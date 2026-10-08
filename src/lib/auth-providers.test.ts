import { afterEach, describe, expect, it, vi } from "vitest";
import { providerConfig, readAuthProviders } from "@/lib/auth-providers";

afterEach(() => vi.unstubAllGlobals());
describe("provider configuration", () => {
  it("defaults to local and validates explicit providers without exposing credentials", () => {
    expect(readAuthProviders({})).toEqual({ providers: [], defaultProvider: "local" });
    const config = readAuthProviders({ COGNITO_ISSUER: "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_pool", COGNITO_CLIENT_ID: "client", COGNITO_CLIENT_SECRET: "secret" });
    expect(config.defaultProvider).toBe("local");
    expect(config.providers[0].allowSignUp).toBe(false);
    expect(providerConfig(config.providers[0])).toMatchObject({ pkce: true, disableSignUp: true, scopes: ["openid", "email", "profile"] });
    expect(() => readAuthProviders({ COGNITO_CLIENT_ID: "incomplete" })).toThrow("requires");
    expect(() => readAuthProviders({ TACK_AUTH_DEFAULT: "missing" })).toThrow("TACK_AUTH_DEFAULT");
    expect(() => readAuthProviders({ TACK_OIDC_PROVIDERS: "not json" })).toThrow("JSON");
    expect(() => readAuthProviders({ TACK_OIDC_PROVIDERS: JSON.stringify([{ id: "corp", name: "Work", issuer: "http://example.com", clientId: "id" }]) })).toThrow("HTTPS");
  });
  it("trusts verified UserInfo, never an unverified decoded ID-token profile", async () => {
    const config = providerConfig({ id: "corp", name: "Work", issuer: "https://identity.example", clientId: "id", allowSignUp: false });
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ issuer: "https://identity.example", userinfo_endpoint: "https://identity.example/userinfo" }))).mockResolvedValueOnce(new Response(JSON.stringify({ sub: "person-1", email: "Member@example.com", email_verified: true, name: "Member" })));
    vi.stubGlobal("fetch", fetcher);
    expect(await config.getUserInfo!({ accessToken: "access", idToken: "untrusted.payload" })).toMatchObject({ id: "person-1", email: "member@example.com", emailVerified: true });
    expect(fetcher.mock.calls[1][1].headers.Authorization).toBe("Bearer access");
    expect(await config.getUserInfo!({ idToken: "untrusted.payload" })).toBeNull();
  });
  it("rejects unverified email and mismatched discovery issuer", async () => {
    const config = providerConfig({ id: "corp", name: "Work", issuer: "https://identity.example", clientId: "id", allowSignUp: false });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ issuer: "https://wrong.example", userinfo_endpoint: "https://wrong.example/userinfo" }))));
    expect(await config.getUserInfo!({ accessToken: "access" })).toBeNull();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ issuer: "https://identity.example", userinfo_endpoint: "https://identity.example/userinfo" }))).mockResolvedValueOnce(new Response(JSON.stringify({ sub: "person", email: "member@example.com", email_verified: false }))));
    expect(await config.getUserInfo!({ accessToken: "access" })).toBeNull();
  });
});
