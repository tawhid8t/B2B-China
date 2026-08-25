import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BridgeCart Operations",
  description: "Cross-border sourcing and fulfillment platform for China to Bangladesh buying operations."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
