import { createHash } from "node:crypto";

const SALT_FALLBACK = "brieff-ip-rate-limit";

// Vercel sets x-forwarded-for; its first entry is the client.
export function clientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return headers.get("x-real-ip")?.trim() || "unknown";
}

// IPs are only ever stored hashed, salted with CRON_SECRET.
export function hashIp(ip: string): string {
  const salt = process.env.CRON_SECRET ?? SALT_FALLBACK;
  return createHash("sha256").update(`${ip}:${salt}`).digest("hex");
}
