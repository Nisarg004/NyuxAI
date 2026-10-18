import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { preferences } from "@/lib/db/schema";
import { getInternalBaseUrl } from "@/lib/internal-api";
import { signLink, verifyLink } from "@/lib/signed-link";

const PURPOSE = "unsubscribe";

export function unsubscribeToken(userId: string): string {
  return signLink({ purpose: PURPOSE, userId });
}

// The confirm page (for people clicking the footer link) and the RFC 8058
// one-click endpoint (for mail clients' native Unsubscribe button).
export function unsubscribePageUrl(userId: string): string {
  return `${getInternalBaseUrl()}/unsubscribe?t=${unsubscribeToken(userId)}`;
}

export function unsubscribeOneClickUrl(userId: string): string {
  return `${getInternalBaseUrl()}/api/unsubscribe?t=${unsubscribeToken(userId)}`;
}

export function unsubscribeHeaders(userId: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<${unsubscribeOneClickUrl(userId)}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

// Idempotent: pausing an already-paused user is a no-op that still reports success.
export async function unsubscribeByToken(token: string): Promise<boolean> {
  const link = verifyLink(token, PURPOSE);
  if (!link) return false;
  await db.update(preferences).set({ isActive: false }).where(eq(preferences.userId, link.userId));
  return true;
}
