import { apiKey } from "@better-auth/api-key";
import { betterAuth } from "better-auth";
import { admin, genericOAuth } from "better-auth/plugins";

import { getDatabase } from "@/lib/database";

import { readAuthProviders, providerConfig } from "@/lib/auth-providers";
import { APIError, createAuthMiddleware } from "better-auth/api";

export const authentication = readAuthProviders();

const trustedOrigins = process.env.BETTER_AUTH_TRUSTED_ORIGINS?.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

export const auth = betterAuth({
  appName: "Tack",
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins,
  database: getDatabase(),
  disabledPaths: ["/api-key/create", "/api-key/update", "/api-key/delete", "/api-key/get", "/api-key/list"],
  onAPIError: { errorURL: "/sign-in" },
  hooks: {
    before: createAuthMiddleware(async context => {
      if (!["/sign-in/oauth2", "/sign-in/social", "/oauth2/link", "/link-social"].includes(context.path)) return;
      for (const key of ["callbackURL", "errorCallbackURL", "newUserCallbackURL"]) {
        const value = context.body?.[key];
        if (value === undefined) continue;
        const base = new URL(process.env.BETTER_AUTH_URL || "http://localhost:3000");
        let valid = false;
        if (typeof value === "string" && !/[\\\r\n]/.test(value) && !value.startsWith("//")) {
          try { const target = new URL(value, base); valid = target.origin === base.origin && ["/", "/team", "/sign-in", "/settings/api-keys"].includes(target.pathname); } catch { /* Reject malformed return URLs. */ }
        }
        if (!valid) throw new APIError("FORBIDDEN", { message: "Choose a Tack return address." });
      }
    }),
  },
  account: { accountLinking: { enabled: true, allowDifferentEmails: false } },
  databaseHooks: {
    user: {
      create: {
        async before(user, context) {
          const path = context?.path ?? "";
          const providerId = context?.params?.providerId ?? context?.params?.id;
          const provider = path.includes("/callback/") ? authentication.providers.find(provider => provider.id === providerId) : undefined;
          if (process.env.TACK_BOOTSTRAP !== "1" && path !== "/admin/create-user" && !provider?.allowSignUp) {
            throw new APIError("FORBIDDEN", { message: "Ask a Tack administrator to create your account first." });
          }
          return { data: { ...user, initials: (user.initials && user.initials !== "?" ? user.initials : "") || user.name.split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase()).join("").slice(0, 3) || "?", color: user.color || "slate" } };
        },
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    disableSignUp: process.env.TACK_BOOTSTRAP !== "1",
    minPasswordLength: 10,
    maxPasswordLength: 128,
  },
  user: {
    additionalFields: {
      initials: {
        type: "string",
        required: true,
        input: true,
        defaultValue: "?",
      },
      color: {
        type: ["rust", "blue", "gold", "green", "slate", "violet"],
        required: true,
        input: true,
        defaultValue: "slate",
      },
    },
  },
  plugins: [
    apiKey({ defaultPrefix: "tack_", defaultKeyLength: 32, enableSessionForAPIKeys: false, keyExpiration: { defaultExpiresIn: 90 * 86400, maxExpiresIn: 90 }, rateLimit: { enabled: true, timeWindow: 60000, maxRequests: 120 } }),
    genericOAuth({ config: authentication.providers.map(providerConfig) }),
    admin({
      defaultRole: "user",
      adminRoles: ["admin"],
    }),
  ],
});

export type AuthSession = typeof auth.$Infer.Session;
