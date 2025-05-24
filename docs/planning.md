# Consolidated Project Action Plan: StudyCards App Enhancements

**Overall Status:** Not Started

---

## Phase 0: Foundational DB/Settings & RPC Changes

**Objective:** Implement all necessary database schema modifications, update corresponding TypeScript types, and enhance backend services to support upcoming features (Timer, i18n, Grouping).

*   `[ ]` **Task 0.1: DB Migration - New Settings Fields & Deck Grouping**
    *   Add to `settings` table:
        *   `enable_study_timer` (BOOLEAN, NOT NULL, DEFAULT FALSE)
        *   `study_timer_duration_minutes` (INTEGER, NOT NULL, DEFAULT 25)
        *   `ui_language` (TEXT, NOT NULL, DEFAULT 'en')
        *   `deck_list_grouping_preference` (TEXT, NOT NULL, DEFAULT 'none')
        *   (Review `study_algorithm` TEXT field default if needed, currently `enable_dedicated_learn_mode` drives logic)
    *   *Files affected:* `supabase/migrations/YYYYMMDDHHMMSS_add_feature_settings.sql`
*   `[ ]` **Task 0.2: Update TypeScript DB Types**
    *   Run `npx supabase gen types typescript --linked > types/database.ts` after applying the migration.
    *   Verify `types/database.ts` reflects new `settings` columns.
*   `[ ]` **Task 0.3: Update SettingsProvider - Interface & Defaults**
    *   Add new fields (`enableStudyTimer`, `studyTimerDurationMinutes`, `uiLanguage`, `deckListGroupingPreference`) to `Settings` interface in `providers/settings-provider.tsx`.
    *   Update `DEFAULT_SETTINGS` object with appropriate defaults for these new fields.
*   `[ ]` **Task 0.4: Update SettingsProvider - Transformation Logic**
    *   Update `transformDbSettingsToSettings` function in `providers/settings-provider.tsx` to correctly map the new snake_case DB columns from `settings` to the camelCase fields in the `Settings` interface.
*   `[ ]` **Task 0.5: Update `settingsActions.ts`**
    *   Modify `updateUserSettings` server action in `lib/actions/settingsActions.ts` to handle saving the new settings fields, correctly mapping from camelCase input to snake_case DB columns.
*   `[ ]` **Task 0.6: Enhance RPC for Deck Tags**
    *   Modify the `get_decks_with_complete_srs_counts` RPC.
    *   The RPC should now also return an array of associated tags (e.g., `deck_tags_json: JSONB` containing `Array<{id: uuid, name: text}>`) for each deck.
    *   Update the `DeckListItemWithCounts` type in `lib/actions/deckActions.ts` to include this new `deck_tags_json` (or a processed `tags` array).
    *   *Files affected:* `supabase/migrations/YYYYMMDDHHMMSS_enhance_deck_counts_with_tags.sql`, `lib/actions/deckActions.ts`.

---

## Feature X: App Structure Refactor (Manage, Practice, Test Modes)

**Objective:** Restructure the app's top-level navigation into "Manage," "Practice," and "Test" modes for clarity and improved user experience.

*   **Phase X.1: Sidebar & Basic Page Structure**
    *   `[ ]` **Task X.1.1:** Refactor `components/layout/Sidebar.tsx` for new top-level navigation.
    *   `[ ]` **Task X.1.2:** Create basic page files and route structures under `app/[locale]/` (e.g., `practice/decks/page.tsx`, `test/page.tsx`, `manage/decks/page.tsx`). (Requires i18n [locale] setup from Feature 2, or do without `[locale]` initially if i18n is later).
    *   `[ ]` **Task X.1.3:** Update routing (e.g., redirect old home `/` to `/practice/decks`).
*   **Phase X.2: Implement "Manage > Decks" View (Table-based)**
    *   `[ ]` **Task X.2.1:** Develop `components/manage/DeckTableClient.tsx` for a table view of decks with Edit/Delete actions.
    *   `[ ]` **Task X.2.2:** Integrate `DeckTableClient.tsx` into `app/[locale]/manage/decks/page.tsx`.
    *   `[ ]` **Task X.2.3:** Add "Create New Deck" button on this page.
    *   `[ ]` **Task X.2.4:** Link "Manage Tags" correctly from the "Manage" section in the sidebar.
*   **Phase X.3: Adapt "Practice > Decks" View & Implement Grouping Controls**
    *   `[ ]` **Task X.3.1:** Ensure `DeckListClient.tsx` (or new `GroupableDeckListClient.tsx`) is used by `app/[locale]/practice/decks/page.tsx`. This component will read `settings.deck_list_grouping_preference` and render grouped/flat lists.
    *   `[ ]` **Task X.3.2:** Remove "Edit" buttons from deck cards in this "Practice" context. Action button is "Practice (Unified)".
    *   `[ ]` **Task X.3.3:** Implement UI controls on `app/[locale]/practice/decks/page.tsx` to change `settings.deck_list_grouping_preference`.
*   **Phase X.4: Implement "Test" Mode Content Selection UI**
    *   `[ ]` **Task X.4.1:** Design `app/[locale]/test/page.tsx` as a landing page for Test mode.
    *   `[ ]` **Task X.4.2:** Create UI for `app/[locale]/test/decks/page.tsx` (using adapted `DeckListClient` or `GroupableDeckListClient`) that respects grouping preference and has "Start Examination" buttons.
    *   `[ ]` **Task X.4.3:** Create UI for `app/[locale]/test/playlists/page.tsx` (using adapted `StudySetListClient`) with "Start Examination" buttons.
*   **Phase X.5: Testing & Finalization**
    *   `[ ]` **Task X.5.1:** Test all new navigation paths and structural changes.

---

## Feature 1: Study Timer (ADHD/Dyslexia Friendly & Persistent Block)

**Objective:** Implement a user-configurable study timer to promote focused learning, with persistence across micro-sessions within a larger "focus block."

*   **Phase 1.1: `useStudyBlockTimer` Hook Development**
    *   `[ ]` **Task 1.1.1:** Create `hooks/useStudyBlockTimer.ts` with state for block start/duration, `localStorage` persistence, and control functions (`startBlock`, `pauseBlock`, `resumeBlock`, `extendBlock`, `endBlock`, `onBlockExpired` callback).
*   **Phase 1.2: Integration into Study Session Page**
    *   `[ ]` **Task 1.2.1:** Integrate `useStudyBlockTimer` into `app/[locale]/study/session/page.tsx`.
    *   `[ ]` **Task 1.2.2:** Implement visual timer display (e.g., depleting bar).
    *   `[ ]` **Task 1.2.3:** Implement "Focus Time Complete" `AlertDialog` with options (End, Extend, Break).
    *   `[ ]` **Task 1.2.4:** Handle modal actions and timer pausing/resuming based on session state and navigation.
*   **Phase 1.3: UI in Settings Page**
    *   `[ ]` **Task 1.3.1:** Add UI in `app/[locale]/settings/page.tsx` to configure timer (enable/disable, duration).
*   **Phase 1.4: Testing & Refinement**
    *   `[ ]` **Task 1.4.1:** Test all timer functionalities, persistence, notifications, and edge cases.

---

## Feature 2: Internationalization (i18n) with `next-intl`

**Objective:** Make the entire application UI translatable into multiple languages.

*   **Phase 2.1: Setup & Core Integration (`next-intl`)**
    *   `[ ]` **Task 2.1.1:** Install and configure `next-intl` (middleware, provider, i18n config).
    *   `[ ]` **Task 2.1.2:** Create initial `messages/en.json` and `app/[locale]/layout.tsx`.
    *   `[ ]` **Task 2.1.3:** Restructure `app` directory to use `[locale]` segments.
*   **Phase 2.2: Comprehensive UI Text Translation (Iterative)**
    *   `[ ]` **Task 2.2.1:** Systematically extract strings from all components/pages to `messages/en.json` and use `useTranslations`/`getTranslations`.
    *   `[ ]` **Task 2.2.2:** Handle plurals and dynamic content.
    *   `[ ]` **Task 2.2.3:** Create and translate `messages/es.json` (or other language) for testing.
*   **Phase 2.3: Language Switching & Persistence**
    *   `[ ]` **Task 2.3.1:** Implement language switcher UI in `app/[locale]/settings/page.tsx` (updates `settings.ui_language` and route).
    *   `[ ]` **Task 2.3.2:** Ensure middleware correctly handles locale detection and persistence.
*   **Phase 2.4: Testing & Validation**
    *   `[ ]` **Task 2.4.1:** Test language switching, persistence, and display for all UI elements.

---

## Feature 3: Examination Mode

**Objective:** Allow users to test their knowledge without SRS assistance.

*   **Phase 3.1: Core Logic & Backend Adjustments**
    *   `[ ]` **Task 3.1.1:** Add `'examination'` to `SessionType` enum in `types/study.ts`.
    *   `[ ]` **Task 3.1.2:** Update `session-queue-manager.ts` (`initializeQueue`) to handle `'examination'` type (fetch all, shuffle).
    *   `[ ]` **Task 3.1.3:** Create `handleExaminationAnswer` in `lib/study/card-state-handlers.ts` (no SRS DB updates, `'remove'` instruction, new `sessionResultCategory`).
    *   `[ ]` **Task 3.1.4:** Modify `hooks/useStudySession.ts` to use the new handler for exam mode and fetch all cards for the input. Ensure no SRS progress is saved.
    *   `[ ]` **Task 3.1.5:** Update `SessionResults` type for exam-specific scoring.
*   **Phase 3.2: UI & Session Flow (Integrated with "Test" Mode from Feature X)**
    *   `[ ]` **Task 3.2.1:** Ensure "Start Examination" buttons (from Feature X.4.2 & X.4.3) correctly set `SessionType = 'examination'` and navigate to `/study/session`.
    *   `[ ]` **Task 3.2.2:** Update `app/[locale]/study/session/page.tsx` to display correctly for examination mode (title, progress, no SRS card status).
    *   `[ ]` **Task 3.2.3:** Implement Examination Completion Screen (score, option to review missed).
*   **Phase 3.3: Testing & Validation**
    *   `[ ]` **Task 3.3.1:** Test exam flow, verify no SRS data changes, validate scoring.

---