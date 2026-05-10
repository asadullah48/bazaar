export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden animate-pulse"
        >
          <div className="aspect-square bg-gray-100 dark:bg-gray-800" />
          <div className="p-3 space-y-2">
            <div className="h-3 w-1/3 bg-gray-100 dark:bg-gray-800 rounded" />
            <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded" />
            <div className="h-4 w-2/3 bg-gray-100 dark:bg-gray-800 rounded" />
            <div className="flex justify-between items-center pt-1">
              <div className="h-5 w-1/3 bg-gray-100 dark:bg-gray-800 rounded" />
              <div className="h-8 w-8 bg-gray-100 dark:bg-gray-800 rounded-xl" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
