import {
  formatAvailableStockFromPieces,
  formatAvailableStockBoxCell,
  formatAvailableStockPieceCell,
  formatAvailableStockUnit,
} from "@/lib/stock-display";

interface StockSplitProps {
  pieces: number;
  piecesPerBox: number;
  className?: string;
}

/** Available stock — box and piece shown separately; zero side hidden */
export function StockSplitCells({ pieces, piecesPerBox, className = "" }: StockSplitProps) {
  const stock = formatAvailableStockFromPieces(pieces, piecesPerBox);

  if (stock.mode === "empty") {
    return <span className={`text-red-600 text-xs font-medium ${className}`}>Out of Stock</span>;
  }

  if (stock.mode === "box") {
    return (
      <span className={`text-sm font-semibold text-navy ${className}`}>
        {stock.fullBoxes} Box{stock.fullBoxes !== 1 ? "es" : ""}
      </span>
    );
  }

  if (stock.mode === "piece") {
    return (
      <span className={`text-sm font-semibold text-navy ${className}`}>
        {stock.loosePieces} Pc{stock.loosePieces !== 1 ? "s" : ""}
      </span>
    );
  }

  return (
    <div className={`flex flex-col gap-0.5 text-xs ${className}`}>
      <span className="font-semibold text-navy">{stock.fullBoxes} Box</span>
      <span className="font-medium text-gold">+ {stock.loosePieces} Pc</span>
    </div>
  );
}

export function AvailableStockTableCells({
  pieces,
  piecesPerBox,
}: {
  pieces: number;
  piecesPerBox: number;
}) {
  const stock = formatAvailableStockFromPieces(pieces, piecesPerBox);
  return {
    unit: stock.unit,
    boxCell: stock.boxCell,
    pieceCell: stock.pieceCell,
    summary: stock.summary,
  };
}

export { formatAvailableStockUnit, formatAvailableStockBoxCell, formatAvailableStockPieceCell };

export function RateSplitCells({
  boxPrice,
  piecePrice,
  piecesPerBox,
}: {
  boxPrice: number;
  piecePrice: number;
  piecesPerBox: number;
}) {
  return (
    <div className="flex flex-col gap-0.5 text-xs">
      <span className="font-medium text-navy">
        ₹{boxPrice.toLocaleString("en-IN")}/Box
      </span>
      {piecesPerBox > 1 && (
        <span className="text-gray-500">
          ₹{piecePrice.toLocaleString("en-IN")}/Pc
        </span>
      )}
    </div>
  );
}
