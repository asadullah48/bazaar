"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { formatPrice } from "@/lib/format-price";

interface RecItem {
  id: string;
  title: string;
  slug: string;
  price: number | null;
  image_url: string | null;
}

interface RecommendationsProps {
  productId: string;
  locale: string;
}

export function Recommendations({ productId, locale }: RecommendationsProps) {
  const [items, setItems] = useState<RecItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    fetch(`${base}/v1/recommendations?product_id=${productId}`)
      .then((r) => r.json())
      .then((data) => { setItems(data.items ?? []); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, [productId]);

  if (!loaded || items.length === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
        You may also like
      </h2>
      <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
        {items.map((item) => (
          <Link
            key={item.id}
            href={`/${locale}/products/${item.slug}`}
            className="flex-shrink-0 w-40 group"
          >
            <div className="rounded-xl overflow-hidden border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 hover:shadow-md transition-shadow">
              <div className="aspect-square relative bg-gray-50 dark:bg-gray-800">
                {item.image_url ? (
                  <Image
                    src={item.image_url}
                    alt={item.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                    sizes="160px"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-300 dark:text-gray-600 text-4xl">
                    📦
                  </div>
                )}
              </div>
              <div className="p-2">
                <p className="text-xs font-medium text-gray-800 dark:text-gray-200 line-clamp-2 leading-tight">
                  {item.title}
                </p>
                {item.price != null && (
                  <p className="mt-1 text-sm font-bold text-orange-600 dark:text-orange-400">
                    {formatPrice(item.price, locale as "en" | "ar" | "ur")}
                  </p>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
