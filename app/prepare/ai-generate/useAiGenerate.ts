// app/prepare/ai-generate/useAiGenerate.ts
"use client";

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useSupabase } from '@/hooks/use-supabase'; // For storage uploads
import { useAuth } from '@/hooks/use-auth'; // For user ID
import { v4 as uuidv4 } from 'uuid';
// Ensure ApiFlashcard is imported and reflects the latest structure with classification fields
import type { ApiFlashcard } from '@/app/api/extract-pdf/types';
import { swapCardFields } from '@/lib/utils';

// Use consistent type alias within this file
type AiFlashcardData = ApiFlashcard;

// Constants (remain unchanged)
const SUPPORTED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"];
const MAX_FILE_SIZE = 25; // 25MB
const DIRECT_UPLOAD_LIMIT = 4; // 4MB
const COMBINED_SIZE_LIMIT = 4; // 4MB
const UPLOAD_BUCKET = 'ai-uploads';

// Language Name -> Code Mapping (remain unchanged)
const languageNameToCodeMap: Record<string, string> = {
    'english': 'en', 'dutch': 'nl', 'french': 'fr', 'german': 'de',
    'spanish': 'es', 'italian': 'it', 'portuguese': 'pt',
    // Add more as needed
};
const getLanguageCode = (name: string | undefined): string => {
    if (!name) return 'en'; // Default to English if undefined
    const code = languageNameToCodeMap[name.toLowerCase().trim()];
    return code || 'en'; // Default to English if mapping not found
};

// Helper function (remain unchanged)
const getFlashcardsBySource = (cards: AiFlashcardData[]) => {
    const grouped: Record<string, AiFlashcardData[]> = {};
    cards.forEach(card => {
        const source = card.source || 'Unknown Source';
        if (!grouped[source]) grouped[source] = [];
        grouped[source].push(card);
    });
    return grouped;
};

export function useAiGenerate() {
    // --- State ---
    const [files, setFiles] = useState<File[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    // Ensure state uses the updated type
    const [flashcards, setFlashcards] = useState<AiFlashcardData[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [extractedTextPreview, setExtractedTextPreview] = useState<string | null>(null);
    const [processingSummary, setProcessingSummary] = useState<string | null>(null);
    const [deckName, setDeckName] = useState<string>("");
    const [isSavingDeck, setIsSavingDeck] = useState(false);
    const [savedDeckId, setSavedDeckId] = useState<string | null>(null);
    const [detectedLanguageNames, setDetectedLanguageNames] = useState<{ qName: string | undefined, aName: string | undefined, b: boolean }>({ qName: undefined, aName: undefined, b: false });

    // --- Hooks and Refs ---
    const { supabase } = useSupabase();
    const { user } = useAuth();
    const router = useRouter();
    const progressTimerRef = useRef<NodeJS.Timeout | null>(null);
    const currentFileIndexRef = useRef<number>(0);

    // --- Internal Helper Functions ---

    // startProgressIndicator (remain unchanged)
    const startProgressIndicator = (toastId: string, fileNames: string[]) => {
        const totalFiles = fileNames.length;
        const averageTimePerFile = Math.max(1500, Math.min(5000, 90000 / (totalFiles + 1)));
        if (progressTimerRef.current) clearInterval(progressTimerRef.current);
        toast.loading(`Processing file 1/${totalFiles}: ${fileNames[0]}`, { id: toastId });
        currentFileIndexRef.current = 0;
        progressTimerRef.current = setInterval(() => {
            currentFileIndexRef.current++;
            if (currentFileIndexRef.current >= totalFiles) {
                if (progressTimerRef.current) clearInterval(progressTimerRef.current);
                progressTimerRef.current = null;
                toast.loading(`Finalizing processing of ${totalFiles} files...`, { id: toastId });
                return;
            }
            const currentFile = fileNames[currentFileIndexRef.current];
            toast.loading(`Processing file ${currentFileIndexRef.current + 1}/${totalFiles}: ${currentFile}`, { id: toastId });
        }, averageTimePerFile);
    };

    // handleApiResponse (remain unchanged - assumes data.flashcards is correct)
    const handleApiResponse = (data: any, totalFilesSubmitted: number) => {
        if (data?.code === 'PAGE_LIMIT_EXCEEDED') { setError(data.message); toast.error("Processing Failed", { description: data.message }); setProcessingSummary(null); return; }

        // This should now receive ApiFlashcard[] including classification fields
        const generatedCards: AiFlashcardData[] = data?.flashcards || [];
        const skippedFiles: Array<{ filename: string; reason: string }> = data?.skippedFiles || [];
        const successfullyProcessedCount = data?.fileInfo?.files || 0;

        let summaryLines: string[] = [];
        const sourceCounts: Record<string, number> = {};
        generatedCards.forEach(card => {
            const source = card.source || 'Unknown Source';
            sourceCounts[source] = (sourceCounts[source] || 0) + 1;
        });
        Object.entries(sourceCounts).forEach(([filename, count]) => summaryLines.push(`- ${filename}: ${count} card${count !== 1 ? 's' : ''} generated`));
        skippedFiles.forEach(skipped => summaryLines.push(`- ${skipped.filename}: Skipped (${skipped.reason})`));
        setProcessingSummary(summaryLines.length > 0 ? summaryLines.join('\n') : "Processing complete.");

        setFlashcards(generatedCards);
        setExtractedTextPreview(data?.extractedTextPreview || null);

        if (generatedCards.length > 0) {
            const firstCard = generatedCards[0];
            const qLangName = firstCard.questionLanguage;
            const aLangName = firstCard.answerLanguage;
            const isBilingual = firstCard.isBilingual ?? (!!qLangName && !!aLangName && qLangName !== aLangName);
            setDetectedLanguageNames({ qName: qLangName, aName: aLangName, b: isBilingual });
            const suggestedName = firstCard.source ? firstCard.source.substring(0, firstCard.source.lastIndexOf('.')) || firstCard.source : "Generated Deck";
            setDeckName(suggestedName);
        } else {
            setDetectedLanguageNames({ qName: undefined, aName: undefined, b: false });
            setDeckName("Generated Deck");
        }

        // Toast logic remains the same
        if (generatedCards.length > 0) {
            toast.success(`Generated ${generatedCards.length} flashcards!`, {
                description: skippedFiles.length > 0 ? `(${skippedFiles.length} file(s) skipped)` : `Processed ${successfullyProcessedCount} file(s).`,
            });
        } else if (successfullyProcessedCount > 0 && skippedFiles.length === 0) {
            toast.info(`No flashcards generated from ${successfullyProcessedCount} file(s).`, { description: "Check file content or try different settings." });
        } else if (skippedFiles.length > 0) {
            toast.warning(`No flashcards generated. ${skippedFiles.length} file(s) skipped.`, { description: "Check 'Skipped Files' details." });
        } else {
            toast.error("Processing failed.", { description: "No files processed and no flashcards generated." });
        }
    };


    // --- Exposed Handler Functions ---

    // handleFilesSelected (remain unchanged)
    const handleFilesSelected = useCallback((selectedFiles: File[]) => {
        console.log(`[useAiGenerate] handleFilesSelected: ${selectedFiles.length} files`);
        setFiles(Array.isArray(selectedFiles) ? [...selectedFiles] : []);
        setError(null); setFlashcards([]); setExtractedTextPreview(null);
        setProcessingSummary(null); setDeckName(""); setSavedDeckId(null);
        setDetectedLanguageNames({ qName: undefined, aName: undefined, b: false });
    }, []);

    // handleSubmit (remain unchanged)
    const handleSubmit = useCallback(async () => {
        console.log("[useAiGenerate] handleSubmit triggered");
        const currentFiles = files;

        if (!currentFiles || currentFiles.length === 0) { setError('Please select file(s)'); return; }
        if (!supabase || !user) { setError('Auth or DB connection error.'); return; }

        setIsLoading(true); setError(null); setFlashcards([]); setExtractedTextPreview(null);
        setProcessingSummary(null); setDeckName(""); setSavedDeckId(null);
        setDetectedLanguageNames({ qName: undefined, aName: undefined, b: false });

        const loadingToastId = `loading-${Date.now()}`;
        currentFileIndexRef.current = 0;
        if (progressTimerRef.current) clearInterval(progressTimerRef.current);
        const safetyTimeout = setTimeout(() => { /* ... */ }, 90000);
        toast.loading(`Preparing ${currentFiles.length} file(s)...`, { id: loadingToastId });

        try {
            // File Validation (logic unchanged)
            for (const file of currentFiles) {
                 const fileSizeMB = file.size / (1024 * 1024);
                 const fileExtension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
                 if (!SUPPORTED_EXTENSIONS.includes(fileExtension)) {
                     throw new Error(`Unsupported file type: ${file.name}. Supported: ${SUPPORTED_EXTENSIONS.join(', ')}`);
                 }
                 if (fileSizeMB > MAX_FILE_SIZE) {
                     throw new Error(`File too large: ${file.name} (${fileSizeMB.toFixed(2)}MB). Max size: ${MAX_FILE_SIZE}MB`);
                 }
             }

            // Determine Upload Strategy & Prepare API Payload (logic unchanged)
            const isAnyFileLarge = currentFiles.some(f => f.size > DIRECT_UPLOAD_LIMIT * 1024 * 1024);
            const totalSizeMB = currentFiles.reduce((sum, f) => sum + f.size / (1024*1024), 0);
            let apiPayload: FormData | string;
            let fetchOptions: RequestInit = { method: 'POST', credentials: 'same-origin' };

            if (isAnyFileLarge || totalSizeMB > COMBINED_SIZE_LIMIT) {
                // Storage Upload Flow (logic unchanged)
                toast.loading(`Uploading to storage...`, { id: loadingToastId });
                let currentUploadIndex = 0;
                const uploadPromises = currentFiles.map(async (file, index) => {
                    const storagePath = `${user.id}/${uuidv4()}${file.name.slice(file.name.lastIndexOf('.'))}`; // Preserve original extension
                    try {
                        currentUploadIndex = index + 1;
                        toast.loading(`Uploading ${currentUploadIndex}/${currentFiles.length}: ${file.name}`, { id: loadingToastId });
                        const { data: uploadData, error: uploadError } = await supabase.storage.from(UPLOAD_BUCKET).upload(storagePath, file, { upsert: false });
                        if (uploadError) throw new Error(`Storage upload failed for ${file.name}: ${uploadError.message}`);
                        toast.success(`Uploaded: ${file.name}`, { id: `upload-${file.name}-${index}` });
                        return { filename: file.name, filePath: uploadData.path };
                    } catch (err: any) {
                        console.error(`Upload Error ${file.name}:`, err);
                        toast.error(`Failed to upload: ${file.name}`, { id: `upload-${file.name}-${index}`, description: err.message });
                        return null;
                    }
                });
                const uploadResults = await Promise.all(uploadPromises);
                const successfulUploads = uploadResults.filter(
                    (result): result is { filename: string; filePath: string } => result !== null
                );
                if (successfulUploads.length === 0) throw new Error('All storage uploads failed.');
                if (successfulUploads.length < currentFiles.length) toast.warning(`${currentFiles.length - successfulUploads.length} file(s) failed to upload. Continuing with successful ones.`);
                apiPayload = JSON.stringify({ files: successfulUploads });
                fetchOptions.headers = { 'Content-Type': 'application/json' };
            } else {
                // Direct Upload Flow (logic unchanged)
                const formData = new FormData();
                currentFiles.forEach(file => formData.append('file', file));
                apiPayload = formData;
                // No specific Content-Type header needed for FormData; browser sets it
            }

            // API Call (logic unchanged)
            const filesToProcess = currentFiles.map(f => f.name);
            startProgressIndicator(loadingToastId, filesToProcess); // Update toast for processing phase
            fetchOptions.body = apiPayload;
            console.log("[useAiGenerate] Calling POST /api/extract-pdf");
            const response = await fetch('/api/extract-pdf', fetchOptions);

            // Handle API Response (logic unchanged)
            if (!response) throw new Error("No response from extraction server.");
            let data;
            try { data = await response.json(); }
            catch (jsonError) { throw new Error(`Server returned invalid response (${response.status}).`); }
            finally { clearTimeout(safetyTimeout); toast.dismiss(loadingToastId); } // Dismiss loading toast *after* getting response
            handleApiResponse(data, currentFiles.length);

        } catch (err: any) {
            console.error('[useAiGenerate] Error during file processing:', err);
            clearTimeout(safetyTimeout); toast.dismiss(loadingToastId);
            setError(err.message || 'An error occurred during processing.');
            toast.error('Processing Error', { description: err.message || 'An unknown error occurred.' });
            setProcessingSummary(null);
        } finally {
            setIsLoading(false);
            if (progressTimerRef.current) clearInterval(progressTimerRef.current);
        }
    }, [files, supabase, user]);


    // --- UPDATED: handleSaveDeck ---
    const handleSaveDeck = useCallback(async () => {
        if (!flashcards || flashcards.length === 0) {
            toast.error("No flashcards to save.");
            return;
        }
        if (!deckName.trim()) {
            toast.error("Please enter a deck name.");
            return;
        }

        setIsSavingDeck(true);
        const toastId = toast.loading("Saving deck and flashcards...");

        try {
            // --- Prepare payload matching /api/decks route --- 
            // --- Derive languages from the CURRENT first card state --- 
            const firstCard = flashcards[0];
            const currentQuestionLanguageName = firstCard?.questionLanguage;
            const currentAnswerLanguageName = firstCard?.answerLanguage;
            // Determine if bilingual based on current languages of the first card
            const isBilingualFlag = !!currentQuestionLanguageName && !!currentAnswerLanguageName && currentQuestionLanguageName !== currentAnswerLanguageName;

            // Convert names to codes (using the same helper)
            const questionLangCode = getLanguageCode(currentQuestionLanguageName);
            const answerLangCode = getLanguageCode(currentAnswerLanguageName);
            // -----------------------------------------------------------

            const payload = {
                name: deckName.trim(),
                questionLanguage: questionLangCode, // Use derived code
                answerLanguage: answerLangCode,   // Use derived code
                isBilingual: isBilingualFlag,    // Use derived flag
                flashcards: flashcards // Pass the full ApiFlashcard array (reflecting UI swaps)
            };
            console.log("[useAiGenerate] Saving deck via POST /api/decks with payload:", payload);
            // -------------------------------------------------

            // --- Use the correct API route: /api/decks --- 
            const response = await fetch('/api/decks', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload), // Send the complete payload
            });
            // -----------------------------------------------

            // --- Check response and parse JSON safely ---
            const contentType = response.headers.get("content-type");
            let result;
            if (contentType && contentType.includes("application/json")) {
                 result = await response.json();
            } else {
                // Handle non-JSON response (e.g., HTML error page from server)
                const textResponse = await response.text();
                throw new Error(`Server returned non-JSON response (${response.status}): ${textResponse.substring(0, 100)}...`);
            }
            // ---------------------------------------------

            // --- Use result.success and result.message from API response --- 
            if (!response.ok || !result.success) {
                // Use the message from the API if available
                throw new Error(result.message || `Failed to create deck (Status: ${response.status})`);
            }
            // -------------------------------------------------------------

            setSavedDeckId(result.deckId);
            toast.success(result.message || `Deck "${deckName.trim()}" saved!`, { // Use API message
                id: toastId,
                // description: `${flashcards.length} flashcards added.`, // Description might be redundant if included in API message
                action: {
                    label: "View Deck",
                    onClick: () => router.push(`/deck/${result.deckId}`),
                },
            });

        } catch (error: any) {
            console.error("[useAiGenerate] Error saving deck:", error);
            toast.error("Failed to save deck", {
                id: toastId,
                description: error.message || "An unknown error occurred.",
            });
            setSavedDeckId(null); // Ensure it's null on error
        } finally {
            setIsSavingDeck(false);
        }
    }, [deckName, flashcards, router]); 


    // handleClearAll (remain unchanged)
    const handleClearAll = useCallback(() => {
        setFiles([]);
        setError(null);
        setFlashcards([]);
        setExtractedTextPreview(null);
        setProcessingSummary(null);
        setDeckName("");
        setIsLoading(false);
        setIsSavingDeck(false);
        setSavedDeckId(null);
        setDetectedLanguageNames({ qName: undefined, aName: undefined, b: false });
        if (progressTimerRef.current) clearInterval(progressTimerRef.current);
        currentFileIndexRef.current = 0;
        toast.info("Inputs and results cleared.");
    }, []);


    // handleSaveFlashcards (JSON download - remain unchanged)
    const handleSaveFlashcards = useCallback(() => {
        if (flashcards.length === 0) {
            toast.error("No flashcards to download.");
            return;
        }
        const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
            JSON.stringify(flashcards, null, 2)
        )}`;
        const link = document.createElement("a");
        link.href = jsonString;
        link.download = `${deckName || 'flashcards'}.json`;
        link.click();
        toast.success("Flashcard data downloaded as JSON.");
    }, [flashcards, deckName]);


    // handleDeckNameChange (remain unchanged)
    const handleDeckNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setDeckName(e.target.value);
    }, []);


    // --- NEW: Handler to swap Q/A for a specific source ---
    const handleSwapSourceCards = useCallback((sourceToSwap: string) => {
        console.log(`[useAiGenerate] Swapping Q/A for source: ${sourceToSwap}`);
        setFlashcards(currentFlashcards => {
            // Create a new array with swapped cards for the target source
            const newFlashcards = currentFlashcards.map(card => {
                if (card.source === sourceToSwap) {
                    // Use the utility function to swap fields
                    return swapCardFields(card);
                }
                return card; // Return original card if source doesn't match
            });
            return newFlashcards; // Update state with the new array
        });
        toast.info(`Question & Answer swapped for "${sourceToSwap}" (preview only). Save deck to persist.`);
    }, [setFlashcards]); // Dependency on the state setter
    // -------------------------------------------------------


    // --- Return Values ---
    return {
        // State
        files, isLoading, error, flashcards, extractedTextPreview, processingSummary,
        deckName, isSavingDeck, savedDeckId,
        // Actions / Handlers
        handleFilesSelected, handleSubmit, handleSaveDeck, handleClearAll,
        handleSaveFlashcards, handleDeckNameChange, handleSwapSourceCards,
    };
}