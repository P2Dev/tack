import { authentication } from "@/lib/auth";
import { safeReturnPath } from "@/lib/return-path";
import { redirect } from "next/navigation";

import { SignInForm } from "@/components/sign-in-form";
import { getPageSession } from "@/lib/auth-guards";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ returnTo?: string | string[]; error?: string; providerError?: string }> }) {
  const { returnTo, error, providerError } = await searchParams;
  const destination = safeReturnPath(Array.isArray(returnTo) ? returnTo[0] : returnTo);
  if (await getPageSession()) {
    redirect(destination);
  }

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="sign-in-title">
        <div className="auth-brand">
          <span className="brand-mark" aria-hidden="true">
            <span />
          </span>
          <div>
            <p className="brand-name">Tack</p>
            <p className="brand-subtitle">Team boards</p>
          </div>
        </div>
        <div className="auth-copy">
          <p className="eyebrow">Your team boards</p>
          <h1 id="sign-in-title">Pick up where you left off.</h1>
          <p>
            {authentication.providers.length ? "Sign in with your local account or your organization." : "Sign in with the local account created by your Tack administrator."}
          </p>
        </div>
        <SignInForm returnTo={destination} providers={authentication.providers.map(({ id, name }) => ({ id, name }))} defaultProvider={authentication.defaultProvider} providerError={Boolean(error || providerError)} />
      </section>
      <p className="auth-footnote">
        Need an account or a local password reset? Contact your Tack administrator.
      </p>
    </main>
  );
}
