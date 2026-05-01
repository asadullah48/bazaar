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
          <span className="text-xs font-semibold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-1.5 py-0.5 rounded">
            -{discountPct}%
          </span>
        </>
      )}
    </div>
  );
}
