interface ProductPriceProps {
  price: number;
  comparePrice?: number | null;
  currency?: string;
  className?: string;
}

export function ProductPrice({
  price,
  comparePrice,
  currency = "PKR",
  className = "",
}: ProductPriceProps) {
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-PK", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(n);

  const discountPct =
    comparePrice && comparePrice > price
      ? Math.round(((comparePrice - price) / comparePrice) * 100)
      : null;

  return (
    <div className={`flex items-center gap-2 flex-wrap ${className}`}>
      <span className="text-lg font-bold text-gray-900 dark:text-white">
        {fmt(price)}
      </span>
      {comparePrice && comparePrice > price && (
        <>
          <span className="text-sm text-gray-400 line-through">
            {fmt(comparePrice)}
          </span>
          <span className="text-xs font-semibold text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-900/30 px-1.5 py-0.5 rounded-md">
            -{discountPct}%
          </span>
        </>
      )}
    </div>
  );
}
