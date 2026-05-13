// Minimal root layout required by Next.js App Router.
// All locale routes render their full html/body inside [locale]/layout.tsx.
// Payment routes render their full html/body inside payment/layout.tsx.
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
