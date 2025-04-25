// hooks/useStudySetForm.ts
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useForm, UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod'; // Zod is needed here
// Import the schema object and type
import { studyQueryCriteriaSchema, StudyQueryCriteria } from '@/lib/schema/study-query.schema';
import { useTags } from '@/hooks/useTags';
import { useDecks } from '@/hooks/useDecks';
import type { Database, Tables } from "@/types/database";
type DbTag = Tables<'tags'>;
// Type for deck list item from useDecks
type DeckListItem = Pick<Tables<'decks'>, 'id' | 'name' | 'primary_language' | 'secondary_language' | 'is_bilingual' | 'updated_at'> & { card_count: number };
import { toast } from 'sonner';
import { format, isValid, parseISO } from "date-fns";
import { DateRange } from "react-day-picker";

// Define allowed operator types (constants)
const DateDaysOperators = ['newerThanDays', 'olderThanDays'] as const;
const DateSpecificOperators = ['onDate', 'betweenDates'] as const;
const NullableDateOperators = ['never'] as const;
const DueDateOperators = ['isDue'] as const;
const SrsLevelOperators = ['equals', 'lessThan', 'greaterThan'] as const;

// Define combined operator types
type CreatedUpdatedDateOp = typeof DateDaysOperators[number] | typeof DateSpecificOperators[number];
type LastReviewedDateOp = CreatedUpdatedDateOp | typeof NullableDateOperators[number];
type NextReviewDateOp = CreatedUpdatedDateOp | typeof NullableDateOperators[number] | typeof DueDateOperators[number];
type SrsLevelOp = typeof SrsLevelOperators[number];

// --- Define a Zod Schema specifically for the FORM data ---
const studySetFormSchema = z.object({
  name: z.string().trim().min(1, 'Study set name is required').max(100, 'Name too long'),
  description: z.string().trim().max(500, 'Description too long').optional().nullable(),
  selectedDeckId: z.string().uuid().or(z.literal('none')).optional().nullable(),
  includeTags: z.array(z.string().uuid()).optional().default([]),
  tagLogic: z.enum(['ANY', 'ALL']).default('ANY'),
  excludeTags: z.array(z.string().uuid()).optional().default([]),
  createdDateOperator: z.string().nullable().optional(),
  createdDateValueDays: z.number().int().positive().nullable().optional(),
  createdDateValueDate: z.date().nullable().optional(),
  createdDateValueRange: z.custom<DateRange>((val) => typeof val === 'object' && val !== null && ('from' in val || 'to' in val || (val as DateRange).from === undefined && (val as DateRange).to === undefined)).nullable().optional(),
  updatedDateOperator: z.string().nullable().optional(),
  updatedDateValueDays: z.number().int().positive().nullable().optional(),
  updatedDateValueDate: z.date().nullable().optional(),
  updatedDateValueRange: z.custom<DateRange>((val) => typeof val === 'object' && val !== null && ('from' in val || 'to' in val || (val as DateRange).from === undefined && (val as DateRange).to === undefined)).nullable().optional(),
  lastReviewedOperator: z.string().nullable().optional(),
  lastReviewedValueDays: z.number().int().positive().nullable().optional(),
  lastReviewedValueDate: z.date().nullable().optional(),
  lastReviewedValueRange: z.custom<DateRange>((val) => typeof val === 'object' && val !== null && ('from' in val || 'to' in val || (val as DateRange).from === undefined && (val as DateRange).to === undefined)).nullable().optional(),
  nextReviewDueOperator: z.string().nullable().optional(),
  nextReviewDueValueDays: z.number().int().positive().nullable().optional(),
  nextReviewDueValueDate: z.date().nullable().optional(),
  nextReviewDueValueRange: z.custom<DateRange>((val) => typeof val === 'object' && val !== null && ('from' in val || 'to' in val || (val as DateRange).from === undefined && (val as DateRange).to === undefined)).nullable().optional(),
  srsLevelOperator: z.string().nullable().optional(),
  srsLevelValue: z.number().int().gte(0).nullable().optional(),
  includeDifficult: z.boolean().nullable().optional(),
}).strict();

// Export Form Data type if needed elsewhere, otherwise keep internal
export type StudySetBuilderFormData = z.infer<typeof studySetFormSchema>;


// --- Helper to parse Date Criteria from DB schema to Form schema ---
const parseDateCriteriaForForm = (criteriaValue: StudyQueryCriteria['createdDate'] | undefined): { operator: string | null, days: number | null, date: Date | null, range: DateRange | null } => {
    const defaultValue = { operator: null, days: null, date: null, range: null };
    let operator: string | null = null; let days = null, date = null, range = null;
    const op = criteriaValue?.operator; const value = criteriaValue?.value;
    if (!op) return defaultValue; operator = op;
    try {
        if ((op === 'newerThanDays' || op === 'olderThanDays') && typeof value === 'number') { days = value; }
        else if (op === 'onDate' && typeof value === 'string') { const parsed = parseISO(value + 'T00:00:00Z'); if (isValid(parsed)) date = parsed; }
        else if (op === 'betweenDates' && Array.isArray(value)) {
            const fromString = value[0]; const toString = value[1]; let fromDate = undefined, toDate = undefined;
            if (fromString && typeof fromString === 'string') { const parsed = parseISO(fromString); if (isValid(parsed)) fromDate = parsed; }
            if (toString && typeof toString === 'string') { const parsed = parseISO(toString); if (isValid(parsed)) toDate = parsed; }
            if (fromDate !== undefined || toDate !== undefined) { range = { from: fromDate, to: toDate }; }
        }
    } catch (e) { console.error("Error parsing date criteria:", e); return defaultValue; }
    return { operator, days, date, range };
};

// Helper to parse initial SRS Level from DB schema to Form schema
const parseSrsLevelCriteriaForForm = (criteriaValue: StudyQueryCriteria['srsLevel'] | undefined): { operator: string | null, value: number | null } => {
    const op = criteriaValue?.operator; const value = criteriaValue?.value;
    if (op && typeof value === 'number') return { operator: op, value };
    return { operator: null, value: null };
};

// --- Custom Hook Props Interface ---
interface UseStudySetFormProps {
    initialData?: { id?: string; name: string; description?: string | null; criteria: StudyQueryCriteria; };
    onSave: (data: { name: string; description: string | null; criteria: StudyQueryCriteria }) => Promise<void>;
    isSaving?: boolean;
}

// --- FIX: Export the hook's return type ---
export interface UseStudySetFormReturn { // Use export keyword
    form: UseFormReturn<StudySetBuilderFormData>;
    isLoading: boolean;
    tagsError: string | null;
    decksError: string | null;
    allTags: DbTag[];
    decks: DeckListItem[];
    onSubmit: (e?: React.BaseSyntheticEvent) => Promise<void>;
    watchedOperators: {
        createdDateOperator: string | null | undefined;
        updatedDateOperator: string | null | undefined;
        lastReviewedOperator: string | null | undefined;
        nextReviewDueOperator: string | null | undefined;
        srsLevelOperator: string | null | undefined;
    };
    watchedFilterValues: {
        includeDifficult: boolean | null | undefined;
        includeTags: string[] | undefined;
        excludeTags: string[] | undefined;
    };
    allowedOperators: {
        createdUpdatedOps: readonly CreatedUpdatedDateOp[];
        lastReviewedOps: readonly LastReviewedDateOp[];
        nextReviewDueOps: readonly NextReviewDateOp[];
        srsLevelOps: readonly SrsLevelOp[];
    };
}
// -----------------------------------------

// --- Hook Implementation ---
export function useStudySetForm({ initialData, onSave, isSaving = false }: UseStudySetFormProps): UseStudySetFormReturn {
  const { allTags, isLoading: isLoadingTags, error: tagsError } = useTags();
  const { decks, isLoading: isLoadingDecks, error: decksError } = useDecks();

  // Parse initial data memoized
  const initialCreated = useMemo(() => parseDateCriteriaForForm(initialData?.criteria?.createdDate), [initialData]);
  const initialUpdated = useMemo(() => parseDateCriteriaForForm(initialData?.criteria?.updatedDate), [initialData]);
  const initialLastReviewed = useMemo(() => parseDateCriteriaForForm(initialData?.criteria?.lastReviewed), [initialData]);
  const initialNextReviewDue = useMemo(() => parseDateCriteriaForForm(initialData?.criteria?.nextReviewDue), [initialData]);
  const initialSrsLevel = useMemo(() => parseSrsLevelCriteriaForForm(initialData?.criteria?.srsLevel), [initialData]);
  const initialIncludeDifficult = useMemo(() => initialData?.criteria?.includeDifficult ?? false, [initialData]);

  // Setup form
  const form = useForm<StudySetBuilderFormData>({
    resolver: zodResolver(studySetFormSchema),
    defaultValues: {
      name: initialData?.name || '', description: initialData?.description ?? null,
      selectedDeckId: initialData?.criteria?.deckId ?? 'none',
      includeTags: initialData?.criteria?.includeTags || [], tagLogic: initialData?.criteria?.tagLogic || 'ANY', excludeTags: initialData?.criteria?.excludeTags || [],
      createdDateOperator: initialCreated.operator, createdDateValueDays: initialCreated.days, createdDateValueDate: initialCreated.date, createdDateValueRange: initialCreated.range,
      updatedDateOperator: initialUpdated.operator, updatedDateValueDays: initialUpdated.days, updatedDateValueDate: initialUpdated.date, updatedDateValueRange: initialUpdated.range,
      lastReviewedOperator: initialLastReviewed.operator, lastReviewedValueDays: initialLastReviewed.days, lastReviewedValueDate: initialLastReviewed.date, lastReviewedValueRange: initialLastReviewed.range,
      nextReviewDueOperator: initialNextReviewDue.operator, nextReviewDueValueDays: initialNextReviewDue.days, nextReviewDueValueDate: initialNextReviewDue.date, nextReviewDueValueRange: initialNextReviewDue.range,
      srsLevelOperator: initialSrsLevel.operator, srsLevelValue: initialSrsLevel.value,
      includeDifficult: initialIncludeDifficult,
    },
    mode: 'onChange',
  });

  // Watch relevant form values
  const watchedOperatorsArray = form.watch(['createdDateOperator', 'updatedDateOperator', 'lastReviewedOperator', 'nextReviewDueOperator', 'srsLevelOperator']);
  const watchedFilterValuesArray = form.watch(['includeDifficult', 'includeTags', 'excludeTags']);
  const [createdDateOperator, updatedDateOperator, lastReviewedOperator, nextReviewDueOperator, srsLevelOperator] = watchedOperatorsArray;
  const [includeDifficult, includeTags, excludeTags] = watchedFilterValuesArray;

  // --- onSubmit Handler (Maps Form Data -> DB Schema) ---
  // Memoize the mapping helper
  const mapDateFilterToCriteria = useCallback((
      operator: StudySetBuilderFormData['createdDateOperator'], days: StudySetBuilderFormData['createdDateValueDays'], date: StudySetBuilderFormData['createdDateValueDate'], range: StudySetBuilderFormData['createdDateValueRange']
  ): StudyQueryCriteria['createdDate'] | undefined => {
      // (Mapping logic remains the same as previous correct version)
      if (!operator || operator === 'any') return undefined;
      const schemaOperators: (CreatedUpdatedDateOp | LastReviewedDateOp | NextReviewDateOp)[] = [...DateDaysOperators, ...DateSpecificOperators, ...NullableDateOperators, ...DueDateOperators];
      if (!schemaOperators.includes(operator as any)) return undefined;
      const schemaOperator = operator as typeof schemaOperators[number];
      if ((schemaOperator === 'newerThanDays' || schemaOperator === 'olderThanDays') && typeof days === 'number' && days > 0) return { operator: schemaOperator, value: days };
      if (schemaOperator === 'onDate' && date && isValid(date)) return { operator: schemaOperator, value: format(date, 'yyyy-MM-dd') };
      if (schemaOperator === 'betweenDates' && range) {
          const fromISO = range.from ? range.from.toISOString() : null; const toISO = range.to ? range.to.toISOString() : null;
          if (fromISO !== null || toISO !== null) { const valueArray = (fromISO !== null && toISO !== null) && fromISO > toISO ? [toISO, fromISO] : [fromISO, toISO]; return { operator: 'betweenDates', value: valueArray as [string | null, string | null] }; }
          return undefined;
      }
      if (schemaOperator === 'never') return { operator: 'never' };
      if (schemaOperator === 'isDue') return { operator: 'isDue' };
      return undefined;
  }, []); // Empty dependency array for pure mapping logic

  // Memoize the RHF submit handler wrapper
  const handleFormSubmit = useCallback(form.handleSubmit(async (formData: StudySetBuilderFormData) => {
    const criteria: StudyQueryCriteria = {};
    // Map deckId, tags
    if (formData.selectedDeckId && formData.selectedDeckId !== 'none') criteria.deckId = formData.selectedDeckId;
    if (formData.includeTags && formData.includeTags.length > 0) { criteria.includeTags = formData.includeTags; criteria.tagLogic = formData.tagLogic ?? 'ANY'; } else { delete criteria.tagLogic; }
    if (formData.excludeTags && formData.excludeTags.length > 0) criteria.excludeTags = formData.excludeTags;
    // Map dates
    criteria.createdDate = mapDateFilterToCriteria(formData.createdDateOperator, formData.createdDateValueDays, formData.createdDateValueDate, formData.createdDateValueRange);
    criteria.updatedDate = mapDateFilterToCriteria(formData.updatedDateOperator, formData.updatedDateValueDays, formData.updatedDateValueDate, formData.updatedDateValueRange);
    criteria.lastReviewed = mapDateFilterToCriteria(formData.lastReviewedOperator, formData.lastReviewedValueDays, formData.lastReviewedValueDate, formData.lastReviewedValueRange);
    criteria.nextReviewDue = mapDateFilterToCriteria(formData.nextReviewDueOperator, formData.nextReviewDueValueDays, formData.nextReviewDueValueDate, formData.nextReviewDueValueRange);
    // Remove undefined
    for (const key of ['createdDate', 'updatedDate', 'lastReviewed', 'nextReviewDue', 'srsLevel', 'includeDifficult'] as (keyof StudyQueryCriteria)[]) { if (criteria[key] === undefined) { if (key in criteria) delete criteria[key]; } }
    // Map SRS
    if (formData.srsLevelOperator && formData.srsLevelOperator !== 'any' && (formData.srsLevelValue !== null && formData.srsLevelValue !== undefined && formData.srsLevelValue >= 0)) {
        const validOperators: SrsLevelOp[] = ['equals', 'lessThan', 'greaterThan'];
        if (validOperators.includes(formData.srsLevelOperator as any)) criteria.srsLevel = { operator: formData.srsLevelOperator as SrsLevelOp, value: formData.srsLevelValue };
    }
    // Map includeDifficult
    if (formData.includeDifficult === true) criteria.includeDifficult = true;

    console.log("Final Form Data (Raw):", formData);
    console.log("Generated Criteria for Save:", criteria);
    await onSave({ name: formData.name, description: formData.description ?? null, criteria }).catch(err => { toast.error("Save failed."); console.error("onSave error:", err); });
  }), [form, onSave, mapDateFilterToCriteria]); // Include mapDateFilterToCriteria in deps

  // Combine loading states
  const isLoading = isLoadingTags || isLoadingDecks || isSaving;

  // Return hook outputs
  return {
    form,
    isLoading,
    tagsError,
    decksError,
    allTags: allTags || [],
    decks: (decks || []) as DeckListItem[], // Cast to expected type
    onSubmit: handleFormSubmit, // Return the memoized RHF handleSubmit wrapper
    watchedOperators: { createdDateOperator, updatedDateOperator, lastReviewedOperator, nextReviewDueOperator, srsLevelOperator },
    watchedFilterValues: { includeDifficult, includeTags, excludeTags },
    allowedOperators: {
        createdUpdatedOps: [...DateDaysOperators, ...DateSpecificOperators],
        lastReviewedOps: [...DateDaysOperators, ...DateSpecificOperators, ...NullableDateOperators],
        nextReviewDueOps: [...DateDaysOperators, ...DateSpecificOperators, ...NullableDateOperators, ...DueDateOperators],
        srsLevelOps: [...SrsLevelOperators],
    }
  };
}