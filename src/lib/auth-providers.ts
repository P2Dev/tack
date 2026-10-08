import { z } from "zod";
import type { GenericOAuthConfig } from "better-auth/plugins/generic-oauth";

const providerSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]{1,39}$/).refine(id => !["local", "credential"].includes(id)),
  name: z.string().trim().min(1).max(60),
  issuer: z.string().url(),
  clientId: z.string().min(1),
  clientSecret: z.string().min(1).optional(),
  allowSignUp: z.boolean().default(false),
});
export type IdentityProvider = z.infer<typeof providerSchema>;
export type PublicIdentityProvider = Pick<IdentityProvider, "id" | "name">;

export function readAuthProviders(env: Record<string, string | undefined> = process.env) {
  let raw: unknown;
  try { raw = JSON.parse(env.TACK_OIDC_PROVIDERS || "[]"); }
  catch { throw new Error("TACK_OIDC_PROVIDERS must be a JSON array."); }
  const parsed = z.array(providerSchema).safeParse(raw);
  if (!parsed.success) throw new Error("Check TACK_OIDC_PROVIDERS: each provider needs a unique id, name, issuer and clientId.");
  const providers = parsed.data;
  if (env.COGNITO_ISSUER || env.COGNITO_CLIENT_ID || env.COGNITO_CLIENT_SECRET) {
    const cognito = providerSchema.safeParse({ id: "cognito", name: env.COGNITO_NAME || "Amazon Cognito", issuer: env.COGNITO_ISSUER, clientId: env.COGNITO_CLIENT_ID, clientSecret: env.COGNITO_CLIENT_SECRET || undefined, allowSignUp: env.COGNITO_ALLOW_SIGN_UP === "true" });
    if (!cognito.success) throw new Error("Cognito requires COGNITO_ISSUER and COGNITO_CLIENT_ID.");
    providers.push(cognito.data);
  }
  const seen = new Set<string>();
  for (const provider of providers) {
    if (seen.has(provider.id)) throw new Error("Identity provider IDs must be unique.");
    seen.add(provider.id);
    const issuer = new URL(provider.issuer);
    assertProviderUrl(issuer, env);
    if (issuer.search || issuer.hash) throw new Error("Provider issuers cannot contain query strings or fragments.");
    provider.issuer = issuer.href.replace(/\/$/, "");
  }
  const defaultProvider = env.TACK_AUTH_DEFAULT || "local";
  if (defaultProvider !== "local" && !seen.has(defaultProvider)) throw new Error("TACK_AUTH_DEFAULT must be local or a configured provider ID.");
  return { providers, defaultProvider };
}

function assertProviderUrl(url: URL, env: Record<string, string | undefined>) {
  const localTest = env.NODE_ENV !== "production" && env.TACK_OIDC_ALLOW_LOCAL_HTTP === "true" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.username || url.password || (url.protocol !== "https:" && !(localTest && url.protocol === "http:"))) throw new Error("Identity provider endpoints must use HTTPS.");
}

export function providerConfig(provider: IdentityProvider): GenericOAuthConfig {
  const discoveryUrl = `${provider.issuer}/.well-known/openid-configuration`;
  return {
    providerId: provider.id,
    discoveryUrl,
    issuer: provider.issuer,
    clientId: provider.clientId,
    clientSecret: provider.clientSecret,
    scopes: ["openid", "email", "profile"],
    pkce: true,
    disableSignUp: !provider.allowSignUp,
    overrideUserInfo: false,
    // Better Auth 1.6.25's default can decode an ID token without verifying it.
    // Always obtain identity from the issuer's authenticated UserInfo endpoint.
    async getUserInfo(tokens) {
      if (!tokens.accessToken) return null;
      try {
        const discovery = await fetch(discoveryUrl, { signal: AbortSignal.timeout(10_000), redirect: "error" });
        if (!discovery.ok) return null;
        const metadata = await discovery.json();
        if (metadata.issuer !== provider.issuer || typeof metadata.userinfo_endpoint !== "string") return null;
        const endpoint = new URL(metadata.userinfo_endpoint);
        assertProviderUrl(endpoint, process.env);
        const response = await fetch(endpoint, { headers: { Authorization: `Bearer ${tokens.accessToken}` }, signal: AbortSignal.timeout(10_000), redirect: "error" });
        if (!response.ok) return null;
        const profile = await response.json();
        if (typeof profile.sub !== "string" || !profile.sub || typeof profile.email !== "string" || !z.email().safeParse(profile.email).success || profile.email_verified !== true) return null;
        const name = typeof profile.name === "string" && profile.name.trim() ? profile.name.trim() : profile.email.split("@")[0];
        return { id: profile.sub, name, email: profile.email.toLowerCase(), emailVerified: true };
      } catch { return null; }
    },
  };
}
