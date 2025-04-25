// app/prepare/ai-generate/page.tsx
'use client';

import React from 'react'; // Import React if using JSX type React.FormEvent
// Import the hook and new components
import { useAiGenerate } from './useAiGenerate';
import { AiGenerateInputCard } from './AiGenerateInputCard';
import { AiGenerateResultsCard } from './AiGenerateResultsCard';
import { AiGenerateSaveDeckCard } from './AiGenerateSaveDeckCard';

/**
 * Main page component for the AI Flashcard Generator.
 * Orchestrates the UI by using the useAiGenerate hook and rendering
 * specialized child components for input, results, and saving.
 */
export default function AiGeneratePage() {
    // Get all state and handlers from the custom hook
    const {
        files,
        isLoading,
        error,
        flashcards,
        extractedTextPreview,
        processingSummary,
        deckName,
        isSavingDeck,
        savedDeckId,
        handleFilesSelected,
        handleSubmit, // This is now the async function to call
        handleSaveDeck,
        handleClearAll,
        handleSaveFlashcards, // For JSON download
        handleDeckNameChange,
    } = useAiGenerate();

    // --- FIX: Create an async wrapper for the form onSubmit ---
    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault(); // Prevent default form submission
        await handleSubmit(); // Call the async handler from the hook
    };
    // -------------------------------------------------------

    return (
        <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
            <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6">AI Flashcard Generator</h1>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">

                {/* Input Column */}
                <div>
                    <AiGenerateInputCard
                        files={files}
                        isLoading={isLoading}
                        error={error}
                        onFilesSelected={handleFilesSelected}
                        onSubmit={handleFormSubmit} // Use the async wrapper here
                        onClearAll={handleClearAll}
                        hasResults={flashcards.length > 0 || !!extractedTextPreview || !!processingSummary}
                    />
                </div>

                {/* Results & Save Column */}
                <div className="space-y-6">
                    <AiGenerateResultsCard
                        flashcards={flashcards}
                        extractedTextPreview={extractedTextPreview}
                        processingSummary={processingSummary}
                        deckName={deckName}
                        savedDeckId={savedDeckId}
                        onSaveJson={handleSaveFlashcards}
                    />

                    <AiGenerateSaveDeckCard
                        flashcards={flashcards}
                        deckName={deckName}
                        isSavingDeck={isSavingDeck}
                        savedDeckId={savedDeckId}
                        onDeckNameChange={handleDeckNameChange}
                        onSaveDeck={handleSaveDeck}
                    />
                </div>

            </div>
        </div> // End container
    );
}