import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Next.js 16's eslint-config-next ships native ESLint flat configs (arrays of
// config objects), so it's imported and spread directly rather than resolved
// through @eslint/eslintrc's FlatCompat (which expects legacy-style shareable
// configs and chokes on these with a circular-structure error).
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Agent worktrees are full checkouts of other branches, not this tree.
    ".claude/**",
  ]),
]);

export default eslintConfig;
