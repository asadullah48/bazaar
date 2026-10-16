"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { useCartStore } from "@/store/cart-store";
import { useAuthStore } from "@/store/auth-store";
import { apiFetch, GatewayConfig, paymentsApi } from "@/lib/api";
import { formatPrice } from "@/lib/format-price";

export default function CheckoutPage() {
  const locale = useLocale();
  const text = (en:string, ar:string, ur:string) => locale === "ar" ? ar : locale === "ur" ? ur : en;
  const {items, updateQty, removeItem, totalPrice, clearCart} = useCartStore();
  const token = useAuthStore(s => s.accessToken);
  const [ready,setReady] = useState(false); const [gateways,setGateways] = useState<GatewayConfig[]>([]);
  const [selected,setSelected] = useState("cod"); const [error,setError] = useState(""); const [busy,setBusy] = useState(false);
  const [order,setOrder] = useState<{checkout_session_id:string; orders:{id:string; total_amount:number}[]} | null>(null);
  const [address,setAddress] = useState({full_name:"",phone:"",address_line1:"",city:""});
  useEffect(() => {setReady(true); paymentsApi.gateways().then(setGateways).catch(() => setError(text("Payment options could not be loaded. Please try again.","تعذر تحميل خيارات الدفع. حاول مرة أخرى.","ادائیگی کے طریقے لوڈ نہیں ہوئے۔ دوبارہ کوشش کریں۔")));}, []);
  const fmt = (n:number) => formatPrice(n, locale as "en"|"ar"|"ur");
  async function json(path:string, init:RequestInit = {}) {
    const response = await apiFetch(path,init); const body = await response.json();
    if (!response.ok) throw new Error(typeof body.detail === "string" ? body.detail : text("Please check your details and try again.","تحقق من بياناتك وحاول مرة أخرى.","تفصیلات درست کریں اور دوبارہ کوشش کریں۔"));
    return body;
  }
  async function submit(e:React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); if(busy || !token) return; setBusy(true); setError("");
    try {
      if(Object.values(address).some(v => !v.trim())) throw new Error(text("Complete every address field.","أكمل جميع حقول العنوان.","پتے کے تمام خانے مکمل کریں۔"));
      let result = order;
      if(!result) {
        if(items.some(i => !i.variant_id)) throw new Error(text("A saved item needs refreshing. Remove it and add it again from its product page.","أحد المنتجات المحفوظة يحتاج للتحديث. احذفه وأضفه من صفحة المنتج.","محفوظ مصنوعہ تازہ کرنا ضروری ہے۔ اسے ہٹا کر دوبارہ شامل کریں۔"));
        const remote = await json("/v1/cart");
        if(remote.items.some((r:{variant_id:string;is_b2b:boolean}) => r.is_b2b || !items.some(i => i.variant_id === r.variant_id))) throw new Error(text("Your account cart differs from this device. Review it before ordering; no order was created.","سلة حسابك تختلف عن هذا الجهاز. راجعها قبل الطلب؛ لم يتم إنشاء طلب.","اکاؤنٹ کی ٹوکری اس آلے سے مختلف ہے۔ آرڈر سے پہلے جائزہ لیں۔"));
        for(const item of items) {
          const existing = remote.items.find((r:{variant_id:string}) => r.variant_id === item.variant_id);
          await json(existing ? `/v1/cart/items/${existing.id}` : "/v1/cart/items",{method:existing ? "PUT" : "POST",body:JSON.stringify({variant_id:item.variant_id,quantity:item.quantity,is_b2b:false})});
        }
        result = await json("/v1/checkout",{method:"POST",body:JSON.stringify({address,payment_method:selected === "checkout" ? "card" : selected})});
        setOrder(result);
      }
      if(selected === "cod") { clearCart(); return; }
      const gw = gateways.find(g => g.name === selected);
      if(!gw || gw.environment !== "sandbox" || selected === "checkout") throw new Error(text("This payment option is unavailable for this phase.","خيار الدفع غير متاح في هذه المرحلة.","ادائیگی کا یہ طریقہ اس مرحلے میں دستیاب نہیں۔"));
      const pay = await paymentsApi.initiate(token,{checkout_session_id:result!.checkout_session_id,gateway:selected as "jazzcash"|"easypaisa",customer_info:{name:address.full_name,phone:address.phone},currency:"PKR"});
      if(!pay.success || !pay.redirect_url) throw new Error(text("Payment could not start. Your order is saved; retry payment below.","تعذر بدء الدفع. طلبك محفوظ؛ أعد المحاولة أدناه.","ادائیگی شروع نہیں ہوئی۔ آرڈر محفوظ ہے؛ دوبارہ کوشش کریں۔"));
      const data = pay.payment_data as unknown as {method?:string;fields?:Record<string,string>};
      if(data?.method === "POST" && data.fields) {
        const form = document.createElement("form"); form.method="POST"; form.action=pay.redirect_url;
        for(const [name,value] of Object.entries(data.fields)){const input=document.createElement("input");input.type="hidden";input.name=name;input.value=String(value);form.appendChild(input);}
        document.body.appendChild(form); form.submit();
      } else window.location.assign(pay.redirect_url);
    } catch(e) {setError(e instanceof Error ? e.message : text("Checkout failed. Please try again.","تعذر إتمام الطلب. حاول مرة أخرى.","آرڈر مکمل نہیں ہوا۔ دوبارہ کوشش کریں۔"));} finally {setBusy(false);}
  }
  if(!ready) return <div role="status" className="p-10">{text("Loading checkout…","جارٍ تحميل الطلب…","آرڈر لوڈ ہو رہا ہے…")}</div>;
  if(order && selected === "cod") return <section className="max-w-3xl mx-auto p-8"><h1 className="text-2xl font-bold">{text("Order received — cash on delivery","تم استلام الطلب — الدفع عند الاستلام","آرڈر موصول — وصولی پر ادائیگی")}</h1>{order.orders.map(o => <Link className="block underline p-3" key={o.id} href={`/${locale}/orders/${o.id}`}>{o.id} · {fmt(o.total_amount)}</Link>)}</section>;
  if(!items.length) return <section className="p-12 text-center"><h1 className="text-2xl font-bold">{text("Your cart is empty","سلتك فارغة","آپ کی ٹوکری خالی ہے")}</h1><Link className="inline-block underline p-4" href={`/${locale}/products`}>{text("Browse products","تصفح المنتجات","مصنوعات دیکھیں")}</Link></section>;
  return <div className="max-w-6xl mx-auto px-4 py-8">
    <ol className="flex gap-4 text-sm mb-8" aria-label={text("Checkout steps","خطوات الطلب","آرڈر کے مراحل")}><li>{text("Cart","السلة","ٹوکری")}</li><li aria-current="step">{text("Address & payment","العنوان والدفع","پتہ اور ادائیگی")}</li><li>{text("Confirmation","التأكيد","تصدیق")}</li></ol>
    <h1 className="text-3xl font-bold mb-6">{text("Checkout","إتمام الطلب","آرڈر مکمل کریں")}</h1>
    {!token && <p role="alert" className="mb-5"><Link className="underline" href={`/${locale}/auth/login`}>{text("Sign in to place your order","سجل الدخول لإتمام الطلب","آرڈر کے لیے سائن ان کریں")}</Link></p>}
    {error && <p role="alert" className="rounded-lg border border-red-300 bg-red-50 text-red-800 p-4 mb-5">{error}</p>}
    <form onSubmit={submit} className="grid lg:grid-cols-[1fr_24rem] gap-8">
      <div className="space-y-6"><fieldset disabled={busy || !!order} className="border rounded-xl p-5"><legend className="font-semibold px-2">{text("Delivery address","عنوان التسليم","ترسیل کا پتہ")}</legend>{([['full_name',text('Full name','الاسم الكامل','پورا نام')],['phone',text('Phone','الهاتف','فون')],['address_line1',text('Street address','عنوان الشارع','مکمل پتہ')],['city',text('City','المدينة','شہر')]] as const).map(([key,label]) => <label key={key} className="block mb-4">{label}<input className="market-input" name={key} type={key === 'phone' ? 'tel' : 'text'} autoComplete={{full_name:'name',phone:'tel',address_line1:'street-address',city:'address-level2'}[key]} required value={address[key]} onChange={e => setAddress({...address,[key]:e.target.value})}/></label>)}</fieldset>
      <fieldset disabled={busy || !!order} className="border rounded-xl p-5 space-y-4"><legend className="font-semibold px-2">{text("Payment method","طريقة الدفع","ادائیگی کا طریقہ")}</legend>
        <label className="flex items-center gap-3"><input type="radio" name="payment" checked={selected === 'cod'} onChange={() => setSelected('cod')}/>{text("Cash on delivery","الدفع عند الاستلام","وصولی پر ادائیگی")}</label>
        {gateways.filter(g => g.name !== 'checkout' && g.environment === 'sandbox').map(g => <label key={g.name} className="flex items-center gap-3"><input type="radio" name="payment" checked={selected === g.name} onChange={() => setSelected(g.name)}/>{g.name} · {text("Sandbox test payment","دفع تجريبي","آزمائشی ادائیگی")}</label>)}
        <p className="text-sm">{text("JazzCash and Easypaisa adapters default to sandbox. Successful test transactions are unverified. Card integration is partial and unavailable here. Live payments are unavailable in this phase.","تكامل JazzCash وEasypaisa افتراضيًا تجريبي. نجاح المعاملات غير مؤكد. تكامل البطاقة جزئي وغير متاح هنا. الدفع الفعلي غير متاح في هذه المرحلة.","JazzCash اور Easypaisa سینڈباکس پر مبنی ہیں۔ کامیاب آزمائشی لین دین غیر تصدیق شدہ ہے۔ کارڈ انضمام جزوی ہے اور یہاں دستیاب نہیں۔ لائیو ادائیگی اس مرحلے میں دستیاب نہیں۔")}</p>
      </fieldset></div>
      <aside className="border rounded-xl p-5 h-fit lg:sticky lg:top-28 space-y-5"><h2 className="text-xl font-semibold">{text("Order summary","ملخص الطلب","آرڈر کا خلاصہ")}</h2>{items.map(i => <div key={i.variant_id ?? i.product_id} className="border-b pb-4"><Link href={`/${locale}/products/${i.slug}`} className="font-medium">{i.name}</Link><p>{fmt(i.price)}</p><label className="block text-sm">{text("Quantity","الكمية","مقدار")}<input aria-label={`${text("Quantity","الكمية","مقدار")} ${i.name}`} className="market-input max-w-24" type="number" min="1" max={i.stock_qty} value={i.quantity} disabled={!!order || busy} onChange={e => updateQty(i.variant_id ?? i.product_id,Number(e.target.value))}/></label><button type="button" disabled={!!order || busy} className="underline text-sm py-2" onClick={() => removeItem(i.variant_id ?? i.product_id)}>{text("Remove","حذف","ہٹائیں")}</button></div>)}<div className="flex justify-between font-semibold"><span>{text("Subtotal","المجموع الفرعي","ذیلی کل")}</span><span>{fmt(totalPrice())}</span></div><p className="text-sm">{text("Shipping and final totals are confirmed when the server creates the order. No delivery date is promised.","تؤكد رسوم الشحن والمجموع النهائي عند إنشاء الطلب. لا يوجد موعد تسليم مضمون.","ترسیل اور حتمی رقم آرڈر بننے پر تصدیق ہوگی۔ ترسیل کی تاریخ کی ضمانت نہیں۔")}</p><button className="market-button w-full" disabled={!token || busy}>{busy ? text("Processing…","جارٍ التنفيذ…","جاری ہے…") : order ? text("Retry payment","إعادة الدفع","ادائیگی دوبارہ کریں") : text("Place order","تأكيد الطلب","آرڈر دیں")}</button></aside>
    </form>
  </div>;
}
