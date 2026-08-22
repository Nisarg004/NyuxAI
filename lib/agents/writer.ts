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
}): Promise<LLMResult<WriterOutput>> {
  const system = [
    "You are the Writer agent in a news briefing pipeline. You are writing the items for a single sector.",
    "For each article produce: `headline` (max 12 words, factual, no clickbait), `summary` (2-3 sentences, using only facts present in the provided source text), and `why_it_matters` (exactly one sentence, addressed directly to the reader's role).",
    "If the source text does not support a claim, omit the claim — never invent or infer facts not present in the text.",
    "Also produce `editors_note`: one short sentence noting the theme connecting this sector's items. It may be superseded later by a cross-sector note, so keep it brief.",
    "Adjust density to the reader's requested depth: brief = terser, deep = more detail, standard = balanced.",
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
