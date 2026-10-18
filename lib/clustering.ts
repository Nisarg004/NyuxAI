export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na === 0 || nb === 0 ? 0 : dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// Embeddings alone can't separate "same event" from "same template": on real feeds the
// ICICI-results and HDFC-results headlines (different events) score 0.83 while genuine
// duplicates of one event score 0.80-0.82. So similarity decides two ways:
//   >= MERGE_SIMILARITY            merge outright
//   >= CANDIDATE_SIMILARITY        merge only if the titles share a specific token
//                                  (a number, or a distinctive proper name)
// Merging two different events hides one of them, which is worse than showing a near-duplicate,
// so the guard errs towards keeping stories apart.
export const MERGE_SIMILARITY = 0.88;
export const CANDIDATE_SIMILARITY = 0.76;

// Words that appear in headlines of unrelated stories; sharing one says nothing about the event.
const GENERIC = new Set(
  `bank banks results result profit profits net loss rises rise jumps jump surges surge falls fall drops
   quarter revenue growth crore lakh report reports says said india indian market markets stock stocks
   shares price prices news update government minister year years first second third week today after
   over with from amid into what why how will could would about their more than also new news`.split(/\s+/),
);

// Numbers of 3+ digits ("14,843" -> "14843") and distinctive capitalised words, lower-cased.
export function specificTokens(title: string): Set<string> {
  const tokens = new Set<string>();
  for (const raw of title.split(/[^\p{L}\p{N},.]+/u)) {
    const word = raw.replace(/^[.,]+|[.,]+$/g, "");
    if (!word) continue;
    const digits = word.replace(/[,.]/g, "");
    if (/^\d{3,}$/.test(digits)) {
      tokens.add(digits);
      continue;
    }
    const letters = word.replace(/[^\p{L}]/gu, "");
    if (letters.length >= 4 && /^\p{Lu}/u.test(letters) && !GENERIC.has(letters.toLowerCase())) {
      tokens.add(letters.toLowerCase());
    }
  }
  return tokens;
}

function allWords(title: string): Set<string> {
  return new Set(title.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean));
}

// A distinctive token from one title must appear in the other. Checked against the other title's
// plain lower-cased words, so a brand styled lower-case in one headline ("ixigo") still matches.
export function sharesSpecificToken(a: string, b: string): boolean {
  const wordsA = allWords(a);
  const wordsB = allWords(b);
  for (const t of specificTokens(a)) if (wordsB.has(t)) return true;
  for (const t of specificTokens(b)) if (wordsA.has(t)) return true;
  return false;
}

export type StoryAnchor = { storyId: string; sector: string; vector: number[]; title: string };

// The best story for an article among anchors of the same sector, or null. Matching against each
// story's canonical article (rather than a drifting centroid) keeps clusters from chaining
// A~B~C into one story when A and C differ.
export function matchStory(
  article: { vector: number[]; sector: string; title: string },
  anchors: StoryAnchor[],
): { storyId: string; similarity: number } | null {
  let best: { storyId: string; similarity: number } | null = null;
  for (const anchor of anchors) {
    if (anchor.sector !== article.sector) continue;
    const similarity = cosine(article.vector, anchor.vector);
    if (similarity < CANDIDATE_SIMILARITY) continue;
    const merge = similarity >= MERGE_SIMILARITY || sharesSpecificToken(article.title, anchor.title);
    if (merge && (!best || similarity > best.similarity)) best = { storyId: anchor.storyId, similarity };
  }
  return best;
}
