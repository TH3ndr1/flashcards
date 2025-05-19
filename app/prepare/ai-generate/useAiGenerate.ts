// app/prepare/ai-generate/useAiGenerate.ts
"use client";

import { useState, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useSupabase } from '@/hooks/use-supabase'; // For storage uploads
import { useAuth } from '@/hooks/use-auth'; // For user ID
import { v4 as uuidv4 } from 'uuid';
// Ensure ApiFlashcard is imported and reflects the latest structure with classification fields
import type { ApiFlashcard } from '@/app/api/extract-pdf/types';
import { swapCardFields } from '@/lib/utils';
// Import specific types needed
import type { InitialGenerationResult, GeminiFlashcardClassification } from '@/app/api/extract-pdf/flashcardGeneratorService';
// --- Import SupportedFileType --- 
import type { SupportedFileType } from '@/app/api/extract-pdf/fileUtils'; 
import { appLogger, statusLogger } from '@/lib/logger';

// Use consistent type alias within this file
type FinalFlashcardData = ApiFlashcard; // Represents the final card with classification
// Export this type so other modules can import it
export type BasicFlashcardData = { question: string; answer: string; source?: string; fileType?: SupportedFileType; }; // Basic card structure
type ClassificationData = GeminiFlashcardClassification;

// Constants (remain unchanged)
const SUPPORTED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"];
const MAX_FILE_SIZE = 25; // 25MB
const DIRECT_UPLOAD_LIMIT = 4; // 4MB
const COMBINED_SIZE_LIMIT = 4; // 4MB
const UPLOAD_BUCKET = 'ai-uploads';

// Language Name -> Code Mapping (remain unchanged)
const languageNameToCodeMap: Record<string, string> = {
    'english': 'en', 'dutch': 'nl', 'french': 'fr',
    'german': 'de',
    'spanish': 'es', 'italian': 'it', 'portuguese': 'pt',
    // Add more as needed
};
const getLanguageCode = (name: string | undefined): string => {
    if (!name) return 'en'; // Default to English if undefined
    const code = languageNameToCodeMap[name.toLowerCase().trim()];
    return code || 'en'; // Default to English if mapping not found
};

// Helper function (remain unchanged)

export function useAiGenerate() {
    // --- State ---
    const [files, setFiles] = useState<File[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isProcessingStep2, setIsProcessingStep2] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [basicFlashcardsBySource, setBasicFlashcardsBySource] = useState<Record<string, BasicFlashcardData[]>>({});
    const [initialModeBySource, setInitialModeBySource] = useState<Record<string, 'translation' | 'knowledge'>>({});
    const [finalFlashcards, setFinalFlashcards] = useState<FinalFlashcardData[]>([]);
    const [serverExtractedTextMap, setServerExtractedTextMap] = useState<Record<string, string>>({});
    const [needsModeConfirmationSource, setNeedsModeConfirmationSource] = useState<string | null>(null);
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

    // --- Memoized Derived State --- 
    const allBasicFlashcards = useMemo(() => Object.values(basicFlashcardsBySource).flat(), [basicFlashcardsBySource]);
    const displayFlashcards: (BasicFlashcardData | FinalFlashcardData)[] = useMemo(() => {
        return needsModeConfirmationSource ? allBasicFlashcards : finalFlashcards;
    }, [needsModeConfirmationSource, allBasicFlashcards, finalFlashcards]);

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

    // Reset state function
    const resetGenerationState = useCallback(() => {
        setError(null);
        setBasicFlashcardsBySource({});
        setInitialModeBySource({});
        setFinalFlashcards([]);
        setServerExtractedTextMap({});
        setNeedsModeConfirmationSource(null);
        setExtractedTextPreview(null);
        setProcessingSummary(null);
        setDeckName("");
        setSavedDeckId(null);
        setDetectedLanguageNames({ qName: undefined, aName: undefined, b: false });
        setIsProcessingStep2(false);
        setIsSavingDeck(false);
    }, []);

    // --- ADDED BACK: handleFilesSelected ---
    const handleFilesSelected = useCallback((selectedFiles: File[]) => {
        appLogger.info(`[useAiGenerate] handleFilesSelected: ${selectedFiles.length} files`);
        setFiles(Array.isArray(selectedFiles) ? [...selectedFiles] : []);
        // Reset relevant state when new files are selected
        resetGenerationState();
    }, [resetGenerationState]);
    // -------------------------------------

    // --- UPDATED: handleApiResponse for Step 1 ---
    const handleStep1ApiResponse = (data: any, totalFilesSubmitted: number) => {
        // --- ADD LOG to see the received code ---
        appLogger.info(`[useAiGenerate] handleStep1ApiResponse received data.code: ${data?.code}`);
        // ---------------------------------------
        
        // --- Explicitly handle PAGE_LIMIT_EXCEEDED error from API --- 
        if (data?.success === false && data?.code === 'PAGE_LIMIT_EXCEEDED') {
            appLogger.warn(`[useAiGenerate] Handling PAGE_LIMIT_EXCEEDED error: ${data.message}`);
            setError(data.message); // Set the specific error message for display
            const skippedInfo = data.skippedFiles && data.skippedFiles[0] ? `- ${data.skippedFiles[0].filename}: Skipped (${data.skippedFiles[0].reason})` : "File skipped due to page limit.";
            setProcessingSummary(skippedInfo);
            toast.error("Processing Failed", { description: data.message });
            appLogger.info("[useAiGenerate] Page limit error handled, returning from handleStep1ApiResponse.");
            return; // Stop further processing in this handler
        }
        // --- ELSE: Check for other errors or invalid structure ---
        else if (!data?.success || !Array.isArray(data.initialResults)) {
            // Throw error for other unsuccessful responses or invalid structure
            throw new Error(data?.message || "Invalid response structure from initial generation API.");
        }
        // ----------------------------------------------------------
        
        // --- Capture Server-Extracted Text --- 
        const extractedTextsFromServer: { filename: string; extractedText: string }[] = data.extractedTexts || [];
        const newServerExtractedTextMap: Record<string, string> = {};
        extractedTextsFromServer.forEach(item => {
            newServerExtractedTextMap[item.filename] = item.extractedText;
        });
        setServerExtractedTextMap(newServerExtractedTextMap); // Store server text
        // ------------------------------------

        const initialResults: InitialGenerationResult[] = data.initialResults;
        const skippedFiles: Array<{ filename: string; reason: string }> = data?.skippedFiles || [];
        const successfullyProcessedCount = data?.fileInfo?.files || 0;
        
        const newBasicFlashcardsBySource: Record<string, BasicFlashcardData[]> = {};
        const newInitialModeBySource: Record<string, 'translation' | 'knowledge'> = {};
        let firstTranslationSource: string | null = null; // Track first source needing confirmation
        let firstCard: BasicFlashcardData | null = null; // Track first card overall for naming
        let firstCardLangs: { qName: string | undefined, aName: string | undefined } = { qName: undefined, aName: undefined };

        initialResults.forEach((result, index) => {
            // Find the source filename - assumes initialResults matches files processed order
            const sourceFilename = data.fileInfo?.metadata?.sources?.[index]?.filename || `Unknown Source ${index + 1}`;
            const sourceFileType = data.fileInfo?.metadata?.sources?.[index]?.type as SupportedFileType | undefined || undefined;

            const processedCards = result.basicFlashcards.map(card => ({ 
                ...card, // question, answer
                source: sourceFilename, // Add source
                fileType: sourceFileType // Add file type
            }));
            
            newBasicFlashcardsBySource[sourceFilename] = processedCards;
            newInitialModeBySource[sourceFilename] = result.mode;

            if (!firstCard && processedCards.length > 0) {
                firstCard = processedCards[0];
                firstCardLangs = { qName: result.detectedQuestionLanguage || undefined, aName: result.detectedAnswerLanguage || undefined };
            }

            if (result.mode === 'translation' && processedCards.length > 0 && !firstTranslationSource) {
                firstTranslationSource = sourceFilename;
            }
        });

        setBasicFlashcardsBySource(newBasicFlashcardsBySource);
        setInitialModeBySource(newInitialModeBySource);
        const initialFinalCards: FinalFlashcardData[] = Object.values(newBasicFlashcardsBySource).flat().map(bc => ({
            question: bc.question,
            answer: bc.answer,
            questionLanguage: getLanguageCode(firstCardLangs.qName),
            answerLanguage: getLanguageCode(firstCardLangs.aName),
            isBilingual: !!firstCardLangs.qName && !!firstCardLangs.aName && firstCardLangs.qName !== firstCardLangs.aName,
            questionPartOfSpeech: 'N/A',
            questionGender: 'N/A',
            answerPartOfSpeech: 'N/A',
            answerGender: 'N/A',
            source: bc.source,
            fileType: bc.fileType
        }));
        setFinalFlashcards(initialFinalCards);
        setExtractedTextPreview(data?.extractedTextPreview || null);

        // --- Handle Mode Confirmation ---
        setNeedsModeConfirmationSource(firstTranslationSource);
        if (firstTranslationSource) {
            appLogger.info(`[useAiGenerate] Mode confirmation needed for source: ${firstTranslationSource}`);
            toast.info("Mode Confirmation Needed", { description: "Please confirm or change the detected mode for one or more files." });
        } else {
             appLogger.info("[useAiGenerate] No mode confirmation needed.");
        }
        // -------------------------------

        // Update summary and languages based on the FIRST card found
        let summaryLines: string[] = [];
        Object.entries(newBasicFlashcardsBySource).forEach(([filename, cards]) => {
            summaryLines.push(`- ${filename}: ${cards.length} card${cards.length !== 1 ? 's' : ''} generated (Mode: ${newInitialModeBySource[filename]})`);
        });
        skippedFiles.forEach(skipped => summaryLines.push(`- ${skipped.filename}: Skipped (${skipped.reason})`));
        setProcessingSummary(summaryLines.length > 0 ? summaryLines.join('\n') : "Processing complete.");

        if (firstCard) {
            const qLangName = firstCardLangs.qName;
            const aLangName = firstCardLangs.aName;
            const isBilingual = !!qLangName && !!aLangName && qLangName !== aLangName;
            setDetectedLanguageNames({ qName: qLangName, aName: aLangName, b: isBilingual });
            const basicFirstCard = firstCard as BasicFlashcardData;
            const suggestedName = basicFirstCard.source
                ? basicFirstCard.source.substring(0, basicFirstCard.source.lastIndexOf('.')) || basicFirstCard.source
                : "Generated Deck";
            setDeckName(suggestedName);
        } else {
            setDetectedLanguageNames({ qName: undefined, aName: undefined, b: false });
            setDeckName("Generated Deck");
        }

        // Toast logic 
        const totalGenerated = Object.values(newBasicFlashcardsBySource).reduce((sum, cards) => sum + cards.length, 0);
        if (totalGenerated > 0) {
            toast.success(`Generated ${totalGenerated} initial flashcards!`, {
                description: skippedFiles.length > 0 ? `(${skippedFiles.length} file(s) skipped)` : `Processed ${successfullyProcessedCount} file(s).`,
            });
        } else if (successfullyProcessedCount > 0 && skippedFiles.length === 0) {
            toast.info(`No flashcards generated from ${successfullyProcessedCount} file(s).`, { description: "Check file content." });
        } else if (skippedFiles.length > 0) {
            toast.warning(`No flashcards generated. ${skippedFiles.length} file(s) skipped.`, { description: "Check summary." });
        } else {
            toast.error("Processing failed.", { description: "No files processed." });
        }
    };

    // --- UPDATED: handleSubmit --- 
    const handleSubmit = useCallback(async () => {
        // Set loading true IMMEDIATELY
        setIsLoading(true);
        
        appLogger.info("[useAiGenerate] handleSubmit triggered for Step 1");
        const currentFiles = files;
        if (!currentFiles || currentFiles.length === 0) {
            setError('Please select file(s)');
            setIsLoading(false); // Reset loading if no files
            return;
        }
        if (!supabase || !user) {
            setError('Auth or DB connection error.');
            setIsLoading(false); // Reset loading on auth error
            return;
        }

        // Now reset other state, isLoading is already true
        resetGenerationState();

        const loadingToastId = `loading-${Date.now()}`;
        currentFileIndexRef.current = 0;
        if (progressTimerRef.current) clearInterval(progressTimerRef.current);
        const safetyTimeout = setTimeout(() => { /* ... */ }, 90000);
        toast.loading(`Preparing ${currentFiles.length} file(s)...`, { id: loadingToastId });

        try {
            // --- File Validation ---
            let totalSizeMB = 0;
            let isAnyFileLarge = false;
            for (const file of currentFiles) {
                const fileSizeMB = file.size / (1024 * 1024);
                totalSizeMB += fileSizeMB;
                const fileExtension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();

                if (!SUPPORTED_EXTENSIONS.includes(fileExtension)) {
                    throw new Error(`Unsupported file type: ${file.name}`);
                }
                if (fileSizeMB > MAX_FILE_SIZE) {
                    throw new Error(`File too large: ${file.name} (${fileSizeMB.toFixed(2)}MB > ${MAX_FILE_SIZE}MB)`);
                }
                if (fileSizeMB > DIRECT_UPLOAD_LIMIT) {
                    isAnyFileLarge = true;
                }
            }
            if (isAnyFileLarge) {
                appLogger.info(`[useAiGenerate] Validation passed. isAnyFileLarge: ${isAnyFileLarge}, totalSizeMB: ${totalSizeMB.toFixed(2)}`);
            }


            // --- Determine Upload Strategy & Prepare API Payload ---
            let apiPayload: FormData | string; // Can be FormData or JSON string
            let fetchOptions: RequestInit = { method: 'POST', credentials: 'same-origin' }; // Default method

            if (isAnyFileLarge || totalSizeMB > COMBINED_SIZE_LIMIT) {
                // Storage Upload Flow (Restored Logic)
                toast.loading(`Uploading to storage...`, { id: loadingToastId });
                let currentUploadIndex = 0;
                const uploadPromises = currentFiles.map(async (file, index) => {
                    // Ensure user object and id exist before using them
                    if (!user?.id) throw new Error("User not authenticated for storage upload."); 
                    const storagePath = `${user.id}/${uuidv4()}${file.name.slice(file.name.lastIndexOf('.'))}`; // Preserve original extension
                    try {
                        currentUploadIndex = index + 1;
                        toast.loading(`Uploading ${currentUploadIndex}/${currentFiles.length}: ${file.name}`, { id: loadingToastId });
                        // Ensure supabase client exists
                        if (!supabase) throw new Error("Supabase client not available for storage upload."); 
                        const { data: uploadData, error: uploadError } = await supabase.storage.from(UPLOAD_BUCKET).upload(storagePath, file, { upsert: false });
                        if (uploadError) throw new Error(`Storage upload failed for ${file.name}: ${uploadError.message}`);
                        // Check if uploadData and path exist
                        if (!uploadData?.path) throw new Error(`Storage upload succeeded for ${file.name} but returned no path.`); 
                        toast.success(`Uploaded: ${file.name}`, { id: `upload-${file.name}-${index}` });
                        return { filename: file.name, filePath: uploadData.path };
                    } catch (err: any) {
                        appLogger.error(`Upload Error ${file.name}:`, err);
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
                
                // Prepare JSON payload with file paths
                apiPayload = JSON.stringify({ files: successfulUploads }); 
                fetchOptions.headers = { 'Content-Type': 'application/json' };
                appLogger.info("[useAiGenerate] Using Storage Upload Flow. Payload:", apiPayload);

            } else {
                // Direct Upload Flow (Unchanged)
                const formData = new FormData();
                currentFiles.forEach(file => formData.append('file', file));
                apiPayload = formData;
                // No specific Content-Type header needed for FormData; browser sets it
                appLogger.info("[useAiGenerate] Using Direct Upload Flow.");
            }
            // Assign body AFTER the if/else
            fetchOptions.body = apiPayload; 
            // ---------------------------------------------------------

            // --- API Call to Step 1 endpoint --- 
            const filesToProcess = currentFiles.map(f => f.name);
            startProgressIndicator(loadingToastId, filesToProcess); // Update toast for processing phase
            appLogger.info("[useAiGenerate] Calling POST /api/extract-pdf (Step 1)");
            const response = await fetch('/api/extract-pdf', fetchOptions);
            // ---------------------------------

            // --- Handle API Response (Step 1) --- 
            if (!response) throw new Error("No response from initial generation server.");
            let data;
            try { data = await response.json(); }
            catch (jsonError) { throw new Error(`Server returned invalid response (${response.status}).`); }
            finally { clearTimeout(safetyTimeout); toast.dismiss(loadingToastId); }
            
            // Use the dedicated handler for Step 1 results
            handleStep1ApiResponse(data, currentFiles.length); 
            // ------------------------------------

        } catch (err: any) {
            appLogger.info("[useAiGenerate] Caught error in handleSubmit try block.");
            appLogger.error('[useAiGenerate] Error during file processing (Step 1):', err);
            clearTimeout(safetyTimeout); toast.dismiss(loadingToastId);
            // --- Only set generic error if a specific one wasn't already set (Corrected Syntax) --- 
            if (!error) {
                setError(err.message || 'An error occurred during initial processing.');
            }
            // -----------------------------------------------------------------------------------
            toast.error('Initial Processing Error', { description: err.message || 'An unknown error occurred.' });
            // Remove this - we want to keep the error state to display it
            // resetGenerationState(); \n        } finally {\n            setIsLoading(false); // Step 1 loading finished\n            if (progressTimerRef.current) clearInterval(progressTimerRef.current);\n        }
        } finally {
            appLogger.info("[useAiGenerate] Entering handleSubmit finally block.");
            setIsLoading(false); // Step 1 loading finished
            if (progressTimerRef.current) clearInterval(progressTimerRef.current);
        }
    }, [files, supabase, user, resetGenerationState, handleStep1ApiResponse, startProgressIndicator]);


    // --- NEW: handleConfirmTranslation (Step 2 - Classify) --- 
    const handleConfirmTranslation = useCallback(async () => {
        if (!needsModeConfirmationSource) return;
        const sourceFilename = needsModeConfirmationSource;
        const basicCards = basicFlashcardsBySource[sourceFilename];
        if (!basicCards || basicCards.length === 0) {
            toast.error("Cannot classify: No basic flashcards found for this source.");
            setNeedsModeConfirmationSource(null); // Clear flag even on error
            return;
        }

        setIsProcessingStep2(true);
        const toastId = toast.loading(`Classifying ${basicCards.length} flashcards for ${sourceFilename}...`);

        try {
            const payload = {
                action: 'classify',
                filename: sourceFilename,
                basicFlashcards: basicCards.map(({ question, answer }) => ({ question, answer })) // Send only Q/A
            };

            appLogger.info(`[useAiGenerate] Calling POST /api/process-ai-step2 (Action: classify) for ${sourceFilename}`);
            const response = await fetch('/api/process-ai-step2', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response) throw new Error("No response from classification server.");
            const result = await response.json();
            if (!result.success) throw new Error(result.message || "Classification API returned an error.");

            const classifications: ClassificationData[] = result.data;

            // Merge classifications with basic cards
            setFinalFlashcards(prevFinal => {
                return prevFinal.map(card => {
                    if (card.source === sourceFilename) {
                        // Find corresponding basic card index (less efficient, consider map if needed)
                        const basicIndex = basicCards.findIndex(bc => bc.question === card.question && bc.answer === card.answer);
                        const classification = (basicIndex !== -1 && basicIndex < classifications.length) ? classifications[basicIndex] : null;
                        return {
                            ...card,
                            questionPartOfSpeech: classification?.questionPartOfSpeech?.trim() || 'N/A',
                            questionGender: classification?.questionGender?.trim() || 'N/A',
                            answerPartOfSpeech: classification?.answerPartOfSpeech?.trim() || 'N/A',
                            answerGender: classification?.answerGender?.trim() || 'N/A',
                        };
                    }
                    return card;
                });
            });

            toast.success(`Classification complete for ${sourceFilename}!`, { id: toastId });
            setNeedsModeConfirmationSource(null); // Clear confirmation flag

        } catch (error: any) {
            appLogger.error('[useAiGenerate] Error during classification (Step 2):', error);
            toast.error(`Classification Failed for ${sourceFilename}`, { 
                id: toastId, 
                description: error.message || 'An unknown error occurred.'
            });
             // Optionally revert finalFlashcards back to basic? Or leave as is?
             // For now, leave as basic, user might retry.
        } finally {
            setIsProcessingStep2(false);
        }
    }, [needsModeConfirmationSource, basicFlashcardsBySource]);


    // --- NEW: handleForceKnowledge (Step 2 - Regenerate) --- 
    const handleForceKnowledge = useCallback(async () => {
        if (!needsModeConfirmationSource) return;
        const sourceFilename = needsModeConfirmationSource;
        // Retrieve text from the map holding SERVER-extracted text
        const serverExtractedText = serverExtractedTextMap[sourceFilename];
        // Explicitly type currentFileType
        const currentFileType: SupportedFileType | undefined = basicFlashcardsBySource[sourceFilename]?.[0]?.fileType;
        if (!serverExtractedText) { // Check the correct variable
            toast.error(`Cannot regenerate: Server-extracted text for ${sourceFilename} not found.`);
            setNeedsModeConfirmationSource(null); // Clear flag
            return;
        }

        setIsProcessingStep2(true);
        const toastId = toast.loading(`Regenerating flashcards in Knowledge Mode for ${sourceFilename}...`);

        try {
            const payload = {
                action: 'force_knowledge',
                filename: sourceFilename,
                originalText: serverExtractedText // Send the correct text
            };

            appLogger.info(`[useAiGenerate] Calling POST /api/process-ai-step2 (Action: force_knowledge) for ${sourceFilename}`);
            const response = await fetch('/api/process-ai-step2', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response) throw new Error("No response from knowledge regeneration server.");
            const result = await response.json();
            if (!result.success || !result.data) throw new Error(result.message || "Knowledge regeneration API returned an error or invalid data.");

            const regeneratedData = result.data as { detectedQuestionLanguage: string; detectedAnswerLanguage: string; basicFlashcards: BasicFlashcardData[] };
            const regeneratedCards: FinalFlashcardData[] = regeneratedData.basicFlashcards.map(card => ({
                ...card,
                questionLanguage: regeneratedData.detectedQuestionLanguage,
                answerLanguage: regeneratedData.detectedAnswerLanguage,
                isBilingual: false, // Knowledge mode is never bilingual
                questionPartOfSpeech: 'N/A',
                questionGender: 'N/A',
                answerPartOfSpeech: 'N/A',
                answerGender: 'N/A',
                source: sourceFilename, // Re-add source
                fileType: currentFileType // Assign the potentially undefined SupportedFileType
            }));

            // Update the final flashcards state, replacing cards from this source
            setFinalFlashcards(prevFinal => {
                const otherSourceCards = prevFinal.filter(card => card.source !== sourceFilename);
                return [...otherSourceCards, ...regeneratedCards];
            });
            
            // Update detected languages if this is the first source processed
            if (Object.keys(basicFlashcardsBySource).length === 1) { // Or check if it was the source used for initial detection
                setDetectedLanguageNames({ qName: regeneratedData.detectedQuestionLanguage, aName: regeneratedData.detectedAnswerLanguage, b: false });
            }

            // Update the summary for this source
            setProcessingSummary(prev => {
                 if (!prev) return `Regenerated ${regeneratedCards.length} cards for ${sourceFilename} (Knowledge Mode).`;
                 const lines = prev.split('\n');
                 const existingIndex = lines.findIndex(line => line.includes(sourceFilename));
                 const newLine = `- ${sourceFilename}: ${regeneratedCards.length} card${regeneratedCards.length !== 1 ? 's' : ''} generated (Knowledge Mode - Regenerated)`;
                 if (existingIndex !== -1) {
                     lines[existingIndex] = newLine;
                     return lines.join('\n');
                 } else {
                     return prev + '\n' + newLine;
                 }
            });

            toast.success(`Regeneration complete for ${sourceFilename}!`, { id: toastId });
            setNeedsModeConfirmationSource(null); // Clear confirmation flag

        } catch (error: any) {
            appLogger.error('[useAiGenerate] Error during knowledge regeneration (Step 2):', error);
            toast.error(`Regeneration Failed for ${sourceFilename}`, { 
                id: toastId, 
                description: error.message || 'An unknown error occurred.'
            });
        } finally {
            setIsProcessingStep2(false);
        }
    }, [needsModeConfirmationSource, serverExtractedTextMap, basicFlashcardsBySource]);

    // --- handleSaveDeck (Cleaned up error handling comments) --- 
    const handleSaveDeck = useCallback(async () => {
        const cardsToSave = finalFlashcards; 
        if (!cardsToSave || cardsToSave.length === 0) { 
            toast.error("No flashcards to save."); 
            return; 
        }
        if (needsModeConfirmationSource) {
             toast.error("Please resolve the mode confirmation before saving.");
             return;
        }
        if (!deckName.trim()) {
            toast.error("Please enter a deck name.");
            return;
        }

        setIsSavingDeck(true);
        const toastId = toast.loading("Saving deck...");

        try {
            const firstCard = cardsToSave[0]; 
            const qLangCode = getLanguageCode(firstCard?.questionLanguage);
            const aLangCode = getLanguageCode(firstCard?.answerLanguage);
            const isBilingualFlag = !!firstCard?.isBilingual;
            const payload = { name: deckName.trim(), questionLanguage: qLangCode, answerLanguage: aLangCode, isBilingual: isBilingualFlag, flashcards: cardsToSave };

            const response = await fetch('/api/decks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            
            // --- Cleaned up response handling --- 
            let result;
            const contentType = response.headers.get("content-type"); 
            if (contentType && contentType.includes("application/json")) {
                 result = await response.json(); 
            } else {
                 const textResponse = await response.text();
                 throw new Error(`Server returned non-JSON response (${response.status}): ${textResponse.substring(0,150)}...`);
            }
             
            if (!response.ok || !result.success) { 
                 throw new Error(result.message || `Failed to save deck (Status: ${response.status})`); 
            }
            // ----------------------------------

            setSavedDeckId(result.deckId); 
            toast.success(result.message || `Deck "${deckName.trim()}" saved!`, { id: toastId, action: { label: "View Deck", onClick: () => router.push(`/edit/${result.deckId}`) } }); 

        } catch (error: any) {
            appLogger.error("[useAiGenerate] Error saving deck:", error);
            toast.error("Failed to save deck", { id: toastId, description: error.message || "An unknown error occurred." });
            setSavedDeckId(null); 
        } finally {
            setIsSavingDeck(false);
        }
    }, [deckName, finalFlashcards, router, needsModeConfirmationSource]); 


    // handleClearAll (Needs to reset new state)
    const handleClearAll = useCallback(() => {
        setFiles([]);
        setIsLoading(false);
        resetGenerationState(); // Use the reset helper
        if (progressTimerRef.current) clearInterval(progressTimerRef.current);
        currentFileIndexRef.current = 0;
        toast.info("Inputs and results cleared.");
    }, [resetGenerationState]);


    // handleSaveFlashcards (JSON download - Should download FINAL cards)
    const handleSaveFlashcards = useCallback(() => {
        const cardsToDownload = finalFlashcards;
        if (cardsToDownload.length === 0) {
            toast.error("No flashcards to download.");
            return;
        }
        // ... rest of download logic remains the same ...
        const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
            JSON.stringify(cardsToDownload, null, 2)
        )}`;
        const link = document.createElement("a");
        link.href = jsonString;
        link.download = `${deckName || 'flashcards'}.json`;
        link.click();
        toast.success("Final flashcard data downloaded as JSON.");
    }, [finalFlashcards, deckName]);


    // handleDeckNameChange (remain unchanged)
    const handleDeckNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setDeckName(e.target.value);
    }, []);


    // handleSwapSourceCards (updated)
    const handleSwapSourceCards = useCallback((sourceToSwap: string) => {
        appLogger.info(`[useAiGenerate] Swapping Q/A for source: ${sourceToSwap}`);
        
        setFinalFlashcards(currentFlashcards => 
            currentFlashcards.map(card => {
                if (card.source === sourceToSwap) {
                    const swappedBase = swapCardFields({ question: card.question, answer: card.answer });
                    return { 
                        ...card, 
                        question: swappedBase.question,
                        answer: swappedBase.answer,
                        questionLanguage: card.answerLanguage, // Swap languages
                        answerLanguage: card.questionLanguage,
                     } as FinalFlashcardData;
                }
                return card; 
            })
        );

        // Update basic cards state too
        setBasicFlashcardsBySource(prevBasic => {
             if (!prevBasic[sourceToSwap]) return prevBasic;
             const currentBasic = prevBasic[sourceToSwap];
             const newBasic = currentBasic.map(card => {
                 const swapped = swapCardFields({question: card.question, answer: card.answer});
                 // Re-apply source/type
                 return { ...swapped, source: card.source, fileType: card.fileType };
             }) as BasicFlashcardData[];
             return { ...prevBasic, [sourceToSwap]: newBasic };
         });

        // Update detected languages display state
        const firstSource = Object.keys(basicFlashcardsBySource)[0];
        if (sourceToSwap === firstSource) {
             setDetectedLanguageNames(prev => ({ qName: prev.aName, aName: prev.qName, b: prev.b }));
        }

        toast.info(`Question & Answer swapped for "${sourceToSwap}" (preview only). Save deck to persist.`);
    }, [basicFlashcardsBySource]); // Removed setFinalFlashcards as direct dependency


    // --- Return Values --- 
    return {
        // State
        files, 
        isLoading, // Step 1 loading
        isProcessingStep2, // Step 2 loading
        error, 
        displayFlashcards, // Use this for rendering the list
        extractedTextPreview, 
        processingSummary,
        deckName, 
        isSavingDeck, 
        savedDeckId,
        needsModeConfirmationSource, // Filename needing confirmation, or null
        // Actions / Handlers
        handleFilesSelected, 
        handleSubmit, // Renamed Step 1 trigger
        handleConfirmTranslation, // New Step 2 handler
        handleForceKnowledge, // New Step 2 handler
        handleSaveDeck, 
        handleClearAll,
        handleSaveFlashcards, 
        handleDeckNameChange, 
        handleSwapSourceCards,
    };
}