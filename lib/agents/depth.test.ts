import assert from "node:assert/strict";
import { test } from "node:test";
import { applyDepth } from "./depth";

const text = "First sentence here. Second one follows! A third?";

test("brief keeps only the lead sentence", () => {
  assert.equal(applyDepth(text, "brief"), "First sentence here.");
});

test("standard and deep leave the summary untouched", () => {
  assert.equal(applyDepth(text, "standard"), text);
  assert.equal(applyDepth(text, "deep"), text);
});

test("a single-sentence or empty summary is safe", () => {
  assert.equal(applyDepth("Only one.", "brief"), "Only one.");
  assert.equal(applyDepth("", "brief"), "");
});
