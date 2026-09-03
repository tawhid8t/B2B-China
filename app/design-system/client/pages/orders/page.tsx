import { notFound } from "next/navigation";
import { inter } from "@/app/fonts";
import { ClientOrdersFixture } from "@/components/design-system/client-orders-fixture";

export default function ClientOrdersVisualFixturePage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <div className={inter.variable}><ClientOrdersFixture /></div>;
}
