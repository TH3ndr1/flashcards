// components/study/StudySetBuilder.tsx
'use client';

import React, { useMemo, useCallback } from 'react'; // Removed useState
// Import the hook and its return type
import { useStudySetForm, UseStudySetFormReturn, StudySetBuilderFormData } from '@/hooks/useStudySetForm'; // Import form data type
// Import UI components
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
// Keep type imports needed for props and rendering helpers
import type { StudyQueryCriteria } from '@/lib/schema/study-query.schema';
import type { Database, Tables } from "@/types/database";
type DbTag = Tables<'tags'>;

import { cn } from "@/lib/utils";
import { CalendarIcon, Check, ChevronsUpDown, Loader2 as IconLoader, Plus as IconPlus, X as IconX } from "lucide-react";
import { format, isValid } from "date-fns";
import { Badge } from '@/components/ui/badge';
import { DateRange } from "react-day-picker";


// --- Type Guard for DateRange ---
function isDateRange(value: unknown): value is DateRange {
  return typeof value === 'object' && value !== null && ('from' in value || 'to' in value);
}


// --- Component Props ---
interface StudySetBuilderProps {
  initialData?: { id?: string; name: string; description?: string | null; criteria: StudyQueryCriteria; };
  onSave: (data: { name: string; description: string | null; criteria: StudyQueryCriteria }) => Promise<void>;
  isSaving?: boolean;
}

// --- Component Implementation ---
export function StudySetBuilder({ initialData, onSave, isSaving = false }: StudySetBuilderProps) {
  // Use the hook to get form state, data, and handlers
  const {
    form,
    isLoading,
    tagsError,
    decksError,
    allTags,
    decks,
    onSubmit,
    watchedOperators,
    watchedFilterValues,
    allowedOperators,
  } = useStudySetForm({ initialData, onSave, isSaving });

  // Destructure watched values for easier use in JSX
  const { srsLevelOperator } = watchedOperators;
  const { includeTags } = watchedFilterValues;

  // --- FIX: Move Render Helper Functions INSIDE the component ---
  // Wrap in useCallback to stabilize references if needed, include deps

  const renderDateValueInputs = useCallback((
      opField: keyof typeof watchedOperators,
      daysField: keyof StudySetBuilderFormData,
      dateField: keyof StudySetBuilderFormData,
      rangeField: keyof StudySetBuilderFormData
  ) => {
      // Access form and watched values from the component's scope
      const operator = form.watch(opField);
      const showDays = operator === 'newerThanDays' || operator === 'olderThanDays';
      const showDate = operator === 'onDate';
      const showRange = operator === 'betweenDates';
      const showAnyValueInput = showDays || showDate || showRange;

      return (
          <div className={`flex-grow grid grid-cols-1 sm:grid-cols-2 gap-2 ${showAnyValueInput ? 'mt-2 sm:mt-0' : 'hidden'}`}>
              {/* Days Input - Ensure value is string for Input, handle number conversion in onChange */}
              <FormField control={form.control} name={daysField} render={({ field }) => (<FormItem className={showDays ? '' : 'hidden'}><FormLabel className="sr-only">Days</FormLabel><FormControl><Input type="number" placeholder="Days" {...field} value={typeof field.value === 'number' ? String(field.value) : ''} onChange={e => field.onChange(e.target.value === '' ? null : parseInt(e.target.value, 10))} disabled={isLoading || !showDays} min="1" /></FormControl><FormMessage /></FormItem>)} />
              {/* Date Input - Add type checks */}
              <FormField control={form.control} name={dateField} render={({ field }) => (<FormItem className={`flex flex-col ${showDate ? '' : 'hidden'}`}><FormLabel className="sr-only">Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")} disabled={isLoading || !showDate}><CalendarIcon className="mr-2 h-4 w-4" />{field.value instanceof Date && isValid(field.value) ? format(field.value, "PPP") : <span>Pick a date</span>}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value instanceof Date ? field.value : undefined} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>)} />
              {/* Date Range Input - Add type guards */}
              <FormField control={form.control} name={rangeField} render={({ field }) => {
                const currentRange = isDateRange(field.value) ? field.value : undefined;
                const fromValid = currentRange?.from instanceof Date && isValid(currentRange.from);
                const toValid = currentRange?.to instanceof Date && isValid(currentRange.to);
                return (
                  <FormItem className={`flex flex-col ${showRange ? '' : 'hidden'}`}>
                    <FormLabel className="sr-only">Date Range</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button id={rangeField as string} variant={"outline"} className={cn("w-full justify-start text-left font-normal", !currentRange?.from && !currentRange?.to && "text-muted-foreground")} disabled={isLoading || !showRange}>
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {fromValid && toValid ? (
                              <>{format(currentRange.from!, "LLL dd, y")} - {format(currentRange.to!, "LLL dd, y")}</>
                            ) : fromValid ? (
                              `From ${format(currentRange.from!, "LLL dd, y")}`
                            ) : toValid ? (
                              `To ${format(currentRange.to!, "LLL dd, y")}`
                            ) : (
                              <span>Pick a date range</span>
                            )}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          initialFocus
                          mode="range"
                          defaultMonth={currentRange?.from instanceof Date ? currentRange.from : undefined}
                          selected={currentRange}
                          onSelect={field.onChange}
                          numberOfMonths={2}
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                );
              }} />
          </div>
      );
   // Dependencies now include form and isLoading from the hook's scope
  }, [form, isLoading]);


  const renderTagMultiSelect = useCallback((
      fieldName: "includeTags" | "excludeTags",
      label: string,
      description: string
  ) => {
      // Internal helper - ok inside useCallback
      const getTagObjects = (ids: string[] = [], all: DbTag[] = []): DbTag[] => {
          if (!Array.isArray(all)) return [];
          const idMap = new Map(all.map(tag => [tag.id, tag]));
          return ids.map(id => idMap.get(id)).filter((tag): tag is DbTag => tag !== undefined);
      };

      return (
           <FormField
                control={form.control} // Access form from component scope
                name={fieldName}
                render={({ field }) => {
                    // Use allTags from component scope (provided by hook)
                    const selectedTagObjects = getTagObjects(field.value, allTags);
                    const availableOptions = Array.isArray(allTags)
                        ? allTags.filter(tag => !(Array.isArray(field.value) && field.value.includes(tag.id))).sort((a, b) => a.name.localeCompare(b.name))
                        : [];

                    const handleSelect = (tagId: string) => form.setValue(fieldName, [...(Array.isArray(field.value) ? field.value : []), tagId], { shouldValidate: true, shouldDirty: true });
                    const handleRemove = (tagId: string) => form.setValue(fieldName, (Array.isArray(field.value) ? field.value : []).filter((id) => id !== tagId), { shouldValidate: true, shouldDirty: true });

                    return (
                        <FormItem>
                            <FormLabel className="text-base">{label}</FormLabel>
                            <div className="flex flex-wrap gap-1 mb-2 min-h-[24px]">
                                {selectedTagObjects.map((tag) => ( <Badge key={`${fieldName}-${tag.id}`} variant="secondary" className="flex items-center gap-1">{tag.name}<Button variant="ghost" size="icon" onClick={() => handleRemove(tag.id)} disabled={isLoading} aria-label={`Remove tag ${tag.name}`} className="h-4 w-4 p-0 ml-1 rounded-full hover:bg-muted-foreground/20"><IconX className="h-3 w-3" /></Button></Badge> ))}
                            </div>
                            <Popover>
                                <PopoverTrigger asChild><Button variant="outline" role="combobox" className="w-[200px] justify-start font-normal" disabled={isLoading}> {isLoading ? 'Loading...' : `+ Add Tag`} </Button></PopoverTrigger>
                                <PopoverContent className="w-[200px] p-0" align="start"><Command filter={(value, search) => { const tag = allTags?.find(t => t.id === value); return tag?.name.toLowerCase().includes(search.toLowerCase()) ? 1 : 0; }}><CommandInput placeholder="Search tags..." /><CommandList><CommandEmpty>No tags found.</CommandEmpty><CommandGroup>{availableOptions.map((tag) => (<CommandItem key={tag.id} value={tag.id} onSelect={() => handleSelect(tag.id)}>{tag.name}</CommandItem>))}</CommandGroup></CommandList></Command></PopoverContent>
                            </Popover>
                            <FormDescription>{description}</FormDescription>
                            <FormMessage />
                        </FormItem>
                    );
                }}
            />
      );
  // Dependencies now include form, isLoading, and allTags from the hook's scope
  }, [form, isLoading, allTags]);


  // Handle loading/error states from hook
  if (tagsError || decksError) { return <p className="text-destructive">Error loading required data: {tagsError || decksError}</p>; }
  // Optional: Loading indicator
  // if (isLoading && !initialData) { return <p>Loading builder options...</p>; }


  return (
    // Use the form object returned by the hook
    <Form {...form}>
      {/* Pass the onSubmit handler returned by the hook */}
      <form onSubmit={onSubmit} className="space-y-8">
            {/* Name, Description Fields */}
            <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Study Set Name</FormLabel><FormControl><Input placeholder="e.g., Hard Verbs Chapter 1" {...field} disabled={isLoading} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description (Optional)</FormLabel><FormControl><Textarea placeholder="Describe what this set includes..." {...field} value={field.value ?? ''} onChange={field.onChange} disabled={isLoading} /></FormControl><FormMessage /></FormItem>)} />

            <hr/>
            <h3 className="text-lg font-medium border-b pb-2">Filter Criteria</h3>

            {/* Deck Selector */}
            <FormField control={form.control} name="selectedDeckId" render={({ field }) => (<FormItem><FormLabel>Include Cards From Deck (Optional)</FormLabel><Select onValueChange={(value) => field.onChange(value === 'none' ? null : value)} value={field.value ?? 'none'} disabled={isLoading}><FormControl><SelectTrigger><SelectValue placeholder="-- Any Deck --" /></SelectTrigger></FormControl><SelectContent><SelectItem value="none">-- Any Deck --</SelectItem>{(Array.isArray(decks) ? decks : []).map(deck => (<SelectItem key={deck.id} value={deck.id}>{deck.name}</SelectItem>))}</SelectContent></Select><FormDescription>If selected, only cards from this deck will be included.</FormDescription><FormMessage /></FormItem>)} />

            {/* Tag Filters using MultiSelect */}
             <div className="space-y-6 p-4 border rounded-md">
                 {/* Call helper */}
                 {renderTagMultiSelect("includeTags", "Include Tags (Optional)", "Select tags to include in the study set.")}

                 <FormField control={form.control} name="tagLogic" render={({ field }) => ( <FormItem className={includeTags?.length ? 'mt-2' : 'hidden'}> <FormLabel>Tag Logic</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={isLoading}><FormControl><SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="ANY">Match ANY</SelectItem><SelectItem value="ALL">Match ALL</SelectItem></SelectContent></Select><FormMessage /></FormItem> )}/>

                 {/* Call helper */}
                 {renderTagMultiSelect("excludeTags", "Exclude Tags (Optional)", "Cards with these tags will be excluded.")}
            </div>

            {/* --- Filter Sections --- */}
            <div className="space-y-6">
                {/* Created Date */}
                <div className="space-y-3 p-4 border rounded-md">
                    <Label className="text-base font-medium">Created Date</Label>
                    <div className="flex flex-col sm:flex-row items-start sm:items-end gap-2">
                        <FormField control={form.control} name="createdDateOperator" render={({ field }) => (<FormItem className="w-full sm:flex-shrink-0 sm:w-auto sm:min-w-[180px]"><FormLabel className="sr-only">Condition</FormLabel><Select onValueChange={(value) => { field.onChange(value === 'any' ? null : value); form.resetField("createdDateValueDays"); form.resetField("createdDateValueDate"); form.resetField("createdDateValueRange");}} value={field.value ?? 'any'} disabled={isLoading}><FormControl><SelectTrigger><SelectValue placeholder="Any Date" /></SelectTrigger></FormControl><SelectContent><SelectItem value="any">Any Date</SelectItem>{allowedOperators.createdUpdatedOps.map(op => <SelectItem key={op} value={op}>{op}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                        {renderDateValueInputs('createdDateOperator', 'createdDateValueDays', 'createdDateValueDate', 'createdDateValueRange')}
                    </div>
                </div>

                {/* Updated Date */}
                <div className="space-y-3 p-4 border rounded-md">
                     <Label className="text-base font-medium">Updated Date</Label>
                    <div className="flex flex-col sm:flex-row items-start sm:items-end gap-2">
                        <FormField control={form.control} name="updatedDateOperator" render={({ field }) => (<FormItem className="w-full sm:flex-shrink-0 sm:w-auto sm:min-w-[180px]"><FormLabel className="sr-only">Condition</FormLabel><Select onValueChange={(value) => { field.onChange(value === 'any' ? null : value); form.resetField("updatedDateValueDays"); form.resetField("updatedDateValueDate"); form.resetField("updatedDateValueRange");}} value={field.value ?? 'any'} disabled={isLoading}><FormControl><SelectTrigger><SelectValue placeholder="Any Date" /></SelectTrigger></FormControl><SelectContent><SelectItem value="any">Any Date</SelectItem>{allowedOperators.createdUpdatedOps.map(op => <SelectItem key={op} value={op}>{op}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                        {renderDateValueInputs('updatedDateOperator', 'updatedDateValueDays', 'updatedDateValueDate', 'updatedDateValueRange')}
                    </div>
                </div>

               {/* Last Reviewed Date */}
                <div className="space-y-3 p-4 border rounded-md">
                   <Label className="text-base font-medium">Last Reviewed Date</Label>
                   <div className="flex flex-col sm:flex-row items-start sm:items-end gap-2">
                       <FormField control={form.control} name="lastReviewedOperator" render={({ field }) => (<FormItem className="w-full sm:flex-shrink-0 sm:w-auto sm:min-w-[180px]"><FormLabel className="sr-only">Condition</FormLabel><Select onValueChange={(value) => { field.onChange(value === 'any' ? null : value); form.resetField("lastReviewedValueDays"); form.resetField("lastReviewedValueDate"); form.resetField("lastReviewedValueRange");}} value={field.value ?? 'any'} disabled={isLoading}><FormControl><SelectTrigger><SelectValue placeholder="Any / Never" /></SelectTrigger></FormControl><SelectContent><SelectItem value="any">Any / Never</SelectItem>{allowedOperators.lastReviewedOps.map(op => <SelectItem key={op} value={op}>{op}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                       {renderDateValueInputs('lastReviewedOperator', 'lastReviewedValueDays', 'lastReviewedValueDate', 'lastReviewedValueRange')}
                   </div>
               </div>

               {/* Next Review Due Date */}
               <div className="space-y-3 p-4 border rounded-md">
                   <Label className="text-base font-medium">Next Review Due Date</Label>
                   <div className="flex flex-col sm:flex-row items-start sm:items-end gap-2">
                       <FormField control={form.control} name="nextReviewDueOperator" render={({ field }) => (<FormItem className="w-full sm:flex-shrink-0 sm:w-auto sm:min-w-[180px]"><FormLabel className="sr-only">Condition</FormLabel><Select onValueChange={(value) => { field.onChange(value === 'any' ? null : value); form.resetField("nextReviewDueValueDays"); form.resetField("nextReviewDueValueDate"); form.resetField("nextReviewDueValueRange");}} value={field.value ?? 'any'} disabled={isLoading}><FormControl><SelectTrigger><SelectValue placeholder="Any / Never / Due" /></SelectTrigger></FormControl><SelectContent><SelectItem value="any">Any / Never / Due</SelectItem>{allowedOperators.nextReviewDueOps.map(op => <SelectItem key={op} value={op}>{op}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                       {renderDateValueInputs('nextReviewDueOperator', 'nextReviewDueValueDays', 'nextReviewDueValueDate', 'nextReviewDueValueRange')}
                   </div>
               </div>

               {/* SRS Level Filter */}
                <div className="space-y-3 p-4 border rounded-md">
                    <Label className="text-base font-medium">SRS Level</Label>
                    <div className="flex flex-col sm:flex-row items-start sm:items-end gap-2">
                        <FormField control={form.control} name="srsLevelOperator" render={({ field }) => (<FormItem className="w-full sm:flex-shrink-0 sm:w-auto sm:min-w-[180px]"><FormLabel className="sr-only">Condition</FormLabel><Select onValueChange={(value) => { field.onChange(value === 'any' ? null : value); form.resetField("srsLevelValue"); }} value={field.value ?? 'any'} disabled={isLoading}><FormControl><SelectTrigger><SelectValue placeholder="Any Level" /></SelectTrigger></FormControl><SelectContent><SelectItem value="any">Any Level</SelectItem>{allowedOperators.srsLevelOps.map(op => <SelectItem key={op} value={op}>{op}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                        <div className={`flex-grow grid grid-cols-1 gap-2 ${srsLevelOperator ? 'mt-2 sm:mt-0' : 'hidden'}`}>
                            <FormField control={form.control} name="srsLevelValue" render={({ field }) => (<FormItem><FormLabel className="sr-only">Level</FormLabel><FormControl><Input type="number" placeholder="Level (e.g., 0, 1, 5)" {...field} value={typeof field.value === 'number' ? String(field.value) : ''} onChange={e => field.onChange(e.target.value === '' ? null : parseInt(e.target.value, 10))} disabled={isLoading || !srsLevelOperator} min="0" /></FormControl><FormMessage /></FormItem>)} />
                        </div>
                    </div>
                </div>

                {/* Include Difficult Cards Checkbox */}
                <div className="p-4 border rounded-md">
                  <FormField control={form.control} name="includeDifficult" render={({ field }) => (<FormItem className="flex flex-row items-start space-x-3 space-y-0"><FormControl><Checkbox checked={!!field.value} onCheckedChange={field.onChange} disabled={isLoading} /></FormControl><div className="space-y-1 leading-none"><FormLabel className="text-base">Only Include Difficult Cards</FormLabel><FormDescription>Filters for cards currently in the 'learning' SRS stage.</FormDescription></div><FormMessage /></FormItem>)} />
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