import { inter } from "@/app/fonts";
import { ClientDesignSystemGallery } from "@/components/design-system/client-gallery";
import { notFound } from "next/navigation";

export default function ClientDesignSystemPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <div className={inter.variable}>
      <ClientDesignSystemGallery />
    </div>
  );
}
