import { notFound } from "next/navigation";
import { inter } from "@/app/fonts";
import { ClientDashboardFixture } from "@/components/design-system/client-dashboard-fixture";

export default function ClientDashboardVisualFixturePage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <div className={inter.variable}><ClientDashboardFixture /></div>;
}
