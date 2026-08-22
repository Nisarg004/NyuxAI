import { z } from "zod";

export const curatorOutputSchema = z.object({
  selected: z.array(
    z.object({
      article_id: z.string().uuid(),
      sector: z.string(),
      score: z.number().min(0).max(100),
      reason: z.string(),
    })
  ),
});
export type CuratorOutput = z.infer<typeof curatorOutputSchema>;

export const writerItemSchema = z.object({
  article_id: z.string().uuid(),
  sector: z.string(),
  headline: z.string().refine((h) => h.trim().split(/\s+/).length <= 12, "headline must be 12 words or fewer"),
  summary: z.string(),
  why_it_matters: z.string(),
});
export type WriterItem = z.infer<typeof writerItemSchema>;

export const writerOutputSchema = z.object({
  items: z.array(writerItemSchema),
  editors_note: z.string(),
});
export type WriterOutput = z.infer<typeof writerOutputSchema>;

export const crossSectorNoteSchema = z.object({
  editors_note: z.string(),
});
export type CrossSectorNote = z.infer<typeof crossSectorNoteSchema>;

export const editorOutputSchema = z.object({
  approved: z.array(writerItemSchema),
  rejected: z.array(
    z.object({
      article_id: z.string().uuid(),
      reason: z.string(),
    })
  ),
});
export type EditorOutput = z.infer<typeof editorOutputSchema>;
