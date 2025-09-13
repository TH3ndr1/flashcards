// app/edit/[deckId]/DeckDangerZone.tsx
"use client";

import { memo } from 'react';
import { Button } from "@/components/ui/button";
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
} from "@/components/ui/alert-dialog";
import { Trash2, Loader2 as IconLoader, Archive, ArchiveRestore } from "lucide-react";
import type { Database } from "@/types/database";

type DeckStatus = Database["public"]["Enums"]["status_type"];

interface DeckDangerZoneProps {
    deckName: string;
    deckStatus: DeckStatus;
    onDelete: () => Promise<void>; // The confirmed delete action
    onArchive: () => Promise<void>; // The archive action
    onActivate: () => Promise<void>; // The activate action
    isDeleting: boolean; // Loading state for delete button
    isArchiving: boolean; // Loading state for archive/activate button
}

export const DeckDangerZone = memo(({
    deckName,
    deckStatus,
    onDelete,
    onArchive,
    onActivate,
    isDeleting,
    isArchiving
}: DeckDangerZoneProps) => {

    const isArchived = deckStatus === 'archived';

    return (
        <div className="mt-8 pt-6 border-t border-dashed border-destructive/50">
            <h3 className="text-lg font-semibold text-destructive mb-2">Deck Actions</h3>
            <div className="space-y-4">
                {/* Archive/Activate Section */}
                <div>
                    <p className="text-sm text-muted-foreground mb-2">
                        {isArchived 
                            ? "This deck is currently archived. Activate it to make it available for practice."
                            : "Archive this deck to hide it from practice sessions while keeping all data."
                        }
                    </p>
                    {isArchived ? (
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="outline" disabled={isArchiving}>
                                    {isArchiving ? <IconLoader className="mr-2 h-4 w-4 animate-spin" /> : <ArchiveRestore className="mr-2 h-4 w-4" />}
                                    Activate Deck
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Activate "{deckName}"?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This will make the deck and all its cards available for practice sessions again.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel disabled={isArchiving}>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={onActivate} disabled={isArchiving}>
                                        {isArchiving ? <IconLoader className="h-4 w-4 animate-spin mr-2" /> : null} Activate
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    ) : (
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="outline" disabled={isArchiving}>
                                    {isArchiving ? <IconLoader className="mr-2 h-4 w-4 animate-spin" /> : <Archive className="mr-2 h-4 w-4" />}
                                    Archive Deck
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Archive "{deckName}"?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This will hide the deck from practice sessions but keep all data. You can reactivate it at any time.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel disabled={isArchiving}>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={onArchive} disabled={isArchiving}>
                                        {isArchiving ? <IconLoader className="h-4 w-4 animate-spin mr-2" /> : null} Archive
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    )}
                </div>

                {/* Delete Section */}
                <div className="pt-4 border-t border-dashed border-destructive/50">
                    <h4 className="text-base font-semibold text-destructive mb-2">Danger Zone</h4>
                    <p className="text-sm text-muted-foreground mb-4">Deleting this deck and all its cards cannot be undone.</p>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" disabled={isDeleting}>
                                {isDeleting ? <IconLoader className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                                Delete Deck
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Delete "{deckName}"?</AlertDialogTitle>
                                <AlertDialogDescription>This action cannot be undone. This will permanently delete the deck and all associated cards.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={onDelete} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                                    {isDeleting ? <IconLoader className="h-4 w-4 animate-spin mr-2" /> : null} Delete
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </div>
        </div>
    );
});

DeckDangerZone.displayName = 'DeckDangerZone';