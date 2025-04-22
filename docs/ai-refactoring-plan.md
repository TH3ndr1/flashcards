# AI Generation Feature Refactoring Plan

**Version:** 1.0
**Date:** 2025-04-22
**Author:** Tom Hendrickx

## 1. Introduction & Overview

This document outlines a refactoring plan for the AI Flashcard Generation feature within the StudyCards application. The primary goal is to improve the code structure, maintainability, testability, and adherence to established best practices and SOLID design principles. This plan targets two key files that currently exhibit high complexity and mixed concerns.

**Target Files:**
*   `app/api/extract-pdf/route.ts`: The backend API endpoint responsible for receiving file uploads, extracting text content, detecting languages, generating flashcards via AI, and returning results.
*   `app/prepare/ai-generate/page.tsx`: The frontend Next.js page component responsible for the user interface (file upload, camera capture), managing component state, handling user interactions, orchestrating API calls (including potential pre-upload to storage), displaying results, and allowing users to save generated flashcards to a new deck.

**Target Audience:** This plan is intended for an AI development assistant or a human developer tasked with implementing the refactoring. It assumes the agent has access to the codebase but lacks the specific conversational history leading to this plan.

## 2. Context

The AI Flashcard Generation feature allows users to upload documents (PDFs, images) or capture images via camera. The backend processes these files using Google Cloud services (Document AI, Vision AI, Vertex AI) to extract text and generate question/answer flashcards. The frontend provides the user interface for this workflow and handles the interaction with the backend API.

## 3. Problem Statement / Motivation

Recent code analysis revealed several challenges with the current implementation in the target files:

*   **Monolithic Structure:** Both the API route and the frontend page handle too many distinct responsibilities, making them large and difficult to understand.
*   **Violation of SOLID Principles:** Primarily violates the Single Responsibility Principle (SRP) and Dependency Inversion Principle (DIP). Functionality like text extraction, language detection, AI generation, state management, and UI rendering are tightly coupled.
*   **Mixed Concerns:** Business logic, data fetching/processing logic, and UI rendering logic are intermingled.
*   **Poor Maintainability:** Modifying or extending functionality (e.g., adding support for new file types, changing AI models, altering UI) is complex and prone to introducing regressions.
*   **Limited Testability:** The lack of clear separation makes unit testing difficult. Key logic is embedded within large functions or components.
*   **Deviation from Best Practices:** The implementation deviates from established best practices documented in `docs/best-practices.md`, particularly regarding separation of concerns, component simplicity, state management, and the use of constants/utilities.

## 4. Objectives

The primary objectives of this refactoring effort are to:

1.  **Improve Modularity:** Break down the large files into smaller, more focused modules, services, hooks, and components.
2.  **Enhance Separation of Concerns:** Clearly separate presentation logic (UI), business logic (state management, rules), and data layer logic (API interaction, file processing).
3.  **Adhere to SOLID Principles:** Restructure the code to better align with SRP, OCP, and DIP.
4.  **Increase Maintainability:** Make the code easier to understand, modify, and debug.
5.  **Improve Testability:** Enable effective unit and integration testing of individual components and services.
6.  **Align with Best Practices:** Ensure the code follows the guidelines outlined in `docs/best-practices.md`.

## 5. Guiding Principles

*   **SOLID Principles:** Design decisions should prioritize adherence to SOLID principles.
*   **`docs/best-practices.md`:** This document should serve as the primary reference for coding standards, folder structure, component design, state management, etc.
*   **Incremental Approach:** Refactoring will be performed in phases to manage complexity and allow for verification at each stage.
*   **Readability & Simplicity:** Favor clear, simple, and understandable code over overly complex or clever solutions.

## 6. Action Plan

This plan follows a phased approach, starting with foundational cleanup and progressing to more significant structural changes. **Before making changes in each step, carefully read the existing code to understand its current function.**

---

### Phase 1: Foundational Cleanup & Extraction (Low Complexity)

**Goal:** Move constants, types, and helper functions out of the main files into dedicated modules. Break down the UI into smaller presentational components.

**Steps:**

1.  **Extract Constants:**
    *   Identify all constants defined within `route.ts` and `page.tsx` (e.g., `SUPPORTED_EXTENSIONS`, `MAX_FILE_SIZE`, `DIRECT_UPLOAD_LIMIT`, `UPLOAD_BUCKET`, API configuration strings).
    *   Create a new file: `lib/constants/ai-generation.ts` (or similar).
    *   Move these constants into the new file and export them.
    *   Update `route.ts` and `page.tsx` to import constants from the new file.

2.  **Extract Types:**
    *   Identify all custom types and interfaces defined or used implicitly in `route.ts` and `page.tsx` (e.g., `FlashcardData`, `SkippedFile`, API response structures, function parameter/return types).
    *   Create a new file: `types/ai-generation.ts` (or similar, align with existing `types/` structure if present).
    *   Define and export these types/interfaces clearly. Add missing type definitions where appropriate (e.g., for API responses, complex state objects).
    *   Update `route.ts`, `page.tsx`, and any newly created helper files (Step 3 & 4) to import and use these shared types. Ensure strong typing.

3.  **Extract API Route Helpers (`route.ts`):**
    *   Identify helper functions within `route.ts`: `getSupportedFileType`, `detectLanguages`, `extractTextFromImage`, `extractTextFromPdfWithDocumentAI`, `extractTextFromPdf`, `generateFlashcardsFromText`.
    *   Create new files within `lib/ai-utils/` or `lib/services/` (choose based on project convention) for related logic, e.g.:
        *   `lib/ai-utils/fileTypeUtils.ts` (for `getSupportedFileType`)
        *   `lib/ai-utils/languageDetection.ts` (for `detectLanguages`)
        *   `lib/services/textExtractionService.ts` (for `extractTextFrom...` functions - can start as simple exported functions or a basic class)
        *   `lib/services/flashcardGenerationService.ts` (for `generateFlashcardsFromText` - can start as a simple exported function or basic class)
    *   Move the function logic into these new files. Ensure they are pure functions or simple classes with minimal external dependencies initially.
    *   Update `route.ts` to import and call these functions/methods from their new locations.

4.  **Extract Page Component Helpers (`page.tsx`):**
    *   Identify helper functions defined within `page.tsx`: `getFlashcardsBySource`, `analyzeFlashcardLanguages`, `startProgressIndicator`.
    *   Create a new file: `lib/utils/ai-generation-helpers.ts` (or similar).
    *   Move these functions into the new utility file.
    *   Update `page.tsx` to import and use these functions.

5.  **Break Down UI Components (`page.tsx`):**
    *   Analyze the JSX structure within `page.tsx`.
    *   Identify logical UI sections that can become separate presentational ("dumb") components. Examples:
        *   `AiFileUploadSection`: Contains the `<MediaCaptureTabs>` and related form elements/error display. Receives files and callbacks (e.g., `onFilesSelected`, `onSubmit`, `onClear`) as props.
        *   `GeneratedFlashcardsDisplay`: Responsible for rendering the grouped flashcards based on the `flashcards` prop. Includes source headers, badges, and individual card rendering. Receives callbacks for clearing/saving if needed.
        *   `ProcessingSummaryDisplay`: Renders the processing summary messages.
        *   `ExtractedTextPreview`: Renders the text preview.
        *   `DeckCreationSection`: Contains the input field and button for creating a new deck. Receives state (`deckName`, `isCreatingDeck`, `deckCreated`) and callbacks (`onDeckNameChange`, `onCreateDeck`) as props.
    *   Create these new components within `components/ai/` (or similar appropriate location).
    *   Refactor `page.tsx` to use these new components, passing necessary data and callbacks as props. The main page component should become primarily an orchestrator.

**Verification:** After Phase 1, run the application and manually test the AI generation flow thoroughly. Ensure file uploads, processing, result display, and deck creation (if applicable) still work as expected. Check for console errors.

---

### Phase 2: Logic Extraction & State Management (Medium Complexity)

**Goal:** Move complex logic out of the page component into custom hooks and refactor state management. Introduce a basic service layer in the backend.

**Steps:**

1.  **Create Custom Hooks (`page.tsx`):**
    *   **`useAiGenerationApi`:**
        *   Create `lib/hooks/useAiGenerationApi.ts`.
        *   Encapsulate the state related to the API interaction: `isLoading`, `error`, `flashcards`, `extractedTextPreview`, `processingSummary`, `skippedFiles`.
        *   Move the entire `handleSubmit` function logic into a `processFiles` function within the hook. This includes file validation, determining upload strategy (FormData vs. Storage JSON), calling the `/api/extract-pdf` endpoint, handling the response (success/error/skipped), updating the state, and managing toast notifications.
        *   The hook should return the state variables and the `processFiles` function.
        *   Refactor `page.tsx` to use this hook. Remove the corresponding `useState` calls and the `handleSubmit` logic. Call `processFiles` from the form's submit handler.
    *   **`useDeckCreation`:**
        *   Create `lib/hooks/useDeckCreation.ts`.
        *   Encapsulate the state related to deck creation: `deckName`, `isCreatingDeck`, `deckCreated`.
        *   Move the `createDeckWithFlashcards` function logic into a `createDeck` function within the hook (it might need the generated `flashcards` passed as an argument).
        *   The hook should return the state variables and the `createDeck` function (and potentially `setDeckName`).
        *   Refactor `page.tsx` (or the `DeckCreationSection` component) to use this hook.

2.  **Refactor State Management (`page.tsx`):**
    *   Analyze the state managed by `useAiGenerationApi`. If complexity warrants (multiple related states updated together, complex transitions), consider replacing the multiple `useState` calls *within the hook* with `useReducer` for more predictable state updates.
    *   Evaluate if any state needs to be shared more broadly. If so, integrate with the project's existing state management solution (e.g., Zustand, as mentioned in project docs) instead of relying solely on local component/hook state.

3.  **Introduce Basic Service Layer (`route.ts`):**
    *   Ensure the functions moved in Phase 1 (Step 3) are organized logically (e.g., within `TextExtractionService`, `FlashcardGenerationService` classes or modules in `lib/services/`).
    *   Refactor `route.ts`'s `POST` handler to instantiate (or import) these services and call their methods, rather than calling the standalone helper functions directly. This introduces a level of indirection. The services themselves still contain the core implementation logic at this stage.

**Verification:** After Phase 2, repeat manual testing of the entire AI generation flow. Verify state updates correctly, API calls are made, results are displayed, errors are handled, and deck creation functions. Check browser and server console logs.

---

### Phase 3: Architectural Refinement & Testing (High Complexity)

**Goal:** Implement Dependency Inversion, improve error handling, and add automated tests.

**Steps:**

1.  **Implement Dependency Inversion (Backend):**
    *   Define clear interfaces in `types/ai-generation.ts` (or `types/services.ts`) for the core backend operations, e.g.:
        ```typescript
        interface ITextExtractor {
          extract(fileBuffer: ArrayBuffer, filename: string, mimeType?: string): Promise<ExtractionResult>;
        }
        interface ILanguageDetector {
          detect(text: string, metadata?: any): Promise<LanguageInfo>;
        }
        interface IFlashcardGenerator {
          generate(text: string, filename: string, languageInfo: LanguageInfo): Promise<Flashcard[]>;
        }
        ```
    *   Refactor the service classes created in Phase 2 (e.g., `TextExtractionService`, `FlashcardGenerationService`) to explicitly implement these interfaces.
    *   Refactor the `route.ts` handler (or potentially create an orchestrator service called by the route handler) to depend on the *interfaces*, not the concrete service classes. Use dependency injection (manual instantiation passed down, or a simple container) to provide the concrete implementations. This makes swapping implementations easier (e.g., using a different AI model).

2.  **Enhance Error Handling:**
    *   Review error handling in both frontend hooks (`useAiGenerationApi`, `useDeckCreation`) and backend services/route.
    *   Implement more specific error types or codes where beneficial (e.g., `FileUploadError`, `ExtractionError`, `GenerationError`).
    *   Ensure errors are logged appropriately on the server and communicated clearly to the user on the frontend (using toasts and potentially specific error messages in the UI). Consider implementing Error Boundaries in the frontend around critical sections.

3.  **Add Automated Tests:**
    *   **Unit Tests:** Write unit tests for:
        *   Utility functions (`lib/utils/`, `lib/ai-utils/`).
        *   Custom hooks (`useAiGenerationApi`, `useDeckCreation`) - mock API calls/services.
        *   Backend services (`TextExtractionService`, etc.) - mock external dependencies (Google Cloud clients).
        *   Presentational UI components created in Phase 1.
    *   **Integration Tests:**
        *   Test the `/api/extract-pdf` route handler by mocking the injected services to verify routing, request handling, and response formatting.
        *   Test the interaction between the main page (`page.tsx`), its hooks, and child components.
    *   **(Optional) E2E Tests:** Consider adding end-to-end tests (using Cypress/Playwright) for the complete user flow: uploading a file, seeing results, and potentially saving to a deck.

**Verification:** After Phase 3, run all automated tests. Perform final manual E2E testing to ensure the entire feature behaves correctly and gracefully handles errors.

## 7. Verification & Testing Strategy

*   **Manual Testing:** Perform thorough manual testing after each phase, covering various file types, sizes, successful paths, error conditions (invalid files, API errors, page limits), and edge cases.
*   **Automated Testing:** Implement unit and integration tests as described in Phase 3. Ensure tests cover critical logic in services, hooks, and utils.
*   **Code Review:** Conduct code reviews after each significant set of changes or phase completion.
*   **Logging:** Monitor server and browser console logs during testing for unexpected errors or warnings.

## 8. Conclusion

By following this phased plan, the AI Flashcard Generation feature will be significantly refactored to improve its structure, maintainability, and testability, aligning it with project best practices and SOLID principles. This investment will make future development and enhancements easier and more reliable. 