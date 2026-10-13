import type { Metadata } from "next";

import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Tack — lightweight issue tracking",
  description: "A small, low-friction issue board for development teams.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-p2-theme={process.env.TACK_THEME === "cloud" ? "cloud" : undefined}>
      <body>{children}</body>
    </html>
  );
}
