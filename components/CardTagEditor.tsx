'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { addTagToCard, removeTagFromCard } from '@/lib/actions/tagActions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Command, CommandInput, CommandList, CommandItem, CommandGroup, CommandEmpty } from '@/components/ui/command';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { X as IconX, PlusCircle as IconPlus, Loader2 as IconLoader } from 'lucide-react';
import { toast } from 'sonner';
import type { DbTag } from '@/types/database';
import { Label } from '@/components/ui/label';

// Import the actual hooks
import { useCardTags } from '@/hooks/useCardTags';
import { useTags } from '@/hooks/useTags';

// --- Component Implementation ---

interface CardTagEditorProps {
  cardId: string;
}

export function CardTagEditor({ cardId }: CardTagEditorProps) {
  // --- State and Data Fetching via REAL Hooks ---
  const { cardTags, isLoading: isLoadingCardTags, error: cardTagsError, refetchCardTags } = useCardTags(cardId);
  const { allTags, isLoading: isLoadingAllTags, error: allTagsError } = useTags(); // Don't need refetchAllTags here

  const [actionLoading, setActionLoading] = useState<{ [tagId: string]: boolean }>({}); // Track loading state per tag action
  const [popoverOpen, setPopoverOpen] = useState(false);

  // <<< Add console log here >>>
  console.log(`[CardTagEditor] Render. cardId: ${cardId}, isLoadingCardTags: ${isLoadingCardTags}, cardTags:`, cardTags, `isLoadingAllTags: ${isLoadingAllTags}, allTags:`, allTags, `cardTagsError:`, cardTagsError);

  // Display initial loading errors from hooks
  useEffect(() => {
    if (cardTagsError) {
      toast.error(`Failed to load card tags: ${cardTagsError}`);
    }
  }, [cardTagsError]);

  useEffect(() => {
    if (allTagsError) {
      toast.error(`Failed to load all tags: ${allTagsError}`);
    }
  }, [allTagsError]);

  // Memoize available tags to add (all tags minus already associated tags)
  const availableTagsToAdd = useMemo(() => {
    const currentCardTags = Array.isArray(cardTags) ? cardTags : [];
    const cardTagIds = new Set(currentCardTags.map(tag => tag.id));
    const available = Array.isArray(allTags) ? allTags : [];
    
    return available
      .filter(tag => !cardTagIds.has(tag.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allTags, cardTags]);

  // --- Action Handlers ---

  const handleAddTag = async (tagId: string) => {
    if (!cardId) return;
    setActionLoading(prev => ({ ...prev, [`add-${tagId}`]: true }));
    const result = await addTagToCard(cardId, tagId);
    if (result.error) {
      toast.error(`Failed to add tag: ${result.error}`);
    } else {
      toast.success("Tag added.");
      await refetchCardTags(); // Refetch to update the list via the hook
      setPopoverOpen(false); // Close selector on success
    }
    setActionLoading(prev => ({ ...prev, [`add-${tagId}`]: false }));
  };

  const handleRemoveTag = async (tagId: string) => {
     if (!cardId) return;
    setActionLoading(prev => ({ ...prev, [`remove-${tagId}`]: true }));
    const result = await removeTagFromCard(cardId, tagId);
    if (result.error) {
      toast.error(`Failed to remove tag: ${result.error}`);
    } else {
       toast.success("Tag removed.");
       await refetchCardTags(); // Refetch to update the list via the hook
    }
    setActionLoading(prev => ({ ...prev, [`remove-${tagId}`]: false }));
  };

  // --- Render Logic ---

  const showInitialLoader = isLoadingCardTags || isLoadingAllTags;

  return (
    <div className="space-y-3">
      <Label htmlFor="tag-combobox-trigger">Tags</Label>
      {showInitialLoader ? (
        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
          <IconLoader className="h-4 w-4 animate-spin" />
          <span>Loading tags...</span>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 items-center min-h-[40px]"> 
          {/* Display Current Tags */}
          {(Array.isArray(cardTags) ? cardTags : []).map(tag => (
            <Badge key={tag.id} variant="secondary" className="flex items-center gap-1 pl-2 pr-1 py-0.5">
              <span className="text-sm">{tag.name}</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleRemoveTag(tag.id)}
                disabled={actionLoading[`remove-${tag.id}`]}
                aria-label={`Remove tag ${tag.name}`}
                className="h-5 w-5 p-0 ml-1 hover:bg-destructive/20 rounded-full"
              >
                {actionLoading[`remove-${tag.id}`] ? (
                  <IconLoader className="h-3 w-3 animate-spin" />
                ) : (
                  <IconX className="h-3 w-3" />
                )}
              </Button>
            </Badge>
          ))}

          {/* Add Tag Selector */}
          <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                id="tag-combobox-trigger"
                variant="outline"
                size="sm"
                className="h-7 px-2"
                aria-label="Add tag"
              >
                <IconPlus className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[250px] p-0" align="start">
              <Command filter={(value, search) => {
                 if (value.toLowerCase().includes(search.toLowerCase())) return 1
                 return 0
               }}>
                <CommandInput placeholder="Add tag..." />
                <CommandList>
                  <CommandEmpty>No available tags found.</CommandEmpty>
                  <CommandGroup>
                    {(Array.isArray(availableTagsToAdd) ? availableTagsToAdd : []).map(tag => (
                      <CommandItem
                        key={tag.id}
                        value={tag.name}
                        onSelect={() => handleAddTag(tag.id)}
                        disabled={actionLoading[`add-${tag.id}`]}
                        className="flex justify-between items-center text-sm h-8"
                      >
                        <span>{tag.name}</span>
                        {actionLoading[`add-${tag.id}`] && <IconLoader className="h-4 w-4 animate-spin" />}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      )}
    </div>
  );
} 