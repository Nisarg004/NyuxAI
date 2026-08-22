import { callLLM, type LLMResult } from "../llm";
import { MODEL_FAST, MODEL_WRITER } from "./models";
import { crossSectorNoteSchema, writerOutputSchema, type CrossSectorNote, type WriterOutput } from "./schemas";
import type { ResearchedItem } from "./researcher";

// Called once per sector (in parallel across sectors) so one slow/failed sector
// never blocks or takes down the others. `editors_note` here is scoped to this
// sector only — the real cross-sector note is synthesized separately afterward.
export async function runWriter(input: {
  userName: string;
  roleTitle: string | null;
  depth: "brief" | "standard" | "deep";
  items: ResearchedItem[];
  // Set when every item from a prior pass over these same items was rejected —
  // gives the model the specific reasons so a retry can address them instead of
  // repeating the same mistake blind.
  previousRejections?: { article_id: string; reason: string }[];
}): Promise<LLMResult<WriterOutput>> {
  const system = [
    "You are the Writer agent in a news briefing pipeline. You are writing the items for a single sector.",
    "For each article produce: `headline` (max 12 words, factual, no clickbait) and `summary` (2-3 sentences, using only facts present in the provided source text).",
    "If the source text does not support a claim, omit the claim — never invent or infer facts not present in the text.",
    "For `why_it_matters` (exactly one sentence, addressed directly to the reader's role): it must name a concrete consequence, decision, number, or named party — something the reader would act on or weigh differently because of this article.",
    "Never write a sentence that could be pasted onto any other story in this sector — that is a sign it's generic filler, not analysis. Specifically banned: the pattern \"X can affect/impact Y\", and hedges like \"worth watching\", \"worth monitoring\", or \"remains a factor\".",
    'Good examples (specific, name the consequence for this reader\'s role): "The fine makes automated driver-suspension decisions a compliance issue for product teams." / "The findings support treating agent orchestration, memory, and supervision as product decisions alongside model selection."',
    "If the source text is too thin to support a specific consequence for this reader — e.g. it's only a date, a headline-level fact, or a number with no stated implication — set `why_it_matters` to null. Do not invent a generic sentence to fill the field.",
    "Also produce `editors_note`: one short sentence noting the theme connecting this sector's items. It may be superseded later by a cross-sector note, so keep it brief.",
    "Adjust density to the reader's requested depth: brief = terser, deep = more detail, standard = balanced.",
    ...(input.previousRejections && input.previousRejections.length > 0
      ? [
          "This is a retry: every item from your last pass over these same articles was rejected (see `previous_rejections` in the input, keyed by article_id) — either why_it_matters was null or too generic, or a claim wasn't literally supported by the source text. Re-read each source_text closely for a specific number, deadline, decision, or named party tied to this reader's role, and ground every sentence in exactly what the text says. Only fall back to why_it_matters: null if the source genuinely offers nothing beyond a bare headline-level fact.",
        ]
      : []),
  ].join(" ");

  const user = JSON.stringify({
    reader: { name: input.userName, role_title: input.roleTitle, depth: input.depth },
    articles: input.items.map((item) => ({
      article_id: item.articleId,
      sector: item.sector,
      title: item.title,
      source: item.source,
      research_depth: item.depth,
      source_text: item.text,
    })),
    ...(input.previousRejections && input.previousRejections.length > 0
      ? { previous_rejections: input.previousRejections }
      : {}),
  });

  return callLLM({
    model: MODEL_WRITER,
    schema: writerOutputSchema,
    schemaName: "writer_output",
    system,
    user,
  });
}

// Small, cheap follow-up call once all sectors' items are approved — this is what
// actually connects the brief across sectors, since the per-sector Writer calls
// above run in parallel and never see each other's output.
export async function runCrossSectorNote(
  items: { sector: string; headline: string }[]
): Promise<LLMResult<CrossSectorNote>> {
  const system =
    "You write the editor's note for a personalized news briefing. Given today's headlines grouped by sector, write exactly 2 sentences identifying a theme or connection across sectors for this reader. If there's only one sector, connect the items within it instead.";
  const user = JSON.stringify({ items });

  return callLLM({
    model: MODEL_FAST,
    schema: crossSectorNoteSchema,
    schemaName: "cross_sector_note",
    system,
    user,
  });
}
