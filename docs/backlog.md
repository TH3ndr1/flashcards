## Table of Contents

- [Feature X: App Structure Refactor (Manage, Practice, Test Modes)](#feature-x-app-structure-refactor-manage-practice-test-modes)
- [Feature 1: Study Timer (ADHD/Dyslexia Friendly & Persistent Block)](#feature-1-study-timer-adhddyslexia-friendly--persistent-block)
- [Feature 2: Internationalization (i18n) with `next-intl`](#feature-2-internationalization-i18n-with-next-intl)
- [Feature 3: Examination Mode](#feature-3-examination-mode)
- [Feature 4: Deck Overview Page Restructuring (Interactive Grouping)](#feature-4-deck-overview-page-restructuring-interactive-grouping)


# Feature X: App Structure Refactor (Manage, Practice, Test Modes)

**Version:** 1.0
**Date:** 2025-05-22
**Related Features:** This refactor provides the structural basis for Feature 3 (Examination Mode) and influences how Feature 4 (Deck Overview Grouping) is implemented and accessed.

## 1. Feature Description & Objectives

This feature introduces a fundamental restructuring of the application's top-level navigation and information architecture. The goal is to create clearer, intent-driven sections for users, enhancing usability and reducing cognitive load, especially for the target audience.

The application will be organized into three primary modes/sections:

1.  **Manage Mode:**
    *   **Purpose:** Focused on content creation, organization, and administration of decks and tags.
    *   **Key Functionality:**
        *   View all decks in a compact, list-based (table) format.
        *   Edit deck metadata and cards (navigating to the existing `/edit/[deckId]` page).
        *   Delete decks.
        *   Create new decks (navigating to `/decks/new`).
        *   Access tag management (`/tags`).
    *   **User Benefit:** Provides a streamlined interface for users whose primary task is content management, offering a more efficient way to handle a large number of decks.

2.  **Practice Mode:**
    *   **Purpose:** Dedicated to SRS-based learning and review sessions.
    *   **Key Functionality:**
        *   Access the main deck overview (card-based view with grouping options) for starting "Unified Practice" sessions.
        *   Navigate to "Custom Session Setup" (`/study/select`) for 'Learn-only' or 'Review-only' sessions.
        *   Access and manage "Smart Playlists" (`/study/sets`) for targeted SRS practice.
    *   **User Benefit:** Offers a focused environment for users ready to engage in learning activities, free from management-related clutter.

3.  **Test Mode:**
    *   **Purpose:** Allows users to assess their knowledge without SRS assistance, simulating an exam environment.
    *   **Key Functionality:**
        *   Select content for examination (Decks or Smart Playlists).
        *   The deck selection view in this mode will respect the user's global deck grouping preference.
        *   Initiate an "Examination" session type for the selected content.
    *   **User Benefit:** Provides a clear, distinct pathway for self-assessment, separate from SRS learning, preventing accidental SRS data updates during tests.

This refactor aims to:
*   Improve overall application navigation and clarity.
*   Reduce visual clutter on pages by separating concerns.
*   Provide distinct entry points based on user goals (Manage, Practice, Test).
*   Establish a scalable structure for future feature additions.

## 2. Key Technical Components & Changes

*   **Sidebar Navigation (`components/layout/Sidebar.tsx`):** Will be refactored to reflect the new top-level sections: "Practice", "Test", "Manage", and "Settings" (Profile might be via UserNavButton).
*   **New Page Routes:**
    *   `/practice/decks`: Will house the current card-based deck overview (`DeckListClient.tsx`), now without "Edit" buttons, but with grouping controls.
    *   `/manage/decks`: New page for the table-based deck list (`DeckTableClient.tsx`).
    *   `/test`: Landing page for test mode, linking to deck/playlist selection for exams.
    *   `/test/decks`: Page for selecting a deck to start an examination.
    *   `/test/playlists`: Page for selecting a playlist to start an examination.
*   **New Components:**
    *   `DeckTableClient.tsx`: A new client component for the "Manage" section's table view of decks.
*   **Modified Components:**
    *   `DeckListClient.tsx`: "Edit" buttons removed. Grouping logic and controls will be added here (or in a new `GroupableDeckListClient.tsx` it might become). The primary action button per deck will be "Practice (Unified)".
    *   `StudySetListClient.tsx`: Will need a variant or prop to change its action buttons to "Start Examination" when used in the "/test/playlists" context.
    *   `useStudySessionStore.ts`: No direct changes for this structural refactor, but it will be used by the "Test" mode initiation to set `SessionType = 'examination'`.

## 3. Action Plan & Status Tracker

**Phase 0: Foundational DB/Settings & RPC Changes (Prerequisite - see separate plan)**
*   *Ensure `settings` table can store `deck_list_grouping_preference`.*
*   *Ensure `get_decks_with_complete_srs_counts` RPC can return deck tags.*

**Phase X.1: Sidebar & Basic Page Structure**
*   `[ ]` **Task X.1.1:** Refactor `components/layout/Sidebar.tsx` to implement the new top-level navigation structure:
    *   "Practice" (expands to Decks, Custom Session, Playlists)
    *   "Test" (expands to Select Deck for Test, Select Playlist for Test)
    *   "Manage" (expands to Decks (Table), Create Deck, Manage Tags)
    *   "Settings"
    *   Update corresponding `navItems` definitions.
*   `[ ]` **Task X.1.2:** Create basic page files and route structures under `app/[locale]/`:
    *   `practice/decks/page.tsx`
    *   `test/page.tsx` (simple landing page)
    *   `test/decks/page.tsx`
    *   `test/playlists/page.tsx`
    *   `manage/decks/page.tsx`
    *   Update `app/page.tsx` (old home) to redirect to `/practice/decks` or make `/practice/decks` the new effective home.
*   `[ ]` **Task X.1.3:** Ensure existing links (e.g., from `/decks/new` back navigation, from settings page back navigation) point to appropriate new locations if their context changes.

**Phase X.2: Implement "Manage > Decks" View (Table-based)**
*   `[ ]` **Task X.2.1:** Develop `components/manage/DeckTableClient.tsx`:
    *   Fetches deck data (consider if the full `get_decks_with_complete_srs_counts` is needed here, or a simpler RPC fetching just `decks` and their `tags`).
    *   Uses `shadcn/ui Table` to display columns: Deck Name, # Cards (total), Primary Language, Secondary Language (if bilingual), Tags (comma-separated or badges), Last Modified.
    *   Implements client-side sorting for columns.
    *   Each row includes an "Edit" button (links to `/edit/[deckId]`) and a "Delete" button (with confirmation dialog, calls `deleteDeck` action).
*   `[ ]` **Task X.2.2:** Integrate `DeckTableClient.tsx` into `app/[locale]/manage/decks/page.tsx`.
*   `[ ]` **Task X.2.3:** Add a "Create New Deck" button on `app/[locale]/manage/decks/page.tsx` that links to `/decks/new`.
*   `[ ]` **Task X.2.4:** Ensure "Manage Tags" link in the sidebar (under "Manage") correctly points to `/tags`.

**Phase X.3: Adapt "Practice > Decks" View**
*   `[ ]` **Task X.3.1:** Configure `app/[locale]/practice/decks/page.tsx` to use `DeckListClient.tsx` (or the new `GroupableDeckListClient.tsx` if developed for Feature 4).
    *   This component will be responsible for reading `settings.deck_list_grouping_preference` and rendering decks accordingly (flat or grouped by tag/language).
    *   The primary action button on each deck card will be "Practice (Unified)" (initiates `'unified'` `SessionType`).
*   `[ ]` **Task X.3.2:** Modify `DeckListClient.tsx` (or the new groupable version) to *not* render "Edit" buttons on the deck cards in this "Practice" context.
*   `[ ]` **Task X.3.3:** Implement UI controls (e.g., dropdowns, toggle buttons) on `app/[locale]/practice/decks/page.tsx` for users to change their `deck_list_grouping_preference`. Changes should be saved to user settings (debounced).

**Phase X.4: Implement "Test" Mode Content Selection UI**
*   `[ ]` **Task X.4.1:** Design `app/[locale]/test/page.tsx` as a clear entry point, offering choices:
    *   Button/Link: "Start Examination from Deck" -> `/test/decks`
    *   Button/Link: "Start Examination from Smart Playlist" -> `/test/playlists`
    *   (Future) Button/Link: "Start Examination from All Cards"
*   `[ ]` **Task X.4.2:** Develop/Adapt UI for `app/[locale]/test/decks/page.tsx`:
    *   Reuses `DeckListClient.tsx` or `GroupableDeckListClient.tsx` (from Feature 4 / Phase X.3).
    *   This component fetches decks with tags (using RPC from Task 0.6).
    *   It *reads and applies* `settings.deck_list_grouping_preference`.
    *   Crucially, the action button on each deck card must be "Start Examination". Clicking it sets `StudySessionInput` (with `deckId`) and `SessionType = 'examination'` in `studySessionStore`, then navigates to `/study/session`.
*   `[ ]` **Task X.4.3:** Develop/Adapt UI for `app/[locale]/test/playlists/page.tsx`:
    *   Reuses or adapts `components/study/StudySetListClient.tsx`.
    *   The action button for each playlist must be "Start Examination". Clicking it sets `StudySessionInput` (with `studySetId`) and `SessionType = 'examination'` in `studySessionStore`, then navigates to `/study/session`.

**Phase X.5: Testing & Finalization**
*   `[ ]` **Task X.5.1:** Thoroughly test all new navigation paths, ensuring links are correct and sidebar behavior is consistent.
*   `[ ]` **Task X.5.2:** Verify that "Manage" mode correctly lists decks and allows editing/deletion.
*   `[ ]` **Task X.5.3:** Verify that "Practice" mode correctly displays decks (respecting grouping), allows unified practice, and links to custom sessions/playlists.
*   `[ ]` **Task X.5.4:** Verify that "Test" mode allows selection of decks/playlists (respecting grouping for decks) and correctly initiates an "Examination" session type.
*   `[ ]` **Task X.5.5:** Ensure responsive design works well with the new sidebar and page structures.

---

# Feature 1: Study Timer (ADHD/Dyslexia Friendly & Persistent Block)

**Version:** 1.0
**Date:** 2025-05-22
**Depends On:** Phase 0 (Foundational DB/Settings Changes) for `settings` table updates.

## 1. Feature Description & Objectives

This feature introduces a user-configurable study timer designed to help users manage their study sessions effectively, promote focused learning, and prevent burnout. It is specifically designed with considerations for users with ADHD and dyslexia.

**Key Objectives:**

*   **Focus Management:** Allow users to set a desired duration for a "focus block."
*   **Persistent Tracking:** The timer will track total focused study time within this block, even if the user switches between different decks or study sets (micro-sessions) during that block.
*   **ADHD/Dyslexia Friendly UI:**
    *   The timer display will be visual and minimally intrusive (e.g., a slowly depleting bar).
    *   Notifications will be clear and offer constructive options rather than abrupt stops.
*   **User Configurability:** Users can enable/disable the timer and set its duration.
*   **Actionable Notifications:** When the timer expires, users will be prompted with options to end their study block, extend it, or take a short break.

## 2. Key Technical Components & Changes

*   **Database (`settings` table):**
    *   `enable_study_timer` (BOOLEAN, NOT NULL, DEFAULT FALSE)
    *   `study_timer_duration_minutes` (INTEGER, NOT NULL, DEFAULT 25)
*   **Settings Management:**
    *   Updates to `types/database.ts`, `SettingsProvider`, `settingsActions.ts` to manage these new settings.
    *   UI in `app/[locale]/settings/page.tsx` for configuration.
*   **New Hook (`hooks/useStudyBlockTimer.ts`):**
    *   Manages the state of the current study block: `blockStartTime: number | null`, `blockDurationSetByUserMinutes: number`.
    *   Uses `localStorage` to persist `blockStartTime` and `blockDurationSetByUserMinutes` to allow continuation if the tab is briefly closed/reopened.
    *   Calculates `remainingTimeInBlockMs`.
    *   Provides functions: `startBlock(durationMinutes)`, `pauseBlock()`, `resumeBlock()`, `extendBlock(additionalMinutes)`, `endBlock()`.
    *   Includes a callback prop `onBlockExpired` that is triggered when the timer reaches zero.
*   **Study Session Page (`app/[locale]/study/session/page.tsx`):**
    *   Integrates `useStudyBlockTimer`.
    *   Starts/resumes the block timer when a study session begins (if enabled in settings).
    *   Displays the visual timer (e.g., a thin progress bar).
    *   Handles the `onBlockExpired` callback by showing an `AlertDialog`.
    *   Implements logic for modal actions (end session, add time, start break).
    *   Pauses the block timer if the user navigates away or the study session component becomes inactive.
*   **UI Components:**
    *   Visual timer display component.
    *   `AlertDialog` for timer expiration notification.

## 3. Action Plan & Status Tracker

**Phase 0: Foundational DB/Settings Changes (Prerequisite - see separate plan for Task 0.1-0.5)**
*   *Ensure `enable_study_timer` and `study_timer_duration_minutes` are added to the `settings` table and fully integrated into the settings management system.*

**Phase 1: `useStudyBlockTimer` Hook Development**
*   `[ ]` **Task 1.1:** Create `hooks/useStudyBlockTimer.ts`.
    *   Define state: `blockStartTime: number | null` (timestamp), `blockDurationSetByUserMinutes: number | null`, `isBlockActive: boolean`, `isPaused: boolean`.
    *   Implement `localStorage` logic:
        *   On mount, attempt to load `blockStartTime` and `blockDurationSetByUserMinutes` from `localStorage`. If found and `blockStartTime` is recent (e.g., within last X hours, to avoid resuming very old blocks), calculate remaining time.
        *   When `startBlock` or `extendBlock` is called, save/update `blockStartTime` and `blockDurationSetByUserMinutes` to `localStorage`.
        *   When `endBlock` is called, clear these from `localStorage`.
    *   Implement core timer logic using `useEffect` and `setInterval/setTimeout` to track `remainingTimeInBlockMs`.
    *   Implement functions:
        *   `startBlock(durationMinutes)`: Sets `blockStartTime = Date.now()`, `blockDurationSetByUserMinutes = durationMinutes`, `isBlockActive = true`, `isPaused = false`. Saves to `localStorage`.
        *   `pauseBlock()`: Sets `isPaused = true`. Records elapsed time if needed for precise resume.
        *   `resumeBlock()`: Sets `isPaused = false`. Adjusts `blockStartTime` or remaining duration based on pause.
        *   `extendBlock(additionalMinutes)`: Updates `blockDurationSetByUserMinutes` (adds to current duration or remaining time). Saves to `localStorage`.
        *   `endBlock()`: Sets `isBlockActive = false`, `isPaused = false`. Clears `localStorage`.
        *   `onBlockExpired` (prop): Callback to be invoked when `remainingTimeInBlockMs <= 0`.
    *   Expose: `remainingTimeInBlockMs`, `isBlockActive`, `isBlockPaused`, `startBlock`, `pauseBlock`, `resumeBlock`, `extendBlock`, `endBlock`.

**Phase 2: Integration into Study Session Page (`app/[locale]/study/session/page.tsx`)**
*   `[ ]` **Task 2.1:** Import and use `useStudyBlockTimer` within `StudySessionPage`.
*   `[ ]` **Task 2.2:** On component mount or when `useStudySession` starts a new session:
    *   Check `settings.enableStudyTimer`.
    *   If enabled, call `timerHook.startBlock(settings.studyTimerDurationMinutes)` or `timerHook.resumeBlock()` if a block was active in `localStorage`.
*   `[ ]` **Task 2.3:** Implement visual timer display:
    *   A thin horizontal bar (using `Progress` component from shadcn/ui) under the main session progress.
    *   The bar depletes based on `timerHook.remainingTimeInBlockMs` relative to `timerHook.blockDurationSetByUserMinutes`.
    *   Optional: Tooltip on the bar showing "XX:XX remaining in this focus block."
*   `[ ]` **Task 2.4:** Implement `onBlockExpired` callback for the timer hook:
    *   When called, set state to show an `AlertDialog`.
*   `[ ]` **Task 2.5:** Design and implement the "Focus Time Complete" `AlertDialog`:
    *   Title: "Focus Time Complete!" or "Take a Break?"
    *   Message: e.g., "You've been studying for {X} minutes."
    *   Buttons:
        *   "End Study Block & Session": Calls `useStudySession`'s logic to complete the current card queue, then calls `timerHook.endBlock()`. Navigates user out of study session.
        *   "Add 15 More Minutes": Calls `timerHook.extendBlock(15)`. Closes dialog.
        *   "Start 5 Min Break":
            *   Calls `timerHook.pauseBlock()`.
            *   Pauses `useStudySession` (no new cards, grading disabled).
            *   Shows a simple 5-minute break overlay/timer.
            *   On break completion, prompt "Resume Studying?" or "End Study Block".
*   `[ ]` **Task 2.6:** Handle pausing/resuming the block timer:
    *   `timerHook.pauseBlock()` when user navigates away from `/study/session` (e.g., in `useEffect` cleanup of `StudySessionPage`) or if the study session naturally completes *before* the block timer.
    *   `timerHook.resumeBlock()` if they return and conditions allow.
    *   If `useStudySession` completes (e.g., `isComplete` becomes true) before the block timer expires, call `timerHook.pauseBlock()` or `timerHook.endBlock()` as appropriate (perhaps `endBlock` if they are done with this focus period).

**Phase 3: UI in Settings Page (`app/[locale]/settings/page.tsx`)**
*   `[ ]` **Task 3.1:** Add a new section for "Study Timer Settings".
*   `[ ]` **Task 3.2:** Add a `Switch` component to toggle `settings.enableStudyTimer`.
*   `[ ]` **Task 3.3:** If enabled, show an `Input` (type number) for `settings.studyTimerDurationMinutes`.
    *   Include validation (e.g., min 5, max 120 minutes).
    *   Display current value and save on change (debounced or on blur).

**Phase 4: Testing & Refinement**
*   `[ ]` **Task 4.1:** Test enabling/disabling the timer and changing duration in settings.
*   `[ ]` **Task 4.2:** Verify timer persistence across micro-sessions (e.g., finishing learn queue, starting review queue in unified mode).
*   `[ ]` **Task 4.3:** Test `localStorage` persistence for brief tab closures/reloads.
*   `[ ]` **Task 4.4:** Test notification dialog and all its actions (End, Extend, Break).
*   `[ ]` **Task 4.5:** Evaluate ADHD/Dyslexia friendliness of the visual timer and notifications. Iterate on UI if needed.
*   `[ ]` **Task 4.6:** Test edge cases:
    *   Session completes before block timer.
    *   User navigates away while block timer is running.
    *   User changes timer settings while a block is active (should it reset the current block or apply to the next one?). *Recommendation: Apply to next block.*

---

# Feature 2: Internationalization (i18n) with `next-intl`

**Version:** 1.0
**Date:** 2025-05-22
**Depends On:** Phase 0 (Foundational DB/Settings Changes) for `settings` table updates for `ui_language`.

## 1. Feature Description & Objectives

This feature aims to make the StudyCards application UI fully translatable into multiple languages, enhancing accessibility and user experience for a global audience. This involves translating all user-facing text elements, including static labels, button text, messages, toasts, and settings descriptions.

**Key Objectives:**

*   **Comprehensive Translation:** Ensure all UI text can be localized.
*   **Locale-based Routing:** Implement URL-based localization (e.g., `/en/dashboard`, `/es/dashboard`).
*   **User Preference:** Allow users to select their preferred UI language and persist this choice.
*   **Developer Experience:** Utilize `next-intl` for its strong integration with the Next.js App Router, providing good support for Server Components, Client Components, and Server Actions.
*   **Maintainability:** Store translations in structured JSON files for easy management and contribution.

## 2. Key Technical Components & Changes

*   **`next-intl` Library:** The core library for handling internationalization.
*   **Translation Files:** JSON files (e.g., `messages/en.json`, `messages/es.json`) storing key-value pairs for translations.
*   **Routing:**
    *   Introduction of a `[locale]` dynamic segment in the App Router (e.g., `app/[locale]/page.tsx`).
    *   Middleware (`middleware.ts`) to handle locale detection (from URL, user settings, cookies, or browser `Accept-Language` header) and redirection.
*   **Providers & Hooks:**
    *   `NextIntlClientProvider` in `app/[locale]/layout.tsx` to make translations available to Client Components.
    *   `useTranslations()` hook in Client Components.
    *   `getTranslations()` function in Server Components, Server Actions, and Route Handlers.
*   **Database (`settings` table):**
    *   `ui_language` (TEXT, NOT NULL, DEFAULT 'en') to store user's preferred UI language.
*   **Settings Management:**
    *   Updates to `SettingsProvider` and `settingsActions.ts` for `ui_language`.
    *   UI in `app/[locale]/settings/page.tsx` for language selection.
*   **Component Refactoring:** All components displaying user-facing text will need to be updated to use translation functions/hooks.

## 3. Action Plan & Status Tracker

**Phase 0: Foundational DB/Settings Changes (Prerequisite - see separate plan for Task 0.1-0.5)**
*   *Ensure `ui_language` is added to the `settings` table and fully integrated into the settings management system.*

**Phase 1: `next-intl` Setup & Core Integration**
*   `[ ]` **Task 1.1:** Install `next-intl`: `npm install next-intl`.
*   `[ ]` **Task 1.2:** Create `i18n.ts` (or `.js`) configuration file at the project root to define supported locales and default locale, and to configure `getRequestConfig` for loading messages.
*   `[ ]` **Task 1.3:** Create message files: `messages/en.json`. Add a few initial global translations (e.g., app title, common navigation links like "Practice", "Settings").
*   `[ ]` **Task 1.4:** Update `middleware.ts` to use `next-intl`'s middleware for locale detection, prefixing paths, and redirection. Configure default locale and supported locales.
*   `[ ]` **Task 1.5:** Restructure the `app` directory:
    *   Create `app/[locale]/` directory.
    *   Move existing page/layout files (e.g., `layout.tsx`, `page.tsx` for home) into `app/[locale]/`.
    *   The root `app/layout.tsx` might become very simple, primarily setting up `<html>` and `<body>` and passing children, or it might handle redirects to the default locale if `next-intl` doesn't handle this fully via middleware.
*   `[ ]` **Task 1.6:** In the new `app/[locale]/layout.tsx`:
    *   Wrap children with `<NextIntlClientProvider messages={messages}>` where `messages` are loaded using `getRequestConfig` from `i18n.ts`.
*   `[ ]` **Task 1.7:** Test basic locale routing (e.g., navigating to `/en` and `/es` if Spanish messages are added) and see if the initial sample translations appear.

**Phase 2: UI Text Extraction & Translation (Iterative Process)**
*   `[ ]` **Task 2.1 (Global Elements):**
    *   Refactor `components/layout/Header.tsx`, `components/layout/Sidebar.tsx`, and other global UI elements.
    *   Extract all hardcoded strings into `messages/en.json`.
    *   Use `const t = useTranslations('Namespace');` and `t('key')` in these Client Components.
*   `[ ]` **Task 2.2 (Key Pages):**
    *   Start with high-traffic pages like `app/[locale]/practice/decks/page.tsx` (Deck List), `app/[locale]/study/select/page.tsx`, and `app/[locale]/settings/page.tsx`.
    *   Extract strings, use appropriate translation functions (`useTranslations` or `getTranslations`).
*   `[ ]` **Task 2.3 (All Remaining UI):**
    *   Systematically go through every other page and component.
    *   Translate titles, labels, button texts, placeholders, descriptions, error messages, confirmation dialogs.
    *   **Toasts:** Ensure calls like `toast.success("Deck created!")` are changed to `toast.success(t('toasts.deckCreatedSuccess'))`.
*   `[ ]` **Task 2.4 (Pluralization & Formatting):**
    *   Identify areas needing pluralization (e.g., "1 card" vs. "2 cards") and use `next-intl`'s ICU message format capabilities.
    *   Handle dynamic values in translations (e.g., `t('welcomeMessage', { name: userName })`).
*   `[ ]` **Task 2.5 (Expand Languages):** Create `messages/xx.json` for another target language (e.g., Spanish - `es`) and translate a significant portion of `en.json` to it for testing.

**Phase 3: Language Switching & Persistence**
*   `[ ]` **Task 3.1:** (DB/Settings provider changes for `ui_language` are covered in Phase 0).
*   `[ ]` **Task 3.2:** Implement Language Switcher UI in `app/[locale]/settings/page.tsx`:
    *   A `Select` component listing available languages (defined in `i18n.ts`).
    *   When a new language is selected:
        *   Call `updateUserSettings` to save the new `ui_language`.
        *   Use `useRouter` from `next/navigation` (or `next-intl/client`'s `useRouter` if it provides advantages for locale switching) to navigate to the same page but with the new locale prefix (e.g., `router.replace(\`/${newLocale}/${pathname}\`)`). `next-intl` might handle this transition more smoothly.
*   `[ ]` **Task 3.3:** Ensure `middleware.ts` correctly prioritizes locale detection:
    1.  From URL prefix.
    2.  From user's saved `ui_language` setting (requires fetching settings in middleware, potentially tricky or use a cookie).
    3.  From a language cookie (if set by the language switcher).
    4.  From browser's `Accept-Language` header.
    5.  Fallback to default locale.
    *Alternatively, `next-intl`'s default middleware might handle most of this with proper configuration.*

**Phase 4: Testing & Validation**
*   `[ ]` **Task 4.1:** Test navigation between locales using the URL.
*   `[ ]` **Task 4.2:** Test the language switcher in settings and verify preference persistence.
*   `[ ]` **Task 4.3:** Verify that all UI elements correctly display translated text for supported languages.
*   `[ ]` **Task 4.4:** Check fallback behavior for untranslated strings (should default to the primary language, e.g., English).
*   `[ ]` **Task 4.5:** Test dynamic content, pluralization, and date/number formatting if used.
*   `[ ]` **Task 4.6:** Validate Server Components and Client Components are correctly rendering translations.

---

# Feature 3: Examination Mode

**Version:** 1.0
**Date:** 2025-05-22
**Depends On:** Feature X (App Structure Refactor) for the dedicated "/test" section.

## 1. Feature Description & Objectives

This feature introduces an "Examination Mode" allowing users to test their knowledge on selected content (decks or smart playlists) without the influence of the Spaced Repetition System (SRS). Cards are presented once, and user performance is tracked for a session-end score.

**Key Objectives:**

*   **Assessment Tool:** Provide a means for users to self-assess their understanding under exam-like conditions.
*   **SRS Independence:** Ensure that answers given in examination mode do *not* affect the card's normal SRS scheduling (e.g., `srs_level`, `next_review_due`).
*   **Clear Distinction:** Make examination mode clearly separate from regular SRS practice sessions.
*   **Focused Experience:** Each card is shown only once per examination session.
*   **Performance Feedback:** Present a clear score and summary at the end of the examination.

## 2. Key Technical Components & Changes

*   **`SessionType` Enum (`types/study.ts`):** Add a new variant `'examination'`.
*   **`useStudySession` Hook (`hooks/useStudySession.ts`):**
    *   Modify card fetching logic: For `sessionType = 'examination'`, it will fetch all cards from the selected `StudySessionInput` (deck or study set) without applying SRS-based filters (like due status or learning state).
    *   The fetched cards should be shuffled before being added to the `sessionQueue`.
*   **`session-queue-manager.ts`:**
    *   `initializeQueue`: If `sessionType` is `'examination'`, it should take all provided cards, initialize their `InternalCardState` (mostly for `dueTime` to be now), and shuffle them.
*   **`card-state-handlers.ts`:**
    *   Create a new handler function, e.g., `handleExaminationAnswer(card: DbCard, grade: ReviewGrade): CardStateUpdateOutcome`.
    *   This handler will *not* call any SRS calculation functions (`calculateSm2State`, etc.).
    *   The `dbUpdatePayload` in its returned `CardStateUpdateOutcome` should be empty or only contain updates to non-SRS general stats if those are tracked for exams (e.g., a separate `exam_attempt_count`). For simplicity, initially, it can be empty.
    *   The `queueInstruction` will always be `'remove'` (as each card is seen once).
    *   `sessionResultCategory` could be set to `'examCorrect'` or `'examIncorrect'` to help `useStudySession` tally the score.
*   **`useStudySession` Hook (Continued):**
    *   The `answerCard` method will call `handleExaminationAnswer` if `sessionType` is `'examination'`.
    *   `debouncedUpdateProgress` (from `progressActions.updateCardProgress`) should *not* be called with any SRS-altering fields if in examination mode. If `dbUpdatePayload` from `handleExaminationAnswer` is empty, this might not be called at all, or called with an empty payload.
*   **`SessionResults` Type (`types/study.ts`):**
    *   Potentially add `examCorrectCount: number` and `examTotalAnsweredInExam: number` (or similar) to `SessionResults` to track exam-specific scores if they need to be distinct from general session results.
*   **UI for Initiating Examination:**
    *   As per "Feature X" refinement, new pages like `app/[locale]/test/decks/page.tsx` and `app/[locale]/test/playlists/page.tsx` will allow users to select content.
    *   These pages will feature "Start Examination" buttons that set the appropriate `StudySessionInput` and `SessionType = 'examination'` in `studySessionStore`.
*   **Study Session Page (`app/[locale]/study/session/page.tsx`):**
    *   When `sessionType` is `'examination'`:
        *   Display an appropriate title (e.g., "Examination: {Deck/Playlist Name}").
        *   Progress display should be "Card X of Y" (total cards in the exam).
        *   No SRS-specific status should be shown for the current card.
    *   Implement a distinct examination completion screen:
        *   Title: "Examination Complete!"
        *   Score: "You answered X out of Y cards correctly ({Percentage}%)".
        *   Optionally: A button to "Review Incorrectly Answered Cards" (could start a temporary, non-SRS 'learn-only' session with those specific cards).

## 3. Action Plan & Status Tracker

**Phase 1: Core Logic & Backend Adjustments**
*   `[ ]` **Task 1.1:** Add `'examination'` variant to the `SessionType` enum in `types/study.ts`.
*   `[ ]` **Task 1.2:** In `lib/study/session-queue-manager.ts`:
    *   Modify `initializeQueue` function. If `sessionType` is `'examination'`, it should:
        *   Accept all cards passed to it (no SRS filtering).
        *   Initialize `InternalCardState` for each card (e.g., `dueTime = now`).
        *   Shuffle the resulting `SessionCard[]` array.
*   `[ ]` **Task 1.3:** In `lib/study/card-state-handlers.ts`:
    *   Create `handleExaminationAnswer(card: DbCard, internalState: InternalCardState, grade: ReviewGrade, settings: Settings): CardStateUpdateOutcome`.
    *   This function should determine if the grade means "correct" (e.g., >=3) or "incorrect".
    *   `dbUpdatePayload`: Should be empty (no SRS fields updated).
    *   `nextInternalState`: Can be minimal as the card is removed. `dueTime` can be `now`.
    *   `queueInstruction`: Always `'remove'`.
    *   `sessionResultCategory`: Set to `'examCorrect'` or `'examIncorrect'`.
*   `[ ]` **Task 1.4:** In `hooks/useStudySession.ts`:
    *   Modify the main `initializeNewSession` effect: If `sessionType === 'examination'`, ensure it calls `resolveStudyQuery` to get *all* card IDs for the given input (deck/study set), without SRS status filters.
    *   Modify the `answerCard` method:
        *   If `sessionType === 'examination'`, call `handleExaminationAnswer`.
        *   Ensure `debouncedUpdateProgress` is *not* called with any SRS-altering fields (or not called at all if `dbUpdatePayload` is empty).
*   `[ ]` **Task 1.5:** Update `SessionResults` type in `types/study.ts` to include `examCorrectCount` and `examTotalAnswered` (or similar). Modify `useStudySession` to populate these correctly based on `sessionResultCategory` from `handleExaminationAnswer`.

**Phase 2: UI for Test Mode & Session Display**
    *   *(Tasks for creating the "/test" section and its sub-pages for deck/playlist selection are covered in "Feature X: App Structure Refactor")*
*   `[ ]` **Task 2.1:** Ensure "Start Examination" buttons in `app/[locale]/test/decks/page.tsx` and `app/[locale]/test/playlists/page.tsx` correctly:
    *   Set `StudySessionInput` with `deckId` or `studySetId`.
    *   Set `SessionType = 'examination'` in `studySessionStore`.
    *   Navigate to `/study/session`.
*   `[ ]` **Task 2.2:** In `app/[locale]/study/session/page.tsx`:
    *   When `sessionType` from `useStudySession` is `'examination'`:
        *   Display an appropriate title like "Examination Mode".
        *   Modify progress display to show "Card {currentExamCardNumber} / {totalExamCards}".
        *   Hide any SRS-specific status indicators for the current card.
*   `[ ]` **Task 2.3:** Implement the Examination Completion Screen:
    *   When `isComplete` is true and `sessionType` was `'examination'`:
        *   Display title "Examination Complete!".
        *   Show score: `sessionResults.examCorrectCount` / `sessionResults.examTotalAnswered`.
        *   Calculate and display percentage.
        *   Provide a button "Return to Test Selection" (-> `/test`).
        *   (Optional) Button "Review Incorrect Cards": This would need to store IDs of incorrectly answered cards during the exam and then initiate a new, non-SRS, non-persisting viewing session for them.

**Phase 3: Testing & Validation**
*   `[ ]` **Task 3.1:** Test initiating an examination for both decks and smart playlists.
*   `[ ]` **Task 3.2:** Verify that cards are presented once and in a shuffled order.
*   `[ ]` **Task 3.3:** Critically verify that answering cards in examination mode does *not* alter their `srs_level`, `next_review_due`, `easiness_factor`, or other SRS fields in the database.
*   `[ ]` **Task 3.4:** Test the accuracy of the examination score and the completion screen.
*   `[ ]` **Task 3.5:** Test the (optional) "Review Incorrect Cards" functionality if implemented.

---

# Feature 4: Deck Overview Page Restructuring (Interactive Grouping)

**Version:** 1.0
**Date:** 2025-05-22
**Depends On:**
*   Phase 0 (Foundational DB/Settings Changes) for `settings.deck_list_grouping_preference` and RPC enhancement.
*   Feature X (App Structure Refactor) for establishing the `/practice/decks` page where this feature will primarily apply, and potentially the `/test/decks` page.

## 1. Feature Description & Objectives

This feature enhances the deck overview pages (primarily within "Practice" mode, and respected in "Test" mode's deck selection) by allowing users to group their decks based on various criteria. This aims to improve organization, reduce visual clutter for users with many decks, and make it easier to find specific content.

**Key Objectives:**

*   **Flexible Grouping:** Allow users to group decks by:
    *   No grouping (flat list - default).
    *   Primary Tag.
    *   Primary Language.
    *   A combination (e.g., Language first, then Tag within each language).
*   **Interactive Controls:** Provide UI controls directly on the deck list page for users to select and change their grouping preference.
*   **Persistent Preference:** The user's chosen grouping preference will be saved in their settings and applied automatically on subsequent visits.
*   **Improved Discoverability:** Help users navigate and find decks more efficiently.

## 2. Key Technical Components & Changes

*   **Database (`settings` table):**
    *   `deck_list_grouping_preference` (TEXT, NOT NULL, DEFAULT 'none'). Stores values like 'none', 'tag', 'language', 'language,tag'.
*   **RPC (`get_decks_with_complete_srs_counts`):**
    *   Must be enhanced to return an array of associated tags (e.g., `[{id: uuid, name: text}, ...]`) for each deck. This is crucial for "Group by Tag".
*   **Settings Management:**
    *   Updates to `types/database.ts`, `SettingsProvider`, `settingsActions.ts` for `deck_list_grouping_preference`.
*   **Client Component for Deck List (e.g., `DeckListClient.tsx` or a new `GroupableDeckListClient.tsx`):**
    *   This component will be used on `/practice/decks` and adapted for `/test/decks`.
    *   It will fetch the user's `deck_list_grouping_preference` from `useSettings()`.
    *   It will contain the logic to process the flat list of decks (now including their tags from the RPC) into a grouped data structure based on the preference.
    *   It will render the decks using nested structures (e.g., `Accordion` components from shadcn/ui) if grouping is active.
*   **UI Controls:**
    *   Dropdowns or Segmented Controls on the deck list page to select grouping options. These controls will update the `deck_list_grouping_preference` in user settings.

## 3. Action Plan & Status Tracker

**Phase 0: Foundational DB/Settings & RPC Changes (Prerequisite - see separate plan)**
*   `[ ]` **Task 0.1-0.5 (partially):** Ensure `deck_list_grouping_preference` setting is added to `settings` table and integrated.
*   `[ ]` **Task 0.6 (CRUCIAL):** Modify the `get_decks_with_complete_srs_counts` RPC (or create a new version) to include an array of tags (e.g., `deck_tags: Array<{id: string, name: string}>`) for each deck returned.
    *   This involves joining `decks` with `deck_tags` and then `tags`, and aggregating tag information per deck.
    *   Update `DeckListItemWithCounts` type in `lib/actions/deckActions.ts` to reflect this.

**Phase 1: Client-Side Grouping Logic & UI Controls**
*   `[ ]` **Task 1.1:** In `DeckListClient.tsx` (or a new `GroupableDeckListClient.tsx`):
    *   Fetch `settings.deck_list_grouping_preference` using `useSettings()`.
    *   Add local state to manage the current active grouping selections (e.g., `primaryGroup: 'language' | 'tag' | 'none'`, `secondaryGroup: 'tag' | 'none'`). Initialize from the saved preference.
*   `[ ]` **Task 1.2:** Implement UI controls on the page header of `/practice/decks`:
    *   Example: Two `Select` components: "Primary Grouping: [None, Language, Tag]" and "Secondary Grouping: [None, Tag (only if primary is Language)]".
    *   When these controls change:
        *   Update the local active grouping state.
        *   Construct the preference string (e.g., 'language,tag', 'tag', 'none').
        *   Call `updateSettings` to save the new `deck_list_grouping_preference` (debounced).
*   `[ ]` **Task 1.3:** Develop memoized data processing logic within the client component:
    *   Input: Flat array of `DeckListItemWithCounts` (now including `deck_tags`).
    *   Input: Current active grouping selections.
    *   Output: A nested data structure suitable for rendering grouped lists.
        *   If "None": Return flat list.
        *   If "Language": `Record<string, DeckListItemWithCounts[]>` (key is language).
        *   If "Tag": `Record<string, DeckListItemWithCounts[]>` (key is tag name; handle "Untagged"; a deck can appear in multiple tag groups).
        *   If "Language,Tag": `Record<string, Record<string, DeckListItemWithCounts[]>>`.
*   `[ ]` **Task 1.4:** Update the rendering logic:
    *   If grouped, use `shadcn/ui Accordion` components (potentially nested) to display groups.
    *   Accordion triggers will be Language names or Tag names.
    *   Accordion content will be the list of deck cards belonging to that group.
    *   Deck cards themselves are rendered as before (but without "Edit" buttons in Practice mode).

**Phase 2: Integration into "Practice" and "Test" Deck Views**
*   `[ ]` **Task 2.1:** Ensure `app/[locale]/practice/decks/page.tsx` uses the enhanced `DeckListClient.tsx` (or `GroupableDeckListClient.tsx`) and displays the grouping controls. Action button per deck: "Practice (Unified)".
*   `[ ]` **Task 2.2:** Ensure `app/[locale]/test/decks/page.tsx` also uses the same enhanced client component.
    *   It should *read* the global `deck_list_grouping_preference` to display decks similarly.
    *   It might *not* display the grouping *controls* (or they could be read-only indications of the current grouping), as changing grouping might be more contextually tied to the "Practice" view. This is a UX decision.
    *   Action button per deck: "Start Examination".

**Phase 3: Testing & Refinement**
*   `[ ]` **Task 3.1:** Test all grouping combinations: None, Language only, Tag only, Language then Tag.
*   `[ ]` **Task 3.2:** Verify correct behavior for decks with no tags, one tag, or multiple tags (should appear under each relevant tag group if "Group by Tag" is active).
*   `[ ]` **Task 3.3:** Test persistence of grouping preference in settings and its application on page reload/revisit.
*   `[ ]` **Task 3.4:** Assess UI/UX of the grouping controls and the grouped display, especially with nested accordions.
*   `[ ]` **Task 3.5:** Check performance with a large number of decks and/or tags. Ensure client-side grouping logic is efficient.
*   `[ ]` **Task 3.6:** Confirm that both the Practice deck view and Test deck selection view correctly apply the chosen grouping.

