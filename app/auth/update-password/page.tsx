"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { PasswordField } from "@/components/auth/password-field";
import { Alert, Button } from "@/components/ui";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ password?: string; confirmPassword?: string }>({});
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    const errors = { password: password.length >= 8 ? undefined : "Use at least 8 characters.", confirmPassword: confirmPassword === password ? undefined : "Passwords do not match." };
    setFieldErrors(errors);
    if (errors.password || errors.confirmPassword) return;
    setSubmitting(true);
    const { error: updateError } = await createSupabaseBrowserClient().auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setSubmitting(false);
      return;
    }
    router.replace("/auth/continue");
    router.refresh();
  }

  return <AuthShell title="Choose a new password" description="Set a new password for your BridgeCart account.">
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {error && <Alert variant="danger" title="Password was not updated">{error}</Alert>}
      <PasswordField label="New password" name="password" autoComplete="new-password" minLength={8} value={password} onChange={(event) => { setPassword(event.target.value); setFieldErrors((current) => ({ ...current, password: undefined })); }} error={fieldErrors.password} hint="Use at least 8 characters." required />
      <PasswordField label="Confirm new password" name="confirmPassword" autoComplete="new-password" value={confirmPassword} onChange={(event) => { setConfirmPassword(event.target.value); setFieldErrors((current) => ({ ...current, confirmPassword: undefined })); }} error={fieldErrors.confirmPassword} required />
      <Button type="submit" loading={submitting} className="w-full">Update password</Button>
    </form>
  </AuthShell>;
}
