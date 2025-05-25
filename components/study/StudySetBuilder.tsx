// components/study/StudySetBuilder.tsx
'use client';

import React, { useCallback } from 'react';
import {
    useStudySetForm,
    type StudySetBuilderFormData, // Ensure this is exported from the hook
    type SrsStage // Ensure this is exported from the hook
} from '@/hooks/useStudySetForm'; // Corrected: UseStudySetFormReturn not needed directly here
import {
    Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select as UISelect, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import {
    Command, CommandInput, CommandList, CommandItem, CommandGroup, CommandEmpty
} from '@/components/ui/command';
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
    CalendarIcon, Check, ChevronsUpDown, Loader2 as IconLoader, Languages, GripVertical, Tag, Filter
} from "lucide-react";
import { format, isValid } from "date-fns";
import type { DateRange } from "react-day-picker";
import type { StudyQueryCriteria } from '@/lib/schema/study-query.schema';
import type { Tables } from "@/types/database";

type DbTag = Tables<'tags'>;

interface StudySetBuilderProps {
  initialData?: { id?: string; name: string; description?: string | null; criteria: StudyQueryCriteria; };
  onSave: (data: { name: string; description: string | null; criteria: StudyQueryCriteria }) => Promise<void>;
  isSaving?: boolean;
}

const ANY_LANGUAGE_PLACEHOLDER_VALUE = "__ANY_LANGUAGE__";

const languageOptions = [
    { value: ANY_LANGUAGE_PLACEHOLDER_VALUE, label: "-- Any Language --" },
    { value: "en", label: "English" }, { value: "fr", label: "French" },
    { value: "es", label: "Spanish" }, { value: "de", label: "German" },
    { value: "it", label: "Italian" }, { value: "nl", label: "Dutch" },
];

export function StudySetBuilder({ initialData, onSave, isSaving = false }: StudySetBuilderProps) {
  const {
    form,
    isLoading,
    allTags, // Used in renderMultiSelectPopover
    decks,   // Used in renderMultiSelectPopover
    onSubmit,
    watchedOperators,
    allowedOperators,
    srsFilterOptions
  } = useStudySetForm({ initialData, onSave, isSaving });

  const { control, watch, setValue, resetField } = form;

  // Watch includeTags directly for conditional rendering of tagLogic
  const includeTags = watch("includeTags");

  const renderDateValueInputs = useCallback((
      opFieldKey: keyof Pick<StudySetBuilderFormData, "createdDateOperator" | "updatedDateOperator" | "lastReviewedOperator" | "nextReviewDueOperator">,
      daysFieldKey: keyof Pick<StudySetBuilderFormData, "createdDateValueDays" | "updatedDateValueDays" | "lastReviewedValueDays" | "nextReviewDueValueDays">,
      dateFieldKey: keyof Pick<StudySetBuilderFormData, "createdDateValueDate" | "updatedDateValueDate" | "lastReviewedValueDate" | "nextReviewDueValueDate">,
      rangeFieldKey: keyof Pick<StudySetBuilderFormData, "createdDateValueRange" | "updatedDateValueRange" | "lastReviewedValueRange" | "nextReviewDueValueRange">
  ) => {
      const operator = watch(opFieldKey);
      const showDays = operator === 'newerThanDays' || operator === 'olderThanDays';
      const showDate = operator === 'onDate';
      const showRange = operator === 'betweenDates';
      const showAnyValueInput = showDays || showDate || showRange;

      return (
          <div className={`flex-grow grid grid-cols-1 sm:grid-cols-2 gap-2 ${showAnyValueInput ? 'mt-2 sm:mt-0' : 'hidden'}`}>
              <FormField control={control} name={daysFieldKey} render={({ field }) => (
                  <FormItem className={showDays ? '' : 'hidden'}>
                      <FormLabel className="sr-only">Days</FormLabel>
                      <FormControl><Input type="text" pattern="\d*" placeholder="Days" {...field} value={field.value ?? ''} disabled={isLoading || !showDays} /></FormControl>
                      <FormMessage />
                  </FormItem>
              )} />
              <FormField control={control} name={dateFieldKey} render={({ field }) => (
                  <FormItem className={`flex flex-col ${showDate ? '' : 'hidden'}`}>
                      <FormLabel className="sr-only">Date</FormLabel>
                      <Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")} disabled={isLoading || !showDate}><CalendarIcon className="mr-2 h-4 w-4" />{field.value && isValid(field.value) ? format(field.value, "PPP") : <span>Pick a date</span>}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value ?? undefined} onSelect={field.onChange} initialFocus /></PopoverContent></Popover>
                      <FormMessage />
                  </FormItem>
              )} />
              <FormField control={control} name={rangeFieldKey} render={({ field }) => {
                const currentRange = field.value ?? undefined;
                return (
                  <FormItem className={`flex flex-col ${showRange ? '' : 'hidden'}`}>
                    <FormLabel className="sr-only">Date Range</FormLabel>
                    <Popover><PopoverTrigger asChild><FormControl><Button id={rangeFieldKey} variant={"outline"} className={cn("w-full justify-start text-left font-normal", !currentRange?.from && !currentRange?.to && "text-muted-foreground")} disabled={isLoading || !showRange}><CalendarIcon className="mr-2 h-4 w-4" />{(currentRange?.from && isValid(currentRange.from)) && (currentRange?.to && isValid(currentRange.to)) ? (<>{format(currentRange.from, "LLL dd, y")} - {format(currentRange.to, "LLL dd, y")}</>) : (currentRange?.from && isValid(currentRange.from)) ? (`From ${format(currentRange.from, "LLL dd, y")}`) : (currentRange?.to && isValid(currentRange.to)) ? (`To ${format(currentRange.to, "LLL dd, y")}`) : (<span>Pick a date range</span>)}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar initialFocus mode="range" defaultMonth={currentRange?.from} selected={currentRange} onSelect={field.onChange} numberOfMonths={2} /></PopoverContent></Popover>
                    <FormMessage />
                  </FormItem>
                );
              }} />
          </div>
      );
  }, [control, isLoading, watch]);

  const renderMultiSelectPopover = useCallback((
      field: keyof Pick<StudySetBuilderFormData, "selectedDeckIds" | "includeTags">,
      options: { value: string; label: string }[],
      selectedValuesProp: string[] | undefined,
      placeholder: string,
      groupLabel: string
    ) => {
        const selectedValues = Array.isArray(selectedValuesProp) ? selectedValuesProp.map(String) : [];
        return (
            <Popover>
                <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between font-normal min-h-[40px] h-auto py-2">
                        <span className="flex flex-wrap gap-1">
                            {selectedValues.length > 0
                                ? selectedValues.map(val => {
                                    const option = options.find(opt => opt.value === val);
                                    return option ? <Badge key={val} variant="secondary" className="text-xs px-1.5 py-0.5">{option.label}</Badge> : null;
                                  }).filter(Boolean)
                                : <span className="text-muted-foreground">{placeholder}</span>
                            }
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                    <Command>
                        <CommandInput placeholder={`Search ${groupLabel.toLowerCase()}...`} />
                        <CommandList>
                            <CommandEmpty>No {groupLabel.toLowerCase()} found.</CommandEmpty>
                            <CommandGroup>
                                {options.map((option) => (
                                    <CommandItem
                                        key={option.value}
                                        value={option.label} // Search/display by label
                                        onSelect={() => {    // Act on value (ID)
                                            const currentSelected = selectedValues || [];
                                            const newSelected = currentSelected.includes(option.value)
                                                ? currentSelected.filter(v => v !== option.value)
                                                : [...currentSelected, option.value];
                                            setValue(field, newSelected as any, { shouldValidate: true, shouldDirty: true });
                                        }}
                                    >
                                        <Check className={cn("mr-2 h-4 w-4", selectedValues.includes(option.value) ? "opacity-100" : "opacity-0")} />
                                        {option.label}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        );
    // Corrected dependencies for renderMultiSelectPopover
    }, [setValue, allTags, decks]); // It uses allTags and decks indirectly if options are derived from them

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-8">
        <FormField control={control} name="name" render={({ field }) => (<FormItem><FormLabel>Smart Playlist Name</FormLabel><FormControl><Input placeholder="e.g., Hard French Verbs" {...field} disabled={isLoading} /></FormControl><FormMessage /></FormItem>)} />
        <FormField control={control} name="description" render={({ field }) => (<FormItem><FormLabel>Description (Optional)</FormLabel><FormControl><Textarea placeholder="e.g., All irregular -er verbs from Chapter 3, due this week" {...field} value={field.value ?? ''} onChange={field.onChange} disabled={isLoading} /></FormControl><FormMessage /></FormItem>)} />

        <hr/>
        <Card className="dark:border-slate-700">
            <CardHeader className="pb-4">
                <CardTitle className="text-lg font-semibold flex items-center"><Filter className="mr-2 h-5 w-5 text-primary"/> Filter Criteria</CardTitle>
                <FormDescription>Define rules to dynamically include cards in this playlist.</FormDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-0">
                <FormField control={control} name="selectedDeckIds" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Decks</FormLabel>
                        {renderMultiSelectPopover("selectedDeckIds", decks.map(d => ({ value: d.id, label: d.name })), field.value, "Any Deck", "Decks")}
                        <FormDescription>Include cards from these specific decks. Leave empty for all decks.</FormDescription>
                        <FormMessage />
                    </FormItem>
                )} />

                <div className="space-y-4">
                    <FormField control={control} name="includeTags" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Include Deck Tags</FormLabel>
                            {renderMultiSelectPopover("includeTags", allTags.map(t => ({ value: t.id, label: t.name })), field.value, "Any Tag", "Tags")}
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={control} name="tagLogic" render={({ field }) => (
                        <FormItem className={(includeTags && includeTags.length > 1) ? 'mt-2 pl-2' : 'hidden'}>
                            <FormLabel>Tag Logic</FormLabel>
                            <UISelect onValueChange={field.onChange} value={field.value ?? 'ANY'} disabled={isLoading || !(includeTags && includeTags.length > 1)}>
                                <FormControl><SelectTrigger className="w-full sm:w-[220px]"><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent><SelectItem value="ANY">Match ANY selected tag</SelectItem><SelectItem value="ALL">Match ALL selected tags</SelectItem></SelectContent>
                            </UISelect>
                            <FormMessage />
                        </FormItem>
                    )}/>
                </div>

                <FormField control={control} name="containsLanguage" render={({ field }) => (
                    <FormItem>
                        <FormLabel className="flex items-center"><Languages className="mr-2 h-5 w-5 text-muted-foreground" /> Card Language</FormLabel>
                        <UISelect
                            onValueChange={(value) => field.onChange(value === ANY_LANGUAGE_PLACEHOLDER_VALUE ? null : value)}
                            value={field.value ?? ANY_LANGUAGE_PLACEHOLDER_VALUE}
                            disabled={isLoading}
                        >
                            <FormControl><SelectTrigger><SelectValue placeholder="-- Any Language --" /></SelectTrigger></FormControl>
                            <SelectContent>
                                {languageOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                            </SelectContent>
                        </UISelect>
                        <FormDescription>Show cards where either side matches this language (based on deck settings).</FormDescription>
                        <FormMessage />
                    </FormItem>
                )} />

                <FormField control={control} name="srsFilter" render={({ field }) => (
                    <FormItem>
                        <FormLabel className="flex items-center"><GripVertical className="mr-2 h-5 w-5 text-muted-foreground"/> Card SRS Stage</FormLabel>
                        <UISelect
                            onValueChange={(value) => field.onChange(value === "__ANY_STAGE__" ? null : value)}
                            value={(field.value === 'all' || field.value === 'none') ? "__ANY_STAGE__" : field.value || "__ANY_STAGE__"}
                            disabled={isLoading}
                        >
                            <FormControl><SelectTrigger><SelectValue placeholder="-- Any Stage --" /></SelectTrigger></FormControl>
                            <SelectContent>
                                <SelectItem value="__ANY_STAGE__">-- Any Stage --</SelectItem>
                                {srsFilterOptions.map(stage => {
                                    let label = stage.charAt(0).toUpperCase() + stage.slice(1);
                                    if (stage === 'learning') {
                                        label = 'Learning / Relearning';
                                    }
                                    return (
                                        <SelectItem key={stage} value={stage}>
                                            {label}
                                        </SelectItem>
                                    );
                                })}
                            </SelectContent>
                        </UISelect>
                        <FormDescription>Include cards from a specific SRS stage.</FormDescription>
                        <FormMessage />
                    </FormItem>
                )} />
            </CardContent>
        </Card>

        <Card className="dark:border-slate-700">
            <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium flex items-center"><CalendarIcon className="mr-2 h-5 w-5 text-muted-foreground"/> Date Filters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-4">
                <div className="space-y-3">
                    <Label className="text-sm font-medium">Card Created Date</Label>
                    <div className="flex flex-col sm:flex-row items-start sm:items-end gap-2">
                        <FormField control={control} name="createdDateOperator" render={({ field }) => (<FormItem className="w-full sm:flex-shrink-0 sm:w-auto sm:min-w-[180px]"><FormLabel className="sr-only">Condition</FormLabel><UISelect onValueChange={(value) => { field.onChange(value === 'any' ? null : value); resetField("createdDateValueDays"); resetField("createdDateValueDate"); resetField("createdDateValueRange");}} value={field.value ?? 'any'} disabled={isLoading}><FormControl><SelectTrigger><SelectValue placeholder="Any Date" /></SelectTrigger></FormControl><SelectContent><SelectItem value="any">Any Date</SelectItem>{allowedOperators.createdUpdatedOps.map(op => <SelectItem key={`cd-${op}`} value={op}>{op.replace(/([A-Z])/g, ' $1').trim()}</SelectItem>)}</SelectContent></UISelect><FormMessage /></FormItem>)} />
                        {renderDateValueInputs('createdDateOperator', 'createdDateValueDays', 'createdDateValueDate', 'createdDateValueRange')}
                    </div>
                </div>
                <div className="space-y-3">
                    <Label className="text-sm font-medium">Card Last Updated Date</Label>
                    <div className="flex flex-col sm:flex-row items-start sm:items-end gap-2">
                        <FormField control={control} name="updatedDateOperator" render={({ field }) => (<FormItem className="w-full sm:flex-shrink-0 sm:w-auto sm:min-w-[180px]"><FormLabel className="sr-only">Condition</FormLabel><UISelect onValueChange={(value) => { field.onChange(value === 'any' ? null : value); resetField("updatedDateValueDays"); resetField("updatedDateValueDate"); resetField("updatedDateValueRange");}} value={field.value ?? 'any'} disabled={isLoading}><FormControl><SelectTrigger><SelectValue placeholder="Any Date" /></SelectTrigger></FormControl><SelectContent><SelectItem value="any">Any Date</SelectItem>{allowedOperators.createdUpdatedOps.map(op => <SelectItem key={`ud-${op}`} value={op}>{op.replace(/([A-Z])/g, ' $1').trim()}</SelectItem>)}</SelectContent></UISelect><FormMessage /></FormItem>)} />
                        {renderDateValueInputs('updatedDateOperator', 'updatedDateValueDays', 'updatedDateValueDate', 'updatedDateValueRange')}
                    </div>
                </div>
                <div className="space-y-3">
                   <Label className="text-sm font-medium">Card Last Reviewed Date</Label>
                   <div className="flex flex-col sm:flex-row items-start sm:items-end gap-2">
                       <FormField control={control} name="lastReviewedOperator" render={({ field }) => (<FormItem className="w-full sm:flex-shrink-0 sm:w-auto sm:min-w-[180px]"><FormLabel className="sr-only">Condition</FormLabel><UISelect onValueChange={(value) => { field.onChange(value === 'any' ? null : value); resetField("lastReviewedValueDays"); resetField("lastReviewedValueDate"); resetField("lastReviewedValueRange");}} value={field.value ?? 'any'} disabled={isLoading}><FormControl><SelectTrigger><SelectValue placeholder="Any / Never" /></SelectTrigger></FormControl><SelectContent><SelectItem value="any">Any / Never</SelectItem>{allowedOperators.lastReviewedOps.map(op => <SelectItem key={`lr-${op}`} value={op}>{op.replace(/([A-Z])/g, ' $1').trim()}</SelectItem>)}</SelectContent></UISelect><FormMessage /></FormItem>)} />
                       {renderDateValueInputs('lastReviewedOperator', 'lastReviewedValueDays', 'lastReviewedValueDate', 'lastReviewedValueRange')}
                   </div>
               </div>
               <div className="space-y-3">
                   <Label className="text-sm font-medium">Card Next Review Due Date</Label>
                   <div className="flex flex-col sm:flex-row items-start sm:items-end gap-2">
                       <FormField control={control} name="nextReviewDueOperator" render={({ field }) => (<FormItem className="w-full sm:flex-shrink-0 sm:w-auto sm:min-w-[180px]"><FormLabel className="sr-only">Condition</FormLabel><UISelect onValueChange={(value) => { field.onChange(value === 'any' ? null : value); resetField("nextReviewDueValueDays"); resetField("nextReviewDueValueDate"); resetField("nextReviewDueValueRange");}} value={field.value ?? 'any'} disabled={isLoading}><FormControl><SelectTrigger><SelectValue placeholder="Any / Never / Due" /></SelectTrigger></FormControl><SelectContent><SelectItem value="any">Any / Never / Due</SelectItem>{allowedOperators.nextReviewDueOps.map(op => <SelectItem key={`nr-${op}`} value={op}>{op.replace(/([A-Z])/g, ' $1').trim()}</SelectItem>)}</SelectContent></UISelect><FormMessage /></FormItem>)} />
                       {renderDateValueInputs('nextReviewDueOperator', 'nextReviewDueValueDays', 'nextReviewDueValueDate', 'nextReviewDueValueRange')}
                   </div>
               </div>
            </CardContent>
        </Card>

        <Button type="submit" disabled={isLoading || isSaving} className="w-full text-base py-6">
            {isSaving ? <IconLoader className="animate-spin mr-2 h-5 w-5" /> : null}
            {initialData?.id ? 'Update Smart Playlist' : 'Create Smart Playlist'}
        </Button>
      </form>
    </Form>
  );
}