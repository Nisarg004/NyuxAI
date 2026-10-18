import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { preferences, users } from "@/lib/db/schema";
import { runDispatch } from "@/lib/cron/dispatch";

const DB_AVAILABLE = Boolean(process.env.DATABASE_URL);
const STAMP = Date.now();
const OK_EMAIL = `suppression-ok+${STAMP}@brieff.invalid`;
const BOUNCED_EMAIL = `suppression-bounced+${STAMP}@brieff.invalid`;
const COMPLAINED_EMAIL = `suppression-complained+${STAMP}@brieff.invalid`;
// A fake "now" in 2020 so only these throwaway rows count as due, never real dev data.
const NOW = new Date("2020-01-01T00:00:01.000Z");
const DUE_AT = new Date("2020-01-01T00:00:00.000Z");

const ids: string[] = [];

before(async () => {
  if (!DB_AVAILABLE) return;
  const rows = [
    { email: OK_EMAIL, emailStatus: "ok" as const },
    { email: BOUNCED_EMAIL, emailStatus: "bounced" as const },
    { email: COMPLAINED_EMAIL, emailStatus: "complained" as const },
  ];
  for (const row of rows) {
    const [user] = await db
      .insert(users)
      .values({ ...row, name: "Suppression Test", emailVerifiedAt: new Date() })
      .returning({ id: users.id });
    ids.push(user.id);
    await db.insert(preferences).values({
      userId: user.id,
      sectors: ["technology"],
      deliveryHour: 8,
      deliveryMinute: 0,
      timezone: "UTC",
      nextRunAt: DUE_AT,
      isActive: true,
    });
  }
});

after(async () => {
  if (DB_AVAILABLE && ids.length > 0) await db.delete(users).where(inArray(users.id, ids));
  await db.$client.end();
});

test(
  "dispatcher skips bounced and complained users but still picks up healthy ones",
  { skip: DB_AVAILABLE ? false : "DATABASE_URL not set" },
  async () => {
    // Enqueue-only, so nothing runs; this asserts only who the dispatcher chooses.
    const result = await runDispatch({ now: NOW, leadMs: 0 });
    const emails = result.processed.map((p) => p.email);

    assert.ok(emails.includes(OK_EMAIL), "healthy due user must be dispatched");
    assert.ok(!emails.includes(BOUNCED_EMAIL), "bounced user must be skipped");
    assert.ok(!emails.includes(COMPLAINED_EMAIL), "complained user must be skipped");
  }
);
