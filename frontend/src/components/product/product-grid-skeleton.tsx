export function ProductGridSkeleton({ count = 16 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden animate-pulse"
        >
          <div className="aspect-square bg-gray-100 dark:bg-gray-800" />
          <div className="p-3 space-y-2">
            <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-2/3" />
            <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-full" />
            <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}
