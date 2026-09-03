import { Calculator, ClipboardCheck, Scale, ShipWheel, Truck, Warehouse } from "lucide-react";
import { ContentSection, InfoCard, NumberedItem, PolicyNote, PublicContentPage } from "@/components/public-site/content-page";

export default function ShippingPage() {
  return (
    <PublicContentPage eyebrow="Shipping and forwarding" title="Shipping is planned from the operational inputs available at the time." intro="The platform keeps shipping-related inputs visible in the estimate and tracks the handoffs that happen after a product is purchased and received.">
      <ContentSection title="Shipping inputs in an estimate" eyebrow="No public rate table">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <InfoCard icon={Scale} title="Estimated weight">The estimate uses an estimated unit and total weight until actual receiving weight is recorded.</InfoCard>
          <InfoCard icon={Calculator} title="Category shipping">Category-based international shipping is one of the estimate inputs. Public per-kilogram values are not published here.</InfoCard>
          <InfoCard icon={Truck} title="China to Guangzhou">The estimate can include the China-address-to-Guangzhou forwarding amount based on configured operational settings.</InfoCard>
        </div>
      </ContentSection>

      <PolicyNote title="Specific shipping fees are not configured for public display">This page intentionally publishes the calculation structure, not fabricated per-kg numbers or a universal fee promise. The estimate response is the source for a particular product request.</PolicyNote>

      <ContentSection title="The shipping journey" eyebrow="After purchase">
        <div className="space-y-5 rounded-card border border-border bg-surface p-5 sm:p-7">
          <NumberedItem number="01" title="Seller ships to the China address">Seller tracking information is recorded when it becomes available; one order item may have one or more seller tracking numbers.</NumberedItem>
          <NumberedItem number="02" title="Parcel is received and checked"><Warehouse aria-hidden="true" className="mr-1 inline h-4 w-4 text-commerce-700" />Staff record pieces, package weight, QC status, notes, and photos where needed.</NumberedItem>
          <NumberedItem number="03" title="Eligible products are packed"><ClipboardCheck aria-hidden="true" className="mr-1 inline h-4 w-4 text-commerce-700" />Packing requires receipt, confirmed pieces, recorded weight, and passed or admin-approved QC.</NumberedItem>
          <NumberedItem number="04" title="Carton moves toward Guangzhou"><ShipWheel aria-hidden="true" className="mr-1 inline h-4 w-4 text-commerce-700" />Each carton sent to Guangzhou receives a domestic courier tracking number, entered manually or through the supported tracking workflow.</NumberedItem>
          <NumberedItem number="05" title="Bangladesh arrival and pickup readiness">Admin can update the later arrival stages and notify the client when goods are ready for pickup.</NumberedItem>
        </div>
      </ContentSection>

      <ContentSection title="Why an estimate can change" eyebrow="Important context">
        <div className="grid gap-4 sm:grid-cols-3"><InfoCard icon={Calculator} title="Supplier payment">The actual paid supplier amount can differ from the estimate.</InfoCard><InfoCard icon={Scale} title="Actual weight">Receiving weight can replace the estimated weight used for planning.</InfoCard><InfoCard icon={Truck} title="Courier cost">Domestic forwarding and courier details may be recorded after the estimate.</InfoCard></div>
      </ContentSection>
    </PublicContentPage>
  );
}
