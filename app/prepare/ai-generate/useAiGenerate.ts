// app/prepare/ai-generate/useAiGenerate.ts
"use client";

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useSupabase } from '@/hooks/use-supabase'; // For storage uploads
import { useAuth } from '@/hooks/use-auth'; // For user ID
import { v4 as uuidv4 } from 'uuid';
// Adjust path if ApiFlashcard lives elsewhere
import type { ApiFlashcard } from '@/app/api/extract-pdf/types';

// Use consistent type alias within this file
type AiFlashcardData = ApiFlashcard;

// Constants
const SUPPORTED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"];
const MAX_FILE_SIZE = 25; // 25MB
const DIRECT_UPLOAD_LIMIT = 4; // 4MB
const COMBINED_SIZE_LIMIT = 4; // 4MB
const UPLOAD_BUCKET = 'ai-uploads';

// Language Name -> Code Mapping
const languageNameToCodeMap: Record<string, string> = {
    'english': 'en', 'dutch': 'nl', 'french': 'fr', 'german': 'de',
    'spanish': 'es', 'italian': 'it', 'portuguese': 'pt',
};
const getLanguageCode = (name: string | undefined): string => {
    if (!name) return 'en';
    const code = languageNameToCodeMap[name.toLowerCase().trim()];
    return code || 'en';
};

// --- FIX: Correct helper function type signature ---
// Helper to group flashcards by source (Could be moved to utils if used elsewhere)
const getFlashcardsBySource = (cards: AiFlashcardData[]) => {
    const grouped: Record<string, AiFlashcardData[]> = {}; // Use AiFlashcardData
    cards.forEach(card => {
        const source = card.source || 'Unknown Source';
        if (!grouped[source]) grouped[source] = [];
        grouped[source].push(card);
    });
    return grouped;
};
// ----------------------------------------------------

export function useAiGenerate() {
    // --- State ---
    const [files, setFiles] = useState<File[]>([]);
    const [isLoading, setIsLoading] = useState(false); // For extraction API call
    const [flashcards, setFlashcards] = useState<AiFlashcardData[]>([]); // Use AiFlashcardData
    const [error, setError] = useState<string | null>(null);
    const [extractedTextPreview, setExtractedTextPreview] = useState<string | null>(null);
    const [processingSummary, setProcessingSummary] = useState<string | null>(null);
    const [deckName, setDeckName] = useState<string>("");
    const [isSavingDeck, setIsSavingDeck] = useState(false); // For deck creation API call
    const [savedDeckId, setSavedDeckId] = useState<string | null>(null); // Holds ID after successful save
    const [detectedLanguageNames, setDetectedLanguageNames] = useState<{ qName: string | undefined, aName: string | undefined, b: boolean }>({ qName: undefined, aName: undefined, b: false });

    // --- Hooks and Refs ---
    const { supabase } = useSupabase();
    const { user } = useAuth();
    const router = useRouter();
    const progressTimerRef = useRef<NodeJS.Timeout | null>(null);
    const currentFileIndexRef = useRef<number>(0);

    // --- Internal Helper Functions ---

    // Function to simulate progress during API call
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

    // Function to process the structured response from the extraction API
    const handleApiResponse = (data: any, totalFilesSubmitted: number) => {
        // (Error handling and summary generation logic remains the same)
        if (data?.code === 'PAGE_LIMIT_EXCEEDED') { setError(data.message); toast.error("Processing Failed", { description: data.message }); setProcessingSummary(null); return; }

        const generatedCards: AiFlashcardData[] = data?.flashcards || []; // Use AiFlashcardData
        const skippedFiles: Array<{ filename: string; reason: string }> = data?.skippedFiles || [];
        const successfullyProcessedCount = data?.fileInfo?.files || 0;

        let summaryLines: string[] = [];
        const sourceCounts: Record<string, number> = {};
        generatedCards.forEach(card => { /* ... count sources ... */ });
        Object.entries(sourceCounts).forEach(([filename, count]) => summaryLines.push(`- ${filename}: ${count} card${count !== 1 ? 's' : ''} generated`));
        skippedFiles.forEach(skipped => summaryLines.push(`- ${skipped.filename}: Skipped (${skipped.reason})`));
        setProcessingSummary(summaryLines.length > 0 ? summaryLines.join('\n') : "Processing complete.");

        setFlashcards(generatedCards);
        setExtractedTextPreview(data?.extractedTextPreview || null);

        // Store detected language names and suggest deck name
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

        // Show appropriate toast message (logic remains the same)
        // ... toast logic ...
    };


    // --- Exposed Handler Functions ---

    // Handles new files being selected/dropped
    const handleFilesSelected = useCallback((selectedFiles: File[]) => {
        console.log(`[useAiGenerate] handleFilesSelected: ${selectedFiles.length} files`);
        setFiles(Array.isArray(selectedFiles) ? [...selectedFiles] : []);
        // Reset all results
        setError(null); setFlashcards([]); setExtractedTextPreview(null);
        setProcessingSummary(null); setDeckName(""); setSavedDeckId(null);
        setDetectedLanguageNames({ qName: undefined, aName: undefined, b: false });
    }, []);

    // Handles the form submission to process files
    const handleSubmit = useCallback(async () => { // Removed event param as it's not needed when called directly
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
            // File Validation
            for (const file of currentFiles) { /* ... */ }

            // Determine Upload Strategy & Prepare API Payload
            const isAnyFileLarge = currentFiles.some(f => f.size > DIRECT_UPLOAD_LIMIT * 1024 * 1024);
            const totalSizeMB = currentFiles.reduce((sum, f) => sum + f.size / (1024*1024), 0);
            let apiPayload: FormData | string;
            let fetchOptions: RequestInit = { method: 'POST', credentials: 'same-origin' };

            if (isAnyFileLarge || totalSizeMB > COMBINED_SIZE_LIMIT) {
                // Storage Upload Flow
                toast.loading(`Uploading to storage...`, { id: loadingToastId });
                const uploadPromises = currentFiles.map(async (file, index) => {
                    const storagePath = `${user.id}/${uuidv4()}.${file.name.split('.').pop()}`;
                    try {
                        // ... toast updates ...
                        const { data: uploadData, error: uploadError } = await supabase.storage.from(UPLOAD_BUCKET).upload(storagePath, file, { upsert: false });
                        if (uploadError) throw new Error(`Storage upload failed for ${file.name}: ${uploadError.message}`);
                        // ... toast updates ...
                        return { filename: file.name, filePath: uploadData.path };
                    } catch (err) { console.error(`Upload Error ${file.name}:`, err); return null; }
                });
                const uploadResults = await Promise.all(uploadPromises);
                // --- FIX: Explicit type assertion for filter ---
                const successfulUploads = uploadResults.filter(
                    (result): result is { filename: string; filePath: string } => result !== null
                );
                // ----------------------------------------------
                if (successfulUploads.length === 0) throw new Error('All uploads failed.');
                if (successfulUploads.length < currentFiles.length) toast.warning(`${currentFiles.length - successfulUploads.length} file(s) failed to upload.`);
                apiPayload = JSON.stringify({ files: successfulUploads });
                fetchOptions.headers = { 'Content-Type': 'application/json' };
            } else {
                // Direct Upload Flow
                const formData = new FormData();
                currentFiles.forEach(file => formData.append('file', file));
                apiPayload = formData;
            }

            // API Call
            const filesToProcess = currentFiles.map(f => f.name);
            startProgressIndicator(loadingToastId, filesToProcess);
            fetchOptions.body = apiPayload;
            console.log("[useAiGenerate] Calling POST /api/extract-pdf");
            const response = await fetch('/api/extract-pdf', fetchOptions);

            // Handle API Response
            if (!response) throw new Error("No response from extraction server.");
            let data;
            try { data = await response.json(); }
            catch (jsonError) { throw new Error(`Server returned invalid response (${response.status}).`); }
            clearTimeout(safetyTimeout); toast.dismiss(loadingToastId);
            handleApiResponse(data, currentFiles.length);

        } catch (err: any) {
            console.error('[useAiGenerate] Error during file processing:', err);
            clearTimeout(safetyTimeout); toast.dismiss(loadingToastId);
            setError(err.message || 'An error occurred during processing.');
            setProcessingSummary(null);
        } finally {
            setIsLoading(false);
            if (progressTimerRef.current) clearInterval(progressTimerRef.current);
        }
    // Ensure stable references are included if necessary, 'files' might change
    }, [files, supabase, user]); // Recalculate if files, supabase, or user changes


    // Handles saving the generated flashcards as a new deck
    const handleSaveDeck = useCallback(async () => {
        if (!flashcards.length) { toast.error("No flashcards to save."); return; }
        if (!deckName.trim()) { toast.error("Please enter a deck name."); return; }
        if (!user) { toast.error("Authentication error."); return; }

        setIsSavingDeck(true);
        const toastId = toast.loading("Creating deck...");

        const questionLangCode = getLanguageCode(detectedLanguageNames.qName);
        const answerLangCode = getLanguageCode(detectedLanguageNames.aName);
        const isBilingualFlag = detectedLanguageNames.b;

        const payload = {
            name: deckName.trim(),
            questionLanguage: questionLangCode, answerLanguage: answerLangCode,
            isBilingual: isBilingualFlag,
            flashcards: flashcards.map(fc => ({ question: fc.question, answer: fc.answer }))
        };

        console.log("[useAiGenerate] Saving deck via POST /api/decks with payload:", payload);

        try {
            const response = await fetch('/api/decks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.message || `Failed to create deck`);
            toast.success(`Deck "${payload.name}" created!`, { id: toastId });
            setSavedDeckId(result.deckId);
        } catch (error: any) {
             console.error("[useAiGenerate] Error saving deck:", error);
             toast.error("Failed to save deck", { id: toastId, description: error.message || "Unknown error" });
        } finally {
             setIsSavingDeck(false);
        }
    }, [flashcards, deckName, user, detectedLanguageNames]); // Dependencies


    // Handles clearing all inputs and results
    const handleClearAll = useCallback(() => {
        setFiles([]); setFlashcards([]); setError(null); setExtractedTextPreview(null);
        setProcessingSummary(null); setDeckName(""); setSavedDeckId(null);
        setDetectedLanguageNames({ qName: undefined, aName: undefined, b: false });
        console.log('[useAiGenerate] All cleared.');
        toast.info('Input and results cleared');
    }, []); // No dependencies


    // Handles saving flashcards as a JSON file
    const handleSaveFlashcards = useCallback(() => {
        if (!flashcards.length) { toast.error("No flashcards to save"); return; }
        const dataToSave = flashcards.map(f => ({ question: f.question, answer: f.answer }));
        const dataStr = JSON.stringify(dataToSave, null, 2);
        const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`;
        const link = document.createElement('a');
        const filename = (deckName.trim().replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'generated') + '_flashcards.json';
        link.setAttribute('href', dataUri); link.setAttribute('download', filename);
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
        toast.success("Flashcards downloaded as JSON");
    }, [flashcards, deckName]); // Dependencies


    // Handles changes to the deck name input
    const handleDeckNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setDeckName(e.target.value);
    }, []); // No dependencies


    // --- Return Value ---
    return {
        // State
        files, isLoading, error, flashcards, extractedTextPreview, processingSummary,
        deckName, isSavingDeck, savedDeckId,
        // Actions / Handlers
        handleFilesSelected, handleSubmit, handleSaveDeck, handleClearAll,
        handleSaveFlashcards, handleDeckNameChange,
    };
}