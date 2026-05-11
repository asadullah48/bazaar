"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import Image from "next/image";
import { useCartStore } from "@/store/cart-store";
import { useAuthStore } from "@/store/auth-store";
import { ApiError, checkoutApi, paymentsApi, GatewayConfig, GatewayName } from "@/lib/api";

const GATEWAY_LABELS: Record<string, { label: string; icon: string }> = {
  jazzcash:  { label: "JazzCash",       icon: "🔴" },
  easypaisa: { label: "EasyPaisa",      icon: "🟢" },
  nayapay:   { label: "Naya Pay",       icon: "🔵" },
  meezan:    { label: "Meezan Bank",    icon: "🕌" },
  alfalah:   { label: "Bank Alfalah",   icon: "🏦" },
  checkout:  { label: "Card (Visa/MC)", icon: "💳" },
};

type Step = "cart" | "processing";

export default function CheckoutPage() {
  const locale = useLocale();
  const router = useRouter();
  const { items, totalPrice, clearCart } = useCartStore();
  const { accessToken } = useAuthStore();

  const [step, setStep] = useState<Step>("cart");
  const [gateways, setGateways] = useState<GatewayConfig[]>([]);
  const [selected, setSelected] = useState<GatewayName | "cod">("jazzcash");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Used to auto-submit POST-based gateway forms (JazzCash / Meezan / Alfalah)
  const formRef = useRef<HTMLFormElement>(null);
  const [formAction, setFormAction] = useState("");
  const [formFields, setFormFields] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!accessToken) router.push(`/${locale}/auth/login`);
  }, [accessToken, locale, router]);

  useEffect(() => {
    paymentsApi.gateways().then(setGateways).catch(() => setGateways([]));
  }, []);

  // Auto-submit hidden form once fields are set (form-based gateways)
  useEffect(() => {
    if (formAction && Object.keys(formFields).length > 0 && formRef.current) {
      formRef.current.submit();
    }
  }, [formAction, formFields]);

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-PK", {
      style: "currency",
      currency: "PKR",
      maximumFractionDigits: 0,
    }).format(n);

  async function proceedToPayment() {
    setError("");
    setLoading(true);
    try {
      const res = await checkoutApi.place(accessToken!, {
        items: items.map((i) => ({
          product_id: i.product_id,
          quantity: i.quantity,
          is_b2b: false,
        })),
      });
      clearCart();

      if (selected === "cod") {
        router.push(`/${locale}/payment/success?orders=${res.orders.map((o) => o.id).join(",")}`);
        return;
      }

      setStep("processing");

      const payRes = await paymentsApi.initiate(accessToken!, {
        checkout_session_id: res.checkout_session_id,
        gateway: selected as GatewayName,
        currency: "PKR",
      });

      if (!payRes.success) {
        setError(payRes.error ?? "Payment gateway error");
        setStep("cart");
        return;
      }

      if (payRes.payment_data && payRes.redirect_url) {
        // Form-based gateway: set fields and let the useEffect auto-submit
        setFormAction(payRes.redirect_url);
        setFormFields(payRes.payment_data);
      } else if (payRes.redirect_url) {
        window.location.href = payRes.redirect_url;
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Checkout failed");
      setStep("cart");
    } finally {
      setLoading(false);
    }
  }

  if (items.length === 0 && step === "cart") {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4 gap-4">
        <p className="text-gray-500 dark:text-gray-400">Your cart is empty.</p>
        <button onClick={() => router.push(`/${locale}`)} className="text-orange-500 hover:underline">
          Continue Shopping
        </button>
      </div>
    );
  }

  if (step === "processing") {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-4 text-center">
        <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-600 dark:text-gray-400">Connecting to payment gateway…</p>
        {/* Hidden auto-submit form for POST-based gateways */}
        <form ref={formRef} method="POST" action={formAction} className="hidden">
          {Object.entries(formFields).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Checkout</h1>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      {/* Order summary */}
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl divide-y divide-gray-100 dark:divide-gray-800">
        {items.map((item) => (
          <div key={item.product_id} className="flex items-center gap-4 p-4">
            <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-gray-50 dark:bg-gray-800 flex-shrink-0">
              <Image src={item.image_url} alt={item.name} fill className="object-cover" sizes="56px" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-1">{item.name}</p>
              <p className="text-xs text-gray-400">{item.seller_name} · Qty {item.quantity}</p>
            </div>
            <p className="text-sm font-semibold text-orange-500">{fmt(item.price * item.quantity)}</p>
          </div>
        ))}
      </div>

      {/* Order total */}
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 space-y-3">
        <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
          <span>Subtotal</span>
          <span>{fmt(totalPrice())}</span>
        </div>
        <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
          <span>Shipping</span>
          <span className="text-green-600">Free</span>
        </div>
        <div className="flex justify-between text-base font-bold text-gray-900 dark:text-white border-t border-gray-100 dark:border-gray-800 pt-3">
          <span>Total</span>
          <span className="text-orange-500">{fmt(totalPrice())}</span>
        </div>
      </div>

      {/* Payment method selection */}
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
          Payment Method
        </h2>

        {/* COD — always available */}
        <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
          <input
            type="radio"
            name="gateway"
            value="cod"
            checked={selected === "cod"}
            onChange={() => setSelected("cod")}
            className="accent-orange-500"
          />
          <span className="text-xl">🚚</span>
          <span className="text-sm font-medium text-gray-800 dark:text-gray-200">Cash on Delivery</span>
        </label>

        {/* Active gateway options */}
        {gateways.map((gw) => {
          const meta = GATEWAY_LABELS[gw.name] ?? { label: gw.name, icon: "💰" };
          return (
            <label
              key={gw.name}
              className="flex items-center gap-3 cursor-pointer p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <input
                type="radio"
                name="gateway"
                value={gw.name}
                checked={selected === gw.name}
                onChange={() => setSelected(gw.name as GatewayName)}
                className="accent-orange-500"
              />
              <span className="text-xl">{meta.icon}</span>
              <div className="flex-1">
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{meta.label}</span>
                {gw.environment === "sandbox" && (
                  <span className="ml-2 text-[10px] bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 px-1.5 py-0.5 rounded">
                    sandbox
                  </span>
                )}
              </div>
              <span className="text-xs text-gray-400">{gw.supported_currencies.join(", ")}</span>
            </label>
          );
        })}

        {gateways.length === 0 && (
          <p className="text-xs text-gray-400 pl-3">
            Online payment gateways not yet configured — Cash on Delivery available.
          </p>
        )}
      </div>

      <button
        onClick={proceedToPayment}
        disabled={loading}
        className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-bold py-4 rounded-2xl text-lg transition-colors"
      >
        {loading
          ? "Processing…"
          : selected === "cod"
          ? "Place Order (COD)"
          : `Pay with ${GATEWAY_LABELS[selected]?.label ?? selected}`}
      </button>
    </div>
  );
}
