import { z } from 'zod';
import { StudyQueryCriteriaSchema } from '@/lib/schema/study-query.schema';

// Zod schema for validating the input when creating or fully updating study sets
export const studySetInputSchema = z.object({
    name: z.string().trim().min(1, 'Study set name is required').max(100)
        .describe("The name of the study set (1-100 characters)"),
    description: z.string().trim().max(500).optional().nullable()
        .describe("Optional description for the study set (max 500 characters)"),
    // Use the imported schema to validate the nested criteria object
    criteria: StudyQueryCriteriaSchema
        .describe("The query criteria object defining the cards included in this set"),
});

// Zod schema for validating partial updates to study sets
// Allows any subset of the fields defined in studySetInputSchema to be provided
export const partialStudySetInputSchema = studySetInputSchema.partial()
    .describe("Schema for partially updating a study set; allows any subset of fields.");

// Infer TypeScript types from the schemas
export type StudySetInput = z.infer<typeof studySetInputSchema>;
export type PartialStudySetInput = z.infer<typeof partialStudySetInputSchema>; 