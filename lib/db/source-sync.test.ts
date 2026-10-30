import { test } from "node:test";
import assert from "node:assert/strict";
import { planSourceSync, type ExistingSource } from "./source-sync";

const row = (over: Partial<ExistingSource>): ExistingSource => ({
  id: "id",
  rssUrl: "https://a.example/feed",
  name: "A",
  sector: "Technology",
  weight: 2,
  isActive: true,
  ...over,
});

test("new feeds are inserted and unchanged ones are left alone", () => {
  const plan = planSourceSync(
    [row({})],
    [
      { sector: "Technology", name: "A", rssUrl: "https://a.example/feed", weight: 2 },
      { sector: "Healthcare", name: "B", rssUrl: "https://b.example/feed", weight: 1 },
    ],
  );
  assert.deepEqual(plan.insert.map((s) => s.name), ["B"]);
  assert.equal(plan.update.length, 0);
  assert.equal(plan.deactivate.length, 0);
});

test("a feed dropped from the list is switched off, never deleted", () => {
  const plan = planSourceSync([row({ id: "gone", name: "Old" })], []);
  assert.deepEqual(plan.deactivate, [{ id: "gone", name: "Old" }]);
  assert.equal(plan.insert.length, 0);
});

test("an already-off feed that was dropped needs no change", () => {
  assert.equal(planSourceSync([row({ isActive: false })], []).deactivate.length, 0);
});

test("a renamed or reweighted feed is updated in place, keeping its on/off state", () => {
  const plan = planSourceSync(
    [row({ id: "x", isActive: false })],
    [{ sector: "Technology", name: "A renamed", rssUrl: "https://a.example/feed", weight: 3 }],
  );
  assert.deepEqual(plan.update, [{ id: "x", name: "A renamed", sector: "Technology", weight: 3 }]);
  assert.equal(plan.deactivate.length, 0);
});
