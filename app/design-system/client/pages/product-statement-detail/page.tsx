import { notFound } from "next/navigation";
import { inter } from "@/app/fonts";
import { ClientProductStatementDetailFixture } from "@/components/design-system/client-product-statement-detail-fixture";
export default function ClientProductStatementDetailVisualFixturePage() { if (process.env.NODE_ENV === "production") notFound(); return <div className={inter.variable}><ClientProductStatementDetailFixture /></div>; }
