import { randomUUID } from "node:crypto";
import { CognitoJwtVerifier } from "aws-jwt-verify";
import { getDatabase, withTransaction } from "@/lib/database";

export const cloudManagedUsers = process.env.TACK_COGNITO_MANAGED_USERS === "true";

const issuer = process.env.COGNITO_ISSUER;
const clientId = process.env.COGNITO_CLIENT_ID;
const poolId = issuer && /^https:\/\/cognito-idp\.[a-z0-9-]+\.amazonaws\.com\/([a-z0-9-]+_[A-Za-z0-9]+)$/.exec(issuer)?.[1];
if (cloudManagedUsers && (!poolId || !clientId)) throw new Error("Managed Cloud users require a Cognito pool issuer and client ID.");

const verifier = cloudManagedUsers ? CognitoJwtVerifier.create({ userPoolId: poolId!, tokenUse: "access", clientId: clientId! }) : null;

export async function syncCloudUser(accessToken: string, profile: { sub: string; email: string; name: string }) {
  if (!verifier) return;
  const claims = await verifier.verify(accessToken);
  if (claims.sub !== profile.sub) throw new Error("Cognito UserInfo subject does not match the verified access token.");
  const role = Array.isArray(claims["cognito:groups"]) && claims["cognito:groups"].includes("Admin") ? "admin" : "user";
  const email = profile.email.toLowerCase();
  await withTransaction(async client => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [profile.sub]);
    const linked = await client.query<{ userId: string }>('SELECT "userId" FROM account WHERE "providerId" = $1 AND "accountId" = $2', ["cognito", profile.sub]);
    const byEmail = await client.query<{ id: string }>('SELECT id FROM "user" WHERE LOWER(email) = $1', [email]);
    const userId = linked.rows[0]?.userId ?? byEmail.rows[0]?.id;
    if (linked.rows[0] && byEmail.rows[0] && linked.rows[0].userId !== byEmail.rows[0].id) throw new Error("Cognito email belongs to a different Tack account.");
    if (userId) {
      const subjects = await client.query<{ accountId: string }>('SELECT "accountId" FROM account WHERE "userId" = $1 AND "providerId" = $2', [userId, "cognito"]);
      if (subjects.rows.some(row => row.accountId !== profile.sub)) throw new Error("Tack account is linked to a different Cognito subject.");
      await client.query('UPDATE "user" SET name=$2, email=$3, "emailVerified"=TRUE, role=$4, banned=FALSE, "updatedAt"=NOW() WHERE id=$1', [userId, profile.name, email, role]);
    } else {
      const initials = profile.name.split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase()).join("").slice(0, 3) || "?";
      await client.query('INSERT INTO "user" (id,name,email,"emailVerified","createdAt","updatedAt",role,banned,initials,color) VALUES ($1,$2,$3,TRUE,NOW(),NOW(),$4,FALSE,$5,$6)', [randomUUID(), profile.name, email, role, initials, "slate"]);
    }
  }, getDatabase());
}
