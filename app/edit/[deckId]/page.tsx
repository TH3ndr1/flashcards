// app/edit/[deckId]/page.tsx
"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation"; // Keep useRouter if needed for back button etc.
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Loader2 as IconLoader, FileDown, SwitchCamera } from "lucide-react";
// Import the new hook and components
import { useEditDeck } from "./useEditDeck";
import { swapDeckQA } from '@/lib/actions/deckActions';
import { DeckMetadataEditor } from "./DeckMetadataEditor";
import { CardViewTabContent } from "./CardViewTabContent";
import { TableViewTabContent } from "./TableViewTabContent";
import { DeckDangerZone } from "./DeckDangerZone";
import { DeckTagEditor } from '@/components/deck-tag-editor';
import type { Tables, Database } from "@/types/database"; // Keep type import
import { appLogger } from '@/lib/logger';
import { createBrowserClient } from '@supabase/ssr'; // For client-side Supabase access
import { toast } from 'sonner'; // For notifications
import { useSettings, DEFAULT_SETTINGS } from "@/providers/settings-provider"; // <-- Import useSettings
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
// useTheme import removed as it's not used
// FontOption type import removed as it's not used

type DbCard = Tables<'cards'>;

/**
 * Refactored Edit Deck Page Component.
 *
 * Orchestrates the editing process using the `useEditDeck` hook and specialized
 * sub-components for metadata, card view, table view, and deletion.
 */
export default function EditDeckPage() {
    const params = useParams<{ deckId: string }>();
    const deckId = params?.deckId;
    const router = useRouter();
    const supabase = createBrowserClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { settings: userSettings, loading: settingsLoading } = useSettings();
    const { canUseEditFunctionality, isChildMode } = useFeatureFlags();
    // Theme hooks removed as they're not used in this component

    // Use the custom hook to manage state and actions
    const {
        deck,
        deckTags,
        loading,
        error,
        isSavingMetadata,
        isDeletingDeck,
        isArchiving,
        loadDeckData, // Can be called directly if needed (e.g., manual refresh button)
        handleDeckMetadataChange,
        handleAddCardOptimistic,
        handleCreateCard,
        handleUpdateCard,
        handleDeleteCard,
        handleAddTagToDeck,
        handleRemoveTagFromDeck,
        handleArchiveDeck,
        handleActivateDeck,
        handleDeleteDeckConfirm,
    } = useEditDeck(deckId);

    const [activeTab, setActiveTab] = useState("cards");
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

    // --- Loading State (Combined for deck and settings) ---
    if (loading || settingsLoading) { // <-- Check settingsLoading as well
        return (
            <div className="flex justify-center items-center h-screen">
                <IconLoader className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }

    // --- Error State ---
    if (error) {
        return (
            <div className="container mx-auto px-4 py-8">
                <div className="flex flex-col items-center justify-center">
                    <h2 className="text-xl font-semibold text-red-500 mb-4">Error Loading Deck</h2>
                    <p className="text-muted-foreground mb-6">{error}</p>
                    <Button onClick={() => router.push("/")}>Return to Home</Button>
                </div>
            </div>
        );
    }

    // --- Deck Not Found State ---
    if (!deck) {
        // This case covers both initial load failure where deck is null
        // and the case where getDeck returns null data (deck truly not found)
        return (
            <div className="container mx-auto px-4 py-8">
                <div className="flex flex-col items-center justify-center">
                    <h2 className="text-xl font-semibold mb-4">Deck Not Found</h2>
                    <p className="text-muted-foreground mb-6">The deck you're looking for doesn't exist or couldn't be loaded.</p>
                    <Button onClick={() => router.push("/")}>Return to Home</Button>
                </div>
            </div>
        );
    }

    // --- Feature Flag Protection ---
    if (!canUseEditFunctionality) {
        return (
            <div className="container mx-auto py-8">
                <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
                    <div className="w-16 h-16 text-muted-foreground">
                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="w-full h-full"
                        >
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                            <path d="M8 11l2 2 4-4" />
                        </svg>
                    </div>
                    <div className="w-full max-w-md text-center">
                        <h2 className="text-xl font-semibold mb-2">Edit Access Restricted</h2>
                        <p className="text-muted-foreground mb-6">
                            {isChildMode 
                                ? "Child Mode is active. Deck editing is disabled for safety."
                                : "Deck editing functionality is currently disabled."
                            }
                        </p>
                        <div className="p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg mb-6">
                            <p className="text-sm text-orange-800 dark:text-orange-200">
                                {isChildMode 
                                    ? "To edit decks, please disable Child Mode from your Profile page."
                                    : "This feature has been disabled by an administrator."
                                }
                            </p>
                        </div>
                        <div className="flex gap-2 justify-center">
                            <Button variant="outline" onClick={() => router.back()}>
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Go Back
                            </Button>
                            {isChildMode && (
                                <Button onClick={() => router.push('/profile')}>
                                    Go to Profile
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // --- Main Render ---
    return (
        <div className="container mx-auto py-6 md:py-8 px-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-6 gap-2 flex-wrap">
                <h1 className="text-2xl font-bold truncate pr-2" title={deck.name}>Edit Deck: {deck.name}</h1>
                <div className="flex items-center gap-2">
                    <Button
                        variant="secondary"
                        onClick={async () => {
                            if (!deckId) { toast.error('Deck ID missing.'); return; }
                            const toastId = toast.loading('Swapping Q/A...');
                            try {
                                const res = await swapDeckQA(deckId);
                                if (res.error) throw new Error(res.error);
                                toast.success(`Swapped Q/A for ${res.data?.updatedCards ?? 0} cards.`, { id: toastId });
                                // Soft refresh: reload deck data without a full page reload to avoid auth race
                                await loadDeckData(deckId);
                            } catch (e: unknown) {
                                toast.error('Swap failed', { id: toastId, description: (e as Error).message || 'Unknown error' });
                            }
                        }}
                        title="Swap all cards' Question/Answer and deck languages"
                    >
                        <SwitchCamera className="mr-2 h-4 w-4" /> Swap Q/A for Deck
                    </Button>
                    <Button 
                        variant="outline" 
                        onClick={async () => {
                            if (!deckId) {
                                toast.error("Deck ID is missing.");
                                return;
                            }
                            setIsGeneratingPdf(true);
                            toast.info("Generating PDF...");

                            try {
                                const { data: { session }, error: sessionError } = await supabase.auth.getSession();
                                if (sessionError || !session) {
                                    throw new Error(sessionError?.message || "User not authenticated.");
                                }

                                // Consolidate settings access with fallbacks
                                const settingsForPdf = {
                                    cardFont: userSettings?.cardFont || DEFAULT_SETTINGS.cardFont,
                                    enablePdfWordColorCoding: userSettings?.enablePdfWordColorCoding ?? DEFAULT_SETTINGS.enablePdfWordColorCoding,
                                    pdfCardContentFontSize: userSettings?.pdfCardContentFontSize || DEFAULT_SETTINGS.pdfCardContentFontSize,
                                    showCardStatusIconsInPdf: userSettings?.showCardStatusIconsInPdf ?? DEFAULT_SETTINGS.showCardStatusIconsInPdf,
                                    wordPaletteConfig: userSettings?.wordPaletteConfig || DEFAULT_SETTINGS.wordPaletteConfig,
                                    enableBasicColorCoding: userSettings?.enableBasicColorCoding ?? DEFAULT_SETTINGS.enableBasicColorCoding,
                                    enableAdvancedColorCoding: userSettings?.enableAdvancedColorCoding ?? DEFAULT_SETTINGS.enableAdvancedColorCoding,
                                    colorOnlyNonNative: userSettings?.colorOnlyNonNative ?? DEFAULT_SETTINGS.colorOnlyNonNative,
                                    appLanguage: userSettings?.appLanguage || DEFAULT_SETTINGS.appLanguage,
                                };

                                // Construct the payload explicitly to log it accurately
                                const payload = {
                                    deckId,
                                    cardFont: settingsForPdf.cardFont,
                                    enablePdfWordColorCoding: settingsForPdf.enablePdfWordColorCoding,
                                    pdfCardContentFontSize: settingsForPdf.pdfCardContentFontSize,
                                    showCardStatusIconsInPdf: settingsForPdf.showCardStatusIconsInPdf,
                                    wordPaletteConfig: settingsForPdf.wordPaletteConfig,
                                    enableBasicColorCoding: settingsForPdf.enableBasicColorCoding,
                                    enableAdvancedColorCoding: settingsForPdf.enableAdvancedColorCoding,
                                    colorOnlyNonNative: settingsForPdf.colorOnlyNonNative,
                                    appLanguage: settingsForPdf.appLanguage,
                                };

                                appLogger.debug("Client-side payload for PDF:", JSON.stringify(payload)); // Log the payload

                                const response = await fetch(
                                    `/api/generate-deck-pdf`,
                                    {
                                        method: 'POST',
                                        headers: {
                                            'Content-Type': 'application/json',
                                            'Authorization': `Bearer ${session.access_token}`,
                                        },
                                        body: JSON.stringify(payload), // Use the constructed payload object
                                    }
                                );

                                if (!response.ok) {
                                    const errorData = await response.json().catch(() => ({ message: "Failed to generate PDF. Please try again." }));
                                    throw new Error(errorData.error || errorData.message || "PDF generation failed");
                                }

                                const blob = await response.blob();
                                const url = window.URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                const safeDeckName = (deck.name || 'deck').replace(/[^\w\s.-]/g, '_');
                                a.href = url;
                                a.download = `${safeDeckName}.pdf`;
                                document.body.appendChild(a);
                                a.click();
                                window.URL.revokeObjectURL(url);
                                a.remove();
                                toast.success("PDF generated and download started.");

                            } catch (err: unknown) {
                                console.error("Error generating PDF:", err);
                                appLogger.error("[EditDeckPage - PDF] Error:", err);
                                toast.error(`PDF Generation Failed: ${(err as Error).message}`);
                            } finally {
                                setIsGeneratingPdf(false);
                            }
                        }}
                        disabled={isGeneratingPdf || settingsLoading}
                    >
                        {isGeneratingPdf ? (
                            <IconLoader className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <FileDown className="mr-2 h-4 w-4" />
                        )}
                        Save to PDF
                    </Button>
                </div>
            </div>

            {/* Deck Metadata Editor */}
            <div className="mb-6 space-y-6">
                <DeckMetadataEditor
                    name={deck.name}
                    primaryLanguage={deck.primary_language}
                    secondaryLanguage={deck.secondary_language}
                    isBilingual={deck.is_bilingual}
                    onChange={handleDeckMetadataChange}
                    isSaving={isSavingMetadata}
                />
                <DeckTagEditor 
                    deckId={deck.id}
                    currentTags={deckTags} 
                    onAddTag={handleAddTagToDeck}
                    onRemoveTag={handleRemoveTagFromDeck}
                />
            </div>

            {/* Card Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="cards">Card View</TabsTrigger>
                    <TabsTrigger value="table">Table View</TabsTrigger>
                </TabsList>

                <TabsContent value="cards">
                    <CardViewTabContent
                        cards={deck.cards}
                        onCreateCard={handleCreateCard}
                        onUpdateCard={handleUpdateCard}
                        onDeleteCard={handleDeleteCard}
                        onAddNewCardClick={handleAddCardOptimistic}
                    />
                </TabsContent>

                <TabsContent value="table">
                     <TableViewTabContent
                         // Filter out placeholder cards before passing to table
                         cards={deck.cards.filter(c => c.id && !c.id.startsWith('new-')) as DbCard[]}
                         deckId={deck.id}
                         // Decide how table updates should reflect - refetch or update local state?
                         // Option 1: Assume table handles its own saving and parent just needs to know
                         onCardUpdated={(updatedCard) => {
                              appLogger.info("Card updated via table:", updatedCard.id);
                              // Option: Update local state directly (if needed)
                              // setDeck(prev => ...)
                              // Option: Or trigger a full refetch
                              // loadDeckData(deck.id);
                         }}
                         onAddNewCardClick={handleAddCardOptimistic}
                     />
                 </TabsContent>
            </Tabs>

            {/* Deck Actions */}
            <DeckDangerZone
                deckName={deck.name}
                deckStatus={deck.status}
                onDelete={handleDeleteDeckConfirm}
                onArchive={handleArchiveDeck}
                onActivate={handleActivateDeck}
                isDeleting={isDeletingDeck}
                isArchiving={isArchiving}
            />

        </div>
    );
}