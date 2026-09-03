import { BadgeCheck, Image as ImageIcon, Link2, PackageSearch, Scale, ShieldCheck } from "lucide-react";
import { ContentSection, InfoCard, PolicyNote, PublicContentPage } from "@/components/public-site/content-page";

export default function ProductRulesPage() {
  return (
    <PublicContentPage eyebrow="Product links and selection" title="Review the exact product before requesting an estimate." intro="A supported supplier link is the starting point. Product details, variants, availability, and estimate inputs should remain visible and distinct.">
      <ContentSection title="Supported product sources" eyebrow="Start with a link">
        <div className="grid gap-4 sm:grid-cols-3"><InfoCard icon={Link2} title="1688">Wholesale supplier links are supported by the product-resolution flow.</InfoCard><InfoCard icon={PackageSearch} title="Taobao">Taobao supplier links are supported by the product-resolution flow.</InfoCard><InfoCard icon={BadgeCheck} title="Tmall">Tmall links are a supported product source for the public information architecture.</InfoCard></div>
      </ContentSection>

      <ContentSection title="What product information matters" eyebrow="Review before estimating">
        <div className="grid gap-4 sm:grid-cols-2"><InfoCard icon={ImageIcon} title="Product identity">The resolved product can include its original link, source, title, Chinese title, images, category, and provider item identity.</InfoCard><InfoCard icon={Scale} title="Price and delivery">Supplier price and seller-to-China domestic delivery are shown as CNY inputs, separate from the BDT estimate.</InfoCard><InfoCard icon={PackageSearch} title="Exact SKUs">Select returned SKUs with their attributes, prices, and availability where provided.</InfoCard><InfoCard icon={ShieldCheck} title="Quantity and review">Requested quantities are reviewed against returned availability. One confirmed product session may contain multiple SKU lines.</InfoCard></div>
      </ContentSection>

      <PolicyNote title="Unsupported or unresolved links must stop clearly">Unsupported sources return an error. If automatic lookup requires manual review, the product should not be presented as confirmed or silently converted into an estimate.</PolicyNote>

      <ContentSection title="Availability and historical context" eyebrow="When a listing changes">
        <div className="space-y-4 text-sm leading-6 text-muted"><p>If a product becomes unavailable before purchase, the documented operating process allows admin handling such as replacement, cancellation, or refund/credit according to the applicable workflow.</p><p>Product images and supplier snapshots are intended to remain connected to historical order context even if the supplier listing later changes.</p></div>
      </ContentSection>
    </PublicContentPage>
  );
}
