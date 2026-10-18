import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { suppressionFromEvent, verifyWebhookSignature } from "./webhook";

const secretBytes = Buffer.from("super-secret-key-bytes");
const secret = `whsec_${secretBytes.toString("base64")}`;
const NOW = 1_700_000_000_000;
const id = "msg_123";
const timestamp = String(NOW / 1000);
const body = JSON.stringify({ type: "email.bounced" });
const sign = (b: string) => `v1,${createHmac("sha256", secretBytes).update(`${id}.${timestamp}.${b}`).digest("base64")}`;

const verify = (over: Partial<Parameters<typeof verifyWebhookSignature>[0]> = {}) =>
  verifyWebhookSignature({ secret, id, timestamp, signatureHeader: sign(body), body, now: NOW, ...over });

test("accepts a correctly signed webhook, including among rotated signatures", () => {
  assert.equal(verify(), true);
  assert.equal(verify({ signatureHeader: `v1,AAAA ${sign(body)}` }), true);
});

test("rejects a tampered body, wrong secret, missing headers, and stale timestamps", () => {
  assert.equal(verify({ body: body + " " }), false);
  assert.equal(verify({ secret: `whsec_${Buffer.from("other").toString("base64")}` }), false);
  assert.equal(verify({ id: null }), false);
  assert.equal(verify({ signatureHeader: null }), false);
  assert.equal(verify({ now: NOW + 6 * 60 * 1000 }), false);
});

test("permanent bounces and complaints suppress; transient bounces and other events don't", () => {
  const to = ["a@example.com"];
  assert.deepEqual(suppressionFromEvent({ type: "email.bounced", data: { to, bounce: { type: "Permanent" } } }), { status: "bounced", emails: to });
  assert.deepEqual(suppressionFromEvent({ type: "email.complained", data: { to } }), { status: "complained", emails: to });
  assert.equal(suppressionFromEvent({ type: "email.bounced", data: { to, bounce: { type: "Transient" } } }), null);
  assert.equal(suppressionFromEvent({ type: "email.delivered", data: { to } }), null);
  assert.equal(suppressionFromEvent({ type: "email.complained", data: {} }), null);
  assert.equal(suppressionFromEvent(null), null);
});
