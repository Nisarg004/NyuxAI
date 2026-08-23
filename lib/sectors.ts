export const SECTORS = [
  "Business",
  "Technology",
  "Healthcare",
  "Finance",
  "Politics & Policy",
] as const;

export type Sector = (typeof SECTORS)[number];
