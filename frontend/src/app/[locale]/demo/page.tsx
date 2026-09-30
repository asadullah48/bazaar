import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { DEMO_MODE } from "@/lib/runtime-mode";
import { DemoWorkbench } from "@/components/demo-workbench";

export const metadata: Metadata = { title: "Marketplace Workbench — ShopUnity", robots: { index: false, follow: false } };
export default async function DemoPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!DEMO_MODE) redirect(`/${locale}/products`);
  return <Suspense fallback={<p className="p-12">Loading workbench…</p>}><DemoWorkbench locale={locale} /></Suspense>;
}
