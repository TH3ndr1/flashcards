import { z } from 'zod';

// Schema representing the specific fields on the 'cards' table that can be updated
// during a study session progress update.
export const cardUpdateFieldsSchema = z.object({
  srs_level: z.number().int().min(0).describe("New SRS level (0 for learning/relearning, >=1 for review)"),
  easiness_factor: z.number().describe("New easiness factor (float)"),
  interval_days: z.number().describe("New interval until next review (float, in days, can be fractional for minutes/hours)"),
  next_review_due: z.string().datetime({ offset: true }).describe("Timestamp for next review (ISO 8601 string)"),
  learning_state: z.enum(['learning', 'relearning']).nullable().describe("The new learning phase ('learning', 'relearning', or null)"),
  learning_step_index: z.number().int().min(0).nullable().describe("The index of the current step in learning/relearning phase"),
  failed_attempts_in_learn: z.number().int().min(0).describe("Counter for 'Again' grades during initial learning"),
  hard_attempts_in_learn: z.number().int().min(0).describe("Counter for 'Hard' grades during initial learning"),
  // Include general stats if the hook updates them
  attempt_count: z.number().int().min(0).optional().describe("Total number of attempts on this card"),
  correct_count: z.number().int().min(0).optional().describe("Total number of correct (Grade >= 2) reviews"),
  incorrect_count: z.number().int().min(0).optional().describe("Total number of incorrect (Grade 1) reviews"),
});

// Represents the full input expected by the updateCardProgress server action
export const updateCardProgressSchema = z.object({
  cardId: z.string().uuid("Invalid Card ID format"),
  grade: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4)
  ]).describe("User review grade (1=Again, 2=Hard, 3=Good, 4=Easy)"),
  updatedFields: cardUpdateFieldsSchema.describe("Object containing all card fields to be updated"),
}); 