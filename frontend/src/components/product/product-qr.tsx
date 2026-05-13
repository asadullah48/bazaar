"use client";

import { useEffect, useState } from "react";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface QrData {
  qr_code_url: string;
}

export function ProductQr({ productId }: { productId: string }) {
  const [qrData, setQrData] = useState<QrData | null>(null);

  useEffect(() => {
    fetch(`${BASE}/v1/products/${productId}/qr`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.qr_code_url ? setQrData(d) : null)
      .catch(() => null);
  }, [productId]);

  if (!qrData) return null;

  return (
    <div className="flex flex-col items-start gap-1.5">
      <img
        src={qrData.qr_code_url}
        alt="Scan to open product"
        className="w-24 h-24 rounded-lg border border-gray-100 dark:border-gray-800"
      />
      <p className="text-xs text-gray-400">Scan to open</p>
    </div>
  );
}
