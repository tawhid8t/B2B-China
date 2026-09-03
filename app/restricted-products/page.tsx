import { ClipboardCheck, HelpCircle, ShieldAlert, Tag } from "lucide-react";
import { ContentSection, InfoCard, PolicyNote, PublicContentPage } from "@/components/public-site/content-page";

export default function RestrictedProductsPage() {
  return (
    <PublicContentPage eyebrow="Product restrictions" title="Check product eligibility before you commit to a purchase." intro="Product restrictions belong to the operating rules and review process. This page provides the structure without inventing a banned-product list that is not configured in the current project documentation.">
      <PolicyNote title="No approved public restricted-product list is configured">Do not treat this page as approval for a specific item. A definitive list can be published here when the business supplies and approves the applicable product rules.</PolicyNote>

      <ContentSection title="What to do before submitting a link" eyebrow="Practical checklist">
        <div className="grid gap-4 sm:grid-cols-3"><InfoCard icon={Tag} title="Identify the product">Use a supported marketplace link with enough product detail for review.</InfoCard><InfoCard icon={ClipboardCheck} title="Confirm the exact variant">Keep the selected SKU, attributes, and quantity visible when requesting an estimate.</InfoCard><InfoCard icon={HelpCircle} title="Ask for review when unsure">If the product or link needs manual review, wait for that review instead of assuming it is eligible.</InfoCard></div>
      </ContentSection>

      <ContentSection title="How the platform handles uncertainty" eyebrow="Review boundary">
        <div className="space-y-4 rounded-card border border-border bg-surface p-5 sm:p-7"><div className="flex gap-3"><ShieldAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-warning" /><p className="text-sm leading-6 text-muted">Unsupported links and provider lookup failures return clear error or manual-review states. A client-facing flow should not create fake product data to bypass that boundary.</p></div><div className="flex gap-3"><ClipboardCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-commerce-700" /><p className="text-sm leading-6 text-muted">If availability or suitability changes before purchase, admin handling may include replacement, cancellation, or refund/credit according to the actual workflow and audit requirements.</p></div></div>
      </ContentSection>

      <PolicyNote title="This page is explanatory, not a clearance decision" variant="warning">A product should only proceed when its details and any required operational review have been completed through the protected workflow.</PolicyNote>
    </PublicContentPage>
  );
}
