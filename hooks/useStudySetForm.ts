// hooks/useStudySetForm.ts
"use client";

import { useCallback, useMemo } from 'react';
import { useForm, UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { StudyQueryCriteriaSchema, StudyQueryCriteria } from '@/lib/schema/study-query.schema'; // Using the corrected schema
import { useTags } from '@/hooks/useTags';
import { useDecks } from '@/hooks/useDecks';
import type { Tables } from "@/types/database";
import { toast } from 'sonner';
import { format, isValid, parseISO } from "date-fns";
import { DateRange } from "react-day-picker";
import { appLogger, statusLogger } from '@/lib/logger';

type DbTag = Tables<'tags'>;
type DeckListItem = Pick<Tables<'decks'>, 'id' | 'name'>;

// Operator constants (remain the same)
const DateDaysOperators = ['newerThanDays', 'olderThanDays'] as const;
const DateSpecificOperators = ['onDate', 'betweenDates'] as const;
const NullableDateOperators = ['never'] as const;
const DueDateOperators = ['isDue'] as const;
const SrsLevelOperators = ['equals', 'lessThan', 'greaterThan'] as const;

type CreatedUpdatedDateOp = typeof DateDaysOperators[number] | typeof DateSpecificOperators[number];
type LastReviewedDateOp = CreatedUpdatedDateOp | typeof NullableDateOperators[number];
type NextReviewDateOp = CreatedUpdatedDateOp | typeof NullableDateOperators[number] | typeof DueDateOperators[number];
type SrsLevelOp = typeof SrsLevelOperators[number];

// Form Schema (remains the same as your last version)
const studySetFormSchema = z.object({
  name: z.string().trim().min(1, 'Study set name is required').max(100, 'Name too long'),
  description: z.string().trim().max(500, 'Description too long').optional().nullable(),
  selectedDeckId: z.string().uuid().or(z.literal('none')).optional().nullable(),
  includeTags: z.array(z.string().uuid()).optional().default([]),
  tagLogic: z.enum(['ANY', 'ALL']).optional().default('ANY'),
  excludeTags: z.array(z.string().uuid()).optional().default([]),
  createdDateOperator: z.string().nullable().optional(),
  createdDateValueDays: z.string().nullable().optional(),
  createdDateValueDate: z.date().nullable().optional(),
  createdDateValueRange: z.custom<DateRange>((val): val is DateRange => typeof val === 'object' && val !== null && (val.from !== undefined || val.to !== undefined), "Invalid date range").nullable().optional(),
  updatedDateOperator: z.string().nullable().optional(),
  updatedDateValueDays: z.string().nullable().optional(),
  updatedDateValueDate: z.date().nullable().optional(),
  updatedDateValueRange: z.custom<DateRange>((val): val is DateRange => typeof val === 'object' && val !== null && (val.from !== undefined || val.to !== undefined), "Invalid date range").nullable().optional(),
  lastReviewedOperator: z.string().nullable().optional(),
  lastReviewedValueDays: z.string().nullable().optional(),
  lastReviewedValueDate: z.date().nullable().optional(),
  lastReviewedValueRange: z.custom<DateRange>((val): val is DateRange => typeof val === 'object' && val !== null && (val.from !== undefined || val.to !== undefined), "Invalid date range").nullable().optional(),
  nextReviewDueOperator: z.string().nullable().optional(),
  nextReviewDueValueDays: z.string().nullable().optional(),
  nextReviewDueValueDate: z.date().nullable().optional(),
  nextReviewDueValueRange: z.custom<DateRange>((val): val is DateRange => typeof val === 'object' && val !== null && (val.from !== undefined || val.to !== undefined), "Invalid date range").nullable().optional(),
  srsLevelOperator: z.string().nullable().optional(),
  srsLevelValue: z.number().int().gte(0).nullable().optional(),
  includeLearning: z.boolean().optional().nullable(),
}).strict();

export type StudySetBuilderFormData = z.infer<typeof studySetFormSchema>;

// Type for the return of mapDateFilterToCriteria - this will be a general object,
// specific validation happens with Zod at the end.
type GenericDateFilterObject = { operator: string; value?: string | [string, string] };


// parseDateCriteriaForForm (remains same as your last version)
const parseDateCriteriaForForm = (
    criteriaValue?: StudyQueryCriteria[keyof Pick<StudyQueryCriteria, 'createdDate' | 'updatedDate' | 'lastReviewed' | 'nextReviewDue'>]
): { operator: string | null; days: string | null; date: Date | null; range: DateRange | null } => {
    const defaultValue = { operator: null, days: null, date: null, range: null };
    if (!criteriaValue?.operator) return defaultValue;
    const op = criteriaValue.operator;
    const value = 'value' in criteriaValue ? criteriaValue.value : undefined;
    try {
        if ((op === 'newerThanDays' || op === 'olderThanDays') && typeof value === 'string' && /^\d+$/.test(value)) {
            return { ...defaultValue, operator: op, days: value };
        } else if (op === 'onDate' && typeof value === 'string') {
            const parsedDate = parseISO(value);
            return { ...defaultValue, operator: op, date: isValid(parsedDate) ? parsedDate : null };
        } else if (op === 'betweenDates' && Array.isArray(value) && value.length === 2) {
            const fromDate = value[0] && typeof value[0] === 'string' ? parseISO(value[0]) : undefined;
            const toDate = value[1] && typeof value[1] === 'string' ? parseISO(value[1]) : undefined;
            if ((fromDate && isValid(fromDate)) || (toDate && isValid(toDate))) {
                return { ...defaultValue, operator: op, range: { from: fromDate, to: toDate } };
            }
        } else if (op === 'never' || op === 'isDue') {
            return { ...defaultValue, operator: op };
        }
    } catch (e) {
        appLogger.error("Error parsing date criteria for form:", e);
    }
    return defaultValue;
};

const parseSrsLevelCriteriaForForm = (criteriaValue?: StudyQueryCriteria['srsLevel'] ): { operator: string | null; value: number | null } => {
    if (criteriaValue?.operator && typeof criteriaValue.value === 'number') {
        return { operator: criteriaValue.operator, value: criteriaValue.value };
    }
    return { operator: null, value: null };
};

interface UseStudySetFormProps { /* ... */
    initialData?: { id?: string; name: string; description?: string | null; criteria: StudyQueryCriteria };
    onSave: (data: { name: string; description: string | null; criteria: StudyQueryCriteria }) => Promise<void>;
    isSaving?: boolean;
}
export interface UseStudySetFormReturn { /* ... */
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
        includeLearning: boolean | null | undefined;
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

export function useStudySetForm({ initialData, onSave, isSaving = false }: UseStudySetFormProps): UseStudySetFormReturn {
  const { allTags, isLoading: isLoadingTags, error: tagsError } = useTags();
  const { decks, isLoading: isLoadingDecks, error: decksError } = useDecks();

  const initialCreated = useMemo(() => parseDateCriteriaForForm(initialData?.criteria?.createdDate), [initialData]);
  const initialUpdated = useMemo(() => parseDateCriteriaForForm(initialData?.criteria?.updatedDate), [initialData]);
  const initialLastReviewed = useMemo(() => parseDateCriteriaForForm(initialData?.criteria?.lastReviewed), [initialData]);
  const initialNextReviewDue = useMemo(() => parseDateCriteriaForForm(initialData?.criteria?.nextReviewDue), [initialData]);
  const initialSrsLevel = useMemo(() => parseSrsLevelCriteriaForForm(initialData?.criteria?.srsLevel), [initialData]);
  const initialIncludeLearning = useMemo(() => initialData?.criteria?.includeLearning ?? false, [initialData]);

  const form = useForm<StudySetBuilderFormData>({ /* ... */
    resolver: zodResolver(studySetFormSchema),
    defaultValues: {
      name: initialData?.name || '',
      description: initialData?.description ?? null,
      selectedDeckId: initialData?.criteria?.deckId ?? 'none',
      includeTags: initialData?.criteria?.includeTags || [],
      tagLogic: initialData?.criteria?.tagLogic || 'ANY',
      excludeTags: initialData?.criteria?.excludeTags || [],
      createdDateOperator: initialCreated.operator,
      createdDateValueDays: initialCreated.days,
      createdDateValueDate: initialCreated.date,
      createdDateValueRange: initialCreated.range,
      updatedDateOperator: initialUpdated.operator,
      updatedDateValueDays: initialUpdated.days,
      updatedDateValueDate: initialUpdated.date,
      updatedDateValueRange: initialUpdated.range,
      lastReviewedOperator: initialLastReviewed.operator,
      lastReviewedValueDays: initialLastReviewed.days,
      lastReviewedValueDate: initialLastReviewed.date,
      lastReviewedValueRange: initialLastReviewed.range,
      nextReviewDueOperator: initialNextReviewDue.operator,
      nextReviewDueValueDays: initialNextReviewDue.days,
      nextReviewDueValueDate: initialNextReviewDue.date,
      nextReviewDueValueRange: initialNextReviewDue.range,
      srsLevelOperator: initialSrsLevel.operator,
      srsLevelValue: initialSrsLevel.value,
      includeLearning: initialIncludeLearning,
    },
    mode: 'onChange',
  });

  const watchedOperatorsArray = form.watch(['createdDateOperator', 'updatedDateOperator', 'lastReviewedOperator', 'nextReviewDueOperator', 'srsLevelOperator']);
  const watchedFilterValuesArray = form.watch(['includeLearning', 'includeTags', 'excludeTags']);
  const [createdDateOperator, updatedDateOperator, lastReviewedOperator, nextReviewDueOperator, srsLevelOperator] = watchedOperatorsArray;
  const [includeLearning, includeTags, excludeTags] = watchedFilterValuesArray;

  // Corrected mapDateFilterToCriteria
  const mapDateFilterToCriteria = useCallback((
    operator?: string | null,
    days?: string | null,
    date?: Date | null,
    range?: DateRange | null
  ): GenericDateFilterObject | undefined => { // Return a more generic object type
    if (!operator || operator === 'any') return undefined;

    if ((operator === 'newerThanDays' || operator === 'olderThanDays') && days && /^\d+$/.test(days)) {
      return { operator, value: days };
    }
    if (operator === 'onDate' && date && isValid(date)) {
      return { operator, value: format(date, 'yyyy-MM-dd') };
    }
    if (operator === 'betweenDates' && range && range.from && range.to && isValid(range.from) && isValid(range.to)) {
      return { operator, value: [format(range.from, 'yyyy-MM-dd'), format(range.to, 'yyyy-MM-dd')] };
    }
    // For operators without a value, return only the operator
    if (operator === 'never' || operator === 'isDue') {
      return { operator }; // No 'value' property
    }
    return undefined;
  }, []);

  const handleFormSubmit = useCallback(form.handleSubmit(async (formData: StudySetBuilderFormData) => {
    const criteriaToBuild: { [key: string]: any } = {}; // Build as a general object first

    if (formData.selectedDeckId && formData.selectedDeckId !== 'none') {
      criteriaToBuild.deckId = formData.selectedDeckId;
    }
    if (formData.includeTags && formData.includeTags.length > 0) {
      criteriaToBuild.includeTags = formData.includeTags;
      criteriaToBuild.tagLogic = formData.tagLogic ?? 'ANY';
    }
    // No else needed for tagLogic if includeTags is empty, as tagLogic is optional in Zod schema if includeTags is absent

    if (formData.excludeTags && formData.excludeTags.length > 0) {
      criteriaToBuild.excludeTags = formData.excludeTags;
    }

    const createdDateFilter = mapDateFilterToCriteria(formData.createdDateOperator, formData.createdDateValueDays, formData.createdDateValueDate, formData.createdDateValueRange);
    if (createdDateFilter) criteriaToBuild.createdDate = createdDateFilter;

    const updatedDateFilter = mapDateFilterToCriteria(formData.updatedDateOperator, formData.updatedDateValueDays, formData.updatedDateValueDate, formData.updatedDateValueRange);
    if (updatedDateFilter) criteriaToBuild.updatedDate = updatedDateFilter;

    const lastReviewedFilter = mapDateFilterToCriteria(formData.lastReviewedOperator, formData.lastReviewedValueDays, formData.lastReviewedValueDate, formData.lastReviewedValueRange);
    if (lastReviewedFilter) criteriaToBuild.lastReviewed = lastReviewedFilter;

    const nextReviewDueFilter = mapDateFilterToCriteria(formData.nextReviewDueOperator, formData.nextReviewDueValueDays, formData.nextReviewDueValueDate, formData.nextReviewDueValueRange);
    if (nextReviewDueFilter) criteriaToBuild.nextReviewDue = nextReviewDueFilter;

    if (formData.srsLevelOperator && formData.srsLevelOperator !== 'any' &&
        formData.srsLevelValue !== null && formData.srsLevelValue !== undefined && formData.srsLevelValue >= 0) {
      const validSrsOps: SrsLevelOp[] = ['equals', 'lessThan', 'greaterThan'];
      if (validSrsOps.includes(formData.srsLevelOperator as SrsLevelOp)) {
        criteriaToBuild.srsLevel = { operator: formData.srsLevelOperator as SrsLevelOp, value: formData.srsLevelValue };
      }
    }

    if (formData.includeLearning === true) {
      criteriaToBuild.includeLearning = true;
    } else if (formData.includeLearning === false) { // Explicitly handle false
      criteriaToBuild.includeLearning = false;
    }
    // If formData.includeLearning is null/undefined, it's omitted from criteriaToBuild


    // console.log("Criteria before final parse:", JSON.stringify(criteriaToBuild, null, 2));
    const parsedFinalCriteria = StudyQueryCriteriaSchema.safeParse(criteriaToBuild);

    if (!parsedFinalCriteria.success) {
        appLogger.error("Validation of final criteria failed:", parsedFinalCriteria.error.format());
        const errorMessages = parsedFinalCriteria.error.errors.map(err => `${err.path.join('.') || 'criteria'}: ${err.message}`).join('; ');
        toast.error("Error constructing query.", { description: errorMessages || "Some filter values are invalid." });
        return;
    }

    appLogger.info("Final Form Data (Raw for debug):", formData);
    appLogger.info("Generated Criteria for Save:", parsedFinalCriteria.data);

    await onSave({
      name: formData.name,
      description: formData.description ?? null,
      criteria: parsedFinalCriteria.data
    }).catch(err => {
      toast.error("Save failed.");
      appLogger.error("onSave callback error:", err);
    });
  }), [form, onSave, mapDateFilterToCriteria]);

  const isLoadingOverall = isLoadingTags || isLoadingDecks || isSaving;

  return { /* ... same as before ... */
    form,
    isLoading: isLoadingOverall,
    tagsError,
    decksError,
    allTags: allTags || [],
    decks: (decks || []) as DeckListItem[],
    onSubmit: handleFormSubmit,
    watchedOperators: { createdDateOperator, updatedDateOperator, lastReviewedOperator, nextReviewDueOperator, srsLevelOperator },
    watchedFilterValues: { includeLearning, includeTags, excludeTags },
    allowedOperators: {
        createdUpdatedOps: [...DateDaysOperators, ...DateSpecificOperators],
        lastReviewedOps: [...DateDaysOperators, ...DateSpecificOperators, ...NullableDateOperators],
        nextReviewDueOps: [...DateDaysOperators, ...DateSpecificOperators, ...NullableDateOperators, ...DueDateOperators],
        srsLevelOps: [...SrsLevelOperators],
    }
  };
}