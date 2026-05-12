"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Zap } from "lucide-react";

interface FlashItem {
  id: string;
  title: string;
  slug: string;
  banner_url: string | null;
  discount_pct: number | null;
  end_at: string;
}

function Countdown({ endAt }: { endAt: string }) {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    function calc() {
      const diff = new Date(endAt).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft("Ended"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    }
    calc();
    const id = setInterval(calc, 1000);
    return () => clearInterval(id);
  }, [endAt]);

  return (
    <span className="font-mono text-sm font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40 px-2 py-0.5 rounded">
      {timeLeft}
    </span>
  );
}

export function FlashDeals({ locale }: { locale: string }) {
  const [items, setItems] = useState<FlashItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    fetch(`${base}/v1/slots/flash`)
      .then((r) => r.json())
      .then((data) => { setItems(data.items ?? []); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, []);

  if (!loaded) return null;
  if (items.length === 0) return null;

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
      <div className="flex items-center gap-3 mb-5">
        <Zap size={20} className="text-orange-500 fill-orange-500" />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Flash Deals</h2>
        <Link
          href={`/${locale}/products?sale=true`}
          className="ms-auto text-sm font-medium text-orange-600 dark:text-orange-400 hover:underline"
        >
          View all
        </Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {items.map((item) => (
          <Link
            key={item.id}
            href={`/${locale}/campaigns/${item.slug}`}
            className="group relative rounded-xl overflow-hidden border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 hover:shadow-md transition-shadow"
          >
            {item.banner_url ? (
              <img
                src={item.banner_url}
                alt={item.title}
                className="w-full aspect-square object-cover group-hover:scale-105 transition-transform duration-300"
              />
            ) : (
              <div className="w-full aspect-square bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center">
                <Zap size={32} className="text-white" />
              </div>
            )}
            {item.discount_pct != null && (
              <span className="absolute top-2 start-2 bg-orange-500 text-white text-xs font-bold px-1.5 py-0.5 rounded">
                -{Math.round(item.discount_pct)}%
              </span>
            )}
            <div className="p-2">
              <p className="text-xs font-medium text-gray-800 dark:text-gray-200 line-clamp-2 leading-tight">
                {item.title}
              </p>
              <div className="mt-1">
                <Countdown endAt={item.end_at} />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
