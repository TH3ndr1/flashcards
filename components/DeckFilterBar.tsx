"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { SlidersHorizontal, X } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  nl: 'Dutch',
  fr: 'French',
  de: 'German',
  es: 'Spanish',
  it: 'Italian',
  pt: 'Portuguese',
  zh: 'Chinese',
  ja: 'Japanese',
  ko: 'Korean',
  ar: 'Arabic',
  ru: 'Russian',
};

interface TagOption {
  id: string;
  name: string;
}

interface DeckFilterBarProps {
  availableLanguages: string[];
  availableTags: TagOption[];
  selectedLanguages: string[];
  selectedTags: string[];
  onLanguagesChange: (langs: string[]) => void;
  onTagsChange: (tagIds: string[]) => void;
}

export function DeckFilterBar({
  availableLanguages,
  availableTags,
  selectedLanguages,
  selectedTags,
  onLanguagesChange,
  onTagsChange,
}: DeckFilterBarProps) {
  const [open, setOpen] = useState(false);
  const activeFilterCount = selectedLanguages.length + selectedTags.length;

  const toggleLanguage = (lang: string) => {
    onLanguagesChange(
      selectedLanguages.includes(lang)
        ? selectedLanguages.filter(l => l !== lang)
        : [...selectedLanguages, lang]
    );
  };

  const toggleTag = (tagId: string) => {
    onTagsChange(
      selectedTags.includes(tagId)
        ? selectedTags.filter(t => t !== tagId)
        : [...selectedTags, tagId]
    );
  };

  const clearAll = () => {
    onLanguagesChange([]);
    onTagsChange([]);
  };

  const hasOptions = availableLanguages.length > 0 || availableTags.length > 0;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-9 gap-2">
            <SlidersHorizontal className="h-4 w-4" />
            Filter
            {activeFilterCount > 0 && (
              <Badge
                variant="secondary"
                className="h-5 min-w-5 rounded-full px-1 flex items-center justify-center text-xs"
              >
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-72 p-4" align="start" sideOffset={8}>
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm">Filter decks</h4>
              {activeFilterCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAll}
                  className="h-7 px-2 text-xs text-muted-foreground"
                >
                  <X className="h-3 w-3 mr-1" />
                  Clear all
                </Button>
              )}
            </div>

            {!hasOptions && (
              <p className="text-sm text-muted-foreground text-center py-2">
                No filter options available.
              </p>
            )}

            {/* Language filter */}
            {availableLanguages.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Language
                </p>
                <div className="space-y-2">
                  {availableLanguages.map(lang => (
                    <div key={lang} className="flex items-center space-x-2">
                      <Checkbox
                        id={`filter-lang-${lang}`}
                        checked={selectedLanguages.includes(lang)}
                        onCheckedChange={() => toggleLanguage(lang)}
                      />
                      <Label
                        htmlFor={`filter-lang-${lang}`}
                        className="text-sm font-normal cursor-pointer"
                      >
                        {LANGUAGE_NAMES[lang] || lang}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {availableLanguages.length > 0 && availableTags.length > 0 && <Separator />}

            {/* Tag filter */}
            {availableTags.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Tags
                </p>
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {availableTags.map(tag => (
                    <div key={tag.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`filter-tag-${tag.id}`}
                        checked={selectedTags.includes(tag.id)}
                        onCheckedChange={() => toggleTag(tag.id)}
                      />
                      <Label
                        htmlFor={`filter-tag-${tag.id}`}
                        className="text-sm font-normal cursor-pointer"
                      >
                        {tag.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Active filter chips */}
      {selectedLanguages.map(lang => (
        <Badge
          key={lang}
          variant="secondary"
          className="text-xs h-7 pl-2 pr-1 gap-1 cursor-default"
        >
          {LANGUAGE_NAMES[lang] || lang}
          <button
            onClick={() => toggleLanguage(lang)}
            className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5"
            aria-label={`Remove ${LANGUAGE_NAMES[lang] || lang} filter`}
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      {selectedTags.map(tagId => {
        const tag = availableTags.find(t => t.id === tagId);
        return tag ? (
          <Badge
            key={tagId}
            variant="secondary"
            className="text-xs h-7 pl-2 pr-1 gap-1 cursor-default"
          >
            {tag.name}
            <button
              onClick={() => toggleTag(tagId)}
              className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5"
              aria-label={`Remove ${tag.name} filter`}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ) : null;
      })}
    </div>
  );
}
