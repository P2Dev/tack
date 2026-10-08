import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.E2E_PORT || 3100);
const baseURL = `http://127.0.0.1:${port}`;

const e2eDatabaseUrl =
  process.env.E2E_DATABASE_URL ??
  "postgresql://tack:tack@127.0.0.1:54329/tack";
const schemaDatabaseUrl = new URL(e2eDatabaseUrl);
schemaDatabaseUrl.searchParams.set(
  "options",
  "-c search_path=tack_playwright",
);

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  webServer: {
    command:
      `pnpm test:e2e:prepare && pnpm dev --hostname 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    env: {
      DATABASE_URL: schemaDatabaseUrl.toString(),
      E2E_DATABASE_URL: e2eDatabaseUrl,
      E2E_ADMIN_PASSWORD: "admin-password-123",
      BETTER_AUTH_SECRET: "playwright-secret-must-be-at-least-32-characters",
      BETTER_AUTH_URL: baseURL,
      BETTER_AUTH_TRUSTED_ORIGINS: baseURL,
      TACK_AUTH_DEFAULT: "local",
      TACK_OIDC_PROVIDERS: JSON.stringify([{ id: "test-sso", name: "Test organization", issuer: "https://identity.example.test", clientId: "browser-test" }]),
      COGNITO_ISSUER: "",
      COGNITO_CLIENT_ID: "",
      COGNITO_CLIENT_SECRET: "",
    },
    stdout: "pipe",
    stderr: "pipe",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] },
    },
  ],
});
