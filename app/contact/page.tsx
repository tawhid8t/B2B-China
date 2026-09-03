import { ArrowRight, ClipboardCheck, HelpCircle, Link2, MessageCircle, UserRound } from "lucide-react";
import Link from "next/link";
import { ContentSection, InfoCard, PolicyNote, PublicContentPage } from "@/components/public-site/content-page";
import { buttonClasses } from "@/components/ui/button";

export default function ContactPage() {
  return (
    <PublicContentPage eyebrow="Start or ask a question" title="Bring a supplier link when you are ready to begin." intro="The current public experience starts through the account flow. Direct support destinations and contact-form behavior must be configured by the business before they can be published here.">
      <PolicyNote title="Direct contact details are not configured in this release">No WhatsApp number, email destination, address, or outbound contact form is invented on this page. The account flow remains available for starting a product request.</PolicyNote>

      <ContentSection title="For a product estimate" eyebrow="Available now">
        <div className="grid gap-4 sm:grid-cols-3"><InfoCard icon={UserRound} title="Create an account">Register as a client to enter the protected ordering journey.</InfoCard><InfoCard icon={Link2} title="Have a supplier link ready">Use a 1688, Taobao, or Tmall URL as the starting point.</InfoCard><InfoCard icon={ClipboardCheck} title="Review before deciding">Product details and the server-returned estimate are shown before accept or reject.</InfoCard></div>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row"><Link href="/auth/register" className={buttonClasses({ variant: "primary", size: "lg" })}>Create account <ArrowRight aria-hidden="true" className="h-4 w-4" /></Link><Link href="/auth/login" className={buttonClasses({ variant: "outline", size: "lg" })}>Sign in</Link></div>
      </ContentSection>

      <ContentSection title="When you need help" eyebrow="Prepare useful context">
        <div className="grid gap-4 sm:grid-cols-2"><InfoCard icon={HelpCircle} title="Product-link questions">Keep the original supplier URL and note which product or variant you want reviewed.</InfoCard><InfoCard icon={MessageCircle} title="Manual-review questions">If a provider lookup or product eligibility review cannot complete automatically, use the approved business contact channel once it is configured.</InfoCard></div>
      </ContentSection>

      <PolicyNote title="Contact configuration is a content blocker">Before publishing a WhatsApp CTA, email link, or contact form, the owner must provide the real destination and any approved response expectations.</PolicyNote>
    </PublicContentPage>
  );
}
