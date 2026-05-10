import Link from "next/link";
import { Home, SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 text-center">
      <SearchX size={64} className="text-gray-200 dark:text-gray-700 mb-6" />
      <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
        404
      </h1>
      <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-sm">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Link
        href="/"
        className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2.5 px-6 rounded-xl transition-colors"
      >
        <Home size={16} />
        Back to Home
      </Link>
    </div>
  );
}
