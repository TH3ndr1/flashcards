# Manual Deck Editing Feature Refactoring Plan

**Version:** 1.0
**Date:** 2025-04-22
**Author:** Tom Hendrickx

## 1. Introduction & Overview

This document outlines a refactoring plan for the Manual Deck Editing feature within the StudyCards application. The primary goal is to address the high complexity and mixed concerns within the main page component, improving its structure, maintainability, testability, and adherence to established best practices and SOLID design principles.

**Target File:**
*   `app/edit/[deckId]/page.tsx`: The frontend Next.js page component responsible for fetching deck data, rendering the UI for editing deck settings (name, language) and cards (list view, table view), managing component state, handling user interactions (add/edit/delete cards, save settings, delete deck), orchestrating API calls via hooks/actions, and providing user feedback.

**Related Dependencies:**
*   `hooks/use-decks.ts`: Hook providing core deck CRUD operations (`getDeck`, `updateDeck`, `deleteDeck`).
*   `lib/actions/cardActions.ts`: Server actions for card CRUD operations (`createCardAction`, `updateCardAction`, `deleteCardAction` - assuming delete exists or needs to be added).
*   `lib/actions/deckActions.ts`: Server actions for deck CRUD operations.
*   `components/deck/EditableCardTable.tsx`: Component for table-based card editing.
*   `components/card-editor.tsx`: Component for individual card editing/creation form.
*   `components/ui/*`: Various Shadcn UI components.

**Target Audience:** This plan is intended for an AI development assistant or a human developer tasked with implementing the refactoring. It assumes the agent has access to the codebase.

## 2. Context

The Manual Deck Editing feature allows users to view and modify the details of a specific deck, including its name, language settings, and the flashcards contained within it. Users can switch between a card-by-card editor view and a table view for managing cards. Changes to deck settings are auto-saved with debouncing, while card changes might be saved immediately or upon explicit action depending on the component (`CardEditor` vs. `EditableCardTable`).

## 3. Problem Statement / Motivation

Analysis of the current implementation in `app/edit/[deckId]/page.tsx` reveals several challenges:

*   **Monolithic Component:** The page component handles an excessive number of responsibilities: data fetching, multiple pieces of state management (loading, error, saving, deck data, cards, UI state like active tab), complex event handling for both deck settings and card manipulations, orchestration of multiple server actions/hook calls, and rendering a complex UI with conditional views.
*   **Violation of SOLID Principles:** Primarily violates the **Single Responsibility Principle (SRP)**. Logic for deck settings, card management, UI state, and data fetching are tightly coupled within one large component.
*   **Mixed Concerns:** Presentation logic (JSX, UI state), business logic (state updates, validation rules - implicit, debouncing), and data layer interaction (calling hooks/actions) are heavily intertwined.
*   **Complex State Management:** Relies on numerous `useState` hooks for related pieces of state. The `DeckEditState` type attempts to manage the combined state, highlighting the complexity. Managing optimistic updates or syncing state between different views (CardEditor list vs. Table) can become difficult. The `isMountedRef` usage, while functional, can sometimes indicate overly complex effect management.
*   **Poor Maintainability:** The component's size and complexity make it difficult to understand, debug, or modify without risking unintended side effects. Adding new features (e.g., bulk card actions) would be challenging.
*   **Limited Testability:** The core logic is embedded within the component, making isolated unit testing difficult. Testing requires rendering the entire component and mocking numerous dependencies.
*   **Deviation from Best Practices:** Violates guidelines from `docs/best-practices.md` regarding component simplicity ("Dumb" components), clear separation of concerns, and potentially consolidating related state.

## 3.1 Detailed Analysis (SOLID & Best Practices)

This section provides a more detailed look at the key files involved, evaluating them against SOLID principles and the project's best practices (`docs/best-practices.md`).

### `lib/actions/deckActions.ts` (Server Actions)

*   **SOLID Principles:**
    *   **SRP (Single Responsibility Principle):** Generally well-adhered to at the function level. Each action (`getDeckName`, `getDecks`, `createDeck`, `updateDeck`, `deleteDeck`) handles a distinct operation related to decks. They encapsulate logic for Supabase interaction, auth checks, validation (Zod), and result/error handling for that action. This structure is suitable for server actions.
    *   **OCP (Open/Closed Principle):** Moderately adhered to. The module allows adding new deck-related actions (open for extension), but modifying existing actions requires changing their code (closed for modification is ideal). Dependency Injection isn't explicitly used; actions directly call `createActionClient`. While common in simpler server action setups, this could be improved for testability if dependencies become more complex.
    *   **LSP (Liskov Substitution Principle):** Not applicable (no class inheritance hierarchy).
    *   **ISP (Interface Segregation Principle):** Not directly applicable (no client-implemented interfaces). The `ActionResult` type provides a consistent return shape.
    *   **DIP (Dependency Inversion Principle):** Violated. Actions depend directly on the concrete `createActionClient` implementation and specific Supabase client methods (`from`, `select`, `eq`, etc.). Ideally, they'd depend on abstractions (e.g., interfaces defining data access methods like `findDeckById`, `saveDeck`). This would allow different storage implementations or easier mocking. However, given the tight coupling expected between server actions and a specific backend (Supabase), this might be an acceptable trade-off, balanced against the complexity of introducing an abstraction layer. The primary testing strategy might rely more on integration tests with a test database.
*   **Best Practices & Custom Instructions:**
    *   **Structure:** Correctly placed in `lib/actions` with `'use server';` directive.
    *   **Types:** Excellent use of `Tables<>`, `ActionResult`, and Zod schemas (`createDeckSchema`, `updateDeckSchema`) for strong typing and validation.
    *   **Error Handling:** Good use of `try...catch`, the `{ data, error }` pattern for returns, and `console.error` logging.
    *   **Security:** Correctly performs user authentication checks (`supabase.auth.getUser()`) and includes `user_id` filters in queries.
    *   **Clarity & Readability:** Well-formatted, uses `async/await`, clear naming (`snake_case`), and includes helpful logging.
    *   **Revalidation:** Appropriately uses `revalidatePath` after mutations.
    *   **Constants:** No obvious magic strings/numbers.

### `app/edit/[deckId]/page.tsx` (Page Component - *Based on Problem Statement*)

*   **SOLID Principles:**
    *   **SRP:** Heavily Violated. As noted in the Problem Statement, this component mixes responsibilities: fetching data, managing complex state (deck settings, cards, UI state like tabs, loading/error/saving flags), handling user interactions for multiple distinct features (deck settings updates, card CRUD), orchestrating API calls, and rendering the entire UI.
    *   **OCP:** Poorly adhered to. Adding new features or modifying existing ones (e.g., changing card editing logic, adding bulk actions) likely requires significant modification of this large component, increasing the risk of regressions.
    *   **LSP:** Not applicable.
    *   **ISP:** Not directly applicable, but the component likely consumes large, complex props or context values if helper components are used, potentially violating the spirit of the principle.
    *   **DIP:** Violated. Directly depends on concrete hooks (`useDecks` - assumed) and server actions (`deckActions`, `cardActions`). It also likely depends directly on UI component implementations (`EditableCardTable`, `CardEditor`, Shadcn components). It doesn't depend on abstractions, making it hard to test in isolation or swap implementations.
*   **Best Practices & Custom Instructions:**
    *   **Structure:** Acts as a "smart" or container component, which is acceptable at the page level, but its scope is too broad.
    *   **Component Design:** Violates the "Keep Components Simple ('Dumb')" principle (`docs/best-practices.md#7`). It's far from being purely presentational.
    *   **State Management:** Over-reliance on multiple `useState` hooks for related state leads to complexity. The `DeckEditState` type hints at this complexity. Doesn't follow the "Consolidate State" recommendation (`docs/best-practices.md#12`) effectively. Potential issues with state synchronization between different views (list vs. table).
    *   **Separation of Concerns:** Poor separation between presentation (JSX), business logic (state updates, debouncing, event handling), and data layer interaction (hook/action calls), as highlighted in `docs/best-practices.md#separation-of-concerns`.
    *   **`useEffect`:** Likely has complex `useEffect` hooks for data fetching, debouncing, and potentially managing refs like `isMountedRef`, indicating potential areas for simplification via custom hooks (`docs/best-practices.md#15`).
    *   **Testing:** Difficult to unit test due to the tight coupling and mixed concerns.

### `app/api/decks/[deckId]/name/route.ts` (API Route Handler)

*   **SOLID Principles:**
    *   **SRP:** Generally well-adhered to. This route handler has a single responsibility: handling GET requests to fetch the name of a specific deck for the authenticated user.
    *   **OCP:** Moderately adhered to. It's closed for modification regarding its core function, but extending it (e.g., adding PUT/POST) would require changes. Uses concrete `createRouteHandlerClient`.
    *   **LSP:** Not applicable.
    *   **ISP:** Not applicable.
    *   **DIP:** Violated. Directly depends on the concrete `createRouteHandlerClient` from `@supabase/auth-helpers-nextjs` and the Supabase client API. It doesn't depend on abstractions for data access or authentication.
*   **Best Practices & Custom Instructions:**
    *   **Structure:** Correctly placed within `app/api/`. Uses standard `Request` and `NextResponse`.
    *   **Types:** Uses basic types (`Request`, `NextResponse`, inferred Supabase types). Could potentially benefit from explicit `Tables<>` types if complexity increased.
    *   **Error Handling:** Good use of `try...catch`, checks for `deckId`, handles auth errors, checks Supabase errors (including specific code `PGRST116` for not found), and returns appropriate status codes (400, 401, 404, 500). Logging is present.
    *   **Security:** Correctly checks for an authenticated session (`supabase.auth.getSession()`) and includes `user_id` in the Supabase query.
    *   **Clarity:** Code is relatively straightforward and readable.
    *   **Dependency:** Uses `createRouteHandlerClient` from `@supabase/auth-helpers-nextjs`. Note that `docs/best-practices.md#25` recommends using the newer `@supabase/ssr` package for potentially better cookie handling, although `auth-helpers` might still function correctly.
    *   **Constants:** No obvious magic strings/numbers.

## 4. Objectives

The primary objectives of this refactoring effort are to:

1.  **Improve Modularity:** Break down the monolithic page component into smaller, more focused hooks and potentially UI sub-components.
2.  **Enhance Separation of Concerns:** Clearly separate presentation logic (UI rendering), state management/business logic (handling deck and card data, updates, debouncing), and data layer interaction (API calls).
3.  **Adhere to SOLID Principles:** Restructure the code, primarily focusing on achieving SRP for the page component and extracted hooks/components.
4.  **Increase Maintainability:** Make the code easier to understand, modify, and debug by reducing complexity and coupling.
5.  **Improve Testability:** Enable effective unit testing of the extracted logic within custom hooks.
6.  **Align with Best Practices:** Ensure the code follows the guidelines outlined in `docs/best-practices.md`, especially regarding component design and state management.

## 5. Guiding Principles

*   **SOLID Principles:** Especially SRP. The page component should primarily orchestrate hooks and render UI.
*   **`docs/best-practices.md`:** Reference for coding standards, component design, state management, and hook usage.
*   **Custom Hooks:** Leverage custom hooks to encapsulate related state and logic.
*   **Readability & Simplicity:** Favor clear, understandable code over complex inline logic.

## 6. Action Plan

This plan follows a phased approach, focusing on extracting logic into hooks and simplifying the main page component. **Before making changes in each step, carefully read the existing code to understand its current function.** The steps explicitly aim to address the SOLID violations and best practice deviations identified in Section 3.1.

---

### Phase 1: Foundational Cleanup & UI Component Extraction (Low-Medium Complexity)

**Goal:** Break down the UI into more manageable pieces and potentially simplify state typing. This directly targets the **Single Responsibility Principle (SRP)** violation in `page.tsx` by separating purely presentational concerns.

**Steps:**

1.  **Extract UI Sub-Components (Optional but Recommended):**
    *   Analyze the JSX in `page.tsx`. Identify logical, self-contained UI sections that could become separate presentational components. Examples:
        *   `DeckSettingsForm`: Contains the deck name input, bilingual switch, and language selects. Receives deck settings state (`name`, `isBilingual`, `primaryLang`, `secondaryLang`) and callbacks (`onNameChange`, `onBilingualChange`, `onPrimaryLangChange`, `onSecondaryLangChange`) as props.
        *   `CardListView`: Renders the list of `CardEditor` components. Receives the `cards` array and potentially callbacks for add/update/delete if not handled by `CardEditor` itself.
        *   `TableView`: Renders the `EditableCardTable`. Receives `cards`, `deckId`, and `onCardUpdated` callback.
        *   `DangerZone`: Renders the delete button and confirmation dialog trigger. Receives `deckName` and `onDeleteDeck` callback.
    *   Create these components within `components/deck/` or similar.
    *   Refactor `page.tsx` to use these components, passing necessary data and callbacks. This simplifies the main component's render method and improves **SRP** and **Separation of Concerns**.

2.  **Review and Refine Types:**
    *   Re-evaluate `DeckEditState`. Consider if separating deck settings state from card state within the component or hooks would simplify typing and state management. Ensure consistent use of `Tables<'decks'>` and `Tables<'cards'>`.

3.  **Consolidate Simple State (If Applicable):**
    *   Review simple boolean flags (`saving`, `isDeleting`). If their logic becomes complex or intertwined, consider consolidating them into a single status state (`'idle' | 'loading' | 'savingSettings' | 'deletingDeck' | 'error'`) as suggested in `best-practices.md`. This might be deferred to Phase 2 when logic is moved to hooks.

**Verification:** After Phase 1, run the application and manually test the deck editing flow. Ensure all UI elements render correctly, deck settings can be modified, cards are displayed in both views, and the delete confirmation appears. Check for console errors. Verify the page component's rendering logic is simpler.

---

### Phase 2: Logic Extraction into Custom Hooks (High Complexity)

**Goal:** Move the core state management, data fetching, event handling logic, and API orchestration out of the page component into dedicated custom hooks. This is the primary step to fix the **SRP** and **DIP** violations in `page.tsx`, address **complex state management**, and improve **testability** and **maintainability**.

**Steps:**

1.  **Create `useEditableDeck` Hook:**
    *   Create `lib/hooks/useEditableDeck.ts`.
    *   **Responsibilities:** Encapsulates all logic related to fetching and managing the deck *settings* itself.
        *   Fetching the initial deck data (`getDeck(deckId)` - dependency inversion starts here, hook depends on action/API call).
        *   Managing loading and error states related to deck fetching (`loading`, `error`).
        *   Managing the core deck settings state (`name`, `is_bilingual`, `primary_language`, `secondary_language`).
        *   Handling updates to deck settings, including the debouncing logic (`debouncedUpdateDeckSettings` internal to the hook, calling `updateDeck` action).
        *   Handling the deck deletion process (calling `deleteDeck` action).
        *   Providing a refetch mechanism (`refetchDeck`).
    *   **Interface:**
        *   Input: `deckId: string`.
        *   Output: `{ deckSettings: DeckSettingsState | null, isLoadingDeck: boolean, deckError: string | null, updateDeckSetting: (field: keyof DeckSettingsState, value: any) => void, deleteDeck: () => Promise<void>, refetchDeck: () => Promise<void> }` (adjust exact output as needed).
    *   Refactor `page.tsx` to use this hook for deck-level data and operations. Remove the corresponding `useState`, `useEffect` for initial load/debouncing, `handleNameChange`, `handleDeleteDeck`, and related logic from the page component. This significantly improves **SRP** for the page.

2.  **Create `useCardManagement` Hook:**
    *   Create `lib/hooks/useCardManagement.ts`.
    *   **Responsibilities:** Encapsulates all logic related to managing the *cards* within the deck.
        *   Managing the state of the cards (`cards: Partial<DbCard>[]`). This state should be initialized perhaps by `useEditableDeck` or fetched separately if needed.
        *   Handling adding a new (unsaved) card to the local state (`addOptimisticCard`).
        *   Handling the creation of a new card via server action (calling `createCardAction`), including updating local state.
        *   Handling updates to existing cards via server action (calling `updateCardAction`), including potential optimistic updates and state reconciliation.
        *   Handling the deletion of a card via server action (calling `deleteCardAction`), including updating local state.
        *   Providing state and functions to interact with cards.
    *   **Interface:**
        *   Input: `initialCards: Partial<DbCard>[]`, `deckId: string`, `userId: string`.
        *   Output: `{ cards: Partial<DbCard>[], addCardPlaceholder: () => void, createCard: (q: string, a: string) => Promise<string | null>, updateCard: (id: string, q: string, a: string) => Promise<void>, deleteCard: (id: string) => Promise<void> }` (adjust exact output).
    *   Refactor `page.tsx` to use this hook for card data and operations. Remove `useState` for cards, `handleAddCard`, `handleCreateCard`, `handleUpdateCard`, `handleDeleteCard` from the page. Pass the necessary functions down to `CardListView`/`CardEditor` and `TableView`/`EditableCardTable`. This further improves **SRP** for the page and isolates card logic.
    *   **Note:** Consider how state updates from `EditableCardTable` (`onCardUpdated`) integrate with this hook. The hook might need a function like `syncCardUpdate(updatedCard: DbCard)` called by the page.

3.  **Simplify Page Component:**
    *   The `app/edit/[deckId]/page.tsx` component should now primarily:
        *   Call `useEditableDeck` and `useCardManagement` (acting as an orchestrator).
        *   Handle top-level loading/error states derived from the hooks.
        *   Render the extracted UI components (from Phase 1) or standard components (`Tabs`, `Button`, etc.).
        *   Pass state and callbacks from the hooks down to the child components (following prop drilling or context patterns as appropriate).
        *   Manage minimal UI state (e.g., `activeTab`).
    *   This aligns the page component more closely with the role of a container/smart component, delegating most work.

**Verification:** After Phase 2, repeat intensive manual testing. Verify:
*   Initial deck load works.
*   Deck settings changes are reflected in the UI and auto-saved correctly (check network tab/db).
*   Cards can be added, edited (in both views), and deleted, with changes persisted and UI updated correctly.
*   Deck deletion works.
*   Loading and error states are handled gracefully.
*   Check browser and server console logs.
*   Confirm the page component code is substantially simpler and focused on orchestration.

---

### Phase 3: Refinement & Testing (Medium Complexity)

**Goal:** Polish the implementation, improve error handling, add automated tests for the new hooks (addressing testability concerns), and ensure alignment with best practices.

**Steps:**

1.  **Refine State Management (Within Hooks):**
    *   Review the state logic within `useEditableDeck` and `useCardManagement`. If state transitions are complex (e.g., managing optimistic updates, loading states per card), consider using `useReducer` *inside* the hooks for more robust and predictable state updates, aligning with state management best practices (`docs/best-practices.md#11`, `#12`).

2.  **Enhance Error Handling:**
    *   Ensure consistent error handling patterns within the hooks.
    *   Propagate errors effectively so the UI can display meaningful feedback (using toasts, inline messages).
    *   Consider specific error types if beneficial.

3.  **Add Automated Tests:**
    *   **Unit Tests:** Write unit tests for:
        *   Any extracted presentational UI components (Phase 1).
        *   `useEditableDeck` hook: Mock the dependencies (`getDeck`, `updateDeck`, `deleteDeck` actions/API calls) and test state transitions, debouncing logic, and function outputs. This verifies the hook's logic independently.
        *   `useCardManagement` hook: Mock the dependencies (`cardActions`) and test card state manipulation, optimistic updates (if implemented), and function outputs.
    *   **Integration Tests (Optional but Recommended):**
        *   Test the interaction between the simplified `page.tsx` and the hooks it uses. Verify that calling hook functions correctly triggers state updates reflected in the rendered output (using React Testing Library).
    *   **Review Testability & Decide on Action Abstraction:** 
        *   **Evaluate:** During the process of writing unit tests for `useEditableDeck` and `useCardManagement`, assess the difficulty of mocking their direct dependencies (i.e., the current `deckActions.ts` and `cardActions.ts`).
        *   **Decision Point:** If mocking the existing server actions proves straightforward and allows for effective testing of the hooks' logic, then the current level of coupling in the actions may be acceptable for now. The primary goal of achieving testable hooks will have been met.
        *   **Action Trigger:** However, if mocking the actions directly becomes complex, brittle, or significantly hinders the ability to thoroughly test the hooks, this serves as a practical justification for implementing an abstraction layer (like the discussed Repository pattern) for the server actions.
        *   **Next Step (If Triggered):** Should this abstraction be deemed necessary based on testing difficulties, create a separate follow-up task or plan to refactor `deckActions.ts` (and likely `cardActions.ts` for consistency) to use the chosen abstraction pattern (e.g., Repository). This refactoring is *not* part of the scope of this initial plan unless explicitly triggered by testing needs.

**Verification:** After Phase 3, run all automated tests. Perform final manual end-to-end testing to ensure the entire feature behaves correctly, state is synced, and errors are handled gracefully across all interactions. Confirm the final structure aligns well with **SRP**, **Separation of Concerns**, and improves overall maintainability and **testability**.

## 7. Verification & Testing Strategy

*   **Manual Testing:** Perform thorough manual testing after each phase, covering deck setting changes, card CRUD in both views, edge cases (empty deck, large number of cards), error conditions (API errors, validation errors), and browser compatibility.
*   **Automated Testing:** Implement unit tests for hooks and potentially integration tests for the page component as described in Phase 3. Aim for good coverage of the extracted logic.
*   **Code Review:** Conduct code reviews after each significant set of changes or phase completion.
*   **Logging:** Monitor browser console logs during testing for unexpected errors or warnings.

## 8. Conclusion

By implementing this refactoring plan, the `app/edit/[deckId]/page.tsx` component will be significantly simplified, moving complex logic into well-defined, testable custom hooks. This will greatly improve the maintainability, readability, and overall quality of the Manual Deck Editing feature, aligning it with project best practices (like SRP and separation of concerns) and making future enhancements easier and safer to implement.