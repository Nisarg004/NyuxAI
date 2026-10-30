// The public address of the site, for absolute URLs in metadata, the sitemap and
// link previews. Falls back to the production alias.
export const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://nyuxai.vercel.app").replace(/\/$/, "");
