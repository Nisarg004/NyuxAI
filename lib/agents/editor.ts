import { callLLM, type LLMResult } from "../llm";
import { MODEL_FAST } from "./models";
import { editorOutputSchema, type EditorOutput } from "./schemas";
import type { WriterItem } from "./schemas";

export type EditorInput = WriterItem & { sourceText: string };

export async function runEditor(items: EditorInput[]): Promise<LLMResult<EditorOutput>> {
  const system = [
    "You are the Editor agent in a news briefing pipeline — the last check before publication.",
    "For each item, verify every factual claim in `summary` and `why_it_matters` is supported by its `source_text`.",
    "Drop (reject) any item with an unsupported claim, and give a specific, one-sentence `reason` for the rejection — these are shown to the reader, so be concrete about what failed.",
    "For items that pass, strip hype adjectives and hedging language, and enforce word limits: headline max 12 words, summary max 3 sentences, why_it_matters exactly one sentence.",
    "Return approved items in the same shape you received them, edited in place, plus the rejected list.",
  ].join(" ");

  const user = JSON.stringify({
    items: items.map((item) => ({
      article_id: item.article_id,
      sector: item.sector,
      headline: item.headline,
      summary: item.summary,
      why_it_matters: item.why_it_matters,
      source_text: item.sourceText,
    })),
  });

  return callLLM({
    model: MODEL_FAST,
    schema: editorOutputSchema,
    schemaName: "editor_output",
    system,
    user,
  });
}
