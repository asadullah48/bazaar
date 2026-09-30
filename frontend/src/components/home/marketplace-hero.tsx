import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, Layers, PackageCheck, Handshake } from "lucide-react";
import { DEMO_MODE } from "@/lib/runtime-mode";

export function MarketplaceHero({ locale }: { locale: string }) {
  return <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
    <div className="relative overflow-hidden rounded-3xl bg-[#101f2c] text-white p-7 sm:p-12 lg:p-16 grid lg:grid-cols-2 gap-10 items-center">
      <div className="absolute w-96 h-96 rounded-full bg-cyan-500/10 blur-3xl -top-32 -end-32" />
      <div className="relative"><p className="text-xs uppercase tracking-[0.2em] text-cyan-300 font-semibold">Local roots. Larger possibilities.</p>
        <h1 className="mt-5 text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.08]">Find your next<br /><span className="text-orange-400">great purchase.</span><br />Or your next supplier.</h1>
        <p className="mt-6 text-slate-300 leading-relaxed max-w-md">From a single piece to your next wholesale order. Explore Pakistani commerce through one thoughtful marketplace.</p>
        <div className="flex flex-wrap gap-3 mt-8"><Link className="demo-button" href={`/${locale}/products`}>Explore the catalog <ArrowUpRight size={18} /></Link><Link className="demo-button-secondary" href={DEMO_MODE ? `/${locale}/demo` : `/${locale}/rfq/new`}>Source in bulk <Handshake size={18} /></Link></div>
        <div className="mt-8 flex flex-wrap gap-5 text-xs text-slate-300"><span className="flex gap-2 items-center"><Layers size={16} /> Retail + wholesale</span><span className="flex gap-2 items-center"><PackageCheck size={16} /> PKR pricing</span><span>EN / اردو / العربية</span></div>
      </div>
      <div className="relative grid grid-cols-2 gap-4 max-w-md w-full mx-auto lg:ms-auto">
        <div className="rounded-2xl bg-[#eadfd1] p-3 -rotate-3"><Image src="/demo/cotton-bedlinen.svg" alt="Illustration of cotton bed linen" width={320} height={320} priority /><p className="text-gray-800 text-xs font-semibold p-2">Made for everyday living</p></div>
        <div className="rounded-2xl bg-[#d4e7e5] p-3 rotate-3 mt-8"><Image src="/demo/ceramic-dinnerware.svg" alt="Illustration of ceramic dinnerware" width={320} height={320} priority /><p className="text-gray-800 text-xs font-semibold p-2">Thoughtful essentials</p></div>
        <div className="col-span-2 rounded-xl bg-white/5 border border-white/10 p-4 flex justify-between items-center gap-4"><div><p className="text-xs text-cyan-300">THE WHOLESALE WORKBENCH</p><p className="text-sm mt-1">Compare cost. Check MOQ. Make your choice.</p></div><ArrowUpRight className="text-orange-400 shrink-0" /></div>
      </div>
    </div>
  </section>;
}
