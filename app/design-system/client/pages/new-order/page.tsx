import { notFound } from "next/navigation";
import { inter } from "@/app/fonts";
import { ClientNewOrderFixture } from "@/components/design-system/client-new-order-fixture";

export default async function ClientNewOrderVisualFixturePage({ searchParams }: { searchParams: Promise<{ scenario?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { scenario } = await searchParams;
  return <div className={inter.variable}><ClientNewOrderFixture scenario={scenario} /></div>;
}
