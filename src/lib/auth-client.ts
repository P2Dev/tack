"use client";

import { createAuthClient } from "better-auth/react";
import {
  adminClient,
  genericOAuthClient,
  inferAdditionalFields,
} from "better-auth/client/plugins";

import type { auth } from "@/lib/auth";

export const authClient = createAuthClient({
  plugins: [genericOAuthClient(), adminClient(), inferAdditionalFields<typeof auth>()],
});
