import { Calculator, CheckCircle2, ClipboardCheck, Link2, PackageCheck, ShoppingCart, Truck } from "lucide-react";
import { ContentSection, InfoCard, NumberedItem, PolicyNote, PublicContentPage } from "@/components/public-site/content-page";

export default function HowItWorksPage() {
  return (
    <PublicContentPage eyebrow="The client journey" title="A practical flow from supplier link to delivery." intro="The platform separates the decisions you make from the China-side handoffs that follow, so each stage has a clear next action.">
      <ContentSection title="Six stages, one clear handoff" eyebrow="How ordering works">
        <div className="space-y-5 rounded-card border border-border bg-surface p-5 sm:p-7">
          <NumberedItem number="01" title="Paste a supplier link"><Link2 aria-hidden="true" className="mr-1 inline h-4 w-4 text-commerce-700" />Start with a supported 1688, Taobao, or Tmall URL.</NumberedItem>
          <NumberedItem number="02" title="Select the product"><ClipboardCheck aria-hidden="true" className="mr-1 inline h-4 w-4 text-commerce-700" />Review the returned title, images, category, SKU options, price, and China delivery detail.</NumberedItem>
          <NumberedItem number="03" title="Review the live estimate"><Calculator aria-hidden="true" className="mr-1 inline h-4 w-4 text-commerce-700" />Choose one or more SKU quantities for a single product, then inspect the BDT estimate before confirming.</NumberedItem>
          <NumberedItem number="04" title="Accept or reject"><CheckCircle2 aria-hidden="true" className="mr-1 inline h-4 w-4 text-commerce-700" />Accepting creates the order item for the next review stage; rejecting records the reason in the estimate lifecycle.</NumberedItem>
          <NumberedItem number="05" title="Purchase and receive"><ShoppingCart aria-hidden="true" className="mr-1 inline h-4 w-4 text-commerce-700" />Admin-controlled purchasing is followed by seller shipping and receipt at the China address.</NumberedItem>
          <NumberedItem number="06" title="QC, repack, and forward"><PackageCheck aria-hidden="true" className="mr-1 inline h-4 w-4 text-commerce-700" />Receiving, quality checks, carton work, Guangzhou forwarding, and Bangladesh stages follow the operational status flow.</NumberedItem>
        </div>
      </ContentSection>

      <ContentSection title="What you review before accepting" eyebrow="Estimate checkpoint">
        <div className="grid gap-4 sm:grid-cols-3">
          <InfoCard icon={ClipboardCheck} title="Exact selection">Product, selected SKUs, and requested quantities are kept together for confirmation.</InfoCard>
          <InfoCard icon={Calculator} title="Cost breakdown">The response can include product subtotal, domestic delivery, exchange rate, estimated weight, shipping, Guangzhou delivery, and profit.</InfoCard>
          <InfoCard icon={Truck} title="Validity and caveat">The estimate has a validity period and may change when actual supplier, weight, or courier costs are known.</InfoCard>
        </div>
      </ContentSection>

      <PolicyNote title="The visible stages depend on operational completion">The workflow defines the handoffs and statuses; it does not promise a delivery time, a fixed final cost, or an automatic provider action.</PolicyNote>
    </PublicContentPage>
  );
}
