export type StageEntry = Record<string, unknown>;

export type SectorAgentState = {
  status: "pending" | "running" | "done" | "error";
  attempt: 1 | 2;
  itemCount?: number;
  approvedCount?: number;
  rejectedCount?: number;
  rejected: { article_id: string; reason: string }[];
  error?: string;
};

export type PipelineSummary = {
  curator: {
    status: "pending" | "running" | "done" | "error";
    candidateCount?: number;
    selectedCount?: number;
    selections: { article_id: string; sector: string; score: number; reason: string }[];
    error?: string;
  };
  researcher: {
    status: "pending" | "running" | "done";
    itemCount?: number;
    deep?: number;
    shallow?: number;
  };
  writer: Record<string, SectorAgentState>;
  editor: Record<string, SectorAgentState>;
  email: { status: "pending" | "running" | "done" | "error"; to?: string; error?: string };
  notes: string[];
  finished: boolean;
  digestId: string | null;
  totals: { selected: number; fetched: number; approved: number; rejected: number };
};

function emptySector(): SectorAgentState {
  return { status: "pending", attempt: 1, rejected: [] };
}

function str(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}
function num(v: unknown): number | undefined {
  return typeof v === "number" ? v : undefined;
}

export function summarizeStageLog(entries: unknown[]): PipelineSummary {
  const summary: PipelineSummary = {
    curator: { status: "pending", selections: [] },
    researcher: { status: "pending" },
    writer: {},
    editor: {},
    email: { status: "pending" },
    notes: [],
    finished: false,
    digestId: null,
    totals: { selected: 0, fetched: 0, approved: 0, rejected: 0 },
  };

  for (const raw of entries) {
    if (typeof raw !== "object" || raw === null) continue;
    const e = raw as StageEntry;
    const stage = str(e.stage);
    const event = str(e.event);
    const sector = str(e.sector);

    if (stage === "curator") {
      if (event === "start") summary.curator.status = "running";
      if (event === "finish") {
        const status = str(e.status);
        summary.curator.status = status === "degraded" ? "error" : "done";
        summary.curator.candidateCount = num(e.candidateCount);
        summary.curator.selectedCount = num(e.selectedCount);
        summary.curator.error = str(e.error);
        const selections = Array.isArray(e.selections) ? e.selections : [];
        summary.curator.selections = selections as PipelineSummary["curator"]["selections"];
        summary.totals.selected = summary.curator.selectedCount ?? 0;
      }
    }

    if (stage === "researcher") {
      if (event === "start") summary.researcher.status = "running";
      if (event === "finish") {
        summary.researcher.status = "done";
        summary.researcher.itemCount = num(e.itemCount);
        summary.researcher.deep = num(e.deep);
        summary.researcher.shallow = num(e.shallow);
        summary.totals.fetched = summary.researcher.itemCount ?? 0;
      }
    }

    if ((stage === "writer" || stage === "editor") && sector) {
      const bucket = stage === "writer" ? summary.writer : summary.editor;
      const s = bucket[sector] ?? emptySector();
      s.attempt = (num(e.attempt) as 1 | 2) ?? s.attempt;
      if (event === "start") s.status = "running";
      if (event === "finish") {
        const status = str(e.status);
        s.status = status === "degraded" ? "error" : "done";
        s.error = str(e.error);
        s.itemCount = num(e.itemCount);
        if (stage === "editor") {
          s.approvedCount = num(e.approvedCount);
          s.rejectedCount = num(e.rejectedCount);
          const rejected = Array.isArray(e.rejected) ? e.rejected : [];
          s.rejected = rejected as SectorAgentState["rejected"];
        }
      }
      bucket[sector] = s;
    }

    if (stage === "sector_pipeline" && event === "finish" && sector) {
      const s = summary.editor[sector] ?? emptySector();
      s.status = "error";
      s.error = str(e.error);
      summary.editor[sector] = s;
    }

    if (stage === "pipeline") {
      const message = str(e.message);
      if (message) summary.notes.push(sector ? `${sector}: ${message}` : message);
      if (event === "finish") {
        const digestId = e.digestId;
        summary.digestId = typeof digestId === "string" ? digestId : null;
        summary.finished = true;
      }
    }

    if (stage === "email") {
      if (event === "start") summary.email.status = "running";
      if (event === "finish") {
        const status = str(e.status);
        summary.email.status = status === "failed" ? "error" : "done";
        summary.email.to = str(e.to);
        summary.email.error = str(e.error);
      }
    }
  }

  summary.totals.approved = Object.values(summary.editor).reduce((sum, s) => sum + (s.approvedCount ?? 0), 0);
  summary.totals.rejected = Object.values(summary.editor).reduce((sum, s) => sum + (s.rejectedCount ?? 0), 0);

  return summary;
}
