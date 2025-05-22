// lib/schema/study-query.schema.ts
import { z } from 'zod';

// --- Shared Schemas for Date Filter Values ---
const dateStringSchema = z.string().datetime({ offset: true })
  .describe("Date or timestamp in ISO 8601 format (e.g., '2024-07-31T00:00:00+00:00')");
const dateRangeSchema = z.tuple([dateStringSchema, dateStringSchema])
  .describe("A tuple containing two non-null date/time strings in ISO 8601 format for start and end");
const numberOfDaysSchema = z.string().regex(/^\d+$/, "Value must be a whole number of days represented as a string")
  .describe("Number of days, represented as a string (e.g., '7')");

// --- Specific Schemas for Different Date Filter Types using discriminatedUnion ---
const newerThanDaysFilterSchema = z.object({
  operator: z.literal('newerThanDays'),
  value: numberOfDaysSchema, // Value is a string representing a number
});
const olderThanDaysFilterSchema = z.object({
  operator: z.literal('olderThanDays'),
  value: numberOfDaysSchema, // Value is a string representing a number
});
const onDateFilterSchema = z.object({
  operator: z.literal('onDate'),
  value: dateStringSchema,
});
const betweenDatesFilterSchema = z.object({
  operator: z.literal('betweenDates'),
  value: dateRangeSchema,
});
const neverFilterSchema = z.object({
  operator: z.literal('never'),
  value: z.undefined().optional(),
});
const isDueFilterSchema = z.object({
  operator: z.literal('isDue'),
  value: z.undefined().optional(),
});

const CreatedUpdatedDateFilterSchema = z.discriminatedUnion("operator", [
  newerThanDaysFilterSchema,
  olderThanDaysFilterSchema,
  onDateFilterSchema,
  betweenDatesFilterSchema,
]);
const LastReviewedDateFilterSchema = z.discriminatedUnion("operator", [
  newerThanDaysFilterSchema,
  olderThanDaysFilterSchema,
  onDateFilterSchema,
  betweenDatesFilterSchema,
  neverFilterSchema,
]);
const NextReviewDueDateFilterSchema = z.discriminatedUnion("operator", [
  newerThanDaysFilterSchema,
  olderThanDaysFilterSchema,
  onDateFilterSchema,
  betweenDatesFilterSchema,
  neverFilterSchema,
  isDueFilterSchema,
]);

// --- Main Study Query Criteria Schema (Updated) ---
export const StudyQueryCriteriaSchema = z.object({
  // Core Filters
  deckIds: z.array(z.string().uuid("Invalid Deck ID format")).optional() // Changed from deckId to deckIds (array)
    .describe("Optional array of Deck UUIDs to filter by"),
  allCards: z.boolean().optional()
    .describe("If true, fetch all cards for the user, overriding most other filters except possibly user-level ones"),
  includeTags: z.array(z.string().uuid("Invalid Tag ID format")).optional()
    .describe("Optional array of Tag UUIDs (deck tags) to include"),
  excludeTags: z.array(z.string().uuid("Invalid Tag ID format")).optional()
    .describe("Optional array of Tag UUIDs (deck tags) to exclude"),
  tagLogic: z.enum(['ANY', 'ALL']).optional().default('ANY')
    .describe("Logic for 'includeTags': ANY (default) or ALL"),
  includeLearning: z.boolean().optional()
    .describe("If true, includes cards primarily for initial learning (srs_level = 0 and learning_state is null or 'learning')"),

  // NEW Language Filter
  containsLanguage: z.string().length(2, "Language code must be 2 characters").optional() // e.g., "en", "fr"
    .describe("Optional 2-letter ISO language code. Filters cards where this language is primary OR (if deck is bilingual) secondary."),

  // Date Filters
  createdDate: CreatedUpdatedDateFilterSchema.optional(),
  updatedDate: CreatedUpdatedDateFilterSchema.optional(),
  lastReviewed: LastReviewedDateFilterSchema.optional(),
  nextReviewDue: NextReviewDueDateFilterSchema.optional(),

  // NEW SRS Stage Filter (replaces old srsLevel numeric filter)
  srsStages: z.array(z.enum(['new', 'learning', 'relearning', 'young', 'mature'])).optional()
    .describe("Optional array of SRS stage names to include cards from."),

  // REMOVED: srsLevel: srsLevelFilterSchema.optional()
})
.describe("Schema defining the criteria for selecting cards for a study session");

export type StudyQueryCriteria = z.infer<typeof StudyQueryCriteriaSchema>;
export type ResolvedCardId = { card_id: string };

// Alias for backward compatibility if needed (though direct export is fine)
export const studyQueryCriteriaSchema = StudyQueryCriteriaSchema;