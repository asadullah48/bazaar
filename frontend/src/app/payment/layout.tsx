import type { Metadata } from "next";
import "../globals.css";

export const metadata: Metadata = {
  title: "ShopUnity — Payment",
};

export default function PaymentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased bg-white dark:bg-gray-950">{children}</body>
    </html>
  );
}
