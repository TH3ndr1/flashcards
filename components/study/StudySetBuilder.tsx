'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandItem, CommandGroup, CommandEmpty } from '@/components/ui/command';
import { Calendar } from "@/components/ui/calendar";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useTags } from '@/hooks/useTags';
import { useDecks } from '@/hooks/useDecks';
import type { StudyQueryCriteria } from '@/lib/schema/study-query.schema';
import type { Database, Tables } from "@/types/database";
import type { DbTag } from '@/types/database';
import { toast } from 'sonner';
import { cn } from "@/lib/utils";
import { CalendarIcon, Check, ChevronsUpDown, Loader2 as IconLoader, Plus as IconPlus, X as IconX } from "lucide-react";
import { format, isValid, parseISO } from "date-fns";
import { Badge } from '@/components/ui/badge';
import { DateRange } from "react-day-picker";
import { StudyInput } from '@/store/studySessionStore';

// Define allowed operator types
const DateDaysOperators = z.enum(['newerThanDays', 'olderThanDays']);
const DateSpecificOperators = z.enum(['onDate', 'betweenDates']);
const NullableDateOperators = z.enum(['never']);
const DueDateOperators = z.enum(['isDue']);
const SrsLevelOperators = z.enum(['equals', 'lessThan', 'greaterThan']);

// --- Zod Schema for the Builder Form (All Fields Added) ---
const studySetBuilderSchema = z.object({
  name: z.string().trim().min(1, 'Study set name is required').max(100, 'Name too long'),
  description: z.string().trim().max(500, 'Description too long').optional().nullable(),
  selectedDeckId: z.string().uuid().or(z.literal('none')).optional().nullable(),
  includeTags: z.array(z.string().uuid()).optional().default([]),
  tagLogic: z.enum(['ANY', 'ALL']).default('ANY'),
  excludeTags: z.array(z.string().uuid()).optional().default([]),

  // Created Date
  createdDateOperator: DateDaysOperators.or(DateSpecificOperators).optional().nullable(),
  createdDateValueDays: z.number().int().positive().optional().nullable(),
  createdDateValueDate: z.date().optional().nullable(),
  createdDateValueRange: z.custom<DateRange>((val) => typeof val === 'object' && val !== null && ('from' in val || 'to' in val)).optional().nullable(),

  // Updated Date
  updatedDateOperator: DateDaysOperators.or(DateSpecificOperators).optional().nullable(),
  updatedDateValueDays: z.number().int().positive().optional().nullable(),
  updatedDateValueDate: z.date().optional().nullable(),
  updatedDateValueRange: z.custom<DateRange>((val) => typeof val === 'object' && val !== null && ('from' in val || 'to' in val)).optional().nullable(),

  // Last Reviewed
  lastReviewedOperator: DateDaysOperators.or(DateSpecificOperators).or(NullableDateOperators).optional().nullable(),
  lastReviewedValueDays: z.number().int().positive().optional().nullable(),
  lastReviewedValueDate: z.date().optional().nullable(),
  lastReviewedValueRange: z.custom<DateRange>((val) => typeof val === 'object' && val !== null && ('from' in val || 'to' in val)).optional().nullable(),

  // Next Review Due
  nextReviewDueOperator: DateDaysOperators.or(DateSpecificOperators).or(NullableDateOperators).or(DueDateOperators).optional().nullable(),
  nextReviewDueValueDays: z.number().int().positive().optional().nullable(),
  nextReviewDueValueDate: z.date().optional().nullable(),
  nextReviewDueValueRange: z.custom<DateRange>((val) => typeof val === 'object' && val !== null && ('from' in val || 'to' in val)).optional().nullable(),

  // SRS Level
  srsLevelOperator: SrsLevelOperators.optional().nullable(),
  srsLevelValue: z.number().int().gte(0).optional().nullable(),
}).strict();

type StudySetBuilderFormData = z.infer<typeof studySetBuilderSchema>;
type DbDeck = Tables<'decks'>;

// --- Component Props ---
interface StudySetBuilderProps {
  initialData?: { id?: string; name: string; description?: string | null; criteria: StudyQueryCriteria; };
  onSave: (data: { name: string; description: string | null; criteria: StudyQueryCriteria }) => Promise<void>;
  isSaving?: boolean;
}

// --- Component Implementation ---
export function StudySetBuilder({ initialData, onSave, isSaving = false }: StudySetBuilderProps) {
  const { allTags, isLoading: isLoadingTags, error: tagsError } = useTags();
  const { decks, isLoading: isLoadingDecks, error: decksError } = useDecks();

  // --- Calculate Default Values ---
  // Helper to get initial operator safely
  const getInitialOperator = <T extends string>(criteriaOp: string | undefined | null, allowedOps: readonly T[]): T | null => {
      return (!!criteriaOp && allowedOps.includes(criteriaOp as T)) ? criteriaOp as T : null;
  }
  // Helper function to parse Date Criteria from initialData
  const parseDateCriteria = (criteriaValue: any): { days: number | null, date: Date | null, range: DateRange | null } => {
      let days = null, date = null, range = null;
      const operator = criteriaValue?.operator;
      const value = criteriaValue?.value;
      try {
          if ((operator === 'newerThanDays' || operator === 'olderThanDays') && typeof value === 'number') {
              days = value;
          } else if (operator === 'onDate' && typeof value === 'string') {
              const parsed = parseISO(value + 'T00:00:00Z'); // Assume stored date is UTC, parse as such
              if (isValid(parsed)) date = parsed;
          } else if (operator === 'betweenDates' && Array.isArray(value) && value.length === 2) {
              const fromDate = parseISO(value[0]); // Assume ISO string from DB
              const toDate = parseISO(value[1]);
              if (isValid(fromDate) && isValid(toDate)) { range = { from: fromDate, to: toDate }; }
              else if (isValid(fromDate)) { range = { from: fromDate, to: undefined }; }
          }
      } catch (e) {
          console.error("Error parsing date criteria from initialData:", e);
      }
      return { days, date, range };
  };

  const initialCreated = parseDateCriteria(initialData?.criteria?.createdDate);
  const initialUpdated = parseDateCriteria(initialData?.criteria?.updatedDate);
  const initialLastReviewed = parseDateCriteria(initialData?.criteria?.lastReviewed);
  const initialNextReviewDue = parseDateCriteria(initialData?.criteria?.nextReviewDue);

  const allowedCreatedUpdatedOps = ['newerThanDays', 'olderThanDays', 'onDate', 'betweenDates'] as const;
  const allowedLastReviewedOps = [...allowedCreatedUpdatedOps, 'never'] as const;
  const allowedNextReviewDueOps = [...allowedCreatedUpdatedOps, 'never', 'isDue'] as const;
  const allowedSrsLevelOps = ['equals', 'lessThan', 'greaterThan'] as const;


  const form = useForm<StudySetBuilderFormData>({
    resolver: zodResolver(studySetBuilderSchema),
    defaultValues: {
      name: initialData?.name || '',
      description: initialData?.description ?? null, // Ensure null default
      selectedDeckId: initialData?.criteria?.deckId ?? 'none',
      includeTags: initialData?.criteria?.includeTags || [],
      tagLogic: initialData?.criteria?.tagLogic || 'ANY',
      excludeTags: initialData?.criteria?.excludeTags || [],

      createdDateOperator: getInitialOperator(initialData?.criteria?.createdDate?.operator, allowedCreatedUpdatedOps),
      createdDateValueDays: initialCreated.days,
      createdDateValueDate: initialCreated.date,
      createdDateValueRange: initialCreated.range,

      updatedDateOperator: getInitialOperator(initialData?.criteria?.updatedDate?.operator, allowedCreatedUpdatedOps),
      updatedDateValueDays: initialUpdated.days,
      updatedDateValueDate: initialUpdated.date,
      updatedDateValueRange: initialUpdated.range,

      lastReviewedOperator: getInitialOperator(initialData?.criteria?.lastReviewed?.operator, allowedLastReviewedOps),
      lastReviewedValueDays: initialLastReviewed.days,
      lastReviewedValueDate: initialLastReviewed.date,
      lastReviewedValueRange: initialLastReviewed.range,

      nextReviewDueOperator: getInitialOperator(initialData?.criteria?.nextReviewDue?.operator, allowedNextReviewDueOps),
      nextReviewDueValueDays: initialNextReviewDue.days,
      nextReviewDueValueDate: initialNextReviewDue.date,
      nextReviewDueValueRange: initialNextReviewDue.range,

      srsLevelOperator: getInitialOperator(initialData?.criteria?.srsLevel?.operator, allowedSrsLevelOps),
      srsLevelValue: (getInitialOperator(initialData?.criteria?.srsLevel?.operator, allowedSrsLevelOps) ? initialData?.criteria?.srsLevel?.value : null) ?? null,
    },
  });

  // Watch operator fields
  const createdDateOperator = form.watch('createdDateOperator');
  const updatedDateOperator = form.watch('updatedDateOperator');
  const lastReviewedOperator = form.watch('lastReviewedOperator');
  const nextReviewDueOperator = form.watch('nextReviewDueOperator');
  const srsLevelOperator = form.watch('srsLevelOperator');

  // Helper to get tag objects from IDs
  const getTagObjects = (ids: string[] = [], all: DbTag[] = []): DbTag[] => {
     if (!Array.isArray(all)) return [];
     const idMap = new Map(all.map(tag => [tag.id, tag]));
     return ids.map(id => idMap.get(id)).filter((tag): tag is DbTag => tag !== undefined);
  };

  // --- onSubmit with Full Mapping ---
  const onSubmit = (formData: StudySetBuilderFormData) => {
    const criteria: StudyQueryCriteria = {};

    // 1. Deck Filter
    if (formData.selectedDeckId && formData.selectedDeckId !== 'none') {
      criteria.deckId = formData.selectedDeckId;
    }

    // 2. Tag Filters
    if (formData.includeTags && formData.includeTags.length > 0) {
      criteria.includeTags = formData.includeTags;
      criteria.tagLogic = formData.tagLogic ?? 'ANY'; 
    } else {
      // Explicitly remove tagLogic if no includeTags are selected
      delete criteria.tagLogic; 
    }
    if (formData.excludeTags && formData.excludeTags.length > 0) {
      criteria.excludeTags = formData.excludeTags;
    }

    // 3. Date Filter Mapping Helper (Updated)
    const mapDateFilter = (
        operator: typeof formData.createdDateOperator | typeof formData.updatedDateOperator | typeof formData.lastReviewedOperator | typeof formData.nextReviewDueOperator | null | undefined,
        days: number | null | undefined,
        date: Date | null | undefined,
        range: DateRange | null | undefined
    ): StudyQueryCriteria['createdDate'] | undefined => { 
        if (!operator) return undefined;

        if ((operator === 'newerThanDays' || operator === 'olderThanDays') && typeof days === 'number' && days > 0) {
            return { operator, value: days };
        } 
        if (operator === 'onDate' && date && isValid(date)) {
            return { operator, value: format(date, 'yyyy-MM-dd') };
        } 
        if (operator === 'betweenDates' && range?.from && range?.to && isValid(range.from) && isValid(range.to)) {
            // Ensure correct order for backend if necessary, though UI should handle this
            const fromISO = range.from.toISOString();
            const toISO = range.to.toISOString();
            return { operator, value: [fromISO < toISO ? fromISO : toISO, fromISO < toISO ? toISO : fromISO] };
        } 
        if (operator === 'never') {
             return { operator: 'never' }; // No value needed
        } 
        if (operator === 'isDue') {
             // Translate to format expected by resolve_study_query DB function
             return { operator: 'olderThanDays', value: 0 }; // Example translation
        }
        // Operator selected but value missing/invalid
        return undefined; 
    };

    // 4. Map all date filters
    criteria.createdDate = mapDateFilter(formData.createdDateOperator, formData.createdDateValueDays, formData.createdDateValueDate, formData.createdDateValueRange);
    criteria.updatedDate = mapDateFilter(formData.updatedDateOperator, formData.updatedDateValueDays, formData.updatedDateValueDate, formData.updatedDateValueRange);
    criteria.lastReviewed = mapDateFilter(formData.lastReviewedOperator, formData.lastReviewedValueDays, formData.lastReviewedValueDate, formData.lastReviewedValueRange);
    criteria.nextReviewDue = mapDateFilter(formData.nextReviewDueOperator, formData.nextReviewDueValueDays, formData.nextReviewDueValueDate, formData.nextReviewDueValueRange);

    // 5. Remove undefined date criteria properties after mapping all
    for (const key of ['createdDate', 'updatedDate', 'lastReviewed', 'nextReviewDue']) {
         const criteriaKey = key as keyof Pick<StudyQueryCriteria, 'createdDate' | 'updatedDate' | 'lastReviewed' | 'nextReviewDue'>;
         if (criteria[criteriaKey] === undefined) {
             delete criteria[criteriaKey];
         }
     }

    // 6. SRS Level Filter
    if (formData.srsLevelOperator && (formData.srsLevelValue !== null && formData.srsLevelValue !== undefined && formData.srsLevelValue >= 0)) {
        const validOperators: ('equals' | 'lessThan' | 'greaterThan')[] = ['equals', 'lessThan', 'greaterThan'];
         if (validOperators.includes(formData.srsLevelOperator)) {
             criteria.srsLevel = {
                 operator: formData.srsLevelOperator, 
                 value: formData.srsLevelValue
             };
         }
    }

    // 7. TODO: Add mapping for any other future filters here

    // --- Final Steps ---
    console.log("Final Form Data (Raw):", formData);
    console.log("Generated Criteria for Save:", criteria);

    onSave({
        name: formData.name,
        description: formData.description ?? null,
        criteria // Pass the fully constructed criteria object
    }).catch(err => {
        toast.error("Failed to save study set. Please try again.");
        console.error("Error during onSave callback:", err);
    });
  };

  const isLoading = isLoadingTags || isLoadingDecks || isSaving;
  if (tagsError || decksError) { return <p className="text-destructive">Error loading required data: {tagsError || decksError}</p>; }

  // --- Render Date Value Inputs Helper ---
  const renderDateValueInputs = (
      opField: keyof Pick<StudySetBuilderFormData, 'createdDateOperator' | 'updatedDateOperator' | 'lastReviewedOperator' | 'nextReviewDueOperator'>,
      daysField: keyof Pick<StudySetBuilderFormData, 'createdDateValueDays' | 'updatedDateValueDays' | 'lastReviewedValueDays' | 'nextReviewDueValueDays'>,
      dateField: keyof Pick<StudySetBuilderFormData, 'createdDateValueDate' | 'updatedDateValueDate' | 'lastReviewedValueDate' | 'nextReviewDueValueDate'>,
      rangeField: keyof Pick<StudySetBuilderFormData, 'createdDateValueRange' | 'updatedDateValueRange' | 'lastReviewedValueRange' | 'nextReviewDueValueRange'>
  ) => {
      const operator = form.watch(opField);
      const showDays = operator === 'newerThanDays' || operator === 'olderThanDays';
      const showDate = operator === 'onDate';
      const showRange = operator === 'betweenDates';
      // Don't show value inputs for operators that don't need them
      const showAnyValueInput = showDays || showDate || showRange; 

      return (
          // Use flex-grow to allow value inputs to take remaining space
          <div className={`flex-grow grid grid-cols-1 sm:grid-cols-2 gap-2 ${showAnyValueInput ? 'mt-2 sm:mt-0' : 'hidden'}`}>
              {/* Days Input */}
              <FormField control={form.control} name={daysField} render={({ field }) => (<FormItem className={showDays ? '' : 'hidden'}><FormLabel className="sr-only">Days</FormLabel><FormControl><Input type="number" placeholder="Days" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? null : parseInt(e.target.value, 10))} disabled={isLoading || !showDays} min="1" /></FormControl><FormMessage /></FormItem>)} />
              {/* Date Input */}
              <FormField control={form.control} name={dateField} render={({ field }) => (<FormItem className={`flex flex-col ${showDate ? '' : 'hidden'}`}><FormLabel className="sr-only">Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")} disabled={isLoading || !showDate}><CalendarIcon className="mr-2 h-4 w-4" />{field.value && isValid(field.value) ? format(field.value, "PPP") : <span>Pick a date</span>}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value ?? undefined} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>)} />
              {/* Date Range Input */}
              <FormField control={form.control} name={rangeField} render={({ field }) => (<FormItem className={`flex flex-col ${showRange ? '' : 'hidden'}`}><FormLabel className="sr-only">Date Range</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button id={rangeField} variant={"outline"} className={cn("w-full justify-start text-left font-normal", !field.value?.from && "text-muted-foreground")} disabled={isLoading || !showRange}><CalendarIcon className="mr-2 h-4 w-4" />{field.value?.from && isValid(field.value.from) ? (field.value.to && isValid(field.value.to) ? (<>{format(field.value.from, "LLL dd, y")} - {format(field.value.to, "LLL dd, y")}</>) : (format(field.value.from, "LLL dd, y"))) : (<span>Pick a date range</span>)}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar initialFocus mode="range" defaultMonth={field.value?.from} selected={field.value ?? undefined} onSelect={field.onChange} numberOfMonths={2} /></PopoverContent></Popover><FormMessage /></FormItem>)} />
          </div>
      );
  };

  // --- Render Tag MultiSelect Helper ---
  const renderTagMultiSelect = (
      fieldName: "includeTags" | "excludeTags",
      label: string,
      description: string
  ) => {
      return (
           <FormField
                control={form.control}
                name={fieldName}
                render={({ field }) => {
                    const selectedTagObjects = getTagObjects(field.value, allTags);
                    const availableOptions = Array.isArray(allTags)
                        ? allTags
                            .filter(tag => !field.value?.includes(tag.id))
                            .sort((a, b) => a.name.localeCompare(b.name))
                        : [];

                    const handleSelect = (tagId: string) => {
                        field.onChange([...(field.value || []), tagId]);
                    };
                    const handleRemove = (tagId: string) => {
                         field.onChange(field.value?.filter((id) => id !== tagId));
                    };

                    return (
                        <FormItem>
                            <FormLabel className="text-base">{label}</FormLabel>
                            {/* Display Selected Tags */}
                            <div className="flex flex-wrap gap-1 mb-2 min-h-[24px]">
                                {selectedTagObjects.map((tag) => (
                                    <Badge key={`${fieldName}-${tag.id}`} variant="secondary" className="flex items-center gap-1">
                                        {tag.name}
                                        <Button
                                            variant="ghost" size="icon" onClick={() => handleRemove(tag.id)}
                                            disabled={isLoading} aria-label={`Remove tag ${tag.name}`}
                                            className="h-4 w-4 p-0 ml-1 rounded-full hover:bg-muted-foreground/20"
                                        ><IconX className="h-3 w-3" /></Button>
                                    </Badge>
                                ))}
                            </div>
                            {/* Popover with Command */}
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" role="combobox" className="w-[200px] justify-start font-normal" disabled={isLoadingTags || isLoading}>
                                        {isLoadingTags ? 'Loading...' : `+ Add Tag`}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[200px] p-0" align="start">
                                     <Command filter={(value, search) => {
                                         const tag = allTags?.find(t => t.id === value);
                                         return tag?.name.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
                                       }}>
                                        <CommandInput placeholder="Search tags..." />
                                        <CommandList>
                                            <CommandEmpty>No tags found.</CommandEmpty>
                                            <CommandGroup>
                                                {availableOptions.map((tag) => (
                                                    <CommandItem key={tag.id} value={tag.id} onSelect={() => handleSelect(tag.id)}>
                                                        {tag.name}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                            <FormDescription>{description}</FormDescription>
                            <FormMessage />
                        </FormItem>
                    );
                }}
            />
      );
  }


  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            {/* Name, Description Fields */}
            <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Study Set Name</FormLabel><FormControl><Input placeholder="e.g., Hard Verbs Chapter 1" {...field} disabled={isLoading} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description (Optional)</FormLabel><FormControl><Textarea placeholder="Describe what this set includes..." {...field} value={field.value ?? ''} disabled={isLoading} /></FormControl><FormMessage /></FormItem>)} />

            <hr/>
            <h3 className="text-lg font-medium border-b pb-2">Filter Criteria</h3>

            {/* Deck Selector */}
            <FormField control={form.control} name="selectedDeckId" render={({ field }) => (<FormItem><FormLabel>Include Cards From Deck (Optional)</FormLabel><Select onValueChange={(value) => field.onChange(value === 'none' ? null : value)} value={field.value ?? 'none'} disabled={isLoadingDecks || isLoading}><FormControl><SelectTrigger><SelectValue placeholder="-- Any Deck --" /></SelectTrigger></FormControl><SelectContent><SelectItem value="none">-- Any Deck --</SelectItem>{(Array.isArray(decks) ? decks : []).map(deck => (<SelectItem key={deck.id} value={deck.id}>{deck.name as string}</SelectItem>))}</SelectContent></Select><FormDescription>If selected, only cards from this deck will be included.</FormDescription><FormMessage /></FormItem>)} />

            {/* Tag Filters using MultiSelect */}
             <div className="space-y-6 p-4 border rounded-md">
                 {renderTagMultiSelect("includeTags", "Include Tags (Optional)", "Select tags to include in the study set.")}
                 
                 <FormField
                    control={form.control}
                    name="tagLogic"
                    render={({ field }) => (
                         <FormItem className={form.watch('includeTags')?.length ? 'mt-2' : 'hidden'}>
                            <FormLabel>Tag Logic</FormLabel>
                             <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isLoading}>
                                 <FormControl><SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger></FormControl>
                                 <SelectContent>
                                     <SelectItem value="ANY">Match ANY included tag</SelectItem>
                                     <SelectItem value="ALL">Match ALL included tags</SelectItem>
                                 </SelectContent>
                             </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                 {renderTagMultiSelect("excludeTags", "Exclude Tags (Optional)", "Cards with these tags will be excluded.")}
            </div>

            {/* --- Filter Sections --- */}
            <div className="space-y-6"> 
                {/* Created Date */}
                <div className="space-y-3 p-4 border rounded-md">
                    <Label className="text-base font-medium">Created Date</Label>
                    <div className="flex flex-col sm:flex-row items-start sm:items-end gap-2">
                        <FormField control={form.control} name="createdDateOperator" render={({ field }) => (<FormItem className="w-full sm:flex-shrink-0 sm:w-auto sm:min-w-[180px]"><FormLabel className="sr-only">Condition</FormLabel><Select onValueChange={(value) => { field.onChange(value === 'any' ? null : value); form.resetField("createdDateValueDays"); form.resetField("createdDateValueDate"); form.resetField("createdDateValueRange");}} value={field.value ?? 'any'} disabled={isLoading}><FormControl><SelectTrigger><SelectValue placeholder="Any Date" /></SelectTrigger></FormControl><SelectContent><SelectItem value="any">Any Date</SelectItem><SelectItem value="newerThanDays">Newer Than (Days)</SelectItem><SelectItem value="olderThanDays">Older Than (Days)</SelectItem><SelectItem value="onDate">On Specific Date</SelectItem><SelectItem value="betweenDates">Between Dates</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                        {renderDateValueInputs('createdDateOperator', 'createdDateValueDays', 'createdDateValueDate', 'createdDateValueRange')}
                    </div>
                </div>

                {/* Updated Date */}
                <div className="space-y-3 p-4 border rounded-md">
                    <Label className="text-base font-medium">Updated Date</Label>
                    <div className="flex flex-col sm:flex-row items-start sm:items-end gap-2">
                        <FormField control={form.control} name="updatedDateOperator" render={({ field }) => (<FormItem className="w-full sm:flex-shrink-0 sm:w-auto sm:min-w-[180px]"><FormLabel className="sr-only">Condition</FormLabel><Select onValueChange={(value) => { field.onChange(value === 'any' ? null : value); form.resetField("updatedDateValueDays"); form.resetField("updatedDateValueDate"); form.resetField("updatedDateValueRange");}} value={field.value ?? 'any'} disabled={isLoading}><FormControl><SelectTrigger><SelectValue placeholder="Any Date" /></SelectTrigger></FormControl><SelectContent><SelectItem value="any">Any Date</SelectItem><SelectItem value="newerThanDays">Newer Than (Days)</SelectItem><SelectItem value="olderThanDays">Older Than (Days)</SelectItem><SelectItem value="onDate">On Specific Date</SelectItem><SelectItem value="betweenDates">Between Dates</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                        {renderDateValueInputs('updatedDateOperator', 'updatedDateValueDays', 'updatedDateValueDate', 'updatedDateValueRange')}
                    </div>
                </div>

               {/* Last Reviewed Date */}
                <div className="space-y-3 p-4 border rounded-md">
                    <Label className="text-base font-medium">Last Reviewed Date</Label>
                    <div className="flex flex-col sm:flex-row items-start sm:items-end gap-2">
                        <FormField control={form.control} name="lastReviewedOperator" render={({ field }) => (<FormItem className="w-full sm:flex-shrink-0 sm:w-auto sm:min-w-[180px]"><FormLabel className="sr-only">Condition</FormLabel><Select onValueChange={(value) => { field.onChange(value === 'any' ? null : value); form.resetField("lastReviewedValueDays"); form.resetField("lastReviewedValueDate"); form.resetField("lastReviewedValueRange");}} value={field.value ?? 'any'} disabled={isLoading}><FormControl><SelectTrigger><SelectValue placeholder="Any / Never" /></SelectTrigger></FormControl><SelectContent><SelectItem value="any">Any / Never</SelectItem><SelectItem value="never">Never Reviewed</SelectItem><SelectItem value="newerThanDays">Newer Than (Days)</SelectItem><SelectItem value="olderThanDays">Older Than (Days)</SelectItem><SelectItem value="onDate">On Specific Date</SelectItem><SelectItem value="betweenDates">Between Dates</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                        {renderDateValueInputs('lastReviewedOperator', 'lastReviewedValueDays', 'lastReviewedValueDate', 'lastReviewedValueRange')}
                    </div>
                </div>

               {/* Next Review Due Date */}
               <div className="space-y-3 p-4 border rounded-md">
                   <Label className="text-base font-medium">Next Review Due Date</Label>
                   <div className="flex flex-col sm:flex-row items-start sm:items-end gap-2">
                       <FormField control={form.control} name="nextReviewDueOperator" render={({ field }) => (<FormItem className="w-full sm:flex-shrink-0 sm:w-auto sm:min-w-[180px]"><FormLabel className="sr-only">Condition</FormLabel><Select onValueChange={(value) => { field.onChange(value === 'any' ? null : value); form.resetField("nextReviewDueValueDays"); form.resetField("nextReviewDueValueDate"); form.resetField("nextReviewDueValueRange");}} value={field.value ?? 'any'} disabled={isLoading}><FormControl><SelectTrigger><SelectValue placeholder="Any / Never / Due" /></SelectTrigger></FormControl><SelectContent><SelectItem value="any">Any / Never / Due</SelectItem><SelectItem value="isDue">Is Due Now</SelectItem><SelectItem value="never">Is Not Scheduled</SelectItem><SelectItem value="newerThanDays">Due After (Days)</SelectItem><SelectItem value="olderThanDays">Due Before (Days)</SelectItem><SelectItem value="onDate">Due On Specific Date</SelectItem><SelectItem value="betweenDates">Due Between Dates</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                       {renderDateValueInputs('nextReviewDueOperator', 'nextReviewDueValueDays', 'nextReviewDueValueDate', 'nextReviewDueValueRange')}
                   </div>
               </div>

               {/* SRS Level Filter */}
                <div className="space-y-3 p-4 border rounded-md">
                    <Label className="text-base font-medium">SRS Level</Label>
                    <div className="flex flex-col sm:flex-row items-start sm:items-end gap-2">
                        <FormField control={form.control} name="srsLevelOperator" render={({ field }) => (<FormItem className="w-full sm:flex-shrink-0 sm:w-auto sm:min-w-[180px]"><FormLabel className="sr-only">Condition</FormLabel><Select onValueChange={(value) => { field.onChange(value === 'any' ? null : value); form.resetField("srsLevelValue"); }} value={field.value ?? 'any'} disabled={isLoading}><FormControl><SelectTrigger><SelectValue placeholder="Any Level" /></SelectTrigger></FormControl><SelectContent><SelectItem value="any">Any Level</SelectItem><SelectItem value="equals">Equals</SelectItem><SelectItem value="lessThan">Less Than</SelectItem><SelectItem value="greaterThan">Greater Than</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="srsLevelValue" render={({ field }) => (<FormItem className={`flex-grow ${srsLevelOperator ? '' : 'invisible'}`}><FormLabel className="sr-only">Level</FormLabel><FormControl><Input type="number" placeholder="Enter level (e.g., 3)" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? null : parseInt(e.target.value, 10))} disabled={isLoading || !srsLevelOperator} min="0" /></FormControl><FormMessage /></FormItem>)} />
                    </div>
                </div>
            </div> {/* End Filter Criteria Wrapper */}


            {/* Submit Button */}
            <Button type="submit" disabled={isLoading || isSaving} className="w-full">
                {isSaving ? <IconLoader className="animate-spin mr-2 h-4 w-4" /> : null}
                {initialData?.id ? 'Update Study Set' : 'Create Study Set'}
            </Button>
      </form>
    </Form>
  );
} 