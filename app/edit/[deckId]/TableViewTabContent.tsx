// app/edit/[deckId]/TableViewTabContent.tsx
"use client";

import { memo } from 'react';
import { EditableCardTable } from "@/components/deck/EditableCardTable"; // Assuming this component exists and works
import { Button } from "@/components/ui/button";
import { Card as UICard, CardContent } from "@/components/ui/card"; // Alias Card component
import { Plus } from "lucide-react";
import type { Tables } from "@/types/database";

type DbCard = Tables<'cards'>;

interface TableViewTabContentProps {
    // Expects only cards with actual IDs for the table view
    cards: Array<DbCard>;
    deckId: string;
    // Callback when the table signals an update (e.g., after inline edit save)
    onCardUpdated: (updatedCard: DbCard) => void; // Or maybe just refetch? Depends on EditableCardTable
    // Trigger adding a new placeholder/row (might need separate handling than card view)
    onAddNewCardClick: () => void;
}

export const TableViewTabContent = memo(({
    cards,
    deckId,
    onCardUpdated,
    onAddNewCardClick
}: TableViewTabContentProps) => {

    return (
        <div className="mt-6">
            {cards.length > 0 ? (
                <EditableCardTable
                    initialCards={cards}
                    deckId={deckId}
                    onCardUpdated={onCardUpdated} // Pass handler down
                     // Consider if EditableCardTable needs other props like delete handlers
                />
            ) : (
                <UICard>
                    <CardContent className="flex flex-col items-center justify-center p-6 h-40">
                        <p className="text-muted-foreground text-center mb-4">No cards to display in table view.</p>
                        {/* Optionally show Add button here too */}
                    </CardContent>
                </UICard>
            )}
            {/* Add Button Below Table */}
            <div className="flex justify-center mt-6">
                <Button onClick={onAddNewCardClick}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Card
                </Button>
            </div>
        </div>
    );
});

TableViewTabContent.displayName = 'TableViewTabContent';