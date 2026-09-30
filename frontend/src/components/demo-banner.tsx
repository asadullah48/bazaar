import Link from "next/link";
import { DEMO_MODE } from "@/lib/runtime-mode";

export function DemoBanner({ locale }: { locale: string }) {
  if (!DEMO_MODE) return null;
  return <div className="bg-cyan-950 text-cyan-50 text-xs px-4 py-3 text-center">
    <strong className="text-cyan-300">Portfolio demo</strong> · Sample products and suppliers. No real payments or orders.
    <Link href={`/${locale}/demo`} className="inline-block ms-3 underline underline-offset-4 font-semibold">Explore the workbench →</Link>
  </div>;
}
