"use client";

import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import type { PublicIdentityProvider } from "@/lib/auth-providers";
import { signInPath } from "@/lib/return-path";
import { authClient } from "@/lib/auth-client";

export function SignInForm({ returnTo = "/", providers = [], defaultProvider = "local", providerError = false }: { returnTo?: string; providers?: PublicIdentityProvider[]; defaultProvider?: string; providerError?: boolean }) {
  const router = useRouter();
  const [error, setError] = useState(providerError ? "Provider sign-in did not complete. Try again, use a local account, or ask your Tack administrator to check access." : "");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    const form = new FormData(event.currentTarget);
    try {
      const result = await authClient.signIn.email({
        email: String(form.get("email") ?? ""),
        password: String(form.get("password") ?? ""),
        rememberMe: true,
      });

      if (result.error) {
        setError("That email and password did not match.");
        setSubmitting(false);
        return;
      }

      router.replace(returnTo);
      router.refresh();
    } catch {
      setError("Tack could not reach the server. Try again.");
      setSubmitting(false);
    }
  }

  const providerButtons = providers.length ? <div className="provider-sign-in" aria-label="Organization sign-in">
    {providers.map(provider => <button key={provider.id} type="button" className={defaultProvider === provider.id ? "primary-button auth-submit" : "secondary-button auth-submit"} disabled={submitting} onClick={async () => {
      setSubmitting(true); setError("");
      try {
        const result = await authClient.signIn.oauth2({ providerId: provider.id, callbackURL: returnTo, errorCallbackURL: `${signInPath(returnTo)}${signInPath(returnTo).includes("?") ? "&" : "?"}providerError=1` });
        if (result.error) { setError("Provider sign-in is unavailable. Try again or use your local account."); setSubmitting(false); }
      } catch { setError("Could not reach sign-in. Try again or use your local account."); setSubmitting(false); }
    }}>Continue with {provider.name}</button>)}
  </div> : null;

  return (
    <>
    {defaultProvider !== "local" ? providerButtons : null}
    {providers.length ? <h2 className="local-sign-in-heading">Local account</h2> : null}
    <form className="auth-form" onSubmit={handleSubmit}>
      <label>
        <span>Email</span>
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          autoFocus
        />
      </label>
      <label>
        <span>Password</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          minLength={10}
          maxLength={128}
          required
        />
      </label>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <button className="primary-button auth-submit" disabled={submitting}>
        {submitting ? "Signing in…" : "Open the board"}
        {!submitting ? <ArrowRight aria-hidden="true" size={17} /> : null}
      </button>
    </form>
    {defaultProvider === "local" ? providerButtons : null}
    </>
  );
}
