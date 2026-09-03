"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function SignOutButton({ className }: { className?: string }) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string>();

  async function signOut() {
    if (signingOut) return;
    setError(undefined);
    setSigningOut(true);
    const { error: signOutError } = await createSupabaseBrowserClient().auth.signOut();
    if (signOutError) {
      setError("Sign out did not finish. Please try again.");
      setSigningOut(false);
      return;
    }
    router.replace("/auth/login");
    router.refresh();
  }
  return <div><Button variant="outline" loading={signingOut} onClick={() => void signOut()} className={className}>Sign out</Button>{error && <p role="alert" className="mt-2 text-sm font-medium text-danger">{error}</p>}</div>;
}
