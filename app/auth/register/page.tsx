"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { PasswordField } from "@/components/auth/password-field";
import { Alert, Button, Input } from "@/components/ui";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ fullName?: string; email?: string; password?: string; confirmPassword?: string }>({});
  const [error, setError] = useState<string>();
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function validate(form: HTMLFormElement) {
    const emailField = form.elements.namedItem("email");
    const errors = {
      fullName: fullName.trim() ? undefined : "Enter your full name.",
      email: emailField instanceof HTMLInputElement && emailField.validity.typeMismatch ? "Enter a valid email address." : email.trim() ? undefined : "Enter your email address.",
      password: password.length >= 8 ? undefined : "Use at least 8 characters.",
      confirmPassword: confirmPassword === password ? undefined : "Passwords do not match."
    };
    setFieldErrors(errors);
    return !Object.values(errors).some(Boolean);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    if (!validate(event.currentTarget)) return;
    setSubmitting(true);
    const { error: signUpError } = await createSupabaseBrowserClient().auth.signUp({ email: email.trim(), password, options: { data: { full_name: fullName.trim() }, emailRedirectTo: `${window.location.origin}/auth/callback` } });
    if (signUpError) setError(signUpError.message);
    else setSubmitted(true);
    setSubmitting(false);
  }

  return <AuthShell title="Create a client account" description="Start your China-to-Bangladesh sourcing workflow." footer={<span>Already registered? <Link href="/auth/login" className="font-semibold text-action-primary underline underline-offset-4">Sign in</Link></span>}>
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {error && <Alert variant="danger" title="Account could not be created">{error}</Alert>}
      {submitted && <Alert variant="success" title="Check your email">Use the confirmation link we sent to activate your account.</Alert>}
      <Input label="Full name" name="fullName" autoComplete="name" value={fullName} onChange={(event) => { setFullName(event.target.value); setFieldErrors((current) => ({ ...current, fullName: undefined })); }} error={fieldErrors.fullName} required />
      <Input label="Email address" name="email" type="email" autoComplete="email" value={email} onChange={(event) => { setEmail(event.target.value); setFieldErrors((current) => ({ ...current, email: undefined })); }} error={fieldErrors.email} required />
      <PasswordField label="Password" name="password" autoComplete="new-password" minLength={8} value={password} onChange={(event) => { setPassword(event.target.value); setFieldErrors((current) => ({ ...current, password: undefined, confirmPassword: undefined })); }} error={fieldErrors.password} hint="Use at least 8 characters." required />
      <PasswordField label="Confirm password" name="confirmPassword" autoComplete="new-password" value={confirmPassword} onChange={(event) => { setConfirmPassword(event.target.value); setFieldErrors((current) => ({ ...current, confirmPassword: undefined })); }} error={fieldErrors.confirmPassword} required />
      <Button type="submit" loading={submitting} disabled={submitted} className="w-full">Create account</Button>
    </form>
  </AuthShell>;
}
