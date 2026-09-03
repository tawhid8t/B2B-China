import type { Metadata } from "next";
import { openSans } from "@/app/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "BridgeCart | China to Bangladesh sourcing",
  description: "Source from 1688, Taobao, and Tmall with a clearer China-to-Bangladesh workflow."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={openSans.variable}>{children}</body>
    </html>
  );
}
