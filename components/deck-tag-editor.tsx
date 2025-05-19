"use client";

import React, { useMemo, useState } from 'react';
import type { Tables } from '@/types/database';
import { useTags } from '@/hooks/useTags'; // Assuming this hook exists
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X as IconX, Tag as IconTag, Check, ChevronsUpDown } from 'lucide-react';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import { cn } from '@/lib/utils'; // Import cn for conditional classes
import { appLogger } from '@/lib/logger';

// Define the expected props
interface DeckTagEditorProps {
    deckId: string;
    currentTags: Tables<'tags'>[]; // Tags currently on the deck
    onAddTag: (tagId: string) => Promise<void>; // Async to allow for loading state if needed
    onRemoveTag: (tagId: string) => Promise<void>; // Async
    disabled?: boolean; // Optional prop to disable interaction
}

// Type alias for Tag object
type DbTag = Tables<'tags'>;
// Type alias for Combobox options
type TagOption = { value: string; label: string };

export function DeckTagEditor({
    deckId,
    currentTags,
    onAddTag,
    onRemoveTag,
    disabled = false
}: DeckTagEditorProps) {
    // Fetch all available tags for the user
    const { allTags: allUserTags, isLoading: tagsLoading } = useTags();
    const [isAdding, setIsAdding] = useState(false);
    const [isRemoving, setIsRemoving] = useState<string | null>(null); // Store ID of tag being removed
    const [popoverOpen, setPopoverOpen] = useState(false); // State for Popover

    // Prepare options for the Combobox: Filter out tags already on the deck
    const availableTagOptions: TagOption[] = useMemo(() => {
        const currentTagIds = new Set(currentTags.map(tag => tag.id));
        return (allUserTags || [])
            .filter((tag: DbTag) => !currentTagIds.has(tag.id))
            .map((tag: DbTag) => ({ value: tag.id, label: tag.name }))
            .sort((a: TagOption, b: TagOption) => a.label.localeCompare(b.label));
    }, [allUserTags, currentTags]);

    const handleSelectTag = async (tagId: string | null) => {
        if (!tagId || disabled) return;
        setPopoverOpen(false); // Close popover on selection
        setIsAdding(true);
        try {
            await onAddTag(tagId);
        } catch (error) {
            // Error handled by the hook/action via toast
            appLogger.error("Error adding tag:", error);
        } finally {
            setIsAdding(false);
        }
    };

    const handleRemoveClick = async (tagId: string) => {
        if (disabled) return;
        setIsRemoving(tagId);
        try {
            await onRemoveTag(tagId);
        } catch (error) {
            appLogger.error("Error removing tag:", error);
        } finally {
            setIsRemoving(null);
        }
    };

    return (
        <div className="space-y-3">
            <p className="text-sm font-medium flex items-center">
                <IconTag className="h-4 w-4 mr-2 opacity-80" /> Deck Tags
            </p>
            {/* Display Current Tags as Badges */}
            <div className="flex flex-wrap gap-2">
                {currentTags.length === 0 && <p className="text-xs text-muted-foreground">No tags added yet.</p>}
                {currentTags.map((tag) => (
                    <Badge key={tag.id} variant="secondary" className="pl-2 pr-1 text-sm">
                        {tag.name}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="ml-1 h-4 w-4 p-0 text-muted-foreground hover:text-destructive hover:bg-transparent disabled:opacity-50"
                            onClick={() => handleRemoveClick(tag.id)}
                            disabled={disabled || isRemoving === tag.id}
                            aria-label={`Remove tag ${tag.name}`}
                        >
                            <IconX className="h-3 w-3" />
                        </Button>
                    </Badge>
                ))}
            </div>

            {/* --- Add Tag Combobox using Popover/Command --- */}
            <div className="max-w-xs"> 
                <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                    <PopoverTrigger asChild>
                        <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={popoverOpen}
                            className="w-full justify-between h-9 text-muted-foreground font-normal text-xs"
                            disabled={disabled || tagsLoading || isAdding}
                        >
                            {isAdding ? "Adding..." : "Add a tag..."}
                            <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] max-h-[--radix-popover-content-available-height] p-0">
                        <Command shouldFilter={true}>
                            <CommandInput placeholder="Search tags..." className="h-8 text-xs" />
                            <CommandList>
                                <CommandEmpty>No matching tags found.</CommandEmpty>
                                <CommandGroup>
                                    {availableTagOptions.map((option) => (
                                        <CommandItem
                                            key={option.value}
                                            value={option.label} // Use label for filtering/display
                                            onSelect={(currentLabel) => {
                                                // Find the option by label to get the value (tagId)
                                                const selectedOption = availableTagOptions.find(opt => opt.label.toLowerCase() === currentLabel.toLowerCase());
                                                handleSelectTag(selectedOption ? selectedOption.value : null);
                                            }}
                                            className="text-xs"
                                        >
                                            {/* Checkmark logic can be added here if needed, though less common for add-only */} 
                                            {option.label}
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>
                {/* Consider adding a link/button to manage all tags (e.g., navigate to /tags) */} 
            </div>
            {/* ----------------------------------------------- */}
        </div>
    );
} 