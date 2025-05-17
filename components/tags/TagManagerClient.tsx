"use client";

import React, { useState } from 'react';
import { createTag, deleteTag } from '@/lib/actions/tagActions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Loader2 as IconLoader, X as IconX, Plus as IconPlus, Trash2 as IconTrash } from 'lucide-react';
import type { Tables } from "@/types/database";
import { Label } from '@/components/ui/label';

type Tag = Tables<'tags'>;

interface TagManagerClientProps {
  initialTags: Tag[];
}

/**
 * TagManagerClient Component
 * Allows users to view, create, and delete their global tags.
 * Receives pre-fetched tags data from the server component.
 */
export function TagManagerClient({ initialTags }: TagManagerClientProps) {
  const [allTags, setAllTags] = useState<Tag[]>(initialTags);
  const [newTagName, setNewTagName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState<{ [tagId: string]: boolean }>({});

  // --- Handlers ---

  const handleCreateTag = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmedName = newTagName.trim();
    if (!trimmedName) {
      toast.error("Tag name cannot be empty.");
      return;
    }

    setIsCreating(true);
    const result = await createTag(trimmedName);
    setIsCreating(false);

    if (result.error) {
      toast.error(`Failed to create tag: ${result.error}`);
    } else {
      toast.success(`Tag "${result.data?.name}" created.`);
      setNewTagName(''); // Clear input
      // Add the new tag to the local state
      if (result.data) {
        setAllTags(prev => [...prev, result.data!]);
      }
    }
  };

  const handleDeleteTag = async (tag: Tag) => {
    setIsDeleting(prev => ({ ...prev, [tag.id]: true }));
    const result = await deleteTag(tag.id);
    setIsDeleting(prev => ({ ...prev, [tag.id]: false }));

    if (result.error) {
      toast.error(`Failed to delete tag "${tag.name}": ${result.error}`);
    } else {
      toast.success(`Tag "${tag.name}" deleted.`);
      // Remove the tag from the local state
      setAllTags(prev => prev.filter(t => t.id !== tag.id));
    }
  };

  // --- Render Logic ---

  return (
    <div className="space-y-6">
      {/* Create Tag Form */}
      <form onSubmit={handleCreateTag} className="flex items-end gap-2">
        <div className="flex-grow">
            <Label htmlFor="new-tag-name" className="sr-only">New tag name</Label>
            <Input
                id="new-tag-name"
                type="text"
                placeholder="Enter new tag name..."
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                disabled={isCreating}
                maxLength={50} // Match schema validation
            />
        </div>
        <Button type="submit" disabled={isCreating || !newTagName.trim()}>
          {isCreating ? <IconLoader className="h-4 w-4 animate-spin mr-2" /> : <IconPlus className="h-4 w-4 mr-2" />}
          Create Tag
        </Button>
      </form>

      <hr />

      {/* Tag List */}
      <div>
        <h3 className="text-lg font-medium mb-3">Your Tags</h3>
        {allTags.length === 0 ? (
          <p className="text-sm text-muted-foreground">You haven't created any tags yet.</p>
        ) : (
          <ul className="space-y-2">
            {allTags.map((tag) => (
              <li key={tag.id} className="flex items-center justify-between p-2 border rounded-md hover:bg-muted/50">
                <span className="text-sm font-medium">{tag.name}</span>
                 <AlertDialog>
                   <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={isDeleting[tag.id]}
                        aria-label={`Delete tag ${tag.name}`}
                        className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      >
                        {isDeleting[tag.id] ? (
                          <IconLoader className="h-4 w-4 animate-spin" />
                        ) : (
                          <IconTrash className="h-4 w-4" />
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. Deleting the tag "<strong className='font-semibold'>{tag.name}</strong>" will remove it from all associated cards.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting[tag.id]}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDeleteTag(tag)}
                          disabled={isDeleting[tag.id]}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {isDeleting[tag.id] && <IconLoader className="h-4 w-4 animate-spin mr-2" />} 
                          Delete Tag
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
} 