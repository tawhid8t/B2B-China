"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { Alert, Button, Input } from "@/components/ui";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string>();
  const [error, setError] = useState<string>();
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    const emailField = event.currentTarget.elements.namedItem("email");
    if (!(emailField instanceof HTMLInputElement) || !emailField.validity.valid) {
      setEmailError(emailField instanceof HTMLInputElement && emailField.validity.typeMismatch ? "Enter a valid email address." : "Enter your email address.");
      return;
    }
    setEmailError(undefined);
    setSubmitting(true);
    const { error: resetError } = await createSupabaseBrowserClient().auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/auth/callback?next=/auth/update-password` });
    if (resetError) setError(resetError.message);
    else setSubmitted(true);
    setSubmitting(false);
  }

  return <AuthShell title="Reset your password" description="We will send a secure reset link to your account email." footer={<Link href="/auth/login" className="font-semibold text-action-primary underline underline-offset-4">Back to sign in</Link>}>
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {error && <Alert variant="danger" title="Reset link could not be sent">{error}</Alert>}
      {submitted && <Alert variant="success" title="Check your email">If an account exists for this address, a reset link is on its way.</Alert>}
      <Input label="Email address" name="email" type="email" autoComplete="email" value={email} onChange={(event) => { setEmail(event.target.value); setEmailError(undefined); setError(undefined); }} error={emailError} required />
      <Button type="submit" loading={submitting} disabled={submitted} className="w-full">Send reset link</Button>
    </form>
  </AuthShell>;
}
