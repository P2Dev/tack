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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
