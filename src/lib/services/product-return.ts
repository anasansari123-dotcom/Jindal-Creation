import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { Dispatch, ProductReturn, Customer, ConfirmBill } from "@/lib/models";
import type { IDispatchItem } from "@/lib/models/Dispatch";
import type { IProductReturnItem } from "@/lib/models/ProductReturn";
import type { SessionUser } from "@/lib/auth/session";
import { adjustStock } from "@/lib/services/inventory";
import { generateReturnId } from "@/lib/generators";
import { getPaymentStatus } from "@/lib/utils";
import { logActivity } from "@/lib/activity";
import type { productReturnSchema } from "@/lib/validations/return";
import type { z } from "zod";

type ReturnInput = z.infer<typeof productReturnSchema>;

function itemKey(productId?: unknown, productCode?: string) {
  return productId?.toString() || productCode || "";
}

function computeLineReturnAmount(item: IDispatchItem, returnPieces: number): number {
  const sold = item.pieces || item.quantity || 0;
  if (sold <= 0 || returnPieces <= 0) return 0;
  const ratio = Math.min(returnPieces / sold, 1);
  return Math.round(item.total * ratio * 100) / 100;
}

export async function getReturnedPiecesByProduct(
  dispatchMongoId: string,
  session?: mongoose.ClientSession
) {
  const query = ProductReturn.find({
    dispatchMongoId,
    status: "COMPLETED",
  });
  const priorReturns = session
    ? await query.session(session).lean()
    : await query.lean();

  const map = new Map<string, number>();
  for (const ret of priorReturns) {
    for (const line of ret.items) {
      const key = itemKey(line.productId, line.productCode);
      map.set(key, (map.get(key) || 0) + line.returnPieces);
    }
  }
  return map;
}

export async function getReturnableBillItems(dispatchMongoId: string) {
  await connectDB();
  const dispatch = await Dispatch.findById(dispatchMongoId).lean();
  if (!dispatch) throw new Error("Bill not found");
  if (dispatch.billStatus !== "FINAL" || !dispatch.inventoryDeducted) {
    throw new Error("Sirf Final Bill (stock deducted) par return allowed hai");
  }

  const returnedMap = await getReturnedPiecesByProduct(dispatchMongoId);

  return {
    dispatch: {
      _id: dispatch._id.toString(),
      dispatchId: dispatch.dispatchId,
      finalBillId: dispatch.finalBillId,
      customerId: dispatch.customerId?.toString(),
      customerName: dispatch.customerName,
      customerCode: dispatch.customerCode,
      total: dispatch.total,
      advance: dispatch.advance,
      pending: dispatch.pending,
      paymentStatus: dispatch.paymentStatus,
      returnedAmount: dispatch.returnedAmount || 0,
    },
    items: dispatch.items.map((item) => {
      const key = itemKey(item.productId, item.productCode);
      const soldPieces = item.pieces || item.quantity || 0;
      const alreadyReturned = returnedMap.get(key) || 0;
      return {
        productId: item.productId?.toString(),
        productName: item.productName,
        productCode: item.productCode,
        sellMode: item.sellMode,
        unitPrice: item.unitPrice,
        piecePrice: item.piecePrice,
        piecesPerBox: item.piecesPerBox,
        soldPieces,
        alreadyReturned,
        maxReturnable: Math.max(0, soldPieces - alreadyReturned),
        lineTotal: item.total,
      };
    }),
    priorReturns: await ProductReturn.find({ dispatchMongoId, status: "COMPLETED" })
      .sort({ returnDate: -1 })
      .select("returnId refundAmount returnDate items")
      .lean(),
  };
}

async function syncFinalBillPayment(finalBillId: string, advance: number, total: number) {
  const pending = Math.max(0, total - advance);
  await ConfirmBill.updateOne(
    { confirmBillId: finalBillId },
    { advance, pending, paymentStatus: getPaymentStatus(total, advance) }
  );
}

export async function processProductReturn(input: ReturnInput, user: SessionUser) {
  await connectDB();
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const dispatch = await Dispatch.findById(input.dispatchMongoId).session(session);
    if (!dispatch) throw new Error("Bill not found");
    if (dispatch.billStatus !== "FINAL" || !dispatch.inventoryDeducted) {
      throw new Error("Sirf Final Bill par return process ho sakta hai");
    }

    const returnedMap = await getReturnedPiecesByProduct(dispatch._id.toString(), session);
    const returnLines: IProductReturnItem[] = [];
    let refundAmount = 0;

    for (const req of input.items) {
      const billItem = dispatch.items.find(
        (i) => i.productId?.toString() === req.productId
      );
      if (!billItem) {
        throw new Error(`Product bill me nahi mila: ${req.productId}`);
      }

      const key = itemKey(billItem.productId, billItem.productCode);
      const sold = billItem.pieces || billItem.quantity || 0;
      const alreadyReturned = returnedMap.get(key) || 0;
      const maxReturnable = sold - alreadyReturned;

      if (req.returnPieces > maxReturnable + 0.0001) {
        throw new Error(
          `${billItem.productName}: max ${maxReturnable} return ho sakta hai (${alreadyReturned} pehle return ho chuka)`
        );
      }

      const lineReturnAmount = computeLineReturnAmount(billItem, req.returnPieces);
      refundAmount += lineReturnAmount;

      returnLines.push({
        productId: billItem.productId,
        productName: billItem.productName,
        productCode: billItem.productCode,
        soldPieces: sold,
        returnPieces: req.returnPieces,
        sellMode: billItem.sellMode,
        unitPrice: billItem.unitPrice,
        lineReturnAmount,
        reason: req.reason,
      });

      returnedMap.set(key, alreadyReturned + req.returnPieces);
    }

    refundAmount = Math.round(refundAmount * 100) / 100;
    if (refundAmount <= 0) {
      throw new Error("Return amount zero hai — quantity check karein");
    }

    if (input.refundMethod === "credit" && !dispatch.customerId) {
      throw new Error("Account credit ke liye customer linked hona chahiye");
    }

    const returnId = await generateReturnId();

    for (const line of returnLines) {
      if (!line.productId) continue;
      await adjustStock(line.productId.toString(), "RETURN", line.returnPieces, user, {
        orderId: returnId,
        notes: `Return from bill ${dispatch.finalBillId || dispatch.dispatchId} — ${line.productName}`,
        session,
      });
    }

    const newTotal = Math.max(0, Math.round((dispatch.total - refundAmount) * 100) / 100);
    const newSubtotal = Math.max(0, Math.round((dispatch.subtotal - refundAmount) * 100) / 100);
    const pendingReduction = Math.min(refundAmount, dispatch.pending);
    let creditAdded = 0;
    let newAdvance = dispatch.advance;
    let newPending = Math.max(0, Math.round((dispatch.pending - pendingReduction) * 100) / 100);

    const paidExcess = refundAmount - pendingReduction;
    if (paidExcess > 0) {
      newAdvance = Math.max(0, Math.round((dispatch.advance - paidExcess) * 100) / 100);
      if (input.refundMethod === "credit" && dispatch.customerId) {
        creditAdded = paidExcess;
      } else if (input.refundMethod === "cash") {
        creditAdded = 0;
      } else {
        newPending = Math.max(0, Math.round((newTotal - newAdvance) * 100) / 100);
      }
    }

    dispatch.subtotal = newSubtotal;
    dispatch.total = newTotal;
    dispatch.currentBillAmount = Math.max(
      0,
      Math.round(((dispatch.currentBillAmount ?? dispatch.subtotal) - refundAmount) * 100) / 100
    );
    dispatch.advance = newAdvance;
    dispatch.pending = newPending;
    dispatch.paymentStatus = getPaymentStatus(newTotal, newAdvance);
    dispatch.returnedAmount = Math.round(((dispatch.returnedAmount || 0) + refundAmount) * 100) / 100;

    if (!dispatch.statusHistory) dispatch.statusHistory = [];
    dispatch.statusHistory.push({
      status: "COMPLETED",
      billStatus: "FINAL",
      date: new Date(),
      note: `Return ${returnId}: ₹${refundAmount.toLocaleString("en-IN")} (${returnLines.length} item)`,
      byName: user.name,
    });

    await dispatch.save({ session });

    if (dispatch.finalBillId) {
      await syncFinalBillPayment(dispatch.finalBillId, newAdvance, newTotal);
    }

    if (creditAdded > 0 && dispatch.customerId) {
      await Customer.findByIdAndUpdate(
        dispatch.customerId,
        { $inc: { creditBalance: creditAdded } },
        { session }
      );
    }

    const [productReturn] = await ProductReturn.create(
      [
        {
          returnId,
          dispatchMongoId: dispatch._id,
          dispatchId: dispatch.dispatchId,
          finalBillId: dispatch.finalBillId,
          customerId: dispatch.customerId,
          customerName: dispatch.customerName,
          customerCode: dispatch.customerCode,
          items: returnLines,
          refundAmount,
          refundMethod: input.refundMethod,
          refundMethodDetail: input.refundMethodDetail,
          status: "COMPLETED",
          notes: input.notes,
          returnDate: input.returnDate || new Date(),
          processedBy: user.id,
          processedByName: user.name,
        },
      ],
      { session }
    );

    await session.commitTransaction();

    await logActivity(
      user,
      "Product Return",
      `${returnId}: ₹${refundAmount.toLocaleString("en-IN")} from ${dispatch.finalBillId || dispatch.dispatchId}`,
      returnId,
      "ProductReturn"
    );

    return productReturn;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}
