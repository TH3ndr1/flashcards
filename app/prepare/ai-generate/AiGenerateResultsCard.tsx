// app/prepare/ai-generate/AiGenerateResultsCard.tsx
"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Download, Eye, Languages, Repeat, Tag, Loader2, AlertTriangle, HelpCircle, Sparkles, BookOpen } from 'lucide-react'; // Updated Icons
import type { ApiFlashcard } from '@/app/api/extract-pdf/types';
// Import the basic type as well
import type { BasicFlashcardData } from './useAiGenerate';

// Use a union type for the flashcards prop
type FlashcardData = ApiFlashcard | BasicFlashcardData;

interface AiGenerateResultsCardProps {
    flashcards: FlashcardData[]; // Use the union type
    extractedTextPreview: string | null;
    processingSummary: string | null;
    deckName: string;
    savedDeckId: string | null;
    needsModeConfirmationSource: string | null; // New prop
    isProcessingStep2: boolean; // New prop
    onSaveJson: () => void;
    onSwapSource: (source: string) => void;
    onConfirmTranslation: () => void; // New prop
    onForceKnowledge: () => void; // New prop
}

// Helper to group cards (needs to handle union type)
const getFlashcardsBySource = (cards: FlashcardData[]) => {
    const grouped: Record<string, FlashcardData[]> = {};
    cards.forEach(card => {
        const source = card.source || 'Unknown Source';
        if (!grouped[source]) grouped[source] = [];
        grouped[source].push(card);
    });
    return grouped;
};

export function AiGenerateResultsCard({
    flashcards,
    extractedTextPreview,
    processingSummary,
    deckName,
    savedDeckId,
    needsModeConfirmationSource,
    isProcessingStep2,
    onSaveJson,
    onSwapSource,
    onConfirmTranslation,
    onForceKnowledge
}: AiGenerateResultsCardProps) {
    const hasFlashcards = flashcards.length > 0;
    // Disable JSON download if confirmation is needed
    const showJsonDownload = hasFlashcards && !savedDeckId && !needsModeConfirmationSource;

    // Helper to display classification info (check for existence of properties)
    const renderClassification = (
        card: FlashcardData,
        prefix: string = "",
        fieldPrefix: 'question' | 'answer'
    ) => {
        // Check if the card is ApiFlashcard type before accessing classification fields
        const pos = (card as ApiFlashcard)?. [`${fieldPrefix}PartOfSpeech`];
        const gender = (card as ApiFlashcard)?. [`${fieldPrefix}Gender`];

        const posText = (pos && pos !== 'N/A') ? pos : null;
        const genderText = (gender && gender !== 'N/A') ? gender : null;

        if (!posText && !genderText) {
            return null; // Don't render anything if both are N/A or undefined
        }

        return (
            <span className="flex items-center gap-1 text-xs text-muted-foreground ml-1">
                {prefix && <span className="font-medium">{prefix}:</span>}
                {posText && <Badge variant="outline" className="px-1.5 py-0 text-xs">{posText}</Badge>}
                {genderText && <Badge variant="outline" className="px-1.5 py-0 text-xs">{genderText}</Badge>}
            </span>
        );
    };

    // Confirmation UI Component
    const renderConfirmationPrompt = (source: string) => {
        return (
            <div className="border-l-4 border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-md mb-4">
                <div className="flex items-center mb-2">
                    <HelpCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2" />
                    <h4 className="font-semibold text-blue-800 dark:text-blue-200">We detected this as a 'Translation' list. How would you like to proceed?</h4>
                </div>
                <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                    Mode Confirmation for '{source}'
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                    <Button 
                        onClick={onConfirmTranslation}
                        disabled={isProcessingStep2}
                        size="sm"
                        variant="default"
                        className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 dark:text-white w-full"
                    >
                        {isProcessingStep2 ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4"/>}
                        Add Grammar Details
                    </Button>
                    <Button 
                        onClick={onForceKnowledge}
                        disabled={isProcessingStep2}
                        size="sm"
                        variant="outline"
                        className="dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700 dark:hover:text-white w-full"
                    >
                        {isProcessingStep2 ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BookOpen className="mr-2 h-4 w-4"/>}
                        Change to Knowledge Mode
                    </Button>
                </div>
            </div>
        );
    };

    return (
        <Card className="min-h-[300px] flex flex-col">
            <CardHeader className="px-4 sm:px-6 py-4">
                 <CardTitle className="flex items-center gap-2"><Eye className="h-5 w-5" /> 2. Review Results</CardTitle>
                 <CardDescription className="mt-1 !mb-0">
                    Review generated flashcards and processing summary.
                 </CardDescription>
                 {/* Processing Summary Display */}
                 {processingSummary && (
                    <div className="text-xs space-y-1 mt-3 border-t pt-3">
                        <p className="font-medium mb-1 text-foreground">Processing Summary:</p>
                        {processingSummary.split('\n').map((line, index) => (
                        <p key={index} className="flex items-start">
                            <span className={`flex-shrink-0 w-4 ${line.includes('Skipped') ? 'text-orange-500' : 'text-green-500'}`}>{line.includes('Skipped') ? '⚠️' : '✓'}</span>
                            <span className={`ml-1 whitespace-pre-wrap ${line.includes('Skipped') ? 'text-muted-foreground' : 'text-foreground'}`}>{line.replace(/^- /, '')}</span>
                        </p>
                        ))}
                    </div>
                 )}
            </CardHeader>
            <CardContent className="flex-grow overflow-auto px-4 sm:px-6 pb-4">
                {!hasFlashcards && !extractedTextPreview && !processingSummary ? (
                    // Placeholder
                    <div className="text-center py-6 text-muted-foreground flex flex-col items-center justify-center h-full">
                        <p>Results will appear here after processing.</p>
                    </div>
                ) : hasFlashcards ? (
                    // Grouped Flashcard Display
                    <div className="space-y-6 pr-2">
                        {/* Render Confirmation Prompt if needed */}
                        {needsModeConfirmationSource && renderConfirmationPrompt(needsModeConfirmationSource)}

                        {Object.entries(getFlashcardsBySource(flashcards)).map(([source, cards]) => {
                            const firstCard = cards[0]; // Use first card for group info
                            // Check if properties exist before accessing for languages
                            const docLangs = {
                                qName: (firstCard as ApiFlashcard)?.questionLanguage,
                                aName: (firstCard as ApiFlashcard)?.answerLanguage,
                                b: (firstCard as ApiFlashcard)?.isBilingual
                             };
                            const showALang = docLangs.aName && docLangs.qName !== docLangs.aName;
                            return (
                            <div key={source}>
                                <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2 border-b">
                                    <h3 className="text-sm font-semibold truncate" title={source}>Source: {source}</h3>
                                    <div className="flex items-center gap-1 flex-wrap">
                                        {firstCard?.fileType && <Badge variant="outline" className="text-xs">{firstCard.fileType}</Badge>}
                                        {docLangs.qName && <Badge variant="secondary" className="text-xs capitalize"><Languages className="inline h-3 w-3 mr-1"/>Q: {docLangs.qName}</Badge>}
                                        {showALang && <Badge variant="secondary" className="text-xs capitalize"><Languages className="inline h-3 w-3 mr-1"/>A: {docLangs.aName}</Badge>}
                                        <Badge variant="outline" className="text-xs">{cards.length} cards</Badge>
                                    </div>
                                </div>
                                <div className="mb-3 -mt-2 flex justify-end">
                                    {/* Disable swap button if confirmation needed */}
                                    <Button variant="outline" size="sm" onClick={() => onSwapSource(source)} disabled={!!needsModeConfirmationSource}>
                                        <Repeat className="h-4 w-4 mr-2"/>
                                        Swap Q/A for this Source
                                    </Button>
                                </div>
                                <div className="space-y-3">
                                    {cards.map((card, index) => (
                                        <div key={`${source}-${index}-${card.question?.substring(0, 5)}`} className="border rounded-md p-3 text-sm bg-background shadow-sm">
                                            {/* Question and optional classification */}
                                            <div className="flex flex-wrap items-center gap-x-2 mb-1">
                                                <p className="font-medium break-words">{card.question}</p>
                                                {renderClassification(card, "", 'question')}
                                            </div>
                                            {/* Answer and optional classification */}
                                            <div className="flex flex-wrap items-center gap-x-2">
                                                <p className="text-muted-foreground whitespace-pre-line break-words">{card.answer}</p>
                                                {renderClassification(card, "", 'answer')}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            );
                        })}
                    </div>
                ) : extractedTextPreview ? (
                     // Text Preview Display
                    <div>
                        <h3 className="text-sm font-medium mb-2">Extracted Text Preview:</h3>
                        <div className="bg-muted p-3 rounded-md max-h-[40vh] overflow-y-auto text-xs border">
                            <pre className="whitespace-pre-wrap font-mono">{extractedTextPreview.substring(0, 1000)}{extractedTextPreview.length > 1000 && '...'}</pre>
                        </div>
                    </div>
                ) : (
                     // Fallback
                     <div className="text-center py-6 text-muted-foreground flex flex-col items-center justify-center h-full">
                         <p>Processing complete. Check summary above.</p>
                     </div>
                )}
            </CardContent>
             {/* Optional Footer for JSON Download */}
             {showJsonDownload && (
                <CardFooter className="border-t px-4 sm:px-6 py-3 mt-auto">
                    <Button variant="secondary" size="sm" className="w-full" onClick={onSaveJson}>
                        <Download className="mr-2 h-4 w-4" />
                        Download Flashcards as JSON
                    </Button>
                </CardFooter>
             )}
        </Card>
    );
}