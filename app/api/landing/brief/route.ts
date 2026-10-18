import { generateBrief } from "@/lib/agents/pipeline";
import { checkAndRecordLandingRun } from "@/lib/rate-limit";
import { SECTORS } from "@/lib/sectors";

/**
 * PUBLIC route — deliberately NOT behind isAuthorizedCronCaller. The landing
 * page must generate a real brief for a stranger with no account and no
 * secret. Abuse is bounded by checkAndRecordLandingRun (IP rate limit) plus
 * the hard caps below: <=3 sectors, <=3 items/sector, <=45 candidate headlines
 * sent to the Curator. This is the one intentional exception to CLAUDE.md's
 * "gate every route that triggers an LLM call" rule.
 */
export const maxDuration = 300;

const LANDING_CANDIDATE_LIMIT = 45;
const MAX_SECTORS = 3;
const MAX_ITEMS_PER_SECTOR = 3;
const MAX_ROLE_LEN = 120;

function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export async function POST(request: Request) {
  let body: { sectors?: unknown; roleTitle?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_sectors" }, { status: 400 });
  }

  const requested = Array.isArray(body.sectors) ? body.sectors.filter((s): s is string => typeof s === "string") : [];
  const sectors = [...new Set(requested)]
    .filter((s) => (SECTORS as readonly string[]).includes(s))
    .slice(0, MAX_SECTORS);

  if (sectors.length === 0) {
    return Response.json({ error: "invalid_sectors" }, { status: 400 });
  }

  const roleRaw = typeof body.roleTitle === "string" ? body.roleTitle.trim().slice(0, MAX_ROLE_LEN) : "";
  const roleTitle = roleRaw.length > 0 ? roleRaw : null;

  const gate = await checkAndRecordLandingRun(clientIp(request));
  if (!gate.ok) {
    return Response.json({ error: "rate_limited", retryAfterMinutes: gate.retryAfterMinutes }, { status: 429 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      try {
        const result = await generateBrief(
          {
            // A stranger who gave no role gets the shared sector editions: free once built.
            mode: roleTitle ? "role" : "sectors",
            userName: "there",
            roleTitle,
            sectors,
            keywords: [],
            feedbackProfile: null,
            depth: "standard",
          },
          {
            kind: "landing",
            userId: null,
            maxCandidates: LANDING_CANDIDATE_LIMIT,
            maxItemsPerSector: MAX_ITEMS_PER_SECTOR,
            onStage: (entry) => send({ type: "stage", entry }),
          },
        );

        if (!result.success) {
          send({ type: "error", error: result.error });
          controller.close();
          return;
        }

        const grouped = sectors
          .map((sector) => ({
            sector,
            items: result.items
              .filter((i) => i.sector === sector)
              .map((i) => ({
                headline: i.headline,
                summary: i.summary,
                whyItMatters: i.why_it_matters,
                sourceUrl: i.source_url,
              })),
          }))
          .filter((g) => g.items.length > 0);

        send({ type: "done", brief: { editorsNote: result.editorsNote, sectors: grouped } });
        controller.close();
      } catch (err) {
        send({ type: "error", error: err instanceof Error ? err.message : String(err) });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
