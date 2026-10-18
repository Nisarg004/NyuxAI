import { test, after } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { authTokens, users } from "@/lib/db/schema";
import { consumeMagicLink, requestMagicLink } from "@/lib/auth/magic-link";
import { generateToken, hashToken } from "@/lib/auth/tokens";

after(async () => {
  await db.$client.end();
});

async function makeUser() {
  const email = `auth-test+${Date.now()}-${Math.random().toString(36).slice(2)}@brieff.invalid`;
  const [user] = await db.insert(users).values({ email, name: "Auth Test" }).returning();
  return user;
}

async function makeToken(email: string, opts: { expiresInMs?: number } = {}) {
  const token = generateToken();
  await db.insert(authTokens).values({
    tokenHash: hashToken(token),
    email,
    expiresAt: new Date(Date.now() + (opts.expiresInMs ?? 60_000)),
  });
  return token;
}

test("a sign-in token works exactly once and verifies the email", async () => {
  const user = await makeUser();
  try {
    const token = await makeToken(user.email);

    const [first, second] = await Promise.all([consumeMagicLink(token), consumeMagicLink(token)]);
    assert.deepEqual([first, second].filter(Boolean), [user.id]);

    const [row] = await db.select().from(users).where(eq(users.id, user.id));
    assert.ok(row.emailVerifiedAt, "email_verified_at should be set");
    assert.equal(await consumeMagicLink(token), null);
  } finally {
    await db.delete(authTokens).where(eq(authTokens.email, user.email));
    await db.delete(users).where(eq(users.id, user.id));
  }
});

test("an expired or unknown token is rejected", async () => {
  const user = await makeUser();
  try {
    const expired = await makeToken(user.email, { expiresInMs: -1000 });
    assert.equal(await consumeMagicLink(expired), null);
    assert.equal(await consumeMagicLink(generateToken()), null);
  } finally {
    await db.delete(authTokens).where(eq(authTokens.email, user.email));
    await db.delete(users).where(eq(users.id, user.id));
  }
});

test("requestMagicLink refuses unknown emails and rate-limits repeat requests before sending anything", async () => {
  assert.equal(await requestMagicLink("nobody+none@brieff.invalid", { requireAccount: true }), "no_account");

  const user = await makeUser();
  try {
    for (let i = 0; i < 5; i++) await makeToken(user.email);
    assert.equal(await requestMagicLink(user.email, { requireAccount: true }), "rate_limited");
  } finally {
    await db.delete(authTokens).where(eq(authTokens.email, user.email));
    await db.delete(users).where(eq(users.id, user.id));
  }
});
