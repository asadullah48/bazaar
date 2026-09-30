import Link from "next/link";
import { DEMO_MODE } from "@/lib/runtime-mode";

export function SiteFooter({ locale }: { locale: string }) {
  return <footer className="border-t border-gray-200 dark:border-gray-800 mt-12 bg-gray-50 dark:bg-gray-900/40">
    <div className="max-w-7xl mx-auto px-6 py-10 grid gap-8 sm:grid-cols-3 text-sm text-gray-600 dark:text-gray-400">
      <div><p className="text-xl font-bold text-gray-900 dark:text-white">ShopUnity<span className="text-orange-500">.</span></p><p className="mt-2 max-w-xs">Retail discovery and wholesale sourcing, brought together for Pakistani commerce.</p></div>
      <nav aria-label="Footer" className="flex flex-col gap-3"><Link href={`/${locale}/products`}>Explore catalog</Link>{DEMO_MODE && <Link href={`/${locale}/demo`}>Sourcing & seller workbench</Link>}<a href="https://github.com/asadullah48/bazaar" target="_blank" rel="noopener noreferrer">Source & documentation ↗</a></nav>
      <div><p className="font-semibold text-gray-900 dark:text-white">Built by Asadullah Shafique</p><p className="mt-2">Agentic AI Engineer</p><a className="inline-block mt-3 text-cyan-700 dark:text-cyan-400" href="https://asadullahshafique-devunity.vercel.app/">View portfolio ↗</a><p className="mt-4 text-xs">{DEMO_MODE ? "Demonstration data. Artwork is illustrative. Live commerce requires a configured backend and validated integrations." : "Payment methods and delivery availability depend on the seller and configured providers."}</p></div>
    </div>
  </footer>;
}
