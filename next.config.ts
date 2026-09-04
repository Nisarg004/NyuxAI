import type { NextConfig } from "next";

// Next.js 16 removed `next build`'s built-in lint step (and the `eslint` config
// key along with it) — linting is no longer coupled to the build at all, so
// there's nothing to opt out of here anymore. `npm run lint` runs ESLint directly.
const nextConfig: NextConfig = {};

export default nextConfig;
