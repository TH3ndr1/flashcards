// lib/schema/study-query.schema.ts

import { z } from 'zod';

// --- Shared Schemas for Date Filter Values ---

// Expects ISO 8601 string with timezone offset for specific dates/ranges
const dateStringSchema = z.string().datetime({ offset: true })
  .describe("Date or timestamp in ISO 8601 format (e.g., '2024-07-31T10:00:00+00:00')");

// Expects a tuple of two ISO 8601 strings [start, end]
const dateRangeSchema = z.tuple([dateStringSchema, dateStringSchema])
  .describe("A tuple containing start and end date/time strings in ISO 8601 format");

// Expects a number passed as a string (e.g., "7" for 7 days)
const numberOfDaysSchema = z.string().regex(/^\d+$/, "Value must be a whole number of days represented as a string")
  .describe("Number of days, represented as a string (e.g., '7')");

// --- Specific Schemas for Different Date Filter Types ---

// Base schema for date filters with standard operators
const baseDateFilterSchema = z.object({
  operator: z.enum(['newerThanDays', 'olderThanDays', 'onDate', 'betweenDates'])
    .describe("Comparison operator for the date filter"),
  // Value depends on the operator
  value: z.union([numberOfDaysSchema, dateStringSchema, dateRangeSchema])
    .describe("Value for comparison (number of days string, date string, or date range tuple)"),
});

// Schema for 'lastReviewed' filter, adding the 'never' operator
const lastReviewedDateFilterSchema = z.object({
    operator: z.enum(['newerThanDays', 'olderThanDays', 'onDate', 'betweenDates', 'never'])
      .describe("Comparison operator, including 'never'"),
    // Value is optional only when operator is 'never'
    value: z.union([numberOfDaysSchema, dateStringSchema, dateRangeSchema]).optional()
      .describe("Value for comparison (optional for 'never')"),
}).refine(data => data.operator === 'never' ? data.value === undefined || data.value === null : data.value !== undefined, {
    message: "Value is required for operators other than 'never'",
    path: ["value"], // specify the path of the error
});

// Schema for 'nextReviewDue' filter, adding 'never' and 'isDue' operators
const nextReviewDueDateFilterSchema = z.object({
    operator: z.enum(['newerThanDays', 'olderThanDays', 'onDate', 'betweenDates', 'never', 'isDue'])
      .describe("Comparison operator, including 'never' and 'isDue'"),
    // Value is optional only when operator is 'never' or 'isDue'
    value: z.union([numberOfDaysSchema, dateStringSchema, dateRangeSchema]).optional()
      .describe("Value for comparison (optional for 'never' or 'isDue')"),
}).refine(data => (data.operator === 'never' || data.operator === 'isDue') ? data.value === undefined || data.value === null : data.value !== undefined, {
    message: "Value is required for operators other than 'never' or 'isDue'",
    path: ["value"], // specify the path of the error
});


// Schema for SRS level filter
const srsLevelFilterSchema = z.object({
  operator: z.enum(['equals', 'lessThan', 'greaterThan'])
    .describe("Comparison operator for SRS level"),
  value: z.number().int().min(0)
    .describe("Integer value for SRS level comparison"),
});

// --- Main Study Query Criteria Schema ---
export const StudyQueryCriteriaSchema = z.object({
  // Core Filters
  deckId: z.string().uuid("Invalid Deck ID format").optional()
    .describe("Optional UUID of a specific deck to filter by"),
  allCards: z.boolean().optional()
    .describe("If true, fetch all cards for the user, ignoring most other filters"),
  includeTags: z.string().uuid("Invalid Tag ID format").array().optional()
    .describe("Optional array of Tag UUIDs to include"),
  excludeTags: z.string().uuid("Invalid Tag ID format").array().optional()
    .describe("Optional array of Tag UUIDs to exclude"),
  tagLogic: z.enum(['ANY', 'ALL']).optional().default('ANY')
    .describe("Logic for 'includeTags': ANY (default) or ALL"),
  includeDifficult: z.boolean().optional().default(false)
    .describe("If true, includes cards currently in the 'learning' stage (based on view cards_with_srs_stage)"),
  includeLearning: z.boolean().optional()
    .describe("If true, includes cards in the 'learning' state (srs_level = 0, learning_state = 'learning')"),

  // Date Filters
  createdDate: baseDateFilterSchema.optional()
    .describe("Optional filter based on card creation date"),
  updatedDate: baseDateFilterSchema.optional()
    .describe("Optional filter based on card last updated date"),
  lastReviewed: lastReviewedDateFilterSchema.optional()
    .describe("Optional filter based on last reviewed date (supports 'never')"),
  nextReviewDue: nextReviewDueDateFilterSchema.optional()
    .describe("Optional filter based on next review due date (supports 'never', 'isDue')"),

  // SRS Level Filter
  srsLevel: srsLevelFilterSchema.optional()
    .describe("Optional filter based on SRS level"),

  // ---- Placeholders for Future Filters ----
  // cardContent: z.string().optional(), // Text search within question/answer
  // srsMetrics: z.object({...}).optional(), // Filtering by EF, interval, stability, difficulty range

  // ---- Placeholder for Sorting ----
  // orderBy: z.object({
  //   field: z.enum(['created_at', 'updated_at', 'question', 'answer', 'last_reviewed_at', 'next_review_due', 'srs_level', 'easiness_factor', 'interval_days']),
  //   direction: z.enum(['ASC', 'DESC'])
  // }).optional()

})
.describe("Schema defining the criteria for selecting cards for a study session");

// --- Infer TypeScript Type ---
export type StudyQueryCriteria = z.infer<typeof StudyQueryCriteriaSchema>;

// Define and export the type for the RPC function's return value (no changes)
export type ResolvedCardId = { card_id: string };