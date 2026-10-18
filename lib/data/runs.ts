import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { runs, users } from "@/lib/db/schema";

export async function listRuns(limit = 50) {
  return db
    .select({
      id: runs.id,
      kind: runs.kind,
      userEmail: users.email,
      startedAt: runs.startedAt,
      finishedAt: runs.finishedAt,
      status: runs.status,
      error: runs.error,
      tokenCost: runs.tokenCost,
      stageLog: runs.stageLog,
    })
    .from(runs)
    .leftJoin(users, eq(runs.userId, users.id))
    .orderBy(desc(runs.startedAt))
    .limit(limit);
}
