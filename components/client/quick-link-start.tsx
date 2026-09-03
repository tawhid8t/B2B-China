"use client";

import { ArrowRight, Link2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Input } from "@/components/ui";

export function QuickLinkStart() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | undefined>();

  function continueToOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = url.trim();
    if (!value) {
      setError("Paste a supplier product link to continue.");
      return;
    }

    try {
      const parsed = new URL(value);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error("Unsupported protocol");
    } catch {
      setError("Enter a complete product URL, including https://.");
      return;
    }

    setError(undefined);
    router.push(`/client/order/new?url=${encodeURIComponent(value)}`);
  }

  return (
    <form onSubmit={continueToOrder} className="space-y-4">
      <Input
        id="dashboard-supplier-link"
        label="Supplier product link"
        type="url"
        inputMode="url"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        value={url}
        onChange={(event) => { setUrl(event.target.value); if (error) setError(undefined); }}
        placeholder="https://detail.1688.com/..."
        hint="Supported sources: 1688, Taobao, and Tmall."
        error={error}
      />
      <Button type="submit" size="lg" className="w-full sm:w-auto"><Link2 aria-hidden="true" className="h-4 w-4" />Continue with link <ArrowRight aria-hidden="true" className="h-4 w-4" /></Button>
    </form>
  );
}
