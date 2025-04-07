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
  // Allow value to be number (days), string (YYYY-MM-DD or ISO), or array of strings (ISO for range)
  value: z.union([
      z.number().int().positive(), 
      z.string().date().optional(), // Use string().date() if Zod supports it, else z.string() for YYYY-MM-DD
      z.array(z.string().datetime({ offset: true })).length(2).optional() // Use datetime() for ISO strings in range
    ]).optional(), // Value is optional for operators like 'never', 'isDue'
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
  }).strict().optional(), // Ensure no extra properties
  
  // TODO: Add other filters like easinessFactor, intervalDays, language etc.
  
  orderBy: z.object({
      // TODO: Refine field to use z.enum([...v_allowed_order_fields from DB function])
      field: z.string(), 
      direction: z.enum(['ASC', 'DESC']),
  }).strict().optional(), // Ensure no extra properties

}).strict(); // Ensure no extra properties on the main object

export type StudyQueryCriteria = z.infer<typeof studyQueryCriteriaSchema>;

// Define and export the type for the RPC function's return value
export type ResolvedCardId = { card_id: string };
