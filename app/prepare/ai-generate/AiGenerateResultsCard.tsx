// app/prepare/ai-generate/AiGenerateResultsCard.tsx
"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Download, Eye } from 'lucide-react';
import type { ApiFlashcard } from '@/app/api/extract-pdf/types'; // Adjust path if needed

type FlashcardData = ApiFlashcard; // Use consistent naming

interface AiGenerateResultsCardProps {
    flashcards: FlashcardData[];
    extractedTextPreview: string | null;
    processingSummary: string | null;
    deckName: string; // Needed for JSON filename suggestion
    savedDeckId: string | null; // To hide JSON download button after saving deck
    onSaveJson: () => void; // Handler for JSON download button
}

// Helper to group cards (could also be moved to utils)
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
    onSaveJson
}: AiGenerateResultsCardProps) {
    const hasFlashcards = flashcards.length > 0;
    const showJsonDownload = hasFlashcards && !savedDeckId;

    return (
        <Card className="min-h-[300px] flex flex-col"> {/* Ensure card takes height */}
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
            <CardContent className="flex-grow overflow-auto px-4 sm:px-6 pb-4"> {/* Content takes remaining space */}
                {!hasFlashcards && !extractedTextPreview && !processingSummary ? (
                    // Placeholder when no results, preview, or summary
                    <div className="text-center py-6 text-muted-foreground flex flex-col items-center justify-center h-full">
                        <p>Results will appear here after processing.</p>
                    </div>
                ) : hasFlashcards ? (
                    // Grouped Flashcard Display
                    <div className="space-y-6 pr-2"> {/* Added pr for scrollbar */}
                        {Object.entries(getFlashcardsBySource(flashcards)).map(([source, cards]) => {
                            const docLangs = { qName: cards[0]?.questionLanguage, aName: cards[0]?.answerLanguage, b: cards[0]?.isBilingual };
                            const showALang = docLangs.aName && docLangs.qName !== docLangs.aName;
                            return (
                            <div key={source}>
                                <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2 border-b">
                                    <h3 className="text-sm font-semibold truncate" title={source}>Source: {source}</h3>
                                    <div className="flex items-center gap-1 flex-wrap">
                                        {cards[0]?.fileType && <Badge variant="outline" className="text-xs">{cards[0].fileType}</Badge>}
                                        {docLangs.qName && <Badge variant="secondary" className="text-xs capitalize">Q: {docLangs.qName}</Badge>}
                                        {showALang && <Badge variant="secondary" className="text-xs capitalize">A: {docLangs.aName}</Badge>}
                                        {docLangs.b && <Badge className="text-xs">Bilingual</Badge>}
                                        <Badge variant="outline" className="text-xs">{cards.length} cards</Badge>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    {cards.map((card, index) => (
                                        <div key={`${source}-${index}-${card.question?.substring(0, 5)}`} className="border rounded-md p-3 text-sm bg-background shadow-sm">
                                            <p className="font-medium mb-1">{card.question}</p>
                                            <p className="text-muted-foreground whitespace-pre-line">{card.answer}</p>
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
                     // Should not be reached if processingSummary exists, but good fallback
                     <div className="text-center py-6 text-muted-foreground flex flex-col items-center justify-center h-full">
                         <p>Processing complete. Check summary above.</p>
                     </div>
                )}
            </CardContent>
             {/* Optional Footer for JSON Download */}
             {showJsonDownload && (
                <CardFooter className="border-t px-4 sm:px-6 py-3 mt-auto"> {/* mt-auto pushes footer down */}
                    <Button variant="secondary" size="sm" className="w-full" onClick={onSaveJson}>
                        <Download className="mr-2 h-4 w-4" />
                        Download Flashcards as JSON
                    </Button>
                </CardFooter>
             )}
        </Card>
    );
}