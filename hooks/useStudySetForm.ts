// hooks/useStudySetForm.ts
"use client";

import { useCallback, useMemo } from 'react';
import { useForm, UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { StudyQueryCriteriaSchema, StudyQueryCriteria } from '@/lib/schema/study-query.schema';
import { useTags } from '@/hooks/useTags';
import { useDecks } from '@/hooks/useDecks';
import type { Tables } from "@/types/database";
import { toast } from 'sonner';
import { format, isValid, parseISO } from "date-fns";
import { DateRange } from "react-day-picker";

type DbTag = Tables<'tags'>;
type DeckListItem = Pick<Tables<'decks'>, 'id' | 'name'>;

const DateDaysOperators = ['newerThanDays', 'olderThanDays'] as const;
const DateSpecificOperators = ['onDate', 'betweenDates'] as const;
const NullableDateOperators = ['never'] as const;
const DueDateOperators = ['isDue'] as const;
const SrsStageEnum = z.enum(['new', 'learning', 'relearning', 'young', 'mature']);
export type SrsStage = z.infer<typeof SrsStageEnum>;

type CreatedUpdatedDateOp = typeof DateDaysOperators[number] | typeof DateSpecificOperators[number];
type LastReviewedDateOp = CreatedUpdatedDateOp | typeof NullableDateOperators[number];
type NextReviewDateOp = CreatedUpdatedDateOp | typeof NullableDateOperators[number] | typeof DueDateOperators[number];

// Zod Schema for the FORM data (Updated: removed includeLearning)
const studySetFormSchema = z.object({
  name: z.string().trim().min(1, 'Study set name is required').max(100, 'Name too long'),
  description: z.string().trim().max(500, 'Description too long').optional().nullable(),
  selectedDeckIds: z.array(z.string().uuid()).optional().default([]),
  includeTags: z.array(z.string().uuid()).optional().default([]),
  tagLogic: z.enum(['ANY', 'ALL']).optional().default('ANY'),
  excludeTags: z.array(z.string().uuid()).optional().default([]),
  containsLanguage: z.string().length(2).or(z.literal('')).optional().nullable(),
  createdDateOperator: z.string().nullable().optional(),
  createdDateValueDays: z.string().regex(/^\d*$/, "Must be a number").nullable().optional(),
  createdDateValueDate: z.date().nullable().optional(),
  createdDateValueRange: z.custom<DateRange>((val): val is DateRange => typeof val === 'object' && val !== null && (val.from !== undefined || val.to !== undefined), "Invalid date range").nullable().optional(),
  updatedDateOperator: z.string().nullable().optional(),
  updatedDateValueDays: z.string().regex(/^\d*$/, "Must be a number").nullable().optional(),
  updatedDateValueDate: z.date().nullable().optional(),
  updatedDateValueRange: z.custom<DateRange>((val): val is DateRange => typeof val === 'object' && val !== null && (val.from !== undefined || val.to !== undefined), "Invalid date range").nullable().optional(),
  lastReviewedOperator: z.string().nullable().optional(),
  lastReviewedValueDays: z.string().regex(/^\d*$/, "Must be a number").nullable().optional(),
  lastReviewedValueDate: z.date().nullable().optional(),
  lastReviewedValueRange: z.custom<DateRange>((val): val is DateRange => typeof val === 'object' && val !== null && (val.from !== undefined || val.to !== undefined), "Invalid date range").nullable().optional(),
  nextReviewDueOperator: z.string().nullable().optional(),
  nextReviewDueValueDays: z.string().regex(/^\d*$/, "Must be a number").nullable().optional(),
  nextReviewDueValueDate: z.date().nullable().optional(),
  nextReviewDueValueRange: z.custom<DateRange>((val): val is DateRange => typeof val === 'object' && val !== null && (val.from !== undefined || val.to !== undefined), "Invalid date range").nullable().optional(),
  selectedSrsStages: z.array(SrsStageEnum).optional().default([]),
  // includeLearning removed from here
}).strict();

export type StudySetBuilderFormData = z.infer<typeof studySetFormSchema>;

type GenericDateFilterObject = { operator: string; value?: string | [string, string] };

const parseDateCriteriaForForm = ( /* ... same as previous correct version ... */
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
    } catch (e) { console.error("Error parsing date criteria for form:", e); }
    return defaultValue;
};


interface UseStudySetFormProps {
    initialData?: { id?: string; name: string; description?: string | null; criteria: StudyQueryCriteria };
    onSave: (data: { name: string; description: string | null; criteria: StudyQueryCriteria }) => Promise<void>;
    isSaving?: boolean;
}

export interface UseStudySetFormReturn {
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
    };
    watchedFilterValues: {
        // includeLearning removed
        includeTags: string[] | undefined;
        excludeTags: string[] | undefined;
        selectedDeckIds: string[] | undefined;
        selectedSrsStages: SrsStage[] | undefined;
    };
    allowedOperators: {
        createdUpdatedOps: readonly CreatedUpdatedDateOp[];
        lastReviewedOps: readonly LastReviewedDateOp[];
        nextReviewDueOps: readonly NextReviewDateOp[];
    };
    srsStageOptions: readonly SrsStage[];
}

export function useStudySetForm({ initialData, onSave, isSaving = false }: UseStudySetFormProps): UseStudySetFormReturn {
  const { allTags, isLoading: isLoadingTags, error: tagsError } = useTags();
  const { decks, isLoading: isLoadingDecks, error: decksError } = useDecks();

  const initialCreated = useMemo(() => parseDateCriteriaForForm(initialData?.criteria?.createdDate), [initialData]);
  const initialUpdated = useMemo(() => parseDateCriteriaForForm(initialData?.criteria?.updatedDate), [initialData]);
  const initialLastReviewed = useMemo(() => parseDateCriteriaForForm(initialData?.criteria?.lastReviewed), [initialData]);
  const initialNextReviewDue = useMemo(() => parseDateCriteriaForForm(initialData?.criteria?.nextReviewDue), [initialData]);
  // initialIncludeLearning removed

  const form = useForm<StudySetBuilderFormData>({
    resolver: zodResolver(studySetFormSchema),
    defaultValues: {
      name: initialData?.name || '',
      description: initialData?.description ?? null,
      selectedDeckIds: initialData?.criteria?.deckIds || [],
      includeTags: initialData?.criteria?.includeTags || [],
      tagLogic: initialData?.criteria?.tagLogic || 'ANY',
      excludeTags: initialData?.criteria?.excludeTags || [],
      containsLanguage: initialData?.criteria?.containsLanguage || null,
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
      selectedSrsStages: initialData?.criteria?.srsStages || [],
      // includeLearning removed
    },
    mode: 'onChange',
  });

  const watchedOperatorsArray = form.watch(['createdDateOperator', 'updatedDateOperator', 'lastReviewedOperator', 'nextReviewDueOperator']);
  // includeLearning removed from watchedFilterValuesArray
  const watchedFilterValuesArray = form.watch(['includeTags', 'excludeTags', 'selectedDeckIds', 'selectedSrsStages']);
  const [createdDateOperator, updatedDateOperator, lastReviewedOperator, nextReviewDueOperator] = watchedOperatorsArray;
  // includeLearning removed
  const [includeTags, excludeTags, selectedDeckIds, selectedSrsStages] = watchedFilterValuesArray;

  const mapDateFilterToCriteria = useCallback(( /* ... same as previous correct version ... */
    operator?: string | null,
    days?: string | null,
    date?: Date | null,
    range?: DateRange | null
  ): GenericDateFilterObject | undefined => {
    if (!operator || operator === 'any') return undefined;
    if ((operator === 'newerThanDays' || operator === 'olderThanDays') && days && /^\d+$/.test(days) && parseInt(days, 10) > 0) {
      return { operator, value: days };
    }
    if (operator === 'onDate' && date && isValid(date)) {
      return { operator, value: format(date, 'yyyy-MM-dd') };
    }
    if (operator === 'betweenDates' && range && range.from && range.to && isValid(range.from) && isValid(range.to)) {
      return { operator, value: [format(range.from, 'yyyy-MM-dd'), format(range.to, 'yyyy-MM-dd')] };
    }
    if (operator === 'never' || operator === 'isDue') {
      return { operator };
    }
    return undefined;
  }, []);

  const handleFormSubmit = useCallback(form.handleSubmit(async (formData: StudySetBuilderFormData) => {
    const criteriaToBuild: { [key: string]: any } = {};

    if (formData.selectedDeckIds && formData.selectedDeckIds.length > 0) {
      criteriaToBuild.deckIds = formData.selectedDeckIds;
    }
    if (formData.includeTags && formData.includeTags.length > 0) {
      criteriaToBuild.includeTags = formData.includeTags;
      criteriaToBuild.tagLogic = formData.tagLogic ?? 'ANY';
    }
    if (formData.excludeTags && formData.excludeTags.length > 0) {
      criteriaToBuild.excludeTags = formData.excludeTags;
    }
    if (formData.containsLanguage && formData.containsLanguage.length === 2) {
        criteriaToBuild.containsLanguage = formData.containsLanguage;
    }

    const createdDateFilter = mapDateFilterToCriteria(formData.createdDateOperator, formData.createdDateValueDays, formData.createdDateValueDate, formData.createdDateValueRange);
    if (createdDateFilter) criteriaToBuild.createdDate = createdDateFilter;
    const updatedDateFilter = mapDateFilterToCriteria(formData.updatedDateOperator, formData.updatedDateValueDays, formData.updatedDateValueDate, formData.updatedDateValueRange);
    if (updatedDateFilter) criteriaToBuild.updatedDate = updatedDateFilter;
    const lastReviewedFilter = mapDateFilterToCriteria(formData.lastReviewedOperator, formData.lastReviewedValueDays, formData.lastReviewedValueDate, formData.lastReviewedValueRange);
    if (lastReviewedFilter) criteriaToBuild.lastReviewed = lastReviewedFilter;
    const nextReviewDueFilter = mapDateFilterToCriteria(formData.nextReviewDueOperator, formData.nextReviewDueValueDays, formData.nextReviewDueValueDate, formData.nextReviewDueValueRange);
    if (nextReviewDueFilter) criteriaToBuild.nextReviewDue = nextReviewDueFilter;

    if (formData.selectedSrsStages && formData.selectedSrsStages.length > 0) {
        criteriaToBuild.srsStages = formData.selectedSrsStages;
    }

    // includeLearning mapping removed
    // The includeLearning flag can still be part of StudyQueryCriteria for other uses,
    // but it's not set via this specific form anymore.

    const parsedFinalCriteria = StudyQueryCriteriaSchema.safeParse(criteriaToBuild);
    if (!parsedFinalCriteria.success) {
        console.error("Validation of final criteria failed:", parsedFinalCriteria.error.format());
        const errorMessages = parsedFinalCriteria.error.errors.map(err => `${err.path.join('.') || 'criteria'}: ${err.message}`).join('; ');
        toast.error("Error constructing query.", { description: errorMessages || "Some filter values are invalid." });
        return;
    }

    console.log("Generated Criteria for Save:", parsedFinalCriteria.data);
    await onSave({
      name: formData.name,
      description: formData.description ?? null,
      criteria: parsedFinalCriteria.data
    }).catch(err => {
      toast.error("Save failed.");
      console.error("onSave callback error:", err);
    });
  }), [form, onSave, mapDateFilterToCriteria]);

  const isLoadingOverall = isLoadingTags || isLoadingDecks || isSaving;

  return {
    form,
    isLoading: isLoadingOverall,
    tagsError,
    decksError,
    allTags: allTags || [],
    decks: (decks || []) as DeckListItem[],
    onSubmit: handleFormSubmit,
    watchedOperators: { createdDateOperator, updatedDateOperator, lastReviewedOperator, nextReviewDueOperator },
    watchedFilterValues: { /* includeLearning removed */ includeTags, excludeTags, selectedDeckIds, selectedSrsStages },
    allowedOperators: {
        createdUpdatedOps: [...DateDaysOperators, ...DateSpecificOperators],
        lastReviewedOps: [...DateDaysOperators, ...DateSpecificOperators, ...NullableDateOperators],
        nextReviewDueOps: [...DateDaysOperators, ...DateSpecificOperators, ...NullableDateOperators, ...DueDateOperators],
    },
    srsStageOptions: [...SrsStageEnum.options]
  };
}