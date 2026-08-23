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

// Non-null why_it_matters: this is the shape an item must have to ship. Used for the
// Editor's `approved` list, so structured-output enforcement itself blocks the Editor
// from approving an item the Writer flagged as having no concrete consequence.
export const writerItemSchema = z.object({
  article_id: z.string().uuid(),
  sector: z.string(),
  headline: z.string().refine((h) => h.trim().split(/\s+/).length <= 12, "headline must be 12 words or fewer"),
  summary: z.string(),
  why_it_matters: z.string(),
});
export type WriterItem = z.infer<typeof writerItemSchema>;

// The Writer's draft shape: why_it_matters may be null, which is the Writer's explicit
// signal that the source text doesn't support a concrete consequence — the alternative
// to inventing generic filler. The Editor is responsible for rejecting these.
export const writerDraftItemSchema = writerItemSchema.extend({
  why_it_matters: z.string().nullable(),
});
export type WriterDraftItem = z.infer<typeof writerDraftItemSchema>;

export const writerOutputSchema = z.object({
  items: z.array(writerDraftItemSchema),
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

export const feedbackProfileOutputSchema = z.object({
  feedback_profile: z.string().min(1),
});
export type FeedbackProfileOutput = z.infer<typeof feedbackProfileOutputSchema>;
