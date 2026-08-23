import { and, desc, eq, gt } from "drizzle-orm";
import { db } from "../db";
import { digestItems, feedback, preferences } from "../db/schema";
import { callLLM } from "../llm";
import { feedbackProfileOutputSchema } from "./schemas";
import { MODEL_FAST } from "./models";

const SYSTEM_PROMPT = `You maintain a one-line reading profile for a news-briefing user, built from their thumbs up/down/save signals on past digest items. Summarise what they consistently engage with positively and what they consistently reject. Output exactly 1-2 sentences in this literal form, with no extra commentary:

Prefers: <short clause>. Avoids: <short clause>.

Be specific to the actual headlines and sectors given, not generic. If there isn't a clear pattern for one half, write "nothing distinct yet" for that half rather than inventing one.`;

export async function regenerateFeedbackProfile(
  userId: string
): Promise<{ updated: boolean; profile: string | null }> {
  const signals = await db
    .select({
      signal: feedback.signal,
      sector: digestItems.sector,
      headline: digestItems.headline,
    })
    .from(feedback)
    .innerJoin(digestItems, eq(feedback.digestItemId, digestItems.id))
    .where(eq(feedback.userId, userId))
    .orderBy(desc(feedback.createdAt))
    .limit(30);

  const [prefs] = await db
    .select({ feedbackProfile: preferences.feedbackProfile })
    .from(preferences)
    .where(eq(preferences.userId, userId));
  const currentProfile = prefs?.feedbackProfile ?? null;

  if (signals.length === 0) {
    return { updated: false, profile: currentProfile };
  }

  const user = JSON.stringify({
    signals: signals.map((s) => ({ signal: s.signal, sector: s.sector, headline: s.headline })),
  });

  const result = await callLLM({
    model: MODEL_FAST,
    schema: feedbackProfileOutputSchema,
    schemaName: "feedback_profile_output",
    system: SYSTEM_PROMPT,
    user,
  });

  if (!result.ok) {
    return { updated: false, profile: currentProfile };
  }

  await db
    .update(preferences)
    .set({ feedbackProfile: result.data.feedback_profile, feedbackProfileUpdatedAt: new Date() })
    .where(eq(preferences.userId, userId));

  return { updated: true, profile: result.data.feedback_profile };
}

export async function countSignalsSinceProfileUpdate(userId: string): Promise<number> {
  const [prefs] = await db
    .select({ feedbackProfileUpdatedAt: preferences.feedbackProfileUpdatedAt })
    .from(preferences)
    .where(eq(preferences.userId, userId));
  const since = prefs?.feedbackProfileUpdatedAt ?? null;

  const rows = await db
    .select({ id: feedback.id })
    .from(feedback)
    .where(
      since
        ? and(eq(feedback.userId, userId), gt(feedback.createdAt, since))
        : eq(feedback.userId, userId)
    );
  return rows.length;
}
