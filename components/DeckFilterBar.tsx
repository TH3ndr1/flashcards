"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Command, CommandEmpty, CommandGroup,
  CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { Check, ChevronDown, Search, SlidersHorizontal, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English', nl: 'Dutch',  fr: 'French',  de: 'German',
  es: 'Spanish', it: 'Italian', pt: 'Portuguese', zh: 'Chinese',
  ja: 'Japanese', ko: 'Korean', ar: 'Arabic', ru: 'Russian',
};

interface TagOption { id: string; name: string }

export interface DeckFilterBarProps {
  /** Unique language codes present in the deck list */
  availableLanguages: string[];
  /** All tags present in the deck list */
  availableTags: TagOption[];
  /** Currently selected language codes */
  selectedLanguages: string[];
  /** Currently selected tag ids */
  selectedTags: string[];
  /** Current deck-name search string */
  deckNameFilter: string;
  onLanguagesChange: (langs: string[]) => void;
  onTagsChange: (tagIds: string[]) => void;
  onDeckNameChange: (name: string) => void;
}

// ─── Reusable multi-select dropdown ──────────────────────────────────────────

interface MultiSelectProps {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
  searchPlaceholder?: string;
  emptyText?: string;
}

function MultiSelectDropdown({
  label, options, selected, onChange, searchPlaceholder = 'Search…', emptyText = 'No results.',
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);

  const toggle = (value: string) =>
    onChange(selected.includes(value) ? selected.filter(v => v !== value) : [...selected, value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-1.5 font-normal"
          aria-expanded={open}
        >
          {label}
          {selected.length > 0 && (
            <Badge variant="secondary" className="h-5 min-w-5 rounded-full px-1 text-xs">
              {selected.length}
            </Badge>
          )}
          <ChevronDown className="h-3.5 w-3.5 opacity-50 ml-0.5" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-56 p-0" align="start" sideOffset={8}>
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map(opt => (
                <CommandItem
                  key={opt.value}
                  value={opt.label}          /* cmdk searches on `value` */
                  onSelect={() => toggle(opt.value)}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4 shrink-0',
                      selected.includes(opt.value) ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  {opt.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
          {selected.length > 0 && (
            <div className="border-t p-1">
              <Button
                variant="ghost"
                size="sm"
                className="w-full h-8 text-xs text-muted-foreground"
                onClick={() => onChange([])}
              >
                Clear selection
              </Button>
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ─── Main filter bar ──────────────────────────────────────────────────────────

export function DeckFilterBar({
  availableLanguages,
  availableTags,
  selectedLanguages,
  selectedTags,
  deckNameFilter,
  onLanguagesChange,
  onTagsChange,
  onDeckNameChange,
}: DeckFilterBarProps) {
  const [isOpen, setIsOpen] = useState(false);

  const languageOptions = availableLanguages.map(l => ({
    value: l,
    label: LANGUAGE_NAMES[l] || l,
  }));

  const tagOptions = availableTags.map(t => ({ value: t.id, label: t.name }));

  const hasActiveFilters =
    selectedLanguages.length > 0 || selectedTags.length > 0 || deckNameFilter.length > 0;
  const activeFilterCount =
    selectedLanguages.length + selectedTags.length + (deckNameFilter ? 1 : 0);

  const clearAll = () => {
    onLanguagesChange([]);
    onTagsChange([]);
    onDeckNameChange('');
  };

  const removeLanguage = (lang: string) =>
    onLanguagesChange(selectedLanguages.filter(l => l !== lang));

  const removeTag = (tagId: string) =>
    onTagsChange(selectedTags.filter(t => t !== tagId));

  return (
    <div>
      {/* Toggle button — always visible, zero extra vertical space when closed */}
      <div className="flex items-center gap-2">
        <Button
          variant={hasActiveFilters ? 'secondary' : 'outline'}
          size="sm"
          className="h-8 gap-1.5 text-sm"
          onClick={() => setIsOpen(o => !o)}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filter
          {activeFilterCount > 0 && (
            <Badge variant="default" className="h-5 min-w-5 rounded-full px-1 text-xs">
              {activeFilterCount}
            </Badge>
          )}
        </Button>

        {/* Active chips inline with toggle so they don't take extra rows when panel is closed */}
        {!isOpen && hasActiveFilters && (
          <div className="flex flex-wrap gap-1.5">
            {selectedLanguages.map(lang => (
              <Badge key={lang} variant="secondary" className="text-xs h-6 pl-2 pr-1 gap-1">
                {LANGUAGE_NAMES[lang] || lang}
                <button onClick={() => removeLanguage(lang)}
                  className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {selectedTags.map(tagId => {
              const tag = availableTags.find(t => t.id === tagId);
              return tag ? (
                <Badge key={tagId} variant="secondary" className="text-xs h-6 pl-2 pr-1 gap-1">
                  {tag.name}
                  <button onClick={() => removeTag(tagId)}
                    className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ) : null;
            })}
            {deckNameFilter && (
              <Badge variant="secondary" className="text-xs h-6 pl-2 pr-1 gap-1">
                &ldquo;{deckNameFilter}&rdquo;
                <button onClick={() => onDeckNameChange('')}
                  className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Expandable filter panel */}
      {isOpen && (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {/* Deck name search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search deck name…"
                value={deckNameFilter}
                onChange={e => onDeckNameChange(e.target.value)}
                className="h-9 pl-8 w-44 text-sm"
                autoFocus
              />
              {deckNameFilter && (
                <button
                  onClick={() => onDeckNameChange('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Clear name search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Language multi-select */}
            {languageOptions.length > 0 && (
              <MultiSelectDropdown
                label="Language"
                options={languageOptions}
                selected={selectedLanguages}
                onChange={onLanguagesChange}
                searchPlaceholder="Search languages…"
                emptyText="No matching language."
              />
            )}

            {/* Tag multi-select */}
            {tagOptions.length > 0 && (
              <MultiSelectDropdown
                label="Tags"
                options={tagOptions}
                selected={selectedTags}
                onChange={onTagsChange}
                searchPlaceholder="Search tags…"
                emptyText="No matching tag."
              />
            )}

            {/* Clear all */}
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" className="h-9 px-2 text-xs text-muted-foreground"
                onClick={clearAll}>
                <X className="h-3.5 w-3.5 mr-1" />
                Clear all
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
