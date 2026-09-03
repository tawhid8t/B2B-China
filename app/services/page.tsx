import { Calculator, ClipboardList, Globe2, ShoppingCart, Truck, Warehouse } from "lucide-react";
import { ContentSection, InfoCard, LinkList, NumberedItem, PolicyNote, PublicContentPage } from "@/components/public-site/content-page";

export default function ServicesPage() {
  return (
    <PublicContentPage eyebrow="What BridgeCart is for" title="Sourcing support from supplier link to Bangladesh handoff." intro="BridgeCart is designed for Bangladesh businesses buying from 1688, Taobao, and Tmall without managing every China-side step themselves.">
      <ContentSection title="A focused sourcing workflow" eyebrow="Services at a glance">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <InfoCard icon={Globe2} title="Marketplace sourcing">Start with a supported China marketplace link and review the product information returned for it.</InfoCard>
          <InfoCard icon={Calculator} title="Estimate preparation">Request a server-calculated estimate using product, delivery, exchange, weight, shipping, and profit inputs.</InfoCard>
          <InfoCard icon={ShoppingCart} title="Assisted purchasing">Accepted requests move into an admin-controlled purchasing workflow; supplier payment is not presented as an automatic client action.</InfoCard>
          <InfoCard icon={Warehouse} title="China receiving and QC">The operating model includes receiving supplier parcels, checking pieces and weight, and recording quality results.</InfoCard>
          <InfoCard icon={ClipboardList} title="Repacking and handoffs">Products can move through carton creation, shipping marks, and forwarding handoffs after they meet packing requirements.</InfoCard>
          <InfoCard icon={Truck} title="Forwarding visibility">The workflow is structured to record Guangzhou and Bangladesh delivery stages as the relevant operational work is completed.</InfoCard>
        </div>
      </ContentSection>

      <ContentSection title="What you do first" eyebrow="Client starting point">
        <div className="space-y-5 rounded-card border border-border bg-surface p-5 sm:p-7">
          <NumberedItem number="01" title="Create a client account">Use the existing account flow to enter the protected client workspace.</NumberedItem>
          <NumberedItem number="02" title="Paste a supplier link">Submit a 1688, Taobao, or Tmall link so the product can be resolved and persisted for review.</NumberedItem>
          <NumberedItem number="03" title="Choose variants and quantities">A customer can confirm one product session containing one or more SKU/quantity lines.</NumberedItem>
          <NumberedItem number="04" title="Review before accepting">The estimate displays the server-returned cost breakdown and validity period before acceptance or rejection.</NumberedItem>
        </div>
      </ContentSection>

      <PolicyNote title="Availability follows the documented rollout">Client link resolution, estimate preparation, wallet balance, and payment-proof history are active protected workflows. Reports and other later modules remain unavailable until their backend phases are complete.</PolicyNote>

      <ContentSection title="Continue exploring">
        <LinkList items={[{ label: "How it works", href: "/how-it-works", description: "See each handoff in the sourcing journey." }, { label: "Shipping", href: "/shipping", description: "Understand the inputs behind shipping estimates." }, { label: "Product rules", href: "/product-rules", description: "Review supported links, variants, and availability." }, { label: "Restricted products", href: "/restricted-products", description: "See the current state of public restriction guidance." }]} />
      </ContentSection>
    </PublicContentPage>
  );
}
