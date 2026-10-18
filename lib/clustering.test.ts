import assert from "node:assert/strict";
import { test } from "node:test";
import { cosine, matchStory, sharesSpecificToken, specificTokens, type StoryAnchor } from "./clustering";

test("cosine: identical = 1, orthogonal = 0, zero vector = 0", () => {
  assert.ok(Math.abs(cosine([1, 2, 3], [1, 2, 3]) - 1) < 1e-9);
  assert.equal(cosine([1, 0], [0, 1]), 0);
  assert.equal(cosine([0, 0], [1, 1]), 0);
});

test("specificTokens keeps numbers and distinctive names, drops generic headline words", () => {
  const t = specificTokens("ICICI Bank Q2 net rises 20% to ₹14,843 crore as provisions fall");
  assert.ok(t.has("14843") && t.has("icici"));
  assert.ok(!t.has("bank") && !t.has("rises") && !t.has("crore"));
});

// Real headline pairs from the dev feeds, the cases that motivated the guard.
test("same event shares a specific token; same template with different subjects does not", () => {
  assert.equal(sharesSpecificToken("ICICI Bank Q2 net rises 20% to ₹14,843 crore as provisions fall", "ICICI Bank Q2 Results: Net profit jumps 20% YoY to Rs 14,843 crore"), true);
  assert.equal(sharesSpecificToken("Rain, narrow exits, false alert: What led to Kolkata Puja pandal stampede", "Kolkata Durga Puja stampede: Eyewitnesses flag lapses"), true);
  assert.equal(sharesSpecificToken("Ixigo reports ₹63 crore net profit in Q2", "ixigo Q2 profit at Rs 63 cr on robust show"), true, "brand styled lower-case in one headline");
  assert.equal(sharesSpecificToken("HDFC Bank Q2 Results: Net profit rises 5% YoY to Rs 19,510 crore", "ICICI Bank Q2 Results: Net profit jumps 20% YoY to Rs 14,843 crore"), false);
  assert.equal(sharesSpecificToken("Central Bank of India Q2 profit rises 21% to ₹1,469 cr", "Axis Bank Q2FY27 result: Profit rises 38% to ₹7,003 crore"), false);
});

const anchor = (storyId: string, title: string, vector: number[], sector = "Tech"): StoryAnchor => ({ storyId, sector, vector, title });
const near = (s: number) => [s, Math.sqrt(1 - s * s)]; // a vector with cosine `s` to [1, 0]

test("a very high similarity merges even without a shared token", () => {
  const a = [anchor("a", "Alpha launches product", [1, 0])];
  assert.equal(matchStory({ vector: near(0.95), sector: "Tech", title: "Entirely different words" }, a)?.storyId, "a");
});

test("a moderate similarity merges only when the titles share a specific token", () => {
  const a = [anchor("a", "Acme acquires Globex for 4500 million", [1, 0])];
  assert.equal(matchStory({ vector: near(0.8), sector: "Tech", title: "Globex deal valued at 4500 million" }, a)?.storyId, "a");
  assert.equal(matchStory({ vector: near(0.8), sector: "Tech", title: "Stocks slip as dollar heads lower" }, a), null);
});

test("below the candidate similarity never merges; sectors never mix", () => {
  const a = [anchor("a", "Acme acquires Globex", [1, 0])];
  assert.equal(matchStory({ vector: near(0.5), sector: "Tech", title: "Acme acquires Globex" }, a), null);
  assert.equal(matchStory({ vector: [1, 0], sector: "Health", title: "Acme acquires Globex" }, a), null);
});

test("picks the most similar of several qualifying stories", () => {
  const a = [anchor("far", "Globex 4500 deal", [1, 0.6]), anchor("near", "Globex 4500 deal again", [1, 0.1])];
  assert.equal(matchStory({ vector: [1, 0], sector: "Tech", title: "Globex 4500" }, a)?.storyId, "near");
});
