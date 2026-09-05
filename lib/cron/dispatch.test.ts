import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { preferences, users } from "@/lib/db/schema";
import { claimDueRun } from "@/lib/cron/dispatch";

// A DB-integration test: it exercises the real atomic UPDATE against whatever
// DATABASE_URL points at (the dev database). It creates one throwaway user,
// races two claims against the same due slot, and deletes the user afterwards.
const DB_AVAILABLE = Boolean(process.env.DATABASE_URL);

const TEST_EMAIL = `dispatch-race-test+${Date.now()}@brieff.invalid`;
const DUE_AT = new Date("2020-01-01T00:00:00.000Z"); // safely in the past
const NEXT_AT = new Date("2020-01-02T00:00:00.000Z");

let userId: string;

before(async () => {
  if (!DB_AVAILABLE) return;
  const [user] = await db
    .insert(users)
    .values({ email: TEST_EMAIL, name: "Dispatch Race Test" })
    .returning({ id: users.id });
  userId = user.id;
  await db.insert(preferences).values({
    userId,
    sectors: ["technology"],
    deliveryHour: 8,
    deliveryMinute: 0,
    timezone: "America/New_York",
    nextRunAt: DUE_AT,
    isActive: true,
  });
});

after(async () => {
  if (DB_AVAILABLE && userId) {
    await db.delete(users).where(eq(users.id, userId)); // cascades to preferences
  }
  // Close the connection pool so `node --test` can exit.
  await db.$client.end();
});

test(
  "two dispatchers racing the same due user: exactly one claims it, the other gets zero rows",
  { skip: DB_AVAILABLE ? false : "DATABASE_URL not set" },
  async () => {
    // Both callers read next_run_at === DUE_AT and try to roll it forward.
    const [a, b] = await Promise.all([
      claimDueRun(userId, DUE_AT, NEXT_AT),
      claimDueRun(userId, DUE_AT, NEXT_AT),
    ]);

    assert.equal(
      [a, b].filter(Boolean).length,
      1,
      `expected exactly one winner, got a=${a} b=${b}`
    );
    assert.equal(
      [a, b].filter((claimed) => !claimed).length,
      1,
      "expected exactly one loser that skips"
    );

    // The row actually moved forward once.
    const [row] = await db
      .select({ nextRunAt: preferences.nextRunAt })
      .from(preferences)
      .where(eq(preferences.userId, userId));
    assert.equal(row.nextRunAt?.toISOString(), NEXT_AT.toISOString());

    // A third claim against the now-stale DUE_AT also gets nothing.
    const stale = await claimDueRun(userId, DUE_AT, NEXT_AT);
    assert.equal(stale, false, "a claim against the already-rolled slot must fail");
  }
);
