"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, Headphones, LockKeyhole, Mail } from "lucide-react";
import { type FormEvent, type ReactNode, Suspense, useState } from "react";
import { PasswordField } from "@/components/auth/password-field";
import { Alert, Button, Input, LoadingState } from "@/components/ui";
import { dashboardPathByRole, isUserRole, roleCanAccessPath } from "@/lib/auth/roles";
import { safePostLoginPath } from "@/lib/auth/safe-redirect";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LoginPage() {
  return <Suspense fallback={<LoginPresentation><LoadingState label="Preparing sign in" /></LoginPresentation>}><LoginForm /></Suspense>;
}

function LoginPresentation({ children }: { children: ReactNode }) {
  return <main className="auth-theme min-h-[100dvh] overflow-x-hidden bg-canvas text-foreground">
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-form flex-col px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(3.5rem,env(safe-area-inset-top))] sm:px-6 sm:pb-[max(3rem,env(safe-area-inset-bottom))] sm:pt-[max(4.5rem,env(safe-area-inset-top))]">
      <header className="text-center">
        <Link href="/" className="focus-ring inline-block rounded-control px-1 py-1 text-[2rem] font-bold tracking-[-0.055em] text-foreground sm:text-[2.25rem]">
          BridgeCart
        </Link>
        <p className="mt-1 text-xs font-semibold tracking-tight text-success sm:text-sm">Sourcing. Fulfillment. Delivered.</p>
      </header>
      <section className="mt-[clamp(3.5rem,10vh,6.5rem)]">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-[1.75rem]">Welcome back</h1>
        <p className="mt-2 max-w-sm text-sm leading-5 text-muted sm:text-base">Sign in to manage your sourcing and fulfillment with confidence.</p>
        <div className="mt-8">{children}</div>
      </section>
    </div>
  </main>;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState<string>();
  const [passwordError, setPasswordError] = useState<string>();
  const [error, setError] = useState<string>();
  const [attempted, setAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const next = safePostLoginPath(searchParams.get("next"));

  function validate(form: HTMLFormElement) {
    const emailField = form.elements.namedItem("email");
    const passwordField = form.elements.namedItem("password");
    const nextEmailError = emailField instanceof HTMLInputElement
      ? emailField.validity.valueMissing ? "Enter your email address." : emailField.validity.typeMismatch ? "Enter a valid email address." : undefined
      : "Enter your email address.";
    const nextPasswordError = passwordField instanceof HTMLInputElement && passwordField.validity.valueMissing ? "Enter your password." : undefined;
    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);
    return !nextEmailError && !nextPasswordError;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAttempted(true);
    setError(undefined);
    if (!validate(event.currentTarget)) return;
    setSubmitting(true);
    const supabase = createSupabaseBrowserClient();
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (signInError) {
      setError("Invalid email or password.");
      setSubmitting(false);
      return;
    }
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, status")
      .eq("id", signInData.user.id)
      .maybeSingle();
    if (profileError || !profile || profile.status !== "active" || !isUserRole(profile.role)) {
      await supabase.auth.signOut();
      setError("Account profile missing or inactive. Contact an administrator.");
      setSubmitting(false);
      return;
    }
    router.replace(next && roleCanAccessPath(profile.role, next) ? next : dashboardPathByRole[profile.role]);
  }

  return <LoginPresentation>
    <form onSubmit={onSubmit} noValidate className="space-y-5" aria-describedby={error ? "sign-in-error" : undefined}>
      {error && <Alert variant="danger" title="Sign in was not completed"><span id="sign-in-error">{error}</span></Alert>}
      <Input label="Email" name="email" type="email" autoComplete="email" placeholder="you@example.com" startAdornment={<Mail className="h-5 w-5" />} value={email} onChange={(event) => { setEmail(event.target.value); setEmailError(undefined); setError(undefined); }} error={attempted ? emailError : undefined} required />
      <PasswordField label="Password" name="password" autoComplete="current-password" placeholder="Enter your password" startAdornment={<LockKeyhole className="h-5 w-5" />} value={password} onChange={(event) => { setPassword(event.target.value); setPasswordError(undefined); setError(undefined); }} error={attempted ? passwordError : undefined} required />
      <Button type="submit" loading={submitting} className="w-full">Sign in</Button>
      <div className="flex justify-center"><Link href="/auth/forgot-password" className="focus-ring rounded-control px-1 py-1 text-sm font-semibold text-success underline underline-offset-4 hover:text-action-primary">Forgot password?</Link></div>
    </form>
    <Link href="/contact" className="focus-ring mt-6 flex min-h-[4.5rem] items-center gap-3 rounded-card border border-border bg-surface px-3.5 py-3 shadow-sm transition-colors hover:border-action-primary/30 hover:bg-surface-muted">
      <Headphones aria-hidden="true" className="h-6 w-6 shrink-0 text-accent-mint" />
      <span className="min-w-0 flex-1 text-left">
        <span className="block text-sm font-semibold text-foreground">Need help?</span>
        <span className="block text-xs text-muted">Contact our support team</span>
      </span>
      <ChevronRight aria-hidden="true" className="h-5 w-5 shrink-0 text-muted" />
    </Link>
    <p className="mt-5 text-center text-xs text-muted">New to BridgeCart? <Link href="/auth/register" className="focus-ring rounded-control font-semibold text-action-primary underline underline-offset-4">Create a client account</Link></p>
  </LoginPresentation>;
}
