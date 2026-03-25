// components/DeckListClient.tsx
"use client";

import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PlusCircle, Loader2, Globe, Tag } from "lucide-react";
import {
  FlashcardMethodIcon,
  MethodThumbnail,
  STUDY_METHOD_CONFIG,
} from '@/components/study-method/study-method-config';
import { useRouter } from "next/navigation";
import { useStudySessionStore } from '@/store/studySessionStore';
import type { StudySessionInput, SessionType } from '@/types/study';
import {
  TooltipProvider,
} from "@/components/ui/tooltip";
import { DeckProgressBar } from "@/components/deck/DeckProgressBar";
// Import useSettings and DEFAULT_SETTINGS
import { useSettings, DEFAULT_SETTINGS } from "@/providers/settings-provider";
import { Separator } from "@/components/ui/separator";
import { toast } from 'sonner';
import { useDecksRealtime as useDecksHook } from "@/hooks/useDecksRealtime"; // Use real-time hook for cross-device sync
import type { DeckListItemWithCounts } from "@/lib/actions/deckActions"; // Import from actions instead
import { parseISO } from 'date-fns'; // For sorting by date
// ItemInfoBadges replaced by inline layout in new card design
import { DeckProgressLegend } from '@/components/deck/DeckProgressLegend';
import { DeckFilterBar } from '@/components/DeckFilterBar';
import { cn } from "@/lib/utils";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { SrsToggle } from "@/components/ui/srs-toggle";
import { StoryGenerateModal } from '@/components/story/StoryGenerateModal';
import { useStoryStore } from '@/store/storyStore';
import { getStoryForDeck } from '@/lib/actions/storyActions';

// Type for TagInfo (if not already globally defined)
interface TagInfo {
  id: string;
  name: string;
}

// Extend DeckListItemWithCounts locally for this component to include processed fields
interface ProcessedDeck extends DeckListItemWithCounts {
  totalCards: number;
  tags: TagInfo[];
  languageDisplay: string;
}

// Props remain the same, initialData is passed from server component
interface DeckListClientProps {
  // initialData is no longer a prop, data comes from useDecks hook
}

export function DeckListClient({}: DeckListClientProps) { // Removed initialData from props
  const router = useRouter();
  const { 
    decks: rawDecksFromHook, // Renamed to avoid conflict
    loading: decksLoading, 
    error: decksError
  } = useDecksHook();

  const { settings, loading: settingsLoading } = useSettings();
  const { setStudyParameters, clearStudyParameters } = useStudySessionStore(); // Corrected destructuring

  // Preferences from settings, with fallbacks to defaults
  const groupingMode = settings?.deckListGroupingMode || DEFAULT_SETTINGS.deckListGroupingMode;
  const activeTagGroupId = settings?.deckListActiveTagGroupId || DEFAULT_SETTINGS.deckListActiveTagGroupId;
  const sortField = settings?.deckListSortField || DEFAULT_SETTINGS.deckListSortField;
  const sortDirection = settings?.deckListSortDirection || DEFAULT_SETTINGS.deckListSortDirection;
  const showDeckProgressBars = settings?.showDeckProgress ?? DEFAULT_SETTINGS.showDeckProgress; // Use setting for progress bar

  const isOverallLoading = decksLoading || settingsLoading;

  // State for accordion sections - default to open
  const [openSections, setOpenSections] = useState<string[]>(["dueDecks", "otherDecks"]);

  // Filter state
  const [filterLanguages, setFilterLanguages] = useState<string[]>([]);
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [filterName, setFilterName] = useState('');

  // State for SRS toggle - default to enabled (same as practice/select)
  const [srsEnabled, setSrsEnabled] = useState<boolean>(true);

  const [storyModalDeck, setStoryModalDeck] = useState<{ id: string; name: string } | null>(null);
  const setCurrentStory = useStoryStore((s) => s.setCurrentStory);

  // Memoized and processed decks (this will be expanded in Task X.3.3 for grouping)
  const processedAndSortedDecks = useMemo(() => {
    if (!rawDecksFromHook) return [];

    let decksToProcess: ProcessedDeck[] = rawDecksFromHook.map(deck => {
      const totalCards = (deck.new_count ?? 0) +
                         (deck.learning_count ?? 0) +
                         (deck.relearning_count ?? 0) +
                         (deck.young_count ?? 0) +
                         (deck.mature_count ?? 0);
      
      let tags: TagInfo[] = [];
      if (deck.deck_tags_json && Array.isArray(deck.deck_tags_json)) {
         try {
            tags = (deck.deck_tags_json as unknown as TagInfo[]).filter(tag => tag && typeof tag.name === 'string');
         } catch (e) { console.error("Error parsing tags for deck " + deck.id, e); }
      }

      const languageDisplay = deck.is_bilingual
        ? `${deck.primary_language || 'N/A'} / ${deck.secondary_language || 'N/A'}`
        : deck.primary_language || 'N/A';
      return { ...deck, totalCards, tags, languageDisplay };
    });

    // --- Filtering based on 'tag_id' groupingMode (from settings) ---
    if (groupingMode === 'tag_id' && activeTagGroupId) {
      decksToProcess = decksToProcess.filter(deck =>
        deck.tags?.some(tag => tag.id === activeTagGroupId)
      );
    }

    // --- User-selected filters ---
    if (filterName.trim()) {
      decksToProcess = decksToProcess.filter(deck =>
        deck.name.toLowerCase().includes(filterName.trim().toLowerCase())
      );
    }
    if (filterLanguages.length > 0) {
      decksToProcess = decksToProcess.filter(deck =>
        (deck.primary_language   && filterLanguages.includes(deck.primary_language))  ||
        (deck.secondary_language && filterLanguages.includes(deck.secondary_language))
      );
    }
    if (filterTags.length > 0) {
      decksToProcess = decksToProcess.filter(deck =>
        deck.tags?.some(tag => filterTags.includes(tag.id))
      );
    }

    // --- Sorting logic ---
    decksToProcess.sort((a, b) => {
      let valA, valB;
      if (sortField === 'created_at') {
        // Use updated_at since created_at is not available in DeckListItemWithCounts type
        valA = a.updated_at ? parseISO(a.updated_at).getTime() : 0;
        valB = b.updated_at ? parseISO(b.updated_at).getTime() : 0;
      } else { // 'name'
        valA = a.name.toLowerCase();
        valB = b.name.toLowerCase();
      }
      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    
    return decksToProcess;

  }, [rawDecksFromHook, groupingMode, activeTagGroupId, sortField, sortDirection, filterLanguages, filterTags, filterName]);

  // Segregate decks into 'due' and 'other' based on practiceable count
  const dueDecks = useMemo(() => 
    processedAndSortedDecks.filter(deck => 
      (deck.learn_eligible_count ?? 0) + (deck.review_eligible_count ?? 0) > 0
    )
  , [processedAndSortedDecks]);

  const otherDecks = useMemo(() => 
    processedAndSortedDecks.filter(deck => 
      (deck.learn_eligible_count ?? 0) + (deck.review_eligible_count ?? 0) === 0
    )
  , [processedAndSortedDecks]);

  // The actual rendering of groups (Accordion, etc.) will be in Task X.3.3
  // For this task, we just confirm settings are read.
  // console.log("DeckListClient - Settings read:", { groupingMode, activeTagGroupId, sortField, sortDirection });

  // Derive available filter options from the raw (unfiltered) deck list
  const availableFilterLanguages = useMemo(() => {
    const langs = new Set<string>();
    (rawDecksFromHook || []).forEach(d => {
      if (d.primary_language)   langs.add(d.primary_language);
      if (d.secondary_language) langs.add(d.secondary_language);
    });
    return Array.from(langs).sort();
  }, [rawDecksFromHook]);

  const availableFilterTags = useMemo(() => {
    const tagMap = new Map<string, string>();
    (rawDecksFromHook || []).forEach(d => {
      if (d.deck_tags_json && Array.isArray(d.deck_tags_json)) {
        (d.deck_tags_json as Array<{ id: string; name: string }>)
          .filter(t => t && typeof t.name === 'string')
          .forEach(t => tagMap.set(t.id, t.name));
      }
    });
    return Array.from(tagMap.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rawDecksFromHook]);

  const handlePracticeDeck = (deckId: string, learnCount: number, reviewCount: number) => {
    // When SRS is disabled, skip the eligibility check and allow all cards
    if (srsEnabled && learnCount === 0 && reviewCount === 0) {
        toast.info("No cards available to practice in this deck right now.");
        return;
    }
    const studyInput: StudySessionInput = { deckId: deckId };
    const sessionTypeForStore: SessionType = 'unified';
    clearStudyParameters();
    setStudyParameters(studyInput, sessionTypeForStore, undefined, srsEnabled);
    router.push('/study/session');
  };

  const handleCreateDeckClick = () => {
    // Link to the deck creation page
    router.push('/manage/decks/new');
  };

  const handleStoryClick = async (e: React.MouseEvent, deck: { id: string; name: string }) => {
    e.stopPropagation();
    e.preventDefault();
    const { data: story } = await getStoryForDeck(deck.id);
    if (story) {
      setCurrentStory(story, deck.name, deck.id, window.location.pathname);
      router.push(`/practice/story/${deck.id}`);
    } else {
      setStoryModalDeck(deck);
    }
  };

  if (isOverallLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (decksError) {
    return <p className="text-center text-destructive py-10">Error loading decks: {decksError}</p>;
  }

  // --- This is where rendering logic for different grouping modes will go (Task X.3.3) ---
  // For now, we'll render a flat list using processedAndSortedDecks
  // The grouping UI controls will be added in the Settings page (Task X.S1)

  const renderDeckItem = (deck: ProcessedDeck) => {
    const learnEligible = deck.learn_eligible_count ?? 0;
    const reviewEligible = deck.review_eligible_count ?? 0;

    const cfg = STUDY_METHOD_CONFIG.flashcard;
    const languageDisplay = deck.is_bilingual
      ? `${deck.primary_language ?? '?'} / ${deck.secondary_language ?? '?'}`
      : (deck.primary_language ?? '?');
    const tagNames = deck.tags?.map(t => t.name).slice(0, 3).join(', ');

    return (
      <Card
        key={deck.id}
        className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer group"
        onClick={() => handlePracticeDeck(deck.id, learnEligible, reviewEligible)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            handlePracticeDeck(deck.id, learnEligible, reviewEligible);
          }
        }}
      >
        {/* ── Header: white bg, icon + coloured title ── */}
        <div className="px-4 pt-3 pb-2">
          {/* min-h ensures uniform header height whether name is 1 or 2 lines */}
          <div className="flex items-start gap-2 min-h-[38px]">
            <FlashcardMethodIcon className={cn('h-4 w-4 mt-0.5 flex-shrink-0', cfg.textColor)} />
            <span className={cn('text-sm font-semibold leading-snug flex-1 min-w-0 line-clamp-2', cfg.textColor)} title={deck.name}>
              {deck.name}
            </span>
          </div>
        </div>
        {/* thin divider */}
        <div className={cn('h-px mx-4', cfg.divider)} />

        {/* ── Content: coloured bg, stats left + thumbnail bottom-right ── */}
        {/* overflow-visible here so thumbnail can extend past card edge (clipped by Card overflow-hidden) */}
        <div className={cn('relative px-4 pt-3 pb-3 min-h-[88px]', cfg.bgSection)}>
          <div className="space-y-1.5 text-xs text-muted-foreground pr-12">
            {languageDisplay && (
              <div className="flex items-center gap-1.5">
                <Globe className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{languageDisplay}</span>
              </div>
            )}
            {tagNames && (
              <div className="flex items-center gap-1.5">
                <Tag className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{tagNames}</span>
              </div>
            )}
            {deck.totalCards > 0 && (
              <p className="text-xs font-semibold text-foreground/80">
                {learnEligible + reviewEligible > 0
                  ? `${learnEligible + reviewEligible} of ${deck.totalCards} due`
                  : `${deck.totalCards} cards`}
              </p>
            )}
          </div>
          {/* Thumbnail: absolute bottom-right, -right-4 pushes it 16px past the card edge
              so Card overflow-hidden clips ~25% for the "cut off" effect */}
          <div className="absolute bottom-0 -right-4 w-16 h-16">
            <MethodThumbnail type="flashcard" />
          </div>
        </div>

        {/* ── Footer: white bg, progress bar ── */}
        {showDeckProgressBars && deck.totalCards > 0 && (
          <div className="px-4 py-2.5">
            <DeckProgressBar
              newCount={deck.new_count ?? 0}
              learningCount={deck.learning_count ?? 0}
              relearningCount={deck.relearning_count ?? 0}
              youngCount={deck.young_count ?? 0}
              matureCount={deck.mature_count ?? 0}
            />
          </div>
        )}
      </Card>
    );
  }
  // --- End of renderDeckItem ---

  return (
    <TooltipProvider>
      <div className="space-y-6 py-4 px-4 md:p-6">
        <div className="flex justify-between items-center flex-wrap gap-4 mb-6">
          <h2 className="text-2xl font-semibold">Practice Your Decks</h2>
            <SrsToggle
            checked={srsEnabled}
            onCheckedChange={setSrsEnabled}
            id="deck-list-srs-toggle"
          />
        </div>

        {/* Filter bar */}
        <DeckFilterBar
          availableLanguages={availableFilterLanguages}
          availableTags={availableFilterTags}
          selectedLanguages={filterLanguages}
          selectedTags={filterTags}
          deckNameFilter={filterName}
          onLanguagesChange={setFilterLanguages}
          onTagsChange={setFilterTags}
          onDeckNameChange={setFilterName}
        />

        {/* UI Controls for grouping/sorting will be added to Settings page (Task X.S1) */}
        {/* This component now just reads and applies them. */}
        {/* For debugging, you can display the current settings: */}
        {/* 
        <div className="p-2 bg-muted text-xs rounded mb-2">
            Grouping: {groupingMode}
            {groupingMode === 'tag_id' && activeTagGroupId && ` (Tag ID: ${activeTagGroupId})`}
            , Sort: {sortField} ({sortDirection})
        </div> 
        */}

        {processedAndSortedDecks.length === 0 && !isOverallLoading && (
          <div className="col-span-full text-center text-muted-foreground mt-10">
            <p>
              {groupingMode === 'tag_id' && activeTagGroupId 
                ? "No decks found with the selected tag." 
                : "You haven't created any decks yet, or no decks match current filters."}
            </p>
            <Button onClick={handleCreateDeckClick} className="mt-4">
              <PlusCircle className="mr-2 h-4 w-4" />
              Create Your First Deck
            </Button>
          </div>
        )}

        {/* Accordion for Due Decks and Other Decks */}
        {processedAndSortedDecks.length > 0 && (
          <Accordion 
            type="multiple" 
            className="w-full space-y-4"
            value={openSections}
            onValueChange={setOpenSections} // Allow controlling open/close state
          >
            {/* Section 1: Decks with Cards Due */}
            <AccordionItem value="dueDecks" className="border-none">
              <AccordionTrigger className="text-lg font-medium font-atkinson hover:no-underline p-3 bg-muted/50 rounded-md flex items-center">
                <span>Due for Review</span>
              </AccordionTrigger>
              <AccordionContent className="pt-4">
                {dueDecks.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {dueDecks.map(renderDeckItem)}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-4">No decks currently have cards due for review.</p>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* Section 2: Other Decks */}
            <AccordionItem value="otherDecks" className="border-none">
              <AccordionTrigger className="text-lg font-medium font-atkinson hover:no-underline p-3 bg-muted/50 rounded-md flex items-center">
                <span>Not Due for Review</span>
              </AccordionTrigger>
              <AccordionContent className="pt-4">
                {otherDecks.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {otherDecks.map(renderDeckItem)}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-4">No other decks to display.</p>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}

        {showDeckProgressBars && processedAndSortedDecks.length > 0 && (
          <div className="mt-8 pt-4 border-t dark:border-slate-700 flex justify-center">
            <DeckProgressLegend
              newCount={0} // Dummy values, as showEmptyStages will display them
              learningCount={0}
              relearningCount={0}
              youngCount={0}
              matureCount={0}
              showEmptyStages={true} // Ensure all stages are shown for the global legend
            />
          </div>
        )}

        {storyModalDeck && (
          <StoryGenerateModal
            deckId={storyModalDeck.id}
            deckName={storyModalDeck.name}
            isOpen={!!storyModalDeck}
            onClose={() => setStoryModalDeck(null)}
          />
        )}
      </div>
    </TooltipProvider>
  );
}