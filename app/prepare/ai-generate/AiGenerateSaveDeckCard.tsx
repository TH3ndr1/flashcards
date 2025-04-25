// app/prepare/ai-generate/AiGenerateSaveDeckCard.tsx
"use client";

import React from 'react'; // Import React for ChangeEvent type
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, FilePlus, CheckCircle, ArrowRight } from 'lucide-react';
import type { ApiFlashcard } from '@/app/api/extract-pdf/types'; // Adjust path if needed

interface AiGenerateSaveDeckCardProps {
    flashcards: ApiFlashcard[]; // Used only to determine if this card should render
    deckName: string;
    isSavingDeck: boolean;
    savedDeckId: string | null;
    onDeckNameChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onSaveDeck: () => Promise<void>; // Make async if needed
}

export function AiGenerateSaveDeckCard({
    flashcards,
    deckName,
    isSavingDeck,
    savedDeckId,
    onDeckNameChange,
    onSaveDeck
}: AiGenerateSaveDeckCardProps) {

    // Don't render this card if there are no flashcards to save
    if (flashcards.length === 0) {
        return null;
    }

    return (
        <Card className="mt-6">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    {savedDeckId ? <CheckCircle className="h-5 w-5 text-green-600" /> : <FilePlus className="h-5 w-5" />}
                    {savedDeckId ? "Deck Created" : "3. Save as New Deck"}
                </CardTitle>
                <CardDescription>
                    {savedDeckId ? "Your new deck is ready!" : "Optionally, save these flashcards as a new deck in your collection."}
                </CardDescription>
            </CardHeader>
            <CardContent>
                {savedDeckId ? (
                    // Success Message & Link
                    <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/30 rounded-md border border-green-200 dark:border-green-800">
                        <p className="text-sm font-medium text-green-800 dark:text-green-200">
                            Deck "{deckName}" created! {/* Show name used for saving */}
                        </p>
                        <Button variant="default" size="sm" asChild>
                            <Link href={`/edit/${savedDeckId}`}>
                                View Deck <ArrowRight className="ml-2 h-4 w-4" />
                            </Link>
                        </Button>
                    </div>
                ) : (
                    // Input and Save Button
                    <div className="flex flex-col sm:flex-row gap-3 items-end">
                        <div className="flex-1 w-full sm:w-auto">
                            <Label htmlFor="deckNameInput" className="mb-1 block text-sm font-medium">Deck Name</Label>
                            <Input
                                id="deckNameInput" // Use unique ID if needed elsewhere
                                value={deckName}
                                onChange={onDeckNameChange} // Pass handler down
                                placeholder="Enter deck name (e.g., Biology Ch. 5)"
                                disabled={isSavingDeck}
                                required
                                aria-required="true"
                            />
                        </div>
                        <Button
                            disabled={isSavingDeck || !deckName.trim()}
                            onClick={onSaveDeck} // Pass handler down
                            className="w-full sm:w-auto"
                        >
                            {isSavingDeck ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...</> : "Create Deck"}
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}