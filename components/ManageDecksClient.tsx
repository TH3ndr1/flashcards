"use client";

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, Trash2, Merge, Archive, ArchiveRestore, Tags } from 'lucide-react';
import { DeckProgressBar } from '@/components/deck/DeckProgressBar';
import { ItemInfoBadges } from '@/components/ItemInfoBadges';
import { DeckFilterBar } from '@/components/DeckFilterBar';
import { DeckProgressLegend } from '@/components/deck/DeckProgressLegend';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  deleteDecks, mergeDecks, getDecksForManagement,
  archiveMultipleDecks, activateMultipleDecks,
  type DeckListItemWithCountsAndStatus,
} from '@/lib/actions/deckActions';
import { addTagToDecks, removeTagFromDecks } from '@/lib/actions/tagActions';
import { useTags } from '@/hooks/useTags';
import type { Tables } from '@/types/database';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";

type ManageDeckItem = DeckListItemWithCountsAndStatus;

interface ManageDecksClientProps {
  initialDecks: ManageDeckItem[];
  fetchError?: string | null;
}

const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'nl', label: 'Dutch' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'es', label: 'Spanish' },
  { value: 'it', label: 'Italian' },
];

function parseTags(json: unknown): Array<{ id: string; name: string }> {
  if (json && Array.isArray(json)) {
    return (json as Array<{ id: string; name: string }>).filter(
      t => t && typeof t.name === 'string'
    );
  }
  return [];
}

export function ManageDecksClient({ initialDecks, fetchError }: ManageDecksClientProps) {
  const [decks, setDecks] = useState<ManageDeckItem[]>(initialDecks);
  const { isChildMode } = useFeatureFlags();
  const { allTags } = useTags();

  // Multi-edit
  const [isMultiEditMode, setIsMultiEditMode] = useState(false);
  const [selectedDeckIds, setSelectedDeckIds] = useState<Set<string>>(new Set());

  // Action loading states
  const [isDeleting, setIsDeleting] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [isTagging, setIsTagging] = useState(false);

  // Dialog visibility
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [showTagDialog, setShowTagDialog] = useState(false);
  const [tagDialogMode, setTagDialogMode] = useState<'add' | 'remove'>('add');
  const [selectedTagId, setSelectedTagId] = useState('');

  const [openSections, setOpenSections] = useState<string[]>(["activeDecks"]);

  // Filter state
  const [filterLanguages, setFilterLanguages] = useState<string[]>([]);
  const [filterTags, setFilterTags] = useState<string[]>([]);

  const [mergeFormData, setMergeFormData] = useState({
    name: '',
    is_bilingual: false,
    primary_language: '',
    secondary_language: '',
    tags: [] as Array<{ id: string; name: string }>,
  });

  const legendStages = [
    { name: 'New',        startColor: '#EC4899', endColor: '#EF4444' },
    { name: 'Learning',   startColor: '#DA55C6', endColor: '#9353DD' },
    { name: 'Relearning', startColor: '#F59E0B', endColor: '#F97316' },
    { name: 'Young',      startColor: '#6055DA', endColor: '#5386DD' },
    { name: 'Mature',     startColor: '#55A9DA', endColor: '#53DDDD' },
  ];

  // ---------- derived data ----------

  const activeDecks  = useMemo(() => decks.filter(d => d.status === 'active'),   [decks]);
  const archivedDecks = useMemo(() => decks.filter(d => d.status === 'archived'), [decks]);

  // All unique languages across all decks (sorted)
  const availableLanguages = useMemo(() => {
    const langs = new Set<string>();
    decks.forEach(d => {
      if (d.primary_language)   langs.add(d.primary_language);
      if (d.secondary_language) langs.add(d.secondary_language);
    });
    return Array.from(langs).sort();
  }, [decks]);

  // All unique tags across all decks (sorted alphabetically)
  const availableTags = useMemo(() => {
    const tagMap = new Map<string, string>();
    decks.forEach(d => parseTags(d.deck_tags_json).forEach(t => tagMap.set(t.id, t.name)));
    return Array.from(tagMap.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [decks]);

  // Apply filters to each section
  const filterDeck = (deck: ManageDeckItem): boolean => {
    if (filterLanguages.length > 0) {
      const matchesLang =
        (deck.primary_language   && filterLanguages.includes(deck.primary_language))  ||
        (deck.secondary_language && filterLanguages.includes(deck.secondary_language));
      if (!matchesLang) return false;
    }
    if (filterTags.length > 0) {
      const deckTags = parseTags(deck.deck_tags_json).map(t => t.id);
      if (!filterTags.some(tid => deckTags.includes(tid))) return false;
    }
    return true;
  };

  const filteredActiveDecks   = useMemo(() => activeDecks.filter(filterDeck),   [activeDecks,   filterLanguages, filterTags]);
  const filteredArchivedDecks = useMemo(() => archivedDecks.filter(filterDeck), [archivedDecks, filterLanguages, filterTags]);

  // Tags on currently-selected decks (for "Remove Tag" dialog)
  const tagsOnSelectedDecks = useMemo(() => {
    const tagMap = new Map<string, string>();
    decks.filter(d => selectedDeckIds.has(d.id))
         .forEach(d => parseTags(d.deck_tags_json).forEach(t => tagMap.set(t.id, t.name)));
    return Array.from(tagMap.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [decks, selectedDeckIds]);

  // ---------- selection helpers ----------

  React.useEffect(() => {
    if (!isMultiEditMode) setSelectedDeckIds(new Set());
  }, [isMultiEditMode]);

  const allSelected  = decks.length > 0 && selectedDeckIds.size === decks.length;
  const someSelected = selectedDeckIds.size > 0 && selectedDeckIds.size < decks.length;

  const handleSelectAll = (checked: boolean) =>
    setSelectedDeckIds(checked ? new Set(decks.map(d => d.id)) : new Set());

  const handleDeckSelect = (deckId: string, checked: boolean) => {
    const next = new Set(selectedDeckIds);
    checked ? next.add(deckId) : next.delete(deckId);
    setSelectedDeckIds(next);
  };

  const selectedDecks = decks.filter(d => selectedDeckIds.has(d.id));
  const hasSelectedActiveDecks   = selectedDecks.some(d => d.status === 'active');
  const hasSelectedArchivedDecks = selectedDecks.some(d => d.status === 'archived');

  // ---------- handlers ----------

  const handleDeleteSelected = () => {
    if (selectedDeckIds.size === 0) { toast.error("Select at least one deck to delete."); return; }
    setShowDeleteDialog(true);
  };

  const handleMergeSelected = () => {
    if (selectedDeckIds.size < 2) { toast.error("Select at least two decks to merge."); return; }
    const first = decks.find(d => selectedDeckIds.has(d.id));
    if (first) {
      setMergeFormData({
        name: first.name + " (merged)",
        is_bilingual: first.is_bilingual,
        primary_language: first.primary_language || '',
        secondary_language: first.secondary_language || '',
        tags: parseTags(first.deck_tags_json),
      });
    }
    setShowMergeDialog(true);
  };

  const handleOpenTagDialog = (mode: 'add' | 'remove') => {
    if (selectedDeckIds.size === 0) { toast.error("Select at least one deck."); return; }
    setTagDialogMode(mode);
    setSelectedTagId('');
    setShowTagDialog(true);
  };

  const confirmTagAction = async () => {
    if (!selectedTagId) { toast.error("Please select a tag."); return; }
    setIsTagging(true);
    const deckIdsArray = Array.from(selectedDeckIds);
    try {
      let result;
      if (tagDialogMode === 'add') {
        result = await addTagToDecks(deckIdsArray, selectedTagId);
      } else {
        result = await removeTagFromDecks(deckIdsArray, selectedTagId);
      }
      if (result.error) {
        toast.error(`Failed to ${tagDialogMode} tag`, { description: result.error });
      } else {
        const refreshResult = await getDecksForManagement();
        if (refreshResult.data) setDecks(refreshResult.data);
        toast.success(
          tagDialogMode === 'add'
            ? `Tag added to selected decks`
            : `Tag removed from selected decks`
        );
        setShowTagDialog(false);
        setSelectedDeckIds(new Set());
        setIsMultiEditMode(false);
      }
    } catch {
      toast.error("An unexpected error occurred.");
    } finally {
      setIsTagging(false);
    }
  };

  const handleArchiveSelected = async () => {
    if (!hasSelectedActiveDecks) { toast.error("Select at least one active deck."); return; }
    setIsArchiving(true);
    try {
      const result = await archiveMultipleDecks(Array.from(selectedDeckIds));
      if (result.error || !result.data) {
        toast.error("Failed to archive decks", { description: result.error || "Unknown error" });
      } else {
        const refresh = await getDecksForManagement();
        if (refresh.data) setDecks(refresh.data);
        setSelectedDeckIds(new Set()); setIsMultiEditMode(false);
        result.data.archivedCount === 0
          ? toast.info("No active decks were selected for archiving.")
          : toast.success(`Archived ${result.data.archivedCount} deck(s)`);
      }
    } catch { toast.error("An unexpected error occurred."); }
    finally { setIsArchiving(false); }
  };

  const handleActivateSelected = async () => {
    if (!hasSelectedArchivedDecks) { toast.error("Select at least one archived deck."); return; }
    setIsActivating(true);
    try {
      const result = await activateMultipleDecks(Array.from(selectedDeckIds));
      if (result.error || !result.data) {
        toast.error("Failed to activate decks", { description: result.error || "Unknown error" });
      } else {
        const refresh = await getDecksForManagement();
        if (refresh.data) setDecks(refresh.data);
        setSelectedDeckIds(new Set()); setIsMultiEditMode(false);
        result.data.activatedCount === 0
          ? toast.info("No archived decks were selected for activation.")
          : toast.success(`Activated ${result.data.activatedCount} deck(s)`);
      }
    } catch { toast.error("An unexpected error occurred."); }
    finally { setIsActivating(false); }
  };

  const confirmDelete = async () => {
    if (selectedDeckIds.size === 0) return;
    setIsDeleting(true);
    const deckIdsArray = Array.from(selectedDeckIds);
    const names = decks.filter(d => selectedDeckIds.has(d.id)).map(d => d.name);
    try {
      const result = await deleteDecks(deckIdsArray);
      if (result.error) {
        toast.error("Failed to delete decks", { description: result.error });
      } else {
        const deletedCount = result.data?.deletedCount || 0;
        setDecks(prev => prev.filter(d => !selectedDeckIds.has(d.id)));
        setSelectedDeckIds(new Set()); setIsMultiEditMode(false);
        toast.success(`Deleted ${deletedCount} deck(s)`, {
          description: deletedCount !== names.length
            ? `${names.length - deletedCount} deck(s) could not be deleted` : undefined,
        });
      }
    } catch { toast.error("An unexpected error occurred."); }
    finally { setIsDeleting(false); setShowDeleteDialog(false); }
  };

  const confirmMerge = async () => {
    if (selectedDeckIds.size < 2) return;
    setIsMerging(true);
    try {
      const result = await mergeDecks(Array.from(selectedDeckIds), mergeFormData);
      if (result.error || !result.data) {
        toast.error("Failed to merge decks", { description: result.error || "Unknown error" });
      } else {
        const refresh = await getDecksForManagement();
        if (refresh.data) {
          setDecks(refresh.data);
        } else {
          setDecks(prev => {
            const remaining = prev.filter(d => !selectedDeckIds.has(d.id));
            const newItem: ManageDeckItem = {
              id: result.data!.id, name: result.data!.name,
              primary_language: result.data!.primary_language,
              secondary_language: result.data!.secondary_language,
              is_bilingual: result.data!.is_bilingual,
              updated_at: result.data!.updated_at || new Date().toISOString(),
              status: (result.data as Tables<'decks'>).status || 'active',
              new_count: 0, learning_count: 0, relearning_count: 0,
              young_count: 0, mature_count: 0,
              learn_eligible_count: 0, review_eligible_count: 0,
              deck_tags_json: mergeFormData.tags,
            };
            return [...remaining, newItem];
          });
        }
        setSelectedDeckIds(new Set()); setIsMultiEditMode(false);
        toast.success(`Merged ${Array.from(selectedDeckIds).length} decks into "${mergeFormData.name}"`);
      }
    } catch { toast.error("An unexpected error occurred."); }
    finally { setIsMerging(false); setShowMergeDialog(false); }
  };

  // ---------- deck card renderer ----------

  const renderDeck = (deck: ManageDeckItem) => {
    const total = (deck.new_count ?? 0) + (deck.learning_count ?? 0) +
                  (deck.relearning_count ?? 0) + (deck.young_count ?? 0) +
                  (deck.mature_count ?? 0);
    const tags = parseTags(deck.deck_tags_json);
    const isSelected = selectedDeckIds.has(deck.id);

    return (
      <div key={deck.id} className="flex items-center gap-3">
        {isMultiEditMode && (
          <Checkbox
            checked={isSelected}
            onCheckedChange={(c) => handleDeckSelect(deck.id, c as boolean)}
          />
        )}
        <Link
          href={isMultiEditMode ? '#' : `/edit/${deck.id}`}
          className={`flex-1 block bg-card border rounded-lg p-4 transition-shadow duration-200 group ${
            isMultiEditMode ? 'cursor-default' : 'hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50'
          }`}
          onClick={(e) => { if (isMultiEditMode) e.preventDefault(); }}
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex-grow md:w-3/5 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-baseline sm:flex-wrap gap-x-2 gap-y-1">
                <div className="flex items-baseline flex-wrap gap-x-2 gap-y-1 min-w-0 flex-shrink overflow-hidden">
                  <h3 className={`text-lg font-semibold truncate mr-1 transition-colors ${!isMultiEditMode ? 'group-hover:text-primary' : ''}`} title={deck.name}>
                    {deck.name}
                  </h3>
                  {deck.status === 'archived' && (
                    <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                      Archived
                    </Badge>
                  )}
                </div>
                <ItemInfoBadges
                  primaryLanguage={deck.primary_language}
                  secondaryLanguage={deck.secondary_language}
                  isBilingual={deck.is_bilingual}
                  cardCount={total}
                  tags={tags}
                />
              </div>
            </div>
            <div className="w-full md:w-2/5 mt-3 md:mt-0">
              {total > 0 ? (
                <>
                  <DeckProgressBar
                    newCount={deck.new_count ?? 0} learningCount={deck.learning_count ?? 0}
                    relearningCount={deck.relearning_count ?? 0} youngCount={deck.young_count ?? 0}
                    matureCount={deck.mature_count ?? 0}
                  />
                  <DeckProgressLegend
                    newCount={deck.new_count ?? 0} learningCount={deck.learning_count ?? 0}
                    relearningCount={deck.relearning_count ?? 0} youngCount={deck.young_count ?? 0}
                    matureCount={deck.mature_count ?? 0}
                  />
                </>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-2 md:py-0">Deck is empty</p>
              )}
            </div>
          </div>
        </Link>
      </div>
    );
  };

  // ---------- render ----------

  return (
    <div className="container mx-auto py-6 px-4 md:px-6">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-semibold">Manage Your Decks</h1>
        <div className="flex items-center gap-4">
          {!isChildMode && (
            <div className="flex items-center space-x-2">
              <Switch id="multi-edit-mode" checked={isMultiEditMode} onCheckedChange={setIsMultiEditMode} />
              <Label htmlFor="multi-edit-mode" className="text-sm font-medium">Edit Multiple Decks</Label>
            </div>
          )}
          <Button asChild>
            <Link href="/manage/decks/new">
              <PlusCircle className="mr-2 h-4 w-4" />
              Create New Deck
            </Link>
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      {decks.length > 0 && (
        <div className="mb-4">
          <DeckFilterBar
            availableLanguages={availableLanguages}
            availableTags={availableTags}
            selectedLanguages={filterLanguages}
            selectedTags={filterTags}
            onLanguagesChange={setFilterLanguages}
            onTagsChange={setFilterTags}
          />
        </div>
      )}

      {/* Multi-edit controls */}
      {isMultiEditMode && decks.length > 0 && (
        <div className="mb-4 p-4 bg-muted/50 rounded-lg border">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="select-all"
                checked={allSelected}
                ref={(el) => {
                  if (el) {
                    const cb = el.querySelector('input[type="checkbox"]') as HTMLInputElement;
                    if (cb) cb.indeterminate = someSelected;
                  }
                }}
                onCheckedChange={handleSelectAll}
              />
              <label htmlFor="select-all" className="text-sm font-medium leading-none">
                Select All ({selectedDeckIds.size} of {decks.length} selected)
              </label>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="outline" onClick={() => handleOpenTagDialog('add')}
                disabled={selectedDeckIds.size === 0 || isTagging}>
                <Tags className="mr-2 h-4 w-4" />
                Add Tag
              </Button>
              <Button variant="outline" onClick={() => handleOpenTagDialog('remove')}
                disabled={selectedDeckIds.size === 0 || tagsOnSelectedDecks.length === 0 || isTagging}>
                <Tags className="mr-2 h-4 w-4" />
                Remove Tag
              </Button>
              <Button variant="outline" onClick={handleMergeSelected}
                disabled={selectedDeckIds.size < 2 || isMerging}>
                <Merge className="mr-2 h-4 w-4" />
                Merge ({selectedDeckIds.size})
              </Button>
              <Button variant="outline" onClick={handleArchiveSelected}
                disabled={!hasSelectedActiveDecks || isArchiving}>
                <Archive className="mr-2 h-4 w-4" />
                Archive ({selectedDeckIds.size})
              </Button>
              <Button variant="outline" onClick={handleActivateSelected}
                disabled={!hasSelectedArchivedDecks || isActivating}>
                <ArchiveRestore className="mr-2 h-4 w-4" />
                Activate ({selectedDeckIds.size})
              </Button>
              <Button variant="destructive" onClick={handleDeleteSelected}
                disabled={selectedDeckIds.size === 0 || isDeleting}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete ({selectedDeckIds.size})
              </Button>
            </div>
          </div>
        </div>
      )}

      {fetchError && (
        <div className="text-center text-red-500 dark:text-red-400 p-4 border border-red-500 dark:border-red-400 rounded-md bg-red-50 dark:bg-red-900/30">
          <p>Could not load your decks. Please try again later.</p>
          <p className="text-xs mt-1">{typeof fetchError === 'string' ? fetchError : (fetchError as Error)?.message || 'An unexpected error occurred.'}</p>
        </div>
      )}

      {!fetchError && decks.length === 0 && (
        <div className="text-center text-muted-foreground mt-10">
          <p>You haven&apos;t created any decks yet.</p>
          <Button asChild className="mt-4">
            <Link href="/manage/decks/new">
              <PlusCircle className="mr-2 h-4 w-4" />
              Create Your First Deck
            </Link>
          </Button>
        </div>
      )}

      {!fetchError && decks.length > 0 && (
        <>
          <Accordion type="multiple" className="w-full space-y-4" value={openSections} onValueChange={setOpenSections}>
            {/* Active Decks */}
            <AccordionItem value="activeDecks" className="border-none">
              <AccordionTrigger className="text-lg font-medium font-atkinson hover:no-underline p-3 bg-muted/50 rounded-md">
                <span>Active Decks ({filteredActiveDecks.length}{filterLanguages.length + filterTags.length > 0 ? ` of ${activeDecks.length}` : ''})</span>
              </AccordionTrigger>
              <AccordionContent className="pt-4">
                {filteredActiveDecks.length > 0 ? (
                  <div className="space-y-4">{filteredActiveDecks.map(renderDeck)}</div>
                ) : (
                  <p className="text-muted-foreground text-center py-4">
                    {filterLanguages.length + filterTags.length > 0
                      ? 'No active decks match the current filters.'
                      : 'No active decks to display.'}
                  </p>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* Archived Decks */}
            <AccordionItem value="archivedDecks" className="border-none">
              <AccordionTrigger className="text-lg font-medium font-atkinson hover:no-underline p-3 bg-muted/50 rounded-md">
                <span>Archived Decks ({filteredArchivedDecks.length}{filterLanguages.length + filterTags.length > 0 ? ` of ${archivedDecks.length}` : ''})</span>
              </AccordionTrigger>
              <AccordionContent className="pt-4">
                {filteredArchivedDecks.length > 0 ? (
                  <div className="space-y-4">{filteredArchivedDecks.map(renderDeck)}</div>
                ) : (
                  <p className="text-muted-foreground text-center py-4">
                    {filterLanguages.length + filterTags.length > 0
                      ? 'No archived decks match the current filters.'
                      : 'No archived decks to display.'}
                  </p>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {decks.some(d => (d.new_count + d.learning_count + d.relearning_count + d.young_count + d.mature_count) > 0) && (
            <div className="mt-8 flex justify-center sm:justify-end">
              <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 p-2 border rounded-md bg-background shadow-sm">
                {legendStages.map(s => (
                  <span key={s.name} className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm"
                      style={{ backgroundImage: `linear-gradient(to right, ${s.startColor}, ${s.endColor})` }} />
                    {s.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Delete dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Selected Decks</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedDeckIds.size} deck(s)? This cannot be undone and will permanently delete all cards in these decks.
            </AlertDialogDescription>
            {selectedDeckIds.size <= 5 && (
              <ul className="list-disc list-inside mt-2 text-sm text-muted-foreground">
                {decks.filter(d => selectedDeckIds.has(d.id)).map(d => <li key={d.id}>{d.name}</li>)}
              </ul>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Tag add/remove dialog */}
      <Dialog open={showTagDialog} onOpenChange={setShowTagDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{tagDialogMode === 'add' ? 'Add Tag to Selected Decks' : 'Remove Tag from Selected Decks'}</DialogTitle>
            <DialogDescription>
              {tagDialogMode === 'add'
                ? `The tag will be added to all ${selectedDeckIds.size} selected deck(s). Decks that already have it are skipped.`
                : `The tag will be removed from any of the ${selectedDeckIds.size} selected deck(s) that have it.`}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="tag-select" className="mb-2 block">Select tag</Label>
            <Select value={selectedTagId} onValueChange={setSelectedTagId}>
              <SelectTrigger id="tag-select">
                <SelectValue placeholder="Choose a tag…" />
              </SelectTrigger>
              <SelectContent>
                {(tagDialogMode === 'add' ? allTags : tagsOnSelectedDecks).map(tag => (
                  <SelectItem key={tag.id} value={tag.id}>{tag.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {tagDialogMode === 'remove' && tagsOnSelectedDecks.length === 0 && (
              <p className="text-sm text-muted-foreground mt-2">None of the selected decks have any tags to remove.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTagDialog(false)} disabled={isTagging}>Cancel</Button>
            <Button onClick={confirmTagAction} disabled={isTagging || !selectedTagId}>
              {isTagging ? 'Saving…' : tagDialogMode === 'add' ? 'Add Tag' : 'Remove Tag'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Merge dialog */}
      <Dialog open={showMergeDialog} onOpenChange={setShowMergeDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Merge Selected Decks</DialogTitle>
            <DialogDescription>
              Configure the properties for the merged deck. All cards from the selected {selectedDeckIds.size} decks will be combined.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="merge-name">Deck Name</Label>
              <Input id="merge-name" value={mergeFormData.name}
                onChange={e => setMergeFormData(p => ({ ...p, name: e.target.value }))}
                placeholder="Enter merged deck name" />
            </div>
            <div className="flex items-center space-x-2 rounded-lg border p-4">
              <Switch id="merge-bilingual" checked={mergeFormData.is_bilingual}
                onCheckedChange={c => setMergeFormData(p => ({ ...p, is_bilingual: c as boolean }))} />
              <div className="flex-1">
                <Label htmlFor="merge-bilingual" className="font-medium">Bilingual Deck</Label>
                <p className="text-xs text-muted-foreground">Use different languages for questions and answers.</p>
              </div>
            </div>
            {mergeFormData.is_bilingual ? (
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Question Language (Front)</Label>
                  <Select value={mergeFormData.primary_language}
                    onValueChange={v => setMergeFormData(p => ({ ...p, primary_language: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select language…" /></SelectTrigger>
                    <SelectContent>{LANGUAGE_OPTIONS.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Answer Language (Back)</Label>
                  <Select value={mergeFormData.secondary_language}
                    onValueChange={v => setMergeFormData(p => ({ ...p, secondary_language: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select language…" /></SelectTrigger>
                    <SelectContent>{LANGUAGE_OPTIONS.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
              <div className="grid gap-2">
                <Label>Deck Language</Label>
                <Select value={mergeFormData.primary_language}
                  onValueChange={v => setMergeFormData(p => ({ ...p, primary_language: v, secondary_language: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select language…" /></SelectTrigger>
                  <SelectContent>{LANGUAGE_OPTIONS.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            {mergeFormData.tags.length > 0 && (
              <div className="grid gap-2">
                <Label>Deck Tags</Label>
                <div className="flex flex-wrap gap-2">
                  {mergeFormData.tags.map(t => <Badge key={t.id} variant="secondary" className="text-xs">{t.name}</Badge>)}
                </div>
              </div>
            )}
            {selectedDeckIds.size <= 5 && (
              <div>
                <strong className="text-sm font-medium">Decks to merge:</strong>
                <ul className="list-disc list-inside mt-1 text-sm text-muted-foreground">
                  {decks.filter(d => selectedDeckIds.has(d.id)).map(d => <li key={d.id}>{d.name}</li>)}
                </ul>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMergeDialog(false)} disabled={isMerging}>Cancel</Button>
            <Button onClick={confirmMerge}
              disabled={isMerging || !mergeFormData.name.trim() || !mergeFormData.primary_language.trim()}>
              {isMerging ? 'Merging…' : 'Merge Decks'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
