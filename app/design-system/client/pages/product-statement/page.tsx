import { notFound } from "next/navigation";
import { inter } from "@/app/fonts";
import { ClientProductStatementFixture } from "@/components/design-system/client-product-statement-fixture";

export default function ClientProductStatementVisualFixturePage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <div className={inter.variable}><ClientProductStatementFixture /></div>;
}
