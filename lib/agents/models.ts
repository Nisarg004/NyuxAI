function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

// Swap models in .env.local (MODEL_WRITER / MODEL_FAST) without touching agent code.
export const MODEL_WRITER = requireEnv("MODEL_WRITER");
export const MODEL_FAST = requireEnv("MODEL_FAST");
