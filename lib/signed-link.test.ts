import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { signLink, verifyLink } from "./signed-link";

beforeEach(() => {
  process.env.CRON_SECRET = "test-secret";
});

test("a signed link verifies and round-trips its payload", () => {
  const token = signLink({ purpose: "unsubscribe", userId: "u1" });
  assert.deepEqual(verifyLink(token, "unsubscribe"), { purpose: "unsubscribe", userId: "u1" });
});

test("a token is rejected for a different purpose", () => {
  const token = signLink({ purpose: "unsubscribe", userId: "u1" });
  assert.equal(verifyLink(token, "feedback"), null);
});

test("a tampered payload or signature is rejected", () => {
  const token = signLink({ purpose: "unsubscribe", userId: "u1" });
  const [body, sig] = token.split(".");
  const forged = Buffer.from(JSON.stringify({ p: "unsubscribe", u: "someone-else" })).toString("base64url");
  assert.equal(verifyLink(`${forged}.${sig}`, "unsubscribe"), null);
  assert.equal(verifyLink(`${body}.${sig.slice(0, -2)}AA`, "unsubscribe"), null);
});

test("a token signed with a different secret is rejected", () => {
  const token = signLink({ purpose: "unsubscribe", userId: "u1" });
  process.env.CRON_SECRET = "another-secret";
  assert.equal(verifyLink(token, "unsubscribe"), null);
});

test("expiry is enforced when set, and absent by default", () => {
  const now = 1_000_000;
  const expiring = signLink({ purpose: "p", userId: "u" }, { expiresInMs: 1000, now });
  assert.ok(verifyLink(expiring, "p", now + 999));
  assert.equal(verifyLink(expiring, "p", now + 1001), null);
  const forever = signLink({ purpose: "p", userId: "u" });
  assert.ok(verifyLink(forever, "p", now + 10 ** 12));
});

test("malformed input returns null instead of throwing", () => {
  for (const bad of ["", "abc", "a.b.c", ".", "not-base64.@@@"]) {
    assert.equal(verifyLink(bad, "p"), null);
  }
});

test("signing without CRON_SECRET throws (fail closed)", () => {
  delete process.env.CRON_SECRET;
  assert.throws(() => signLink({ purpose: "p", userId: "u" }), /CRON_SECRET/);
});
