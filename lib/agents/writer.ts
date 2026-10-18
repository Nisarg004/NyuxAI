import { callLLM, type LLMResult } from "../llm";
import { MODEL_FAST } from "./models";
import { crossSectorNoteSchema, type CrossSectorNote } from "./schemas";

// Small, cheap follow-up call once the digest's items are assembled — this is what
// connects the brief across sectors, since the shared per-article briefs are written
// independently of each other and of any one reader.
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
