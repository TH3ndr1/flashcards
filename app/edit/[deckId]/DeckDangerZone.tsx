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
import { Trash2, Loader2 as IconLoader } from "lucide-react";

interface DeckDangerZoneProps {
    deckName: string;
    onDelete: () => Promise<void>; // The confirmed delete action
    isDeleting: boolean; // Loading state for delete button
}

export const DeckDangerZone = memo(({
    deckName,
    onDelete,
    isDeleting
}: DeckDangerZoneProps) => {

    return (
        <div className="mt-8 pt-6 border-t border-dashed border-destructive/50">
            <h3 className="text-lg font-semibold text-destructive mb-2">Danger Zone</h3>
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
                        {/* Use template literal for dynamic title */}
                        <AlertDialogTitle>Delete "{deckName}"?</AlertDialogTitle>
                        <AlertDialogDescription>This action cannot be undone. This will permanently delete the deck and all associated cards.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                        {/* Call the onDelete prop when confirmed */}
                        <AlertDialogAction onClick={onDelete} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                            {isDeleting ? <IconLoader className="h-4 w-4 animate-spin mr-2" /> : null} Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
});

DeckDangerZone.displayName = 'DeckDangerZone';