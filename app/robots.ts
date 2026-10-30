import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-url";

// Public pages may be indexed; signed-in and single-use pages may not.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/dashboard", "/archive", "/runs", "/admin", "/auth/", "/unsubscribe"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
