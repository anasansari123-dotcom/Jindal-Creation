import { connectDB } from "@/lib/db/connect";
import { Customer, Product, Order, Payment, Dispatch, ConfirmBill, ProductReturn } from "@/lib/models";

export async function generateCustomerId(): Promise<string> {
  await connectDB();
  const lastCustomer = await Customer.findOne()
    .sort({ customerId: -1 })
    .select("customerId");
  if (!lastCustomer) return "JC-CUST-0001";
  const num = parseInt(lastCustomer.customerId.replace("JC-CUST-", ""), 10);
  return `JC-CUST-${String(num + 1).padStart(4, "0")}`;
}

export async function generateProductId(): Promise<string> {
  await connectDB();
  const lastProduct = await Product.findOne()
    .sort({ productId: -1 })
    .select("productId");
  if (!lastProduct) return "JC-PROD-0001";
  const num = parseInt(lastProduct.productId.replace("JC-PROD-", ""), 10);
  return `JC-PROD-${String(num + 1).padStart(4, "0")}`;
}

export async function generateOrderId(): Promise<string> {
  await connectDB();
  const lastOrder = await Order.findOne()
    .sort({ orderId: -1 })
    .select("orderId");
  if (!lastOrder) return "JC-ORD-0001";
  const num = parseInt(lastOrder.orderId.replace("JC-ORD-", ""), 10);
  return `JC-ORD-${String(num + 1).padStart(4, "0")}`;
}

export async function generatePaymentId(): Promise<string> {
  await connectDB();
  const lastPayment = await Payment.findOne()
    .sort({ paymentId: -1 })
    .select("paymentId");
  if (!lastPayment) return "JC-PAY-0001";
  const num = parseInt(lastPayment.paymentId.replace("JC-PAY-", ""), 10);
  return `JC-PAY-${String(num + 1).padStart(4, "0")}`;
}

export async function generateDispatchId(): Promise<string> {
  await connectDB();
  const lastDispatch = await Dispatch.findOne()
    .sort({ dispatchId: -1 })
    .select("dispatchId");
  if (!lastDispatch) return "JC-DSP-0001";
  const num = parseInt(lastDispatch.dispatchId.replace("JC-DSP-", ""), 10);
  return `JC-DSP-${String(num + 1).padStart(4, "0")}`;
}

export async function generateConfirmBillId(): Promise<string> {
  await connectDB();
  const last = await ConfirmBill.findOne()
    .sort({ confirmBillId: -1 })
    .select("confirmBillId");
  if (!last) return "JC-CNF-0001";
  const num = parseInt(last.confirmBillId.replace("JC-CNF-", ""), 10);
  return `JC-CNF-${String(num + 1).padStart(4, "0")}`;
}

export async function generateReturnId(): Promise<string> {
  await connectDB();
  const last = await ProductReturn.findOne()
    .sort({ returnId: -1 })
    .select("returnId");
  if (!last) return "JC-RTN-0001";
  const num = parseInt(last.returnId.replace("JC-RTN-", ""), 10);
  return `JC-RTN-${String(num + 1).padStart(4, "0")}`;
}
