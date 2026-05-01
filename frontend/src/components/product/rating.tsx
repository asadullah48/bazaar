import { Star } from "lucide-react";

interface RatingProps {
  value: number | null | undefined;
  count?: number;
  size?: number;
}

export function Rating({ value, count, size = 14 }: RatingProps) {
  if (!value) return null;
  const stars = Math.round(value * 2) / 2; // round to 0.5

  return (
    <div className="flex items-center gap-1">
      <div className="flex">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            size={size}
            className={
              i <= stars
                ? "fill-amber-400 text-amber-400"
                : "fill-gray-200 text-gray-200 dark:fill-gray-700 dark:text-gray-700"
            }
          />
        ))}
      </div>
      {count !== undefined && (
        <span className="text-xs text-gray-500 dark:text-gray-400">
          ({count})
        </span>
      )}
    </div>
  );
}
