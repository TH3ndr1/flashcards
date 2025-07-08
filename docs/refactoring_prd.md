# Product Requirements Document: Codebase Refactoring

## 1. Introduction and Goals

**1.1. Purpose:**
This document outlines the requirements and roadmap for a significant refactoring of the StudyCards application codebase. The primary goals are to improve code maintainability, scalability, developer experience, and performance by strategically leveraging modern state management and data fetching libraries.

**1.2. Goals:**
*   **Modernize State Management:** Transition towards more robust and efficient state management solutions, primarily using Zustand for client-side global and feature state, and TanStack Query for server state.
*   **Improve Data Fetching:** Replace manual data fetching logic with TanStack Query to simplify caching, synchronization, and updates of server data.
*   **Reduce Complexity:** Simplify complex custom hooks and components through targeted refactoring (e.g., state machines, reducers).
*   **Minimize Prop Drilling:** Employ techniques like scoped React Context or improved state management to reduce prop drilling in relevant feature areas.
*   **Enhance Developer Experience:** Make the codebase easier to understand, debug, and contribute to.
*   **Maintain/Improve Performance:** Ensure refactoring efforts contribute positively to application performance.
*   **Comprehensive Analysis:** Ensure the refactoring considers the full codebase for potential improvements, not just previously highlighted areas.

**1.3. Non-Goals:**
*   Introducing major new user-facing features (unless they are a direct, minor consequence of a refactoring).
*   Complete rewrite of the entire application. Refactoring will be incremental and targeted.

## 2. Guiding Principles

*   **Leverage Zustand:** Utilize Zustand for managing global and complex client-side state to simplify state logic and reduce the need for explicit React Context Providers where appropriate.
*   **Embrace TanStack Query:** Adopt TanStack Query as the primary solution for server state management, including data fetching, caching, and mutations.
*   **Incremental Refactoring:** Apply changes iteratively, focusing on one area or pattern at a time to manage risk and ensure stability.
*   **Testability:** Design refactored code with testability in mind.
*   **Documentation:** Update relevant project documentation to reflect changes made during refactoring.
*   **Clarity and Maintainability:** Prioritize solutions that make the codebase easier to understand and maintain in the long term.

## 3. Broader Codebase Analysis

A broader scan of the codebase was performed to identify additional opportunities for leveraging Zustand and TanStack Query.

**Key Findings:**

*   **Custom Data Fetching Hooks:** Several custom hooks follow a similar pattern of fetching data via Server Actions and managing `isLoading`, `error`, and `data` states manually.
    *   `hooks/useDecks.ts`: Fetches a list of decks.
    *   `hooks/useStudySets.ts`: Fetches user's study sets.
    *   `hooks/useTags.ts`: Fetches all global tags.
    *   These are prime candidates for `useQuery` from TanStack Query to handle server state.

*   **Client Components with Manual State Sync:**
    *   `components/tags/TagManagerClient.tsx`: Receives initial tags and manages a local copy. After creating or deleting a tag via a Server Action, it manually updates its local state. This can be simplified by using `useMutation` and query invalidation.
    *   Other client components like `components/study/StudySetListClient.tsx` receive initial data. The page components rendering them (e.g., `app/practice/sets/page.tsx`) are responsible for the initial fetch and would benefit from using TanStack Query-powered hooks.

*   **Server Actions for Data Retrieval:** The `lib/actions/` directory contains numerous Server Actions that are used for data fetching (e.g., `getDecks`, `getUserStudySets`, `getTags`, `getUserSettings`, `getDeck`). These actions will become the `queryFn` for TanStack Query's `useQuery`. Mutation actions (create, update, delete) will be used in `useMutation`.

*   **Global State Providers:**
    *   `providers/settings-provider.tsx` (React Context): Fetches and provides global user settings. Candidate for Zustand store + TanStack Query for data fetching.
    *   `hooks/use-auth.tsx` (React Context for Auth): Manages user session. Candidate for Zustand store.

*   **Complex Feature Hooks:**
    *   `hooks/useStudySession.ts`: Complex lifecycle and state. Already targeted for state machine refactoring.
    *   `app/prepare/ai-generate/useAiGenerate.ts`: Multi-step process with complex state. Already targeted for `useReducer`.
    *   `app/edit/[deckId]/useEditDeck.ts`: Manages deck editing, including fetching initial deck data (candidate for `useQuery`) and handling card/tag modifications (candidates for `useMutation`). Prop drilling here is already targeted for scoped React Context.

**Conclusion:** The analysis confirms the significant potential for TanStack Query to simplify data fetching, caching, and synchronization across many parts of the application. Zustand offers a viable path to streamline global state management and reduce reliance on React Context providers. The initially identified complex hooks remain key targets for their specific refactoring strategies. These findings will be incorporated into the detailed refactoring items.

## 4. Roadmap

The refactoring will be approached in phases:

*   **Phase 1: Integrate TanStack Query (Core Setup & Initial Hook)**
*   **Phase 2: Refactor `useStudySession.ts` (State Machine Implementation)**
*   **Phase 3: Refactor `useAiGenerate.ts` (`useReducer` Implementation)**
*   **Phase 4: Address Prop Drilling in Deck Editing (Scoped Context)**
*   **Phase 5: Evaluate & Refactor Global State Management (Zustand for Settings/Auth)**
*   **Phase 6: Comprehensive Code Review, Documentation Update & Final Review**

## 5. Detailed Refactoring Items

*(This section will be populated based on the roadmap phases and the broader codebase analysis. Each item will include: Problem Statement, Proposed Solution, Impacted Files, and Specific Changes.)*

### 5.1. Phase 1: Integrate TanStack Query

**Goal:** Replace manual server state management (loading, error, data states) with TanStack Query for improved caching, background updates, and reduced boilerplate.

*   **5.1.1. Initial Setup & Provider**
    *   **Problem:** TanStack Query requires a `QueryClient` and `QueryClientProvider` at the root of the application.
    *   **Proposed Solution:** Install `@tanstack/react-query` and add the `QueryClientProvider` to the application's layout. Optionally add `ReactQueryDevtools`.
    *   **Impacted Files:**
        *   `package.json`: Add `@tanstack/react-query`.
        *   `app/layout.tsx` or `components/ClientProviders.tsx`: Wrap children with `<QueryClientProvider client={queryClient}>`.
    *   **Specific Changes:**
        *   Run `pnpm add @tanstack/react-query`.
        *   Instantiate `const queryClient = new QueryClient()` and provide it.

*   **5.1.2. Refactor `hooks/useDecks.ts`**
    *   **Problem:** `hooks/useDecks.ts` manually manages `isLoading`, `error`, and `decks` state for fetching deck lists via the `getDecks` server action.
    *   **Proposed Solution:** Use `useQuery` to handle fetching and server state.
    *   **Impacted Files:**
        *   `hooks/useDecks.ts`: Replace `useState`, `useEffect`, and `useCallback` for fetching logic with `useQuery`. The `queryFn` will be `getDecks`.
        *   Components consuming `useDecks` (e.g., `components/DeckListClient.tsx`, `app/manage/decks/page.tsx` via its client component): Adapt to the new data structure/state flags provided by TanStack Query (e.g., `data`, `isLoading`, `isError`).
    *   **Specific Changes:**
        *   Import `useQuery` from `@tanstack/react-query`.
        *   Define `useQuery({ queryKey: ['decks'], queryFn: getDecks })`.
        *   Return `data`, `isLoading`, `isError`, `error`, `refetch` from the hook.

*   **5.1.3. Refactor `hooks/useStudySets.ts`**
    *   **Problem:** Similar to `useDecks.ts`, `hooks/useStudySets.ts` manually manages state for fetching study sets via `getUserStudySets` server action.
    *   **Proposed Solution:** Use `useQuery`.
    *   **Impacted Files:**
        *   `hooks/useStudySets.ts`: Refactor to use `useQuery({ queryKey: ['studySets'], queryFn: getUserStudySets })`.
        *   Components consuming `useStudySets` (e.g., `app/practice/sets/page.tsx` which passes data to `components/study/StudySetListClient.tsx`, `app/practice/select/page.tsx`): Adapt to new hook interface.
    *   **Specific Changes:** Similar to `useDecks.ts` refactoring.

*   **5.1.4. Refactor `hooks/useTags.ts` and `components/tags/TagManagerClient.tsx`**
    *   **Problem:** `hooks/useTags.ts` manually fetches tags. `TagManagerClient.tsx` receives initial tags but then manages its own local copy, manually updating it after create/delete actions.
    *   **Proposed Solution:**
        *   Refactor `hooks/useTags.ts` to use `useQuery({ queryKey: ['tags'], queryFn: getTags })`.
        *   Refactor `TagManagerClient.tsx`:
            *   Remove local `allTags` state management.
            *   Use the `data` from the refactored `useTags` (or the page component using it).
            *   Use `useMutation` for `createTag` and `deleteTag` server actions.
            *   In `onSuccess` of mutations, call `queryClient.invalidateQueries({ queryKey: ['tags'] })` to automatically refetch and update the tag list.
    *   **Impacted Files:**
        *   `hooks/useTags.ts`
        *   `components/tags/TagManagerClient.tsx`
        *   `app/tags/page.tsx` (will use the refactored `useTags` hook).
    *   **Specific Changes:**
        *   `useTags.ts`: Implement `useQuery`.
        *   `TagManagerClient.tsx`: Remove `useState` for `allTags`. Import `useMutation`, `useQueryClient`. Implement mutations for `createTag`, `deleteTag`. Call `invalidateQueries` in `onSuccess`.

*   **5.1.5. Refactor Initial Data Load in `app/edit/[deckId]/useEditDeck.ts`**
    *   **Problem:** `useEditDeck.ts` fetches initial deck data using `getDeck` (from `useDecks.ts`) and manages loading/error states.
    *   **Proposed Solution:** Directly use `useQuery` within `useEditDeck.ts` for fetching the single deck data.
    *   **Impacted Files:**
        *   `app/edit/[deckId]/useEditDeck.ts`: Replace manual fetch for `getDeck(deckId)` with `useQuery({ queryKey: ['deck', deckId], queryFn: () => getDeck(deckId), enabled: !!deckId })`.
    *   **Specific Changes:**
        *   The `getDeck` function itself (likely within `lib/actions/deckActions.ts`, though `useDecks.ts` was its previous consumer) should be directly callable.
        *   Update `useEditDeck.ts` to handle `data`, `isLoading`, `isError` from `useQuery`.
        *   Future: Mutations for card/tag updates within `useEditDeck.ts` will also use `useMutation`.

*   **5.1.6. (Placeholder for further analysis) Other Data Fetching Hooks/Components**
    *   **Problem:** Other areas identified during broader analysis might also use manual data fetching.
    *   **Proposed Solution:** Systematically review and refactor other identified data fetching points (e.g., in `app/profile/page.tsx`, other client components) to use TanStack Query.
    *   **Impacted Files:** To be determined based on deeper dives into those specific files.

### 5.2. Phase 2: Refactor `useStudySession.ts`

**Goal:** Reduce the complexity of `useStudySession.ts` by managing its intricate lifecycle and states using a formal state machine.

*   **5.2.1. Design the Study Session State Machine**
    *   **Problem:** `useStudySession.ts` currently uses multiple `useState` and `useEffect` hooks to manage complex states (initializing, loading, card display, answer processing, phase transitions in 'unified' mode, completion) and orchestrate various helper modules and server actions. This leads to scattered logic and makes the overall flow hard to follow and maintain.
    *   **Proposed Solution:** Define a formal state machine (preferably using XState, or a `useReducer`-based implementation as a fallback) that models all possible states and transitions of a study session.
    *   **Impacted Files:**
        *   `lib/study/studySessionMachine.ts` (New file): This file will contain the definition of the state machine.
    *   **Specific Changes:**
        *   **Identify States:** Based on `hooks/useStudySession.ts` and `docs/codebase_analysis_and_recommendations.md` (Section 3.1), define states like: `idle`, `initializingParameters`, `resolvingCardIds`, `fetchingCardData`, `queueReady`, `displayingQuestion`, `displayingAnswer`, `processingAnswer`, `persistingProgress`, `determiningNextCard`, `unifiedPhaseTransitionPrompt`, `sessionComplete`, `error`.
        *   **Identify Events:** Define events that trigger transitions (e.g., `START_SESSION`, `CARD_IDS_RESOLVED`, `CARD_DATA_FETCHED`, `FLIP_CARD`, `ANSWER_SUBMITTED`, `PROGRESS_SAVED`, `CONTINUE_TO_REVIEW`, `NO_MORE_CARDS`).
        *   **Define Context:** The machine's context will hold `sessionInput`, `sessionType`, `settings`, `sessionQueue`, `currentCardIndex`, `internalCardStates`, `sessionResults`, `errorDetails`, `unifiedSessionPhase`.
        *   **Define Actions & Services:**
            *   **Actions (synchronous context updates):** `assignToContext` (for various data), `updateQueue`, `setNextCardIndex`, `updateResults`.
            *   **Services (asynchronous operations):** `resolveCardIdsService` (calls `resolveStudyQuery`), `fetchCardDataService` (calls `getCardsByIds`), `persistProgressService` (calls `updateCardProgress`).
            *   Logic from `lib/study/card-state-handlers.ts` will be invoked during transitions (e.g., on `ANSWER_SUBMITTED`) to determine `CardStateUpdateOutcome`, which then informs context updates and the `persistProgressService`.
            *   Logic from `lib/study/session-queue-manager.ts` will be used by actions/services to initialize and update the `sessionQueue`.

*   **5.2.2. Implement State Machine in `useStudySession.ts`**
    *   **Problem:** The existing hook's logic needs to be replaced by the state machine.
    *   **Proposed Solution:** Refactor `useStudySession.ts` to use the `useMachine` hook (from `@xstate/react` if XState is chosen) or `useReducer` to run the defined state machine.
    *   **Impacted Files:**
        *   `hooks/useStudySession.ts`: Major rewrite of its internal logic.
        *   Components consuming `useStudySession` (e.g., `app/study/session/page.tsx`, `components/study/StudyFlashcardView.tsx`): May need minor adaptations if the hook's returned interface changes, but the goal is to keep it largely compatible.
    *   **Specific Changes:**
        *   Import `useMachine` and the `studySessionMachine` definition.
        *   Instantiate the machine: `const [state, send] = useMachine(studySessionMachine, { context: { initialInput, sessionType, settings } });`.
        *   Replace internal `useState` and `useEffect` logic with dispatching events (`send({ type: 'EVENT_NAME', payload: ... })`) to the machine.
        *   Derive the hook's return values (e.g., `currentCard`, `isLoading`, `isComplete`, `sessionResults`) from the machine's `state.value` (current state name) and `state.context`.
        *   Ensure all existing functionalities (different session types, unified flow, TTS integration triggers, error handling) are correctly managed by the state machine's logic.

### 5.3. Phase 3: Refactor `app/prepare/ai-generate/useAiGenerate.ts`

**Goal:** Simplify state management within the `useAiGenerate.ts` hook by consolidating multiple `useState` calls into a single `useReducer`.

*   **5.3.1. Design Reducer for AI Generation State**
    *   **Problem:** `useAiGenerate.ts` manages numerous state variables (file list, loading states for different steps, error messages, flashcards at various stages, deck name, etc.) using individual `useState` hooks. This makes the state logic dispersed and harder to track.
    *   **Proposed Solution:** Define a single state object and a reducer function to manage all state transitions for the AI generation process.
    *   **Impacted Files:**
        *   `app/prepare/ai-generate/useAiGenerate.ts` (primarily, or a new `aiGenerateReducer.ts` if preferred).
    *   **Specific Changes:**
        *   **Define State Shape:** Consolidate all existing `useState` variables from `useAiGenerate.ts` into a single interface (e.g., `AiGenerateState`). This state should track an array or map of files, each with its `id`, `fileObject`, `status` (enum: `idle`, `uploading`, `extractingText`, `generatingInitialCards`, `awaitingModeConfirmation`, `classifyingCards`, `regeneratingKnowledgeCards`, `error`, `completedStep1`), `extractedText`, `basicFlashcards`, `finalFlashcards`, `errorMessage`. Also include global states like `isSavingDeck`, `deckName`, `overallError`.
        *   **Define Action Types:** Create a comprehensive list of action types corresponding to all possible state changes (e.g., `ADD_FILES`, `FILE_UPLOAD_START`, `FILE_UPLOAD_SUCCESS`, `API_STEP1_START`, `API_STEP1_SUCCESS`, `API_STEP1_ERROR`, `MODE_CONFIRMATION_NEEDED`, `API_STEP2_CLASSIFY_START`, `API_STEP2_CLASSIFY_SUCCESS`, `API_STEP2_FORCE_KNOWLEDGE_START`, `API_STEP2_FORCE_KNOWLEDGE_SUCCESS`, `UPDATE_DECK_NAME`, `SAVE_DECK_START`, `SAVE_DECK_SUCCESS`, `SAVE_DECK_ERROR`, `CLEAR_STATE`).

*   **5.3.2. Implement `useReducer` in `useAiGenerate.ts`**
    *   **Problem:** The current hook's state update logic is spread across various event handlers and asynchronous callbacks.
    *   **Proposed Solution:** Replace multiple `useState` calls with a single `useReducer` hook. Centralize state update logic within the reducer function.
    *   **Impacted Files:**
        *   `app/prepare/ai-generate/useAiGenerate.ts`: Major refactoring of state management.
        *   Components consuming `useAiGenerate.ts` (e.g., `AiGenerateInputCard.tsx`, `AiGenerateResultsCard.tsx`, `AiGenerateSaveDeckCard.tsx`): Adapt to any changes in how state is exposed or actions are dispatched via the hook.
    *   **Specific Changes:**
        *   In `useAiGenerate.ts`, implement the `aiGenerateReducer(state, action)` function using a `switch` statement for the defined action types. Ensure all state updates are immutable.
        *   Replace `useState` calls with `const [state, dispatch] = useReducer(aiGenerateReducer, initialState);`.
        *   Modify event handlers and asynchronous operation callbacks (e.g., `handleSubmit`, `handleConfirmTranslation`, `handleForceKnowledge`, `handleSaveDeck`) to `dispatch` actions instead of calling individual `set` functions.
        *   The hook will return values derived from the `state` object and functions that `dispatch` actions.

### 5.4. Phase 4: Address Prop Drilling in Deck Editing (`app/edit/[deckId]/`)

**Goal:** Mitigate prop drilling within the deck editing feature by introducing a scoped React Context.

*   **5.4.1. Define and Provide Scoped `DeckEditContext`**
    *   **Problem:** The `app/edit/[deckId]/page.tsx` component, using `useEditDeck.ts`, passes various data (deck object, cards, tags) and functions (for updating metadata, cards, tags) down to multiple nested components like `DeckMetadataEditor.tsx`, `EditableCardTable.tsx`, and potentially `CardEditor.tsx`. This creates prop drilling.
    *   **Proposed Solution:** Create a `DeckEditContext` that is provided by `app/edit/[deckId]/page.tsx` and consumed by the necessary child components.
    *   **Impacted Files:**
        *   `app/edit/[deckId]/DeckEditContext.tsx` (New file): Define the context (e.g., `DeckEditContext`) and its associated type (e.g., `DeckEditContextType`). The type should include the deck data, card list, tag list, and relevant action handlers from `useEditDeck.ts`.
        *   `app/edit/[deckId]/page.tsx`: Import and provide `DeckEditContext`. The value for the provider will come from the `useEditDeck.ts` hook.
    *   **Specific Changes:**
        *   Create `DeckEditContext.tsx` with `React.createContext()`.
        *   In `page.tsx`, wrap the main content with `<DeckEditContext.Provider value={contextValueFromUseEditDeck}>`.

*   **5.4.2. Update Child Components to Consume Context**
    *   **Problem:** Child components currently receive deck editing data and functions via props.
    *   **Proposed Solution:** Modify child components to use `useContext(DeckEditContext)` to access the shared data and functions.
    *   **Impacted Files:**
        *   `app/edit/[deckId]/DeckMetadataEditor.tsx`
        *   `app/edit/[deckId]/EditableCardTable.tsx`
        *   `app/edit/[deckId]/CardViewTabContent.tsx` (if it passes such props further down)
        *   `components/deck-tag-editor.tsx` (when used within the edit page)
        *   Any `CardEditor.tsx` or similar components used within this feature.
    *   **Specific Changes:**
        *   For each relevant child component:
            *   Import `useContext` and `DeckEditContext`.
            *   Call `const deckEditData = useContext(DeckEditContext);`
            *   Access necessary data (e.g., `deckEditData.deck`, `deckEditData.updateCard`) from the context.
            *   Remove the corresponding props from the component's props interface and its invocations.

### 5.5. Phase 5: Evaluate & Refactor Global State Management (Zustand for Settings/Auth)

**Goal:** Transition global state management for Settings and Authentication from React Context Providers to Zustand stores to simplify state access, reduce provider nesting, and potentially improve performance.

*   **5.5.1. Refactor Settings Management to Zustand Store**
    *   **Problem:** `providers/settings-provider.tsx` uses React Context to provide global user settings. Data fetching (`getUserSettings`) and updates (`updateUserSettings`) are managed within this provider.
    *   **Proposed Solution:**
        *   Create a Zustand store (`store/settingsStore.ts`) to hold user settings.
        *   The store will manage its own state (`settings`, `isLoading`, `error`).
        *   Fetching initial settings: The store can expose an async action that uses TanStack Query's `queryClient.fetchQuery` or a `useQuery` hook internally (if the store is a custom hook itself) to call `getUserSettings`. This action would be called once when the app loads or when a user logs in.
        *   Updating settings: The store will expose an async action that uses TanStack Query's `useMutation` (or `queryClient.executeMutation`) to call `updateUserSettings`. On success, it will update its local state and invalidate relevant queries.
    *   **Impacted Files:**
        *   `store/settingsStore.ts` (New file): Define the Zustand store, state, and actions.
        *   `providers/settings-provider.tsx`: To be deprecated and removed.
        *   Components currently using `useSettings()`: Update to import and use `useSettingsStore()`.
        *   `app/layout.tsx` or `components/ClientProviders.tsx`: Remove `<SettingsProvider>` wrapper.
    *   **Specific Changes:**
        *   Define `SettingsState` interface (settings, isLoading, error, methods like `fetchSettings`, `saveSettings`).
        *   Create store: `create<SettingsState>()(...)`.
        *   `fetchSettings` action: uses TanStack Query with `queryKey: ['userSettings']`, `queryFn: getUserSettings`. Updates store state on success/error.
        *   `saveSettings` action: uses TanStack Query mutation for `updateUserSettings`. Updates store state optimistically or on success. Invalidates `['userSettings']` query.
        *   Replace `useSettings` hook calls with `useSettingsStore`.

*   **5.5.2. Refactor Authentication Management to Zustand Store**
    *   **Problem:** `hooks/use-auth.tsx` provides an `AuthProvider` (React Context) to manage user session and authentication status from Supabase.
    *   **Proposed Solution:**
        *   Create a Zustand store (`store/authStore.ts`) to hold `user`, `session`, and `loading` state.
        *   The store will subscribe to Supabase's `onAuthStateChange` to keep its state synchronized.
        *   Authentication actions (`signIn`, `signUp`, `signOut`, `resetPassword`) will be methods of the store, directly calling Supabase client methods.
    *   **Impacted Files:**
        *   `store/authStore.ts` (New file): Define the Zustand store, state, and actions.
        *   `hooks/use-auth.tsx`: To be deprecated and removed (or the hook itself refactored to use the Zustand store if `useAuth` is preferred as the access pattern).
        *   Components currently using `useAuth()`: Update to import and use `useAuthStore()`.
        *   `app/layout.tsx` or `components/ClientProviders.tsx`: Remove `<AuthProvider>` wrapper.
    *   **Specific Changes:**
        *   Define `AuthState` interface (user, session, loading, methods like `signIn`, `signOut`, etc.).
        *   Create store: `create<AuthState>()(...)`.
        *   Initialize Supabase auth listener within the store setup (e.g., in the function passed to `create` or an init action).
        *   Auth methods in the store will call `supabase.auth.[method]` and update store state.

*   **5.5.3. Update Components and Remove Old Providers**
    *   **Problem:** Components need to be updated to use the new Zustand stores, and old Context Provider wrappers need to be removed.
    *   **Proposed Solution:** Systematically find all usages of `useSettings()` and `useAuth()` and replace them with their corresponding Zustand store hooks (e.g., `useSettingsStore()`, `useAuthStore()`). Remove `<SettingsProvider>` and `<AuthProvider>` from the component tree.
    *   **Impacted Files:**
        *   All components currently using `useSettings()` or `useAuth()`.
        *   `app/layout.tsx` or `components/ClientProviders.tsx`.
    *   **Specific Changes:**
        *   Search and replace hook usage.
        *   Delete provider wrappers.
        *   Thoroughly test all affected components and user flows (login, logout, settings changes, features relying on settings/auth state).

*   **5.5.4. (Analysis Dependent) Other Global State Opportunities for Zustand**
    *   **Problem:** Other pieces of global or cross-cutting client state might exist (e.g., `mobileSidebarStore` is already Zustand, but there could be others if the broader analysis uncovers them).
    *   **Proposed Solution:** If further analysis reveals other global state managed inefficiently (e.g., via prop drilling through many layers, or complex local state duplicated across features), evaluate if migrating them to existing or new Zustand stores is beneficial.
    *   **Impacted Files:** To be determined based on findings.

### 5.6. Phase 6: Comprehensive Code Review, Documentation Update & Final Review

**Goal:** Ensure all refactoring changes are well-documented, the codebase is clean, and a final review confirms the stability and correctness of the implemented changes.

*   **5.6.1. Update Project Documentation**
    *   **Problem:** Existing project documentation (e.g., `docs/project-documentation v4.md`, `docs/codebase_analysis_and_recommendations.md`, architecture diagrams) will be outdated after the refactoring.
    *   **Proposed Solution:** Review and update all relevant documentation to reflect the new state management patterns (Zustand, TanStack Query), refactored hooks (`useStudySession`, `useAiGenerate`), context usage (`DeckEditContext`), and any changes to data flow or component responsibilities.
    *   **Impacted Files:**
        *   `docs/project-documentation v4.md`: Update sections on State Management, Data Flow, Frontend Architecture, key hook descriptions, and component interactions.
        *   `docs/codebase_analysis_and_recommendations.md`: Mark implemented recommendations as complete or update their status.
        *   Any Mermaid diagrams depicting data flow or architecture.
        *   README.md or other developer guides if they detail state management or data fetching strategies.
    *   **Specific Changes:**
        *   Update descriptions of how settings and auth state are managed (Zustand stores).
        *   Describe the use of TanStack Query for server state.
        *   Detail the new structure of `useStudySession` (state machine) and `useAiGenerate` (`useReducer`).
        *   Explain the `DeckEditContext` for deck editing.
        *   Ensure consistency across all documents.

*   **5.6.2. Code Cleanup and Final Review**
    *   **Problem:** Refactoring can sometimes leave behind unused code, commented-out blocks, or inconsistencies.
    *   **Proposed Solution:**
        *   Perform a thorough code review of all changed files.
        *   Remove any dead code, old comments related to pre-refactor logic, and unnecessary console logs.
        *   Ensure consistent coding styles and adherence to best practices.
        *   Run linters and formatters.
        *   Manually test key user flows to catch any regressions.
        *   Verify that the application builds successfully and all automated tests (if any exist by then) pass.
    *   **Impacted Files:** Potentially any file touched during the refactoring process.
    *   **Specific Changes:**
        *   Code deletion, comment updates, style fixes.
        *   Address any new linter warnings or errors.

## 6. Success Metrics

*   Reduction in boilerplate code related to data fetching and client-side state management.
*   Improved Lighthouse scores or perceived performance in key user flows.
*   Reduction in complexity metrics (e.g., cyclomatic complexity) for refactored hooks/components.
*   Positive feedback from developers on improved readability and maintainability.
*   Number of React Context providers reduced (where appropriate).
*   Successful replacement of manual data fetching logic with TanStack Query.

## 7. Open Questions & Considerations

*   Specific XState vs. `useReducer` decision for `useStudySession` if XState introduces significant new dependency concerns.
*   Depth of TanStack Query adoption: Start with key areas, but how far do we extend it to every minor server interaction?
*   Impact on existing test suite and effort required for test updates.
*   Timeline and resource allocation for each phase.
*   Strategy for handling optimistic updates with TanStack Query and Server Actions.
*   Ensuring the "broader codebase analysis" (Step 3 in this PRD) is thorough before committing to detailed changes in phases 1-5.

---
*(Further details will be added as each section is developed)*
