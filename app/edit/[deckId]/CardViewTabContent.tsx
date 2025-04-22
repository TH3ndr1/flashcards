// app/edit/[deckId]/CardViewTabContent.tsx
"use client";

import { memo } from 'react';
import { CardEditor } from "@/components/card-editor";
import { Button } from "@/components/ui/button";
import { Card as UICard, CardContent } from "@/components/ui/card"; // Alias Card component
import { Plus } from "lucide-react";
import type { Tables } from "@/types/database";

type DbCard = Tables<'cards'>;

interface CardViewTabContentProps {
    cards: Array<Partial<DbCard>>; // Can include new placeholders
    // Callbacks for actions handled by the parent hook
    onCreateCard: (question: string, answer: string) => Promise<string | null>;
    onUpdateCard: (cardId: string, question: string, answer: string) => void;
    onDeleteCard: (cardId: string) => void;
    onAddNewCardClick: () => void; // Trigger adding a new placeholder
}

export const CardViewTabContent = memo(({
    cards,
    onCreateCard,
    onUpdateCard,
    onDeleteCard,
    onAddNewCardClick
}: CardViewTabContentProps) => {

    return (
        <div className="mt-6">
            {cards.length === 0 ? (
                <UICard>
                    <CardContent className="flex flex-col items-center justify-center p-6 h-40">
                        <p className="text-muted-foreground text-center mb-4">No cards in this deck yet</p>
                        <Button onClick={onAddNewCardClick}>
                            <Plus className="mr-2 h-4 w-4" />
                            Add Your First Card
                        </Button>
                    </CardContent>
                </UICard>
            ) : (
                <div className="space-y-4">
                    {cards.map((cardData, index) => (
                        <CardEditor
                            // Use temporary ID for new cards or real ID for existing
                            key={cardData.id || `new-${index}`}
                            card={cardData}
                            // Pass down the action handlers
                            onUpdate={onUpdateCard}
                            onDelete={onDeleteCard}
                            // Only pass onCreate if it's a new card (no persistent ID)
                            onCreate={!cardData.id ? onCreateCard : undefined}
                        />
                    ))}
                </div>
            )}

            {/* Always show Add Card button at the bottom if needed */}
            {cards.length >= 0 && ( // Show even if empty to allow first add
                <div className="flex justify-center mt-6">
                    <Button onClick={onAddNewCardClick}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Card
                    </Button>
                </div>
            )}
        </div>
    );
});

CardViewTabContent.displayName = 'CardViewTabContent';