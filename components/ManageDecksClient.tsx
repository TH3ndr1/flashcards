"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, Trash2, Merge, Archive, ArchiveRestore } from 'lucide-react';
import { DeckProgressBar } from '@/components/deck/DeckProgressBar';
import { ItemInfoBadges } from '@/components/ItemInfoBadges';
import { DeckProgressLegend } from '@/components/deck/DeckProgressLegend';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { deleteDecks, mergeDecks, getDecksForManagement, archiveMultipleDecks, activateMultipleDecks, type DeckListItemWithCountsAndStatus } from '@/lib/actions/deckActions';
import type { Tables } from '@/types/database';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

// Use the proper type from deckActions instead of defining our own
type ManageDeckItem = DeckListItemWithCountsAndStatus;

interface ManageDecksClientProps {
  initialDecks: ManageDeckItem[];
  fetchError?: string | null;
}

export function ManageDecksClient({ initialDecks, fetchError }: ManageDecksClientProps) {
  const [decks, setDecks] = useState<ManageDeckItem[]>(initialDecks);
  const [isMultiEditMode, setIsMultiEditMode] = useState(false);
  const [selectedDeckIds, setSelectedDeckIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [openSections, setOpenSections] = useState<string[]>(["activeDecks", "archivedDecks"]);
  const [mergeFormData, setMergeFormData] = useState({
    name: '',
    is_bilingual: false,
    primary_language: '',
    secondary_language: '',
    tags: [] as Array<{ id: string; name: string; }>
  });


  const legendStages = [ 
    { name: 'New', startColor: '#EC4899', endColor: '#EF4444' },
    { name: 'Learning', startColor: '#DA55C6', endColor: '#9353DD' },
    { name: 'Relearning', startColor: '#F59E0B', endColor: '#F97316' },
    { name: 'Young', startColor: '#6055DA', endColor: '#5386DD' },
    { name: 'Mature', startColor: '#55A9DA', endColor: '#53DDDD' },
  ];

  // Group decks by status
  const activeDecks = decks.filter(deck => deck.status === 'active');
  const archivedDecks = decks.filter(deck => deck.status === 'archived');

  // Clear selected decks when exiting multi-edit mode
  React.useEffect(() => {
    if (!isMultiEditMode) {
      setSelectedDeckIds(new Set());
    }
  }, [isMultiEditMode]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedDeckIds(new Set(decks.map(deck => deck.id)));
    } else {
      setSelectedDeckIds(new Set());
    }
  };

  const handleDeckSelect = (deckId: string, checked: boolean) => {
    const newSelected = new Set(selectedDeckIds);
    if (checked) {
      newSelected.add(deckId);
    } else {
      newSelected.delete(deckId);
    }
    setSelectedDeckIds(newSelected);
  };

  const handleDeleteSelected = () => {
    if (selectedDeckIds.size === 0) {
      toast.error("Please select at least one deck to delete.");
      return;
    }
    setShowDeleteDialog(true);
  };

  const handleMergeSelected = () => {
    if (selectedDeckIds.size < 2) {
      toast.error("Please select at least two decks to merge.");
      return;
    }
    
    // Get the first selected deck as default values
    const firstSelectedDeck = decks.find(deck => selectedDeckIds.has(deck.id));
    if (firstSelectedDeck) {
      let tagsToDisplay: Array<{ id: string; name: string; }> = [];
      if (firstSelectedDeck.deck_tags_json && Array.isArray(firstSelectedDeck.deck_tags_json)) {
        tagsToDisplay = (firstSelectedDeck.deck_tags_json as unknown as Array<{ id: string; name: string; }>).filter(tag => tag && typeof tag.name === 'string');
      }
      
      setMergeFormData({
        name: firstSelectedDeck.name + " (merged)",
        is_bilingual: firstSelectedDeck.is_bilingual,
        primary_language: firstSelectedDeck.primary_language || '',
        secondary_language: firstSelectedDeck.secondary_language || '',
        tags: tagsToDisplay
      });
    }
    
    setShowMergeDialog(true);
  };

  const handleArchiveSelected = async () => {
    if (!hasSelectedActiveDecks) {
      toast.error("Please select at least one active deck to archive.");
      return;
    }

    setIsArchiving(true);
    const deckIdsArray = Array.from(selectedDeckIds);
    
    try {
      const result = await archiveMultipleDecks(deckIdsArray);
      
      if (result.error || !result.data) {
        toast.error("Failed to archive decks", { 
          description: result.error || "Unknown error occurred"
        });
      } else {
        // Refresh deck list
        const refreshResult = await getDecksForManagement();
        if (refreshResult.data) {
          setDecks(refreshResult.data);
        }
        
        setSelectedDeckIds(new Set());
        setIsMultiEditMode(false);
        
        if (result.data.archivedCount === 0) {
          toast.info("No active decks were selected for archiving.");
        } else {
          toast.success(`Successfully archived ${result.data.archivedCount} deck${result.data.archivedCount === 1 ? '' : 's'}`);
        }
      }
    } catch (error) {
      console.error('Error archiving decks:', error);
      toast.error("An unexpected error occurred while archiving decks.");
    } finally {
      setIsArchiving(false);
    }
  };

  const handleActivateSelected = async () => {
    if (!hasSelectedArchivedDecks) {
      toast.error("Please select at least one archived deck to activate.");
      return;
    }

    setIsActivating(true);
    const deckIdsArray = Array.from(selectedDeckIds);
    
    try {
      const result = await activateMultipleDecks(deckIdsArray);
      
      if (result.error || !result.data) {
        toast.error("Failed to activate decks", { 
          description: result.error || "Unknown error occurred"
        });
      } else {
        // Refresh deck list
        const refreshResult = await getDecksForManagement();
        if (refreshResult.data) {
          setDecks(refreshResult.data);
        }
        
        setSelectedDeckIds(new Set());
        setIsMultiEditMode(false);
        
        if (result.data.activatedCount === 0) {
          toast.info("No archived decks were selected for activation.");
        } else {
          toast.success(`Successfully activated ${result.data.activatedCount} deck${result.data.activatedCount === 1 ? '' : 's'}`);
        }
      }
    } catch (error) {
      console.error('Error activating decks:', error);
      toast.error("An unexpected error occurred while activating decks.");
    } finally {
      setIsActivating(false);
    }
  };

  const confirmDelete = async () => {
    if (selectedDeckIds.size === 0) return;
    
    setIsDeleting(true);
    const deckIdsArray = Array.from(selectedDeckIds);
    const selectedDeckNames = decks
      .filter(deck => selectedDeckIds.has(deck.id))
      .map(deck => deck.name);

    try {
      const result = await deleteDecks(deckIdsArray);
      
      if (result.error) {
        toast.error("Failed to delete decks", { 
          description: result.error 
        });
      } else {
        const deletedCount = result.data?.deletedCount || 0;
        // Update local state by removing deleted decks
        setDecks(prevDecks => prevDecks.filter(deck => !selectedDeckIds.has(deck.id)));
        setSelectedDeckIds(new Set());
        setIsMultiEditMode(false);
        
        toast.success(`Successfully deleted ${deletedCount} deck(s)`, {
          description: deletedCount !== selectedDeckNames.length 
            ? `${selectedDeckNames.length - deletedCount} deck(s) could not be deleted`
            : undefined
        });
      }
    } catch (error) {
      console.error('Error deleting decks:', error);
      toast.error("An unexpected error occurred while deleting decks.");
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const confirmMerge = async () => {
    if (selectedDeckIds.size < 2) return;
    
    setIsMerging(true);
    const deckIdsArray = Array.from(selectedDeckIds);
    
    try {
      const result = await mergeDecks(deckIdsArray, mergeFormData);
      
      if (result.error || !result.data) {
        toast.error("Failed to merge decks", { 
          description: result.error || "Unknown error occurred"
        });
      } else {
        // Refetch all decks to get accurate card counts and display the merged deck correctly
        const refreshResult = await getDecksForManagement();
        if (refreshResult.data) {
          setDecks(refreshResult.data);
        } else {
          // Fallback: remove merged decks and add new merged deck with estimated data
          setDecks(prevDecks => {
            const remainingDecks = prevDecks.filter(deck => !selectedDeckIds.has(deck.id));
            const newDeckItem: ManageDeckItem = {
              id: result.data!.id,
              name: result.data!.name,
              primary_language: result.data!.primary_language,
              secondary_language: result.data!.secondary_language,
              is_bilingual: result.data!.is_bilingual,
              updated_at: result.data!.updated_at || new Date().toISOString(),
              status: (result.data as Tables<'decks'>).status || 'active', // Use actual status from merge result
              new_count: 0,
              learning_count: 0,
              relearning_count: 0,
              young_count: 0,
              mature_count: 0,
              learn_eligible_count: 0,
              review_eligible_count: 0,
              deck_tags_json: mergeFormData.tags
            };
            return [...remainingDecks, newDeckItem];
          });
        }
        
        setSelectedDeckIds(new Set());
        setIsMultiEditMode(false);
        
        toast.success(`Successfully merged ${deckIdsArray.length} decks into "${mergeFormData.name}"`);
      }
    } catch (error) {
      console.error('Error merging decks:', error);
      toast.error("An unexpected error occurred while merging decks.");
    } finally {
      setIsMerging(false);
      setShowMergeDialog(false);
    }
  };

  const allSelected = decks.length > 0 && selectedDeckIds.size === decks.length;
  const someSelected = selectedDeckIds.size > 0 && selectedDeckIds.size < decks.length;
  
  // Smart button enabling logic
  const selectedDecks = decks.filter(deck => selectedDeckIds.has(deck.id));
  const hasSelectedActiveDecks = selectedDecks.some(deck => deck.status === 'active');
  const hasSelectedArchivedDecks = selectedDecks.some(deck => deck.status === 'archived');

  return (
    <div className="container mx-auto py-6 px-4 md:px-6">
      <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center">
          <h1 className="text-2xl font-semibold">Manage Your Decks</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center space-x-2">
            <Switch
              id="multi-edit-mode"
              checked={isMultiEditMode}
              onCheckedChange={setIsMultiEditMode}
            />
            <Label htmlFor="multi-edit-mode" className="text-sm font-medium">
              Edit Multiple Decks
            </Label>
          </div>
          <Button asChild>
            <Link href="/manage/decks/new">
              <PlusCircle className="mr-2 h-4 w-4" />
              Create New Deck
            </Link>
          </Button>
        </div>
      </div>

      {/* Multi-edit controls */}
      {isMultiEditMode && decks.length > 0 && (
        <div className="mb-4 p-4 bg-muted/50 rounded-lg border">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="select-all"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) {
                      const checkboxElement = el.querySelector('input[type="checkbox"]') as HTMLInputElement;
                      if (checkboxElement) checkboxElement.indeterminate = someSelected;
                    }
                  }}
                  onCheckedChange={handleSelectAll}
                />
                <label 
                  htmlFor="select-all" 
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Select All ({selectedDeckIds.size} of {decks.length} selected)
                </label>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                onClick={handleMergeSelected}
                disabled={selectedDeckIds.size < 2 || isMerging}
              >
                <Merge className="mr-2 h-4 w-4" />
                Merge Selected ({selectedDeckIds.size})
              </Button>
              <Button
                variant="outline"
                onClick={handleArchiveSelected}
                disabled={!hasSelectedActiveDecks || isArchiving}
                title={!hasSelectedActiveDecks ? "Select at least one active deck to archive" : ""}
              >
                <Archive className="mr-2 h-4 w-4" />
                Archive Selected ({selectedDeckIds.size})
              </Button>
              <Button
                variant="outline"
                onClick={handleActivateSelected}
                disabled={!hasSelectedArchivedDecks || isActivating}
                title={!hasSelectedArchivedDecks ? "Select at least one archived deck to activate" : ""}
              >
                <ArchiveRestore className="mr-2 h-4 w-4" />
                Activate Selected ({selectedDeckIds.size})
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteSelected}
                disabled={selectedDeckIds.size === 0 || isDeleting}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Selected ({selectedDeckIds.size})
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
          <p>You haven't created any decks yet.</p>
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
          <Accordion 
            type="multiple" 
            className="w-full space-y-4"
            value={openSections}
            onValueChange={setOpenSections}
          >
            {/* Active Decks Section */}
            <AccordionItem value="activeDecks" className="border-none">
              <AccordionTrigger className="text-lg font-medium font-atkinson hover:no-underline p-3 bg-muted/50 rounded-md flex items-center">
                <span>Active Decks ({activeDecks.length})</span>
              </AccordionTrigger>
              <AccordionContent className="pt-4">
                {activeDecks.length > 0 ? (
                  <div className="space-y-4">
                    {activeDecks.map((deck) => {
                      const totalCardsForDisplay = (deck.new_count ?? 0) +
                                           (deck.learning_count ?? 0) +
                                           (deck.relearning_count ?? 0) +
                                           (deck.young_count ?? 0) +
                                           (deck.mature_count ?? 0);

                      let tagsToDisplay: Array<{ id: string; name: string; }> = [];
                      if (deck.deck_tags_json && Array.isArray(deck.deck_tags_json)) {
                        tagsToDisplay = (deck.deck_tags_json as unknown as Array<{ id: string; name: string; }>).filter(tag => tag && typeof tag.name === 'string');
                      }

                      const isSelected = selectedDeckIds.has(deck.id);

                      return (
                        <div key={deck.id} className="flex items-center gap-3">
                          {isMultiEditMode && (
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(checked) => handleDeckSelect(deck.id, checked as boolean)}
                            />
                          )}
                          <Link 
                            href={isMultiEditMode ? '#' : `/edit/${deck.id}`} 
                            className={`flex-1 block bg-card border rounded-lg p-4 transition-shadow duration-200 group ${
                              isMultiEditMode 
                                ? 'cursor-default' 
                                : 'hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50'
                            }`}
                            onClick={(e) => {
                              if (isMultiEditMode) {
                                e.preventDefault();
                              }
                            }}
                          >
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                              <div className="flex-grow md:w-3/5">
                                <div className="flex flex-col sm:flex-row sm:items-baseline sm:flex-wrap gap-x-2 gap-y-1">
                                  <div className="flex items-baseline flex-wrap gap-x-2 gap-y-1">
                                    <h3 className={`text-lg font-semibold truncate mr-1 transition-colors ${
                                      !isMultiEditMode ? 'group-hover:text-primary' : ''
                                    }`} title={deck.name}>
                                      {deck.name}
                                    </h3>
                                  </div>
                                  <ItemInfoBadges 
                                    primaryLanguage={deck.primary_language}
                                    secondaryLanguage={deck.secondary_language}
                                    isBilingual={deck.is_bilingual}
                                    cardCount={totalCardsForDisplay}
                                    tags={tagsToDisplay}
                                  />
                                </div>
                              </div>

                              <div className="w-full md:w-2/5 mt-3 md:mt-0">
                                {totalCardsForDisplay > 0 ? (
                                  <>
                                    <DeckProgressBar
                                      newCount={deck.new_count ?? 0}
                                      learningCount={deck.learning_count ?? 0}
                                      relearningCount={deck.relearning_count ?? 0}
                                      youngCount={deck.young_count ?? 0}
                                      matureCount={deck.mature_count ?? 0}
                                    />
                                    <DeckProgressLegend 
                                      newCount={deck.new_count ?? 0}
                                      learningCount={deck.learning_count ?? 0}
                                      relearningCount={deck.relearning_count ?? 0}
                                      youngCount={deck.young_count ?? 0}
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
                    })}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-4">No active decks to display.</p>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* Archived Decks Section */}
            <AccordionItem value="archivedDecks" className="border-none">
              <AccordionTrigger className="text-lg font-medium font-atkinson hover:no-underline p-3 bg-muted/50 rounded-md flex items-center">
                <span>Archived Decks ({archivedDecks.length})</span>
              </AccordionTrigger>
              <AccordionContent className="pt-4">
                {archivedDecks.length > 0 ? (
                  <div className="space-y-4">
                    {archivedDecks.map((deck) => {
                      const totalCardsForDisplay = (deck.new_count ?? 0) +
                                           (deck.learning_count ?? 0) +
                                           (deck.relearning_count ?? 0) +
                                           (deck.young_count ?? 0) +
                                           (deck.mature_count ?? 0);

                      let tagsToDisplay: Array<{ id: string; name: string; }> = [];
                      if (deck.deck_tags_json && Array.isArray(deck.deck_tags_json)) {
                        tagsToDisplay = (deck.deck_tags_json as unknown as Array<{ id: string; name: string; }>).filter(tag => tag && typeof tag.name === 'string');
                      }

                      const isSelected = selectedDeckIds.has(deck.id);

                      return (
                        <div key={deck.id} className="flex items-center gap-3">
                          {isMultiEditMode && (
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(checked) => handleDeckSelect(deck.id, checked as boolean)}
                            />
                          )}
                          <Link 
                            href={isMultiEditMode ? '#' : `/edit/${deck.id}`} 
                            className={`flex-1 block bg-card border rounded-lg p-4 transition-shadow duration-200 group ${
                              isMultiEditMode 
                                ? 'cursor-default' 
                                : 'hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50'
                            }`}
                            onClick={(e) => {
                              if (isMultiEditMode) {
                                e.preventDefault();
                              }
                            }}
                          >
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                              <div className="flex-grow md:w-3/5">
                                <div className="flex flex-col sm:flex-row sm:items-baseline sm:flex-wrap gap-x-2 gap-y-1">
                                  <div className="flex items-baseline flex-wrap gap-x-2 gap-y-1">
                                    <h3 className={`text-lg font-semibold truncate mr-1 transition-colors ${
                                      !isMultiEditMode ? 'group-hover:text-primary' : ''
                                    }`} title={deck.name}>
                                      {deck.name}
                                    </h3>
                                    <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                                      Archived
                                    </Badge>
                                  </div>
                                  <ItemInfoBadges 
                                    primaryLanguage={deck.primary_language}
                                    secondaryLanguage={deck.secondary_language}
                                    isBilingual={deck.is_bilingual}
                                    cardCount={totalCardsForDisplay}
                                    tags={tagsToDisplay}
                                  />
                                </div>
                              </div>

                              <div className="w-full md:w-2/5 mt-3 md:mt-0">
                                {totalCardsForDisplay > 0 ? (
                                  <>
                                    <DeckProgressBar
                                      newCount={deck.new_count ?? 0}
                                      learningCount={deck.learning_count ?? 0}
                                      relearningCount={deck.relearning_count ?? 0}
                                      youngCount={deck.young_count ?? 0}
                                      matureCount={deck.mature_count ?? 0}
                                    />
                                    <DeckProgressLegend 
                                      newCount={deck.new_count ?? 0}
                                      learningCount={deck.learning_count ?? 0}
                                      relearningCount={deck.relearning_count ?? 0}
                                      youngCount={deck.young_count ?? 0}
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
                    })}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-4">No archived decks to display.</p>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
          
          {decks.some(d => (d.new_count + d.learning_count + d.relearning_count + d.young_count + d.mature_count) > 0) && (
            <div className="mt-8 flex justify-center sm:justify-end">
              <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 p-2 border rounded-md bg-background shadow-sm">
                {legendStages.map(stage => (
                  <span key={stage.name} className="flex items-center gap-1.5">
                    <span
                      className="h-2.5 w-2.5 rounded-sm"
                      style={{ backgroundImage: `linear-gradient(to right, ${stage.startColor}, ${stage.endColor})` }}
                    ></span>
                    {stage.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Selected Decks</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedDeckIds.size} deck(s)? This action cannot be undone and will permanently delete all cards in these decks.
            </AlertDialogDescription>
            {selectedDeckIds.size <= 5 && (
              <div className="mt-2">
                <strong className="text-sm font-medium">Decks to delete:</strong>
                <ul className="list-disc list-inside mt-1 text-sm text-muted-foreground">
                  {decks
                    .filter(deck => selectedDeckIds.has(deck.id))
                    .map(deck => (
                      <li key={deck.id}>{deck.name}</li>
                    ))
                  }
                </ul>
              </div>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Merge confirmation dialog */}
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
              <Input
                id="merge-name"
                value={mergeFormData.name}
                onChange={(e) => setMergeFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter merged deck name"
              />
            </div>

            {/* Bilingual Switch */}
            <div className="flex items-center space-x-2 rounded-lg border p-4">
              <Switch
                id="merge-bilingual"
                checked={mergeFormData.is_bilingual}
                onCheckedChange={(checked) => 
                  setMergeFormData(prev => ({ ...prev, is_bilingual: checked as boolean }))
                }
              />
              <div className="flex-1">
                <Label htmlFor="merge-bilingual" className="font-medium">
                  Bilingual Deck
                </Label>
                <p className="text-xs text-muted-foreground">
                  Use different languages for questions (front) and answers (back).
                </p>
              </div>
            </div>

            {/* Language Selects */}
            {mergeFormData.is_bilingual ? (
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="merge-primary-language">Question Language (Front)</Label>
                  <Select 
                    value={mergeFormData.primary_language} 
                    onValueChange={(value) => setMergeFormData(prev => ({ ...prev, primary_language: value }))}
                  >
                    <SelectTrigger id="merge-primary-language">
                      <SelectValue placeholder="Select language..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="nl">Dutch</SelectItem>
                      <SelectItem value="fr">French</SelectItem>
                      <SelectItem value="de">German</SelectItem>
                      <SelectItem value="es">Spanish</SelectItem>
                      <SelectItem value="it">Italian</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="merge-secondary-language">Answer Language (Back)</Label>
                  <Select 
                    value={mergeFormData.secondary_language} 
                    onValueChange={(value) => setMergeFormData(prev => ({ ...prev, secondary_language: value }))}
                  >
                    <SelectTrigger id="merge-secondary-language">
                      <SelectValue placeholder="Select language..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="nl">Dutch</SelectItem>
                      <SelectItem value="fr">French</SelectItem>
                      <SelectItem value="de">German</SelectItem>
                      <SelectItem value="es">Spanish</SelectItem>
                      <SelectItem value="it">Italian</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
              <div className="grid gap-2">
                <Label htmlFor="merge-language">Deck Language</Label>
                <Select 
                  value={mergeFormData.primary_language} 
                  onValueChange={(value) => setMergeFormData(prev => ({ 
                    ...prev, 
                    primary_language: value,
                    secondary_language: value 
                  }))}
                >
                  <SelectTrigger id="merge-language">
                    <SelectValue placeholder="Select language..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="nl">Dutch</SelectItem>
                    <SelectItem value="fr">French</SelectItem>
                    <SelectItem value="de">German</SelectItem>
                    <SelectItem value="es">Spanish</SelectItem>
                    <SelectItem value="it">Italian</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Tags Display */}
            {mergeFormData.tags.length > 0 && (
              <div className="grid gap-2">
                <Label>Deck Tags</Label>
                <div className="flex flex-wrap gap-2">
                  {mergeFormData.tags.map(tag => (
                    <Badge key={tag.id} variant="secondary" className="text-xs">
                      {tag.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {selectedDeckIds.size <= 5 && (
              <div className="mt-2">
                <strong className="text-sm font-medium">Decks to merge:</strong>
                <ul className="list-disc list-inside mt-1 text-sm text-muted-foreground">
                  {decks
                    .filter(deck => selectedDeckIds.has(deck.id))
                    .map(deck => (
                      <li key={deck.id}>{deck.name}</li>
                    ))
                  }
                </ul>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMergeDialog(false)} disabled={isMerging}>
              Cancel
            </Button>
            <Button 
              onClick={confirmMerge} 
              disabled={isMerging || !mergeFormData.name.trim() || !mergeFormData.primary_language.trim()}
            >
              {isMerging ? 'Merging...' : 'Merge Decks'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
