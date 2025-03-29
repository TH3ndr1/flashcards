# Refactoring Plan: Flashcard App

This document outlines the planned stages for refactoring the Flashcard application.

## Stage 1: Authentication (✅ Completed)

- **Goal**: Modernize authentication using Supabase Auth helpers (`@supabase/ssr`) for server-side rendering compatibility and improved security.
- **Work Done**:
    - Replaced client-side Supabase logic with `@supabase/ssr`.
    - Implemented middleware for session handling (`middleware.ts`).
    - Created server and client Supabase instances.
    - Refactored components (`AuthForm`, protected routes) to use the new auth flow.
    - Updated `useAuth` hook.
    - Added email confirmation handling.
    - Updated documentation (`project-documentation.md`, `README.md`).

## Stage 2: Data Services (`lib/`) (✅ Completed)

- **Goal**: Refactor data fetching and manipulation services in the `lib/` directory for improved type safety, error handling, and adherence to best practices.
- **Work Done**:
    - Refactored `deckService.ts`:
        - Introduced interfaces (`RawDeckQueryResult`, `RawCardQueryResult`, `CreateDeckParams`, `DeckWithCards`).
        - Changed function signatures to return `{ data, error }`.
        - Implemented structured error handling.
        - Added JSDoc comments.
        - Improved type safety in data transformations.
        - Refactored `updateDeckService` for better atomicity (conceptual - needs backend transaction for true atomicity).
        - Addressed potential orphaned cards in `deleteDeckService`.
    - Refactored `cardService.ts`:
        - Introduced interfaces (`RawCardQueryResult`, `CreateCardParams`, `UpdateCardParams`).
        - Changed function signatures to return `{ data, error }`.
        - Implemented structured error handling.
        - Added JSDoc comments.
        - Improved type safety.
        - Refactored `updateCardResult`.
        - Handled card updates and SR algorithm updates.
    - Reviewed `settingsService.ts`:
        - Added type safety and `{ data, error }` return signature.
    - Reviewed `studyService.ts`:
        - Found to be well-structured and using modern patterns. No major refactoring needed.
    - Reviewed `study-utils.ts`, `fonts.ts`, `localStorageUtils.ts`: Minor utilities, generally okay.
    - Deleted `lib/cardDifficultyUtils.ts` (unused) and `lib/supabase.ts` (obsolete).

## Stage 3: State Management & Hooks (Current Stage)

- **Goal**: Review and refactor global state management and custom hooks for better clarity, efficiency, and error handling.
- **Work Done**:
    - **`providers/settings-provider.tsx`** (✅ Completed):
        - Reviewed state management logic (fetching, context, updates).
        - Refactored `useEffect` for loading settings to properly handle `{ data, error }` from `fetchSettings`, show toasts on error, and set defaults reliably.
        - Refactored `updateSettings` callback to return a structured `Promise<{ success: boolean; error?: PostgrestError | Error | null }>`, handle errors from `updateSettingsInDb`, show toasts, and manage preconditions.
        - Corrected `PostgrestError` import.
        - Modified `debug` function to be conditional based on `process.env.NODE_ENV`.
- **Next Steps**:
    - Review other custom hooks (e.g., `useSupabase`, `useAuth`, `useToast`, `useStudySession` if applicable) for consistency, error handling, and potential improvements.
    - Evaluate if a dedicated state management library (Zustand, Jotai) is beneficial or if the current context-based approach is sufficient.

## Stage 4: Component Structure & UI

- **Goal**: Review components for clarity, reusability, adherence to SOLID principles, and proper use of hooks and state.
- **Planned Steps**:
    - Examine key components (e.g., Deck list, Card view, Study session UI).
    - Identify complex or tightly coupled components for potential refactoring.
    - Ensure consistent styling and UI patterns.
    - Check for accessibility improvements.

## Stage 5: Testing

- **Goal**: Improve test coverage and quality for unit and potentially integration tests.
- **Planned Steps**:
    - Review existing tests (if any).
    - Add unit tests for refactored services and hooks.
    - Add tests for critical UI components.
    - Configure testing environment and CI pipeline.

## Future Work & Recommendations

- **Backend Atomicity**: For operations like deck updates/deletes involving cards, implement proper database transactions (e.g., using Supabase Edge Functions) to ensure atomicity.
- **State Management Library**: Re-evaluate the need for Zustand/Jotai as the application grows.
- **End-to-End Testing**: Consider implementing E2E tests (e.g., using Playwright or Cypress) for critical user flows.
- **Performance Optimization**: Profile the application and identify bottlenecks, especially in data fetching and rendering during study sessions.
- **Advanced SR Features**: Explore more sophisticated spaced repetition algorithms or user-configurable options.

---
*This plan is iterative and may be adjusted based on findings during the refactoring process.* 