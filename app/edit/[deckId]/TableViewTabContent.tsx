// app/edit/[deckId]/TableViewTabContent.tsx
"use client";

import { memo } from 'react';
import { EditableCardTable } from "@/components/deck/EditableCardTable";
import { Button } from "@/components/ui/button";
import { Card as UICard, CardContent } from "@/components/ui/card";
import { Plus } from "lucide-react";
import type { Tables } from "@/types/database";

type DbCard = Tables<'cards'>;

interface TableViewTabContentProps {
    cards: Array<DbCard>;
    deckId: string;
    onCardUpdated: (updatedCard: DbCard) => void;
    onCardsRemoved: (cardIds: string[]) => void;
    onAddNewCardClick: () => void;
}

export const TableViewTabContent = memo(({
    cards,
    deckId,
    onCardUpdated,
    onCardsRemoved,
    onAddNewCardClick
}: TableViewTabContentProps) => {

    return (
        <div className="mt-6">
            {cards.length > 0 ? (
                <EditableCardTable
                    initialCards={cards}
                    deckId={deckId}
                    onCardUpdated={onCardUpdated}
                    onCardsRemoved={onCardsRemoved}
                />
            ) : (
                <UICard>
                    <CardContent className="flex flex-col items-center justify-center p-6 h-40">
                        <p className="text-muted-foreground text-center mb-4">No cards to display in table view.</p>
                    </CardContent>
                </UICard>
            )}
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
