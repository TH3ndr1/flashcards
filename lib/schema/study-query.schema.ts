// lib/schema/study-query.schema.ts

import { z } from 'zod';

// Reusable schema for date-based filters
const dateFilterSchema = z.object({
  operator: z.enum([
      'newerThanDays',
      'olderThanDays',
      'onDate',
      'betweenDates',
      'never', // For nullable date fields like lastReviewed
      'isDue'  // Special case for nextReviewDue
    ]),
  // --- FIX: Allow nulls within the array for betweenDates ---
  value: z.union([
      z.number().int().positive(),
      z.string().date().optional(), // Use string().date() if Zod supports it, else z.string() for YYYY-MM-DD
      // This array allows elements to be string (datetime) OR null
      z.array(z.union([z.string().datetime({ offset: true }), z.null()])).length(2).optional()
  ]).optional(), // Value is optional for operators like 'never', 'isDue'
  // ---------------------------------------------------------
}).strict(); // Ensure no extra properties

// Main schema for query criteria JSONB
export const studyQueryCriteriaSchema = z.object({
  allCards: z.boolean().optional(),
  deckId: z.string().uuid().optional(),
  includeTags: z.array(z.string().uuid()).optional(),
  excludeTags: z.array(z.string().uuid()).optional(),
  tagLogic: z.enum(['ANY', 'ALL']).optional(),

  // Apply reusable date filter schema
  createdDate: dateFilterSchema.optional(),
  updatedDate: dateFilterSchema.optional(),
  lastReviewed: dateFilterSchema.optional(),
  nextReviewDue: dateFilterSchema.optional(),

  srsLevel: z.object({
      operator: z.enum(['equals', 'lessThan', 'greaterThan']),
      value: z.number().int().gte(0), // Ensure non-negative integer
  }).strict().optional(),

  // Add new filter for difficult cards
  includeDifficult: z.boolean().optional(),

  orderBy: z.object({
      field: z.string(),
      direction: z.enum(['ASC', 'DESC']),
  }).strict().optional(),

}).strict(); // Ensure no extra properties on the main object

export type StudyQueryCriteria = z.infer<typeof studyQueryCriteriaSchema>;

// Define and export the type for the RPC function's return value (no changes)
export type ResolvedCardId = { card_id: string };