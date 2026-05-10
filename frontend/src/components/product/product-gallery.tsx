"use client";
import { useState } from "react";
import Image from "next/image";
import { ProductImage } from "@/types";
import clsx from "clsx";

export function ProductGallery({
  images,
  name,
}: {
  images: ProductImage[];
  name: string;
}) {
  const sorted = [...images].sort((a, b) =>
    a.is_primary === b.is_primary ? 0 : a.is_primary ? -1 : 1
  );
  const [active, setActive] = useState(0);

  return (
    <div className="flex flex-col gap-3">
      {/* Main image */}
      <div className="relative aspect-square rounded-2xl overflow-hidden bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-800">
        <Image
          src={sorted[active]?.url ?? "https://placehold.co/600x600"}
          alt={sorted[active]?.alt ?? name}
          fill
          priority
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 50vw"
        />
      </div>

      {/* Thumbnails */}
      {sorted.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {sorted.map((img, i) => (
            <button
              key={img.id}
              onClick={() => setActive(i)}
              className={clsx(
                "relative w-16 h-16 flex-shrink-0 rounded-xl overflow-hidden border-2 transition-colors",
                i === active
                  ? "border-orange-500"
                  : "border-transparent hover:border-gray-300 dark:hover:border-gray-600"
              )}
            >
              <Image
                src={img.url}
                alt={img.alt ?? name}
                fill
                className="object-cover"
                sizes="64px"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
