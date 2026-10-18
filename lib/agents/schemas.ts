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

export const crossSectorNoteSchema = z.object({
  editors_note: z.string(),
});
export type CrossSectorNote = z.infer<typeof crossSectorNoteSchema>;

export const feedbackProfileOutputSchema = z.object({
  feedback_profile: z.string().min(1),
});
export type FeedbackProfileOutput = z.infer<typeof feedbackProfileOutputSchema>;
