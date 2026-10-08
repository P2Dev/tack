# Local accounts and organization sign-in

Tack keeps local email/password accounts available by default. Administrators can also configure one or more OpenID Connect providers, including Amazon Cognito User Pools. All providers lead to the same Tack accounts, roles, sessions, and shared boards.

## Cognito User Pools

1. Configure a Cognito User Pool app client and a managed-login domain. Enable the **authorization code** grant and the `openid`, `email`, and `profile` scopes. For a server application, use a confidential app client with a secret.
2. Register the exact Tack callback URL: `https://YOUR-TACK-HOST/api/auth/oauth2/callback/cognito`. For local review, register `http://localhost:3000/api/auth/oauth2/callback/cognito` separately if permitted by your Cognito app-client configuration. Scheme, host, port, and path must match.
3. Copy the pool's exact issuer URL into `COGNITO_ISSUER`. This is the OIDC issuer, usually `https://cognito-idp.REGION.amazonaws.com/POOL_ID`; it is **not** the managed-login domain. Pools using a newer issuer format must use the issuer published by their configuration.
4. Set these server environment variables and restart/recreate the app:

```dotenv
COGNITO_ISSUER=https://cognito-idp.us-east-1.amazonaws.com/us-east-1_EXAMPLE
COGNITO_CLIENT_ID=your-app-client-id
COGNITO_CLIENT_SECRET=your-app-client-secret
COGNITO_NAME=Company sign-in
COGNITO_ALLOW_SIGN_UP=false
TACK_AUTH_DEFAULT=local
```

Set `TACK_AUTH_DEFAULT=cognito` to put the organization button first. The local form remains available. `BETTER_AUTH_URL` and `BETTER_AUTH_TRUSTED_ORIGINS` must describe the actual Tack origin.

With `COGNITO_ALLOW_SIGN_UP=false`, an administrator creates a matching local account in **Team** first. The provider must return the same email and `email_verified: true`. Successful provider sign-in links that identity to the existing account and retains its local password. No email invitation is sent by Tack.

With `COGNITO_ALLOW_SIGN_UP=true`, a verified user accepted by that configured pool can create a Tack account on first sign-in. Such accounts start as members, never administrators. Decide who can join the pool before enabling this: all Tack members can access every board. A local administrator can promote or disable accounts in Team. Provider group claims do not assign Tack roles.

## Other OIDC providers

`TACK_OIDC_PROVIDERS` accepts a JSON array. Each entry has `id`, `name`, `issuer`, `clientId`, optional `clientSecret`, and optional `allowSignUp` (default `false`). IDs must be unique lowercase identifiers, 2–40 characters; `local` and `credential` are reserved.

```dotenv
TACK_OIDC_PROVIDERS='[{"id":"company","name":"Company SSO","issuer":"https://identity.example.com/realms/team","clientId":"tack","clientSecret":"replace-me","allowSignUp":false}]'
TACK_AUTH_DEFAULT=company
```

Register `/api/auth/oauth2/callback/company` for that provider. The issuer must publish discovery metadata and a UserInfo endpoint; Tack requires a stable `sub`, a valid `email`, and boolean `email_verified: true`. A missing name falls back to the email's local part. Configure appropriate provider attributes/scopes if UserInfo omits these fields. Multiple providers can be configured alongside Cognito.

Client secrets stay on the server. The sign-in page receives only provider IDs and display names. Discovery and UserInfo endpoints require HTTPS. The test-only `TACK_OIDC_ALLOW_LOCAL_HTTP=true` escape hatch accepts loopback URLs only outside production and is not forwarded by Compose.

## Session and recovery behavior

- Authorization code flow uses PKCE and state verification. Tack obtains identity from authenticated UserInfo; it does not trust decoded, unverified ID-token claims.
- Verified provider email can link to a pre-created local account. Different emails are not linked. Public local signup stays disabled.
- Callback destinations are restricted to Tack's own board, Team, and sign-in pages. Board, issue, and filter context survives the round trip.
- Failed/cancelled provider login returns to sign-in with an error and the local alternative. A blocked provider does not remove local sign-in.
- Disabled Tack users cannot sign in through either method. Existing role checks still govern administration.
- **Sign out** ends the Tack session. It does not end the Cognito/organization browser SSO session; signing in again may reuse that provider session.
- Team password changes affect the local credential only; provider passwords remain managed by the provider.

## Version and acceptance boundary

Tack currently uses Better Auth **1.6.25**. Its Generic OAuth client method is `signIn.oauth2`, and its callback is `/api/auth/oauth2/callback/:providerId`. Current online Better Auth documentation describes newer APIs and a different callback path. Use the path above for this pinned application and recheck integration behavior when upgrading the auth library.

Local integration tests exercise the installed auth handler against an isolated HTTP test identity provider, including the code exchange, PKCE, cookies, existing-account linking, provisioning, state/replay rejection, disabled accounts, and return-path validation. This does not verify a live AWS tenant. No AWS resources or provider credentials were created in this work.

Before enabling a real provider, verify one provisioned member, one unprovisioned user, one disabled user, the chosen board/issue return link, and local-admin fallback against the actual deployment. Retain a working local administrator account.

References: [AWS federation endpoints](https://docs.aws.amazon.com/cognito/latest/developerguide/federation-endpoints.html), [AWS app-client configuration](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-settings-client-apps.html), [Better Auth Generic OAuth](https://better-auth.com/docs/plugins/generic-oauth). Runtime behavior and callback paths were checked against the installed 1.6.25 implementation.
