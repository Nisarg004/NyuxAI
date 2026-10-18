"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { endSession, getSessionUserId } from "@/lib/session";

export async function signOut() {
  await endSession();
  redirect("/");
}

// Everything the user owns (preferences, digests, items, feedback, sessions)
// cascades off users.id; runs keep their rows with user_id set to null.
export async function deleteAccount() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/signin");

  await db.delete(users).where(eq(users.id, userId));
  await endSession();
  redirect("/");
}
