"use client";
import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight, CheckCircle2, Package, SlidersHorizontal, Store, ShoppingBag, Download, RotateCcw } from "lucide-react";
import { DEMO_PRODUCTS } from "@/lib/demo-catalog";
import { compareQuotes } from "@/lib/sourcing";
import { useCartStore } from "@/store/cart-store";

const fmt = (value: number) => `PKR ${Math.round(value).toLocaleString("en-PK")}`;
const tabs = [{ id: "sourcing", name: "Wholesale sourcing", icon: SlidersHorizontal }, { id: "seller", name: "Seller operations", icon: Store }, { id: "checkout", name: "Demo checkout", icon: ShoppingBag }];

export function DemoWorkbench({ locale }: { locale: string }) {
  const sp = useSearchParams();
  const router = useRouter();
  const view = tabs.some(t => t.id === sp.get("view")) ? sp.get("view")! : "sourcing";
  const [productIndex, setProductIndex] = useState(0);
  const [quantity, setQuantity] = useState(50);
  const [budget, setBudget] = useState(180000);
  const [maxDays, setMaxDays] = useState(14);
  const [selected, setSelected] = useState<string | null>(null);
  const [approved, setApproved] = useState(false);
  const [stage, setStage] = useState(0);
  const [receipt, setReceipt] = useState<{ id: string; total: number; items: number } | null>(null);
  const [ready, setReady] = useState(false);
  const cart = useCartStore();
  useEffect(() => setReady(true), []);
  const product = DEMO_PRODUCTS[productIndex];
  const quotes = compareQuotes(product.price, quantity, budget, maxDays);
  const chosen = quotes.find(q => q.name === selected && q.eligible);
  const resetDecision = () => { setSelected(null); setApproved(false); };

  function exportBrief() {
    const text = `SHOPUNITY — DEMONSTRATION SOURCING BRIEF\nNo real quote, contract, payment or supplier verification.\n\nProduct: ${product.name}\nQuantity: ${quantity}\nBudget: ${fmt(budget)}\nRequired within: ${maxDays} days\n\n${quotes.map(q => `${q.name}: ${fmt(q.total)} delivered; MOQ ${q.moq}; ${q.days} days; ${q.eligible ? "meets constraints" : "outside constraints"}`).join("\n")}\n\nSelection: ${chosen?.name ?? "None"}\nHuman review: ${approved ? "Approved in simulation" : "Pending"}`;
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const a = document.createElement("a"); a.href = url; a.download = "shopunity-demo-sourcing-brief.txt"; a.click(); URL.revokeObjectURL(url);
  }

  return <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 text-gray-900 dark:text-gray-100">
    <div className="flex flex-wrap justify-between gap-5 items-end"><div><p className="demo-eyebrow">THE MARKETPLACE, IN MOTION</p><h1 className="text-3xl sm:text-4xl font-bold tracking-tight mt-3">A better buying decision<br />starts with a clearer picture.</h1><p className="mt-4 text-gray-500 dark:text-gray-400 max-w-xl">Try three commerce workflows. Everything here is simulated; no account or personal information is needed.</p></div><Link href={`/${locale}/products`} className="text-sm text-cyan-700 dark:text-cyan-400 flex gap-2">Explore products <ArrowUpRight size={18} /></Link></div>
    <nav aria-label="Demo workflows" className="flex flex-wrap gap-2 my-8">{tabs.map(({ id, name, icon: Icon }) => <button key={id} aria-current={view === id ? "page" : undefined} onClick={() => router.replace(`/${locale}/demo?view=${id}`, { scroll: false })} className={`rounded-xl px-4 py-3 flex gap-2 items-center text-sm font-semibold border ${view === id ? "bg-gray-900 dark:bg-cyan-900 text-white border-gray-900" : "border-gray-200 dark:border-gray-700"}`}><Icon size={16} />{name}</button>)}</nav>

    {view === "sourcing" && <div className="grid lg:grid-cols-[300px_1fr] gap-6">
      <section className="demo-panel"><h2 className="font-semibold text-lg">Your buying brief</h2><p className="text-xs text-gray-500 mt-2 mb-6">Change the constraints. Watch the shortlist adapt.</p>
        <label className="demo-label" htmlFor="source-product">Product</label><select id="source-product" className="demo-input" value={productIndex} onChange={e => { setProductIndex(Number(e.target.value)); resetDecision(); }}>{DEMO_PRODUCTS.map((p, i) => <option key={p.id} value={i}>{p.name}</option>)}</select>
        <label className="demo-label mt-5" htmlFor="source-quantity">Quantity · {quantity} units</label><input id="source-quantity" type="range" min="10" max="200" step="10" value={quantity} onChange={e => { setQuantity(Number(e.target.value)); resetDecision(); }} className="w-full accent-orange-500" />
        <label className="demo-label mt-5" htmlFor="source-budget">Total budget (PKR)</label><input id="source-budget" className="demo-input" type="number" min="0" max="10000000" step="1000" value={budget} onChange={e => { setBudget(Math.max(0, Math.min(10000000, Number(e.target.value) || 0))); resetDecision(); }} />
        <label className="demo-label mt-5" htmlFor="source-days">Delivery within</label><select id="source-days" className="demo-input" value={maxDays} onChange={e => { setMaxDays(Number(e.target.value)); resetDecision(); }}><option value="4">4 days</option><option value="7">7 days</option><option value="14">14 days</option></select>
        <p className="text-xs text-gray-500 mt-6 leading-relaxed">Rule-based comparison of sample offers. This demo does not call an AI model or contact suppliers.</p>
      </section>
      <section className="demo-panel"><div className="flex flex-wrap justify-between gap-4 items-center"><div><p className="demo-eyebrow">EXPLAINABLE SHORTLIST</p><h2 className="text-xl font-semibold mt-2">See the complete cost.</h2></div><button onClick={exportBrief} className="text-sm flex gap-2 text-cyan-700 dark:text-cyan-400"><Download size={16} />Export brief</button></div>
        <div className="overflow-x-auto mt-6"><table className="w-full text-sm text-start whitespace-nowrap"><caption className="sr-only">Illustrative supplier quotes including delivery, minimum order and eligibility</caption><thead><tr className="text-xs uppercase text-gray-500 border-b dark:border-gray-700">{["Sample supplier", "Unit price", "Delivered total", "Terms", "Fit"].map(h => <th key={h} className="text-start p-3">{h}</th>)}</tr></thead><tbody>{quotes.map(q => <tr key={q.name} className="border-b border-gray-100 dark:border-gray-800"><td className="p-3"><p className="font-semibold">{q.name}</p><p className="text-xs text-gray-500 mt-1">{q.city}</p></td><td className="p-3">{fmt(q.unitPrice)}</td><td className="p-3 font-semibold">{fmt(q.total)}<p className="text-xs font-normal text-gray-500 mt-1">Includes {fmt(q.delivery)} delivery</p></td><td className="p-3">MOQ {q.moq}<p className="text-xs text-gray-500 mt-1">{q.days} days</p></td><td className="p-3"><button disabled={!q.eligible} onClick={() => { setSelected(q.name); setApproved(false); }} className="rounded-lg px-3 py-2 bg-cyan-50 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300 disabled:bg-gray-100 disabled:text-gray-500 dark:disabled:bg-gray-800">{selected === q.name ? "Selected" : q.eligible ? "Select offer" : "Outside brief"}</button></td></tr>)}</tbody></table></div>
        <div className="mt-6 p-5 bg-gray-50 dark:bg-gray-800/50 rounded-xl"><p className="font-semibold">{quotes.some(q => q.eligible) ? "Best fit: " + quotes.find(q => q.eligible)!.name : "No offers meet your brief."}</p><p className="text-sm text-gray-500 dark:text-gray-400 mt-2">{quotes.some(q => q.eligible) ? "Lowest delivered total among offers that meet your quantity, budget and delivery deadline. Inspect the terms before approving." : "Try increasing your budget or delivery window, or changing the quantity. No unsuitable supplier is selected automatically."}</p></div>
        {chosen && <div className="mt-6 border border-orange-200 dark:border-orange-900 rounded-xl p-5"><h3 className="font-semibold">Human approval checkpoint</h3><p className="text-sm text-gray-500 mt-2">{chosen.name} · {fmt(chosen.total)} · {quantity} units. Review specifications and supplier identity before any real purchase.</p><button className="demo-button mt-4" disabled={approved} onClick={() => setApproved(true)}>{approved ? "Selection approved in simulation" : "Approve demo selection"}<CheckCircle2 size={16} /></button>{approved && <p role="status" className="text-sm text-green-700 dark:text-green-400 mt-3">Demo decision recorded for this session. No purchase order was sent.</p>}</div>}
      </section>
    </div>}

    {view === "seller" && <div className="grid lg:grid-cols-3 gap-6"><section className="demo-panel lg:col-span-2"><p className="demo-eyebrow">SAMPLE ORDER · SU-DEMO-1042</p><h2 className="text-2xl font-semibold mt-3">From order to fulfilment.</h2><p className="text-gray-500 mt-3 text-sm">Advance an illustrative order through its workflow. Status changes remain in memory.</p><ol className="grid sm:grid-cols-4 gap-3 mt-8">{["Confirmed", "Packing", "Shipped", "Delivered"].map((s, i) => <li key={s} className={`rounded-xl border p-4 ${i <= stage ? "border-cyan-300 bg-cyan-50 dark:bg-cyan-950 dark:border-cyan-800" : "border-gray-200 dark:border-gray-700"}`}><span className="text-xs text-gray-500">0{i + 1}</span><p className="font-semibold mt-2">{s}</p></li>)}</ol><div className="flex flex-wrap gap-3 mt-8"><button className="demo-button" disabled={stage === 3} onClick={() => setStage(s => s + 1)}>{stage === 3 ? "Demo order delivered" : `Move to ${["Packing", "Shipped", "Delivered"][stage]}`}<Package size={16} /></button><button className="demo-button-light" onClick={() => setStage(0)}><RotateCcw size={16} />Reset</button></div><p role="status" className="text-sm mt-6 text-gray-500">Current sample status: {["Confirmed", "Packing", "Shipped", "Delivered"][stage]}</p></section><section className="demo-panel"><h2 className="font-semibold text-lg">Inventory attention</h2><p className="text-xs text-gray-500 mt-2">Illustrative stock signals</p>{DEMO_PRODUCTS.filter(p => p.stock_qty < 50).map(p => <div key={p.id} className="border-b dark:border-gray-700 py-5"><p className="font-medium text-sm">{p.name}</p><p className="text-sm text-orange-600 dark:text-orange-400 mt-2">{p.stock_qty} units remaining</p><p className="text-xs text-gray-500 mt-1">Review stock before replenishment.</p></div>)}</section></div>}

    {view === "checkout" && <section className="demo-panel max-w-3xl mx-auto"><p className="demo-eyebrow">NO PAYMENT. NO PERSONAL DATA.</p><h2 className="text-2xl font-semibold mt-3">Try the checkout experience.</h2>{!ready ? <p className="mt-5">Loading cart…</p> : receipt ? <div role="status" className="mt-8"><CheckCircle2 className="text-green-600" size={40} /><h3 className="text-xl font-semibold mt-4">Demo order created</h3><p className="mt-2 text-gray-500">{receipt.id} · {receipt.items} units · {fmt(receipt.total)}</p><p className="mt-4 text-sm">No charge, delivery or actual order occurred. This receipt is a simulation.</p><Link className="demo-button mt-6" href={`/${locale}/products`}>Keep exploring</Link></div> : !cart.items.length ? <div className="py-10"><p className="text-gray-500">Your cart is empty. Add a sample product to start.</p><Link className="demo-button mt-5" href={`/${locale}/products`}>Browse catalog <ArrowUpRight size={16} /></Link></div> : <><div className="divide-y dark:divide-gray-700 mt-6">{cart.items.map(item => <div key={item.product_id} className="py-4 flex justify-between gap-4"><div><p className="font-semibold">{item.name}</p><p className="text-sm text-gray-500 mt-1">{item.quantity} × {fmt(item.price)}</p></div><p>{fmt(item.quantity * item.price)}</p></div>)}</div><div className="border-t dark:border-gray-700 pt-5 mt-3 flex justify-between font-bold"><span>Sample total</span><span>{fmt(cart.totalPrice())}</span></div><p className="text-xs text-gray-500 mt-3">Delivery and taxes are excluded. No payment gateway is connected in demo mode.</p><button className="demo-button mt-6" onClick={() => { setReceipt({ id: `SU-DEMO-${Date.now().toString().slice(-6)}`, total: cart.totalPrice(), items: cart.totalItems() }); cart.clearCart(); }}>Create simulated order <CheckCircle2 size={16} /></button></>}</section>}
    <p className="text-xs text-gray-500 text-center mt-8">Sample scenarios demonstrate product design and workflow logic. Live seller, admin, payment and AI integrations require backend deployment and acceptance testing.</p>
  </div>;
}
