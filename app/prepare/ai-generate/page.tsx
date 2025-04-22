// app/prepare/ai-generate/page.tsx
'use client';

import { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Download, Eye, ArrowRight, BotMessageSquare, FileText, CheckCircle, FilePlus } from 'lucide-react';
import { toast } from 'sonner';
import { useSupabase } from '@/hooks/use-supabase';
import { useAuth } from '@/hooks/use-auth';
import { v4 as uuidv4 } from 'uuid';
import { MediaCaptureTabs } from '@/components/media-capture-tabs';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
// Adjust import path if ApiFlashcard lives elsewhere
import type { ApiFlashcard } from '@/app/api/extract-pdf/types';

// Use ApiFlashcard type for consistency
type FlashcardData = ApiFlashcard;

// Constants
const SUPPORTED_FILE_TYPES = "PDF, JPG, JPEG, PNG, GIF, BMP, WEBP";
const SUPPORTED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"];
const MAX_FILE_SIZE = 25; // 25MB
const DIRECT_UPLOAD_LIMIT = 4; // 4MB - Files larger use Storage
const COMBINED_SIZE_LIMIT = 4; // 4MB - Limit for direct FormData upload
const UPLOAD_BUCKET = 'ai-uploads'; // Supabase storage bucket name

// Language Name -> Code Mapping
const languageNameToCodeMap: Record<string, string> = {
    'english': 'en',
    'dutch': 'nl',
    'french': 'fr',
    'german': 'de',
    'spanish': 'es',
    'italian': 'it',
    'portuguese': 'pt',
    // Add other common languages returned by Gemini and their codes
    // Ensure keys are lowercase
};

// Helper to get code, defaulting to 'en' or original value if not mapped
const getLanguageCode = (name: string | undefined): string => {
    if (!name) return 'en'; // Default if no name provided
    const code = languageNameToCodeMap[name.toLowerCase().trim()]; // Use lowercase, trimmed name for lookup
    // If lookup fails, consider returning the original name (if it *might* be a code)
    // or a safe default like 'en'. Defaulting to 'en' is safer.
    return code || 'en';
};


export default function AiGeneratePage() {
    // State for UI and data management
    const [files, setFiles] = useState<File[]>([]);
    const [isLoading, setIsLoading] = useState(false); // Loading during file processing
    const [flashcards, setFlashcards] = useState<FlashcardData[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [extractedTextPreview, setExtractedTextPreview] = useState<string | null>(null);
    const [processingSummary, setProcessingSummary] = useState<string | null>(null);
    const [deckName, setDeckName] = useState<string>(""); // For the final save step
    const [isSavingDeck, setIsSavingDeck] = useState(false); // Loading for deck creation API call
    const [savedDeckId, setSavedDeckId] = useState<string | null>(null); // ID after successful save
    // State to store detected language *names* from AI
    const [detectedLanguageNames, setDetectedLanguageNames] = useState<{ qName: string | undefined, aName: string | undefined, b: boolean }>({ qName: undefined, aName: undefined, b: false });

    // Hooks
    const { supabase } = useSupabase();
    const { user } = useAuth();
    const router = useRouter();

    // Refs for internal logic
    const progressTimerRef = useRef<NodeJS.Timeout | null>(null);
    const currentFileIndexRef = useRef<number>(0);

    // Handler for files selected/cleared via MediaCaptureTabs
    const handleFilesSelected = (selectedFiles: File[]) => {
        console.log(`[AI Generate] Received ${selectedFiles.length} files`);
        setFiles(Array.isArray(selectedFiles) ? [...selectedFiles] : []);
        // Reset all results and intermediate states
        setError(null);
        setFlashcards([]);
        setExtractedTextPreview(null);
        setProcessingSummary(null);
        setDeckName("");
        setSavedDeckId(null);
        setDetectedLanguageNames({ qName: undefined, aName: undefined, b: false });
    };

    // Main function to trigger file processing -> text extraction -> flashcard generation
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        console.log("[AI Generate] Form submitted");
        const currentFiles = files; // Use state at time of submission

        // Pre-submission checks
        if (!currentFiles || currentFiles.length === 0) { setError('Please select or capture at least one file'); return; }
        if (!supabase) { setError('Database connection not ready.'); return; }
        if (!user) { setError('You must be logged in.'); return; }

        // Reset state before starting
        setIsLoading(true); setError(null); setFlashcards([]); setExtractedTextPreview(null);
        setProcessingSummary(null); setDeckName(""); setSavedDeckId(null);
        setDetectedLanguageNames({ qName: undefined, aName: undefined, b: false });

        // Setup loading indicators
        const loadingToastId = `loading-${Date.now()}`;
        currentFileIndexRef.current = 0;
        if (progressTimerRef.current) clearInterval(progressTimerRef.current);
        // Safety timeout for the whole process
        const safetyTimeout = setTimeout(() => {
            toast.dismiss(loadingToastId);
            if (progressTimerRef.current) clearInterval(progressTimerRef.current);
            console.error("[AI Generate] Process timed out after 90s.");
            setError("Processing timed out. Please try again with smaller files or check server logs.");
            setIsLoading(false);
        }, 90000);
        toast.loading(`Preparing ${currentFiles.length} file(s)...`, { id: loadingToastId });

        try {
            // 1. File Validation (Type and Size)
            for (const file of currentFiles) {
                const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
                if (!SUPPORTED_EXTENSIONS.includes(fileExtension)) {
                    throw new Error(`Unsupported file type: "${file.name}". Supported: ${SUPPORTED_EXTENSIONS.join(', ')}`);
                }
                const fileSizeMB = file.size / (1024 * 1024);
                if (fileSizeMB > MAX_FILE_SIZE) {
                    throw new Error(`File "${file.name}" too large (${fileSizeMB.toFixed(2)}MB). Max: ${MAX_FILE_SIZE}MB.`);
                }
            }

            // 2. Determine Upload Strategy and Prepare API Payload
            const isAnyFileLarge = currentFiles.some(file => file.size > DIRECT_UPLOAD_LIMIT * 1024 * 1024);
            const totalSizeMB = currentFiles.reduce((sum, file) => sum + file.size / (1024*1024), 0);
            let apiPayload: FormData | string;
            let fetchOptions: RequestInit = { method: 'POST', credentials: 'same-origin' };

            if (isAnyFileLarge || totalSizeMB > COMBINED_SIZE_LIMIT) {
                // Upload files to Supabase Storage first
                toast.loading(`Large/Multiple files detected. Uploading to storage...`, { id: loadingToastId });
                let uploadedCount = 0;
                const uploadPromises = currentFiles.map(async (file, index) => {
                    const storagePath = `${user.id}/${uuidv4()}.${file.name.split('.').pop()}`;
                    try {
                        toast.loading(`Uploading ${index + 1}/${currentFiles.length}: ${file.name}`, { id: loadingToastId });
                        const { data: uploadData, error: uploadError } = await supabase.storage
                          .from(UPLOAD_BUCKET).upload(storagePath, file, { upsert: false });
                        if (uploadError) throw new Error(`Storage upload failed for ${file.name}: ${uploadError.message}`);
                        uploadedCount++;
                        // Avoid overwhelming toasts, maybe update less frequently or just show count
                        if (uploadedCount % 3 === 0 || uploadedCount === currentFiles.length) {
                             toast.loading(`Uploaded ${uploadedCount}/${currentFiles.length} files...`, { id: loadingToastId });
                        }
                        return { filename: file.name, filePath: uploadData.path };
                    } catch (err) { console.error(`Error uploading ${file.name}:`, err); return null; }
                });
                const uploadResults = await Promise.all(uploadPromises);
                const successfulUploads = uploadResults.filter(Boolean) as { filename: string; filePath: string }[];
                if (successfulUploads.length === 0) throw new Error('All file uploads failed.');
                if (successfulUploads.length < currentFiles.length) toast.warning(`${currentFiles.length - successfulUploads.length} file(s) failed to upload.`);

                apiPayload = JSON.stringify({ files: successfulUploads }); // Payload is JSON object with references
                fetchOptions.headers = { 'Content-Type': 'application/json' };
            } else {
                // All files small enough, send directly via FormData
                const formData = new FormData();
                currentFiles.forEach(file => formData.append('file', file));
                apiPayload = formData; // Payload is FormData
            }

            // 3. Call the Backend API (/api/extract-pdf)
            const filesToProcess = currentFiles.map(f => f.name);
            startProgressIndicator(loadingToastId, filesToProcess); // Start visual progress indicator

            fetchOptions.body = apiPayload; // Assign prepared payload
            console.log("[AI Generate] Calling POST /api/extract-pdf");
            const response = await fetch('/api/extract-pdf', fetchOptions);

            // 4. Handle API Response
            if (!response) throw new Error("No response from extraction server.");
            let data;
            try {
                data = await response.json();
                console.log("[AI Generate] Received response from /api/extract-pdf:", data);
            } catch (jsonError) {
                // Attempt to get text if JSON fails (e.g., HTML error page)
                const textResponse = await response.text();
                console.error("[AI Generate] Failed to parse JSON response. Status:", response.status, "Body:", textResponse);
                throw new Error(`Server returned an invalid response (${response.status} ${response.statusText}).`);
            }

            clearTimeout(safetyTimeout); // Clear safety timeout on successful response
            toast.dismiss(loadingToastId); // Dismiss loading toast

            // Process the structured data from the API
            handleApiResponse(data, currentFiles.length);

        } catch (err: any) {
            // Catch errors from validation, upload, fetch, or response handling
            console.error('[AI Generate] Error during file processing:', err);
            clearTimeout(safetyTimeout); // Clear timeout on error
            toast.dismiss(loadingToastId); // Dismiss any active loading toast
            setError(err.message || 'An unexpected error occurred during processing.');
            setProcessingSummary(null); // Clear summary display on error
        } finally {
            setIsLoading(false); // Ensure loading indicator stops
            if (progressTimerRef.current) clearInterval(progressTimerRef.current); // Clear progress timer if running
        }
    };

    // Function to process the data received from the /api/extract-pdf endpoint
    const handleApiResponse = (data: any, totalFilesSubmitted: number) => {
        // Always check for specific error codes first
        if (data?.code === 'PAGE_LIMIT_EXCEEDED') {
            setError(data.message); toast.error("Processing Failed", { description: data.message }); setProcessingSummary(null); return;
        }

        // Extract data safely
        const generatedCards: FlashcardData[] = data?.flashcards || [];
        const skippedFiles: Array<{ filename: string; reason: string }> = data?.skippedFiles || [];
        const successfullyProcessedCount = data?.fileInfo?.files || 0;

        // Generate Processing Summary text
        let summaryLines: string[] = [];
        const sourceCounts: Record<string, number> = {};
        generatedCards.forEach(card => {
            const sourceName = card.source || 'unknown';
            sourceCounts[sourceName] = (sourceCounts[sourceName] || 0) + 1;
        });
        Object.entries(sourceCounts).forEach(([filename, count]) => summaryLines.push(`- ${filename}: ${count} flashcard${count !== 1 ? 's' : ''} generated`));
        skippedFiles.forEach(skipped => summaryLines.push(`- ${skipped.filename}: Skipped (${skipped.reason})`));
        setProcessingSummary(summaryLines.length > 0 ? summaryLines.join('\n') : "Processing complete, no summary details available.");

        // Update state with results
        setFlashcards(generatedCards);
        setExtractedTextPreview(data?.extractedTextPreview || null);

        // Store detected language names and suggest deck name if cards were generated
        if (generatedCards.length > 0) {
            const firstCard = generatedCards[0];
            const qLangName = firstCard.questionLanguage;
            const aLangName = firstCard.answerLanguage;
            const isBilingual = firstCard.isBilingual ?? (qLangName !== aLangName && !!qLangName && !!aLangName); // Derive if needed

            setDetectedLanguageNames({ qName: qLangName, aName: aLangName, b: isBilingual });
            const suggestedName = firstCard.source ? firstCard.source.substring(0, firstCard.source.lastIndexOf('.')) || firstCard.source : "Generated Deck";
            setDeckName(suggestedName);
            console.log("[AI Generate] Detected Languages (Names):", { q: qLangName, a: aLangName, b: isBilingual });
        } else {
            // Reset if no cards generated
            setDetectedLanguageNames({ qName: undefined, aName: undefined, b: false });
            setDeckName("Generated Deck"); // Default suggestion
        }

        // Show appropriate toast message based on outcome
        const actualProcessedCount = Object.keys(sourceCounts).length; // Files cards were generated from
        const skippedCount = skippedFiles.length;
        if (actualProcessedCount === 0 && skippedCount > 0) {
            toast.warning("Processing finished, but no files could be generated.", { description: "Check the summary for details." });
        } else if (skippedCount > 0) {
            toast.warning(`Generated ${generatedCards.length} flashcards from ${actualProcessedCount} file(s), but ${skippedCount} file(s) were skipped.`, { description: "Check summary for details.", duration: 8000 });
        } else if (generatedCards.length > 0) {
            toast.success(`Successfully generated ${generatedCards.length} flashcards from ${actualProcessedCount} file(s).`);
        } else if (!data?.success && data?.message) {
             // Handle cases where API reported success:false but wasn't caught earlier
             setError(data.message); toast.error("Processing Failed", {description: data.message}); setProcessingSummary(null);
        } else {
             // No cards, no skipped, success reported true (e.g., empty files processed)
             toast.info("Processing complete. No flashcards were generated from the content.");
        }
    };


    // Function to save the generated flashcards as a new deck via API
    const handleSaveDeck = async () => {
        if (!flashcards.length) { toast.error("No flashcards to save."); return; }
        if (!deckName.trim()) { toast.error("Please enter a deck name."); return; }
        if (!user) { toast.error("Authentication error."); return; }

        setIsSavingDeck(true);
        const toastId = toast.loading("Creating deck...");

        // Convert detected language NAMES to CODES for the API payload
        const questionLangCode = getLanguageCode(detectedLanguageNames.qName);
        const answerLangCode = getLanguageCode(detectedLanguageNames.aName);
        const isBilingualFlag = detectedLanguageNames.b;

        // Prepare payload for POST /api/decks
        const payload = {
            name: deckName.trim(),
            questionLanguage: questionLangCode, // Use CODE
            answerLanguage: answerLangCode,     // Use CODE
            isBilingual: isBilingualFlag,
            // Map flashcards to only include question/answer as expected by API
            flashcards: flashcards.map(fc => ({
                 question: fc.question,
                 answer: fc.answer
            }))
        };

        console.log("[AI Generate] Saving deck via POST /api/decks with payload:", payload);

        try {
            const response = await fetch('/api/decks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();

            if (!response.ok || !result.success) {
                 throw new Error(result.message || `Failed to create deck (HTTP ${response.status})`);
            }

            toast.success(`Deck "${payload.name}" created successfully!`, { id: toastId });
            setSavedDeckId(result.deckId); // Store ID to update UI (show success message/link)

        } catch (error: any) {
             console.error("[AI Generate] Error saving deck:", error);
             toast.error("Failed to save deck", { id: toastId, description: error.message || "Unknown error" });
        } finally {
             setIsSavingDeck(false); // Reset loading state
        }
    };

    // --- RESTORED: Function to simulate progress ---
    const startProgressIndicator = (toastId: string, fileNames: string[]) => {
        const totalFiles = fileNames.length;
        // Estimate time per file - adjust based on typical processing time
        const averageTimePerFile = Math.max(1500, Math.min(5000, 90000 / (totalFiles + 1))); // Dynamic estimate
        if (progressTimerRef.current) clearInterval(progressTimerRef.current);
        toast.loading(`Processing file 1/${totalFiles}: ${fileNames[0]}`, { id: toastId });
        currentFileIndexRef.current = 0;
        progressTimerRef.current = setInterval(() => {
            currentFileIndexRef.current++;
            if (currentFileIndexRef.current >= totalFiles) {
                // Stop interval slightly before showing finalizing message
                if (progressTimerRef.current) clearInterval(progressTimerRef.current);
                progressTimerRef.current = null;
                // Update toast one last time if needed
                 toast.loading(`Finalizing processing of ${totalFiles} files...`, { id: toastId });
                return;
            }
            const currentFile = fileNames[currentFileIndexRef.current];
            toast.loading(`Processing file ${currentFileIndexRef.current + 1}/${totalFiles}: ${currentFile}`, { id: toastId });
        }, averageTimePerFile);
    };
    // ---------------------------------------------

    // --- RESTORED: Helper to group flashcards by source ---
    const getFlashcardsBySource = (cards: FlashcardData[]) => {
        const grouped: Record<string, FlashcardData[]> = {};
        cards.forEach(card => {
            const source = card.source || 'Unknown Source'; // Group cards without source
            if (!grouped[source]) grouped[source] = [];
            grouped[source].push(card);
        });
        return grouped;
    };
    // ----------------------------------------------------

    // --- RESTORED: JSON download function ---
    const handleSaveFlashcards = useCallback(() => {
        if (!flashcards.length) { toast.error("No flashcards to save"); return; }
        // Format for download (simple q/a)
        const dataToSave = flashcards.map(f => ({ question: f.question, answer: f.answer }));
        const dataStr = JSON.stringify(dataToSave, null, 2);
        const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`;
        const link = document.createElement('a');
        // Suggest filename based on deck name input or default "generated"
        const filename = (deckName.trim().replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'generated') + '_flashcards.json';
        link.setAttribute('href', dataUri);
        link.setAttribute('download', filename);
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
        toast.success("Flashcards downloaded as JSON");
    }, [flashcards, deckName]); // Depend on deckName for filename suggestion
    // -----------------------------------------

    // --- RESTORED: Clear all inputs and results ---
    const handleClearAll = useCallback(() => {
        setFiles([]); // Clear selected files
        setFlashcards([]); // Clear generated flashcards
        setError(null); // Clear any errors
        setExtractedTextPreview(null); // Clear text preview
        setProcessingSummary(null); // Clear summary
        setDeckName(""); // Reset deck name
        setSavedDeckId(null); // Reset saved deck state
        setDetectedLanguageNames({ qName: undefined, aName: undefined, b: false }); // Reset detected languages
        // Attempt to reset file input visually (may depend on MediaCaptureTabs implementation)
        // This might require MediaCaptureTabs to expose a reset function or accept a key prop change
        console.log('[AI Generate] All input and results cleared.');
        toast.info('Input and results cleared');
    }, []); // No dependencies needed
    // ---------------------------------------------


    // --- JSX Render ---
    return (
        <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
            <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6">AI Flashcard Generator</h1>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                {/* Column 1: Input */}
                <div>
                    <Card className="sticky top-4"> {/* Make input card sticky */}
                        <CardHeader className="px-4 sm:px-6 py-4">
                            <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> 1. Upload Source</CardTitle>
                            <CardDescription> Upload PDF/Image files or use camera. </CardDescription>
                        </CardHeader>
                        <CardContent className="px-4 sm:px-6 pb-4">
                            <form onSubmit={handleSubmit}>
                                <div className="mb-4">
                                    <MediaCaptureTabs
                                        // Pass files state ONLY if needed for display inside MediaCaptureTabs
                                        // initialFiles={files} // Example if component supports displaying current files
                                        onFilesSelected={handleFilesSelected} // Pass the handler
                                        supportedFileTypes={SUPPORTED_FILE_TYPES}
                                        supportedExtensions={SUPPORTED_EXTENSIONS}
                                        maxFileSize={MAX_FILE_SIZE}
                                        maxImages={10} // Allow more images potentially
                                    />
                                    {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
                                </div>
                                <div className="flex flex-col sm:flex-row gap-2">
                                    <Button type="submit" disabled={isLoading || !files || files.length === 0} className="flex-1">
                                        {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</> : <><BotMessageSquare className="mr-2 h-4 w-4" /> Generate Flashcards</>}
                                    </Button>
                                    {/* Show Clear All button if there's anything to clear */}
                                    {(files.length > 0 || flashcards.length > 0 || extractedTextPreview || processingSummary || error) && !isLoading && (
                                        <Button type="button" variant="outline" onClick={handleClearAll}> Clear All </Button>
                                    )}
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </div>

                 {/* Column 2: Results & Save */}
                <div className="space-y-6">
                    {/* Results Card */}
                    <Card className="min-h-[300px]">
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
                        <CardContent className="px-4 sm:px-6 pb-4">
                            {flashcards.length > 0 ? (
                                // Grouped Flashcard Display
                                <div className="space-y-6 max-h-[50vh] overflow-y-auto pr-2">
                                    {Object.entries(getFlashcardsBySource(flashcards)).map(([source, cards]) => {
                                        // Get language names from the first card of the source
                                        const docLangs = { qName: cards[0]?.questionLanguage, aName: cards[0]?.answerLanguage, b: cards[0]?.isBilingual };
                                        const showALang = docLangs.aName && docLangs.qName !== docLangs.aName;
                                        return (
                                        <div key={source}>
                                            {/* Source Header with Badges */}
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
                                            {/* Card List for this Source */}
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
                                // Placeholder when no results and no preview
                                <div className="text-center py-6 text-muted-foreground">
                                    <p>Results will appear here after processing.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Save as Deck Section (Card 3) */}
                    {flashcards.length > 0 && (
                        <Card className="mt-6">
                             <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    {/* Use FilePlus icon here */}
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
                                            Deck "{deckName}" created!
                                        </p>
                                        <Button variant="default" size="sm" asChild>
                                            <Link href={`/edit/${savedDeckId}`}>
                                                 View Deck <ArrowRight className="ml-2 h-4 w-4"/>
                                            </Link>
                                        </Button>
                                     </div>
                                ) : (
                                    // Input and Save Button
                                    <div className="flex flex-col sm:flex-row gap-3 items-end">
                                        <div className="flex-1 w-full sm:w-auto">
                                            <Label htmlFor="deckName" className="mb-1 block text-sm font-medium">Deck Name</Label>
                                            <Input
                                                id="deckName"
                                                value={deckName}
                                                onChange={(e) => setDeckName(e.target.value)}
                                                placeholder="Enter deck name (e.g., Biology Ch. 5)"
                                                disabled={isSavingDeck}
                                                required
                                                aria-required="true"
                                            />
                                        </div>
                                        <Button
                                            disabled={isSavingDeck || !deckName.trim()}
                                            onClick={handleSaveDeck}
                                            className="w-full sm:w-auto"
                                        >
                                            {isSavingDeck ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...</> : "Create Deck"}
                                        </Button>
                                    </div>
                                )}
                             </CardContent>
                             {/* Optional Footer for JSON Download */}
                             {flashcards.length > 0 && !savedDeckId && (
                                <CardFooter className="border-t px-4 sm:px-6 py-3">
                                    <Button variant="secondary" size="sm" className="w-full" onClick={handleSaveFlashcards}>
                                        <Download className="mr-2 h-4 w-4" />
                                        Download Flashcards as JSON
                                    </Button>
                                </CardFooter>
                             )}
                         </Card>
                    )}
                </div>
            </div>
        </div> // End container
    );
}