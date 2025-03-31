import { z } from "zod";

// Define Zod schema for study query criteria
export const studyQueryCriteriaSchema = z.object({
    deckId: z.string().uuid().optional(),
    studySetId: z.string().uuid().optional(),
    tagIds: z.array(z.string().uuid()).optional(),
    limit: z.number().int().min(1).max(100).optional().default(50),
    includeNew: z.boolean().optional().default(true),
    includeReview: z.boolean().optional().default(true),
    includeLearning: z.boolean().optional().default(true)
});

// Export the TypeScript type derived from the schema
export type StudyQueryCriteria = z.infer<typeof studyQueryCriteriaSchema>;

// Add new interface for tracking SRS changes
export interface SrsProgression {
    newToLearning: number;
    learningToReview: number;
    stayedInLearning: number;
    droppedToLearning: number;
} 