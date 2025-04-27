// app/edit/[deckId]/CardViewTabContent.tsx
"use client";

import { memo } from 'react';
import { CardEditor } from "@/components/card-editor";
import { Button } from "@/components/ui/button";
import { Card as UICard, CardContent } from "@/components/ui/card"; // Alias Card component
import { Plus } from "lucide-react";
import type { Tables } from "@/types/database";

// --- Add Constants ---
const POS_OPTIONS: ReadonlyArray<string> = ['Noun', 'Verb', 'Adjective', 'Adverb', 'Pronoun', 'Preposition', 'Interjection', 'Other', 'N/A'];
const GENDER_OPTIONS = [
    { value: 'Male', label: 'Male'},
    { value: 'Female', label: 'Female'},
    { value: 'Default', label: 'Neutral / Other'}
]; // Use 'Default' as the key for N/A/Neutral
const GENDER_KEYS: ReadonlyArray<string> = ['Male', 'Female', 'Default'] as const; // Keys matching GENDER_OPTIONS values
const GENDERED_POS: ReadonlyArray<string> = ['Noun', 'Adjective', 'Pronoun'] as const; // PoS types where gender selection is relevant
// ---------------------

type DbCard = Tables<'cards'>;
// --- Define input types matching useEditDeck handlers ---
type CreateCardInput = Pick<DbCard, 'question' | 'answer' | 'question_part_of_speech' | 'question_gender' | 'answer_part_of_speech' | 'answer_gender'>;
type UpdateCardInput = Partial<CreateCardInput>;
// -------------------------------------------------------

interface CardViewTabContentProps {
    cards: Array<Partial<DbCard>>; // Can include new placeholders
    // --- Update callback signatures to match useEditDeck handlers ---
    onCreateCard: (data: CreateCardInput) => Promise<string | null>;
    onUpdateCard: (cardId: string, data: UpdateCardInput) => void;
    // -----------------------------------------------------------
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
                            // --- Pass down the action handlers directly --- They now have the correct signature
                            onUpdate={onUpdateCard}
                            onDelete={onDeleteCard}
                            onCreate={!cardData.id || cardData.id.startsWith('new-') ? onCreateCard : undefined} // Pass onCreate if it's a placeholder
                            // -------------------------------------------
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