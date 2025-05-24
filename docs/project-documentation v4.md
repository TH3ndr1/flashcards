# Project Documentation: StudyCards App

**Version:** 4.0 (Post-Study-Refactor & UI Cleanup)
**Date:** 2025-05-22

---

## Table of Contents

1.  [Executive Summary](#1-executive-summary)
2.  [Conceptual Overview: Prepare vs. Practice](#2-conceptual-overview-prepare-vs-practice)
3.  [Business Context](#3-business-context)
    *   [3.1 Problem Statement](#31-problem-statement)
    *   [3.2 Key Stakeholders](#32-key-stakeholders)
    *   [3.3 User Personas](#33-user-personas)
    *   [3.4 Business Workflows](#34-business-workflows)
4.  [Functional Requirements](#4-functional-requirements)
    *   [4.1 Core Features](#41-core-features)
    *   [4.2 Prepare Mode Features](#42-prepare-mode-features)
    *   [4.3 Practice Mode Features](#43-practice-mode-features)
    *   [4.4 Accessibility & Inclusivity](#44-accessibility--inclusivity)
    *   [4.5 Key User Interactions](#45-key-user-interactions)
5.  [Technical Architecture](#5-technical-architecture)
    *   [5.1 Technology Stack](#51-technology-stack)
    *   [5.2 Frontend Architecture](#52-frontend-architecture)
    *   [5.3 Backend Architecture](#53-backend-architecture)
    *   [5.4 Database Schema](#54-database-schema)
        *   [5.4.1 Tables](#541-tables)
        *   [5.4.2 Views](#542-views)
        *   [5.4.3 Functions](#543-functions)
    *   [5.5 Navigation Structure](#55-navigation-structure)
    *   [5.6 Code Structure and Organization](#56-code-structure-and-organization)
        *   [5.6.1 Component Architecture](#561-component-architecture)
        *   [5.6.2 Directory Structure](#562-directory-structure)
        *   [5.6.3 Key Components and Their Functions](#563-key-components-and-their-functions)
        *   [5.6.4 State Management](#564-state-management)
        *   [5.6.5 Data Flow](#565-data-flow)
        *   [5.6.6 Performance Considerations](#566-performance-considerations)
        *   [5.6.7 Logging Strategy](#567-logging-strategy)
    *   [5.7 Authentication Flow](#57-authentication-flow)
    *   [5.8 Codebase Structure and File Interactions](#58-codebase-structure-and-file-interactions)
        *   [5.8.1 File Structure Overview](#581-file-structure-overview)
        *   [5.8.2 Core File Interactions (Diagram)](#582-core-file-interactions-diagram)
        *   [5.8.3 File Descriptions](#583-file-descriptions)
        *   [5.8.4 Data Flow Patterns (Diagram)](#584-data-flow-patterns-diagram)
6.  [Core Feature Implementation Details](#6-core-feature-implementation-details)
    *   [6.1 Study Session Initiation & Execution Flow](#61-study-session-initiation--execution-flow)
    *   [6.2 SRS Algorithm: SM-2 & Custom Learning Algorithms](#62-srs-algorithm-sm-2--custom-learning-algorithms)
        *   [6.2.1 SRS States & Transitions](#621-srs-states--transitions)
        *   [6.2.2 SM-2 Calculations & Algorithm Logic (`lib/srs.ts`, `lib/study/card-state-handlers.ts`)](#622-sm-2-calculations--algorithm-logic-libsrsts-libstudycard-state-handlersts)
    *   [6.3 AI Q&A Generation Workflow (Google Cloud)](#63-ai-qa-generation-workflow-google-cloud)
7.  [Component Breakdown (Key Components)](#7-component-breakdown-key-components)
8.  [Security Considerations](#8-security-considerations)
9.  [Development & Deployment Workflow](#9-development--deployment-workflow)
10. [Known Issues / Future Roadmap](#10-known-issues--future-roadmap)
11. [References](#11-references)
12. [Changelog](#12-changelog)
13. [Implementation Action Plan & Status](#13-implementation-action-plan--status)

---

## 1. Executive Summary

### Purpose and Objectives
StudyCards is a modern, multilingual learning platform designed for maximum learning efficiency and inclusivity. It aims to enhance the study experience through:
*   **Effective Spaced Repetition:** Implementing proven SRS algorithms (SM-2 foundation) with distinct user-configurable initial learning algorithms ('Dedicated Learn' streak-based or 'Standard SM-2' timed steps) and clear session types ('Learn-only', 'Review-only', 'Unified Practice').
*   **Flexible Content Management:** Allowing users to organize content via decks and tags, and create custom study sessions using "Smart Playlists" (Study Sets).
*   **AI-Powered Content Creation:** Enabling users to automatically generate flashcards from uploaded PDF documents or images.
*   **Accessibility:** Providing features specifically designed to support learners with dyslexia, ADHD, and other challenges (font choices, colors, TTS, simple UI).
*   **Multi-modal Learning:** Supporting text and audio (TTS).

### Target Users
Students of all ages, language learners, self-learners, teachers, particularly benefiting those seeking efficient study methods and users with learning differences.

### Key Differentiators
*   Robust SRS (SM-2) with distinct initial learning algorithms ('Dedicated Learn' streak or 'Standard SM-2' steps) and session types ('Learn-only', 'Review-only', 'Unified Practice').
*   Seamless AI-powered card generation from user documents/images.
*   Strong focus on accessibility and inclusivity features.
*   Clean, intuitive, distraction-free user interface optimized for learning.
*   Flexible, query-based study sessions using tags, deck affiliation, and other criteria ("Smart Playlists").

---

## 2. Conceptual Overview: Prepare vs. Practice

The application's functionality is divided into two main modes:

*   **Prepare Mode:** Encompasses all aspects of content creation, organization, and setup. This includes managing decks, creating/editing individual cards, managing tags, creating/editing Study Sets ("Smart Playlists"), and using the AI Flashcard Generator.
*   **Practice Mode:** Focuses entirely on the active learning and review process using the prepared content. This involves initiating study sessions using different `SessionType`s ('Learn-only', 'Review-only', or 'Unified Practice') sourced from decks, tags (via Smart Playlists), or Smart Playlists ('Study Sets'). Interacting with flashcards (flipping, grading), and leveraging the SRS scheduling. The initial learning phase behavior is determined by the user's chosen `studyAlgorithm` setting ('Dedicated Learn' or 'Standard SM-2').

This conceptual separation guides the UI navigation and feature organization.

---

## 3. Business Context

### 3.1 Problem Statement
Traditional flashcard methods and simpler apps often lack the flexibility, efficiency, and features needed for modern, optimized learning:
- Limited accessibility across devices.
- No or basic audio support for pronunciation.
- Difficulty in tracking granular progress and understanding memory decay.
- Inflexible study options (often limited to single decks).
- Lack of robust, evidence-based spaced repetition integrated seamlessly.
- Difficulty studying related concepts across different decks or focusing on specific card types (e.g., only difficult cards, only due cards).

### 3.2 Key Stakeholders
- End Users (students, language learners, self-learners)
- Content Creators (teachers, education professionals)
- Platform Administrators
- Development Team

### 3.3 User Personas
1. Language Learner
   - Primary need: Vocabulary acquisition with pronunciation and context.
   - Key features: TTS, bilingual cards, tagging ('verbs', 'idioms'), SRS.
2. Student
   - Primary need: Subject matter revision and long-term retention.
   - Key features: Progress tracking, deck organization, query-based study (due cards, chapter tags), SRS.
3. Teacher
   - Primary need: Content creation and organization.
   - Key features: Deck management, multi-language support, tagging for structure.

### 3.4 Business Workflows
1. User Registration and Authentication
2. Deck Creation (Manual or AI) and Management
3. Tag Creation and Management (Assigning tags to decks/cards)
4. Study Set Creation and Management (Defining query criteria)
5. Study Session Initiation (User selects content source like Deck, 'All Cards', or Study Set, and a `SessionType`: 'Learn-only', 'Review-only', or 'Unified Practice' (from Deck List)).
6. Study Session Execution (System presents cards based on `SessionType` and, for initial learning, the user's chosen `studyAlgorithm` setting).
7. Card Review and SRS Update (Answering card, system calculates next state, saves state)
8. Progress Tracking and Analytics (Overall stats, card-level SRS state)
9. User Settings Management (Including SRS algorithm preference)
10. AI Flashcard Generation (Upload -> Process -> Review -> Save as Deck)
11. Content Sharing and Collaboration (Future)

---

## 4. Functional Requirements

### 4.1 Core Features
*   User Authentication (Supabase Auth).
*   Multi-language support (UI and potentially content).
*   Responsive design (Mobile, Tablet, Desktop).
*   User Settings management.

### 4.2 Prepare Mode Features
*   **Deck Management:**
    *   **Create Decks:**
        *   **Manual Path:** User navigates to `/decks/new`. Chooses 'Create Manually'. Fills metadata (name, languages) in a form. On submit, client calls `POST /api/decks` which creates the deck and returns its ID. Client then navigates to `/edit/[newDeckId]`.
        *   **AI Path:** User navigates to `/prepare/ai-generate` (or via `/decks/new` choice page). Upload file(s). Client calls `POST /api/extract-pdf` for initial Q/A. User reviews, potentially triggers intermediate processing via `POST /api/process-ai-step2` (for classification or knowledge mode regeneration). User enters Deck Name. Client calls `POST /api/decks` with metadata and final flashcards. On success, navigates to `/edit/[newDeckId]`.
    *   View Decks: List user's decks (`/` via `DeckListClient.tsx`).
    *   Edit Decks: Modify deck metadata, manage cards, and assign/unassign deck tags (`/edit/[deckId]` page via `useEditDeck` hook).
    *   Delete Decks: Remove decks and associated cards (via `DeckDangerZone` component on `/edit/[deckId]` page, triggering `useEditDeck().handleDeleteDeckConfirm` -> `deckActions.deleteDeck`).
*   **Card Management:** Create, view, edit, delete individual cards within the deck edit page (`/edit/[deckId]`, managed by `useEditDeck` hook calling `cardActions`).
*   **Tag Management:**
    *   Create, view, delete user-specific global tags (`/tags` page via `TagManagerClient.tsx`, using `tagActions`).
    *   Assign/remove global tags to/from specific decks (via `DeckTagEditor` component on `/edit/[deckId]` page, using `tagActions.addTagToDeck`, `tagActions.removeTagFromDeck`).
*   **Study Set ("Smart Playlist") Management:**
    *   Create/Save complex filter criteria as named Study Sets (`/study/sets/new` via `StudySetBuilder` component and `useStudySetForm` hook).
    *   View/List saved Study Sets (`/study/sets` page via `StudySetListClient.tsx`).
    *   Edit existing Study Sets (`/study/sets/[id]/edit` via `StudySetBuilder`).
    *   Delete saved Study Sets (`/study/sets` page).
    *   **Filter Criteria (`StudyQueryCriteria`):** Support filtering by Deck(s), Deck Tags (Include Any/All, Exclude), Date ranges (Created, Updated, Last Reviewed, Next Due - including 'never', 'isDue'), SRS Level (equals, <, >). Includes `includeLearning` flag (filters for cards `srs_level = 0` AND (`learning_state IS NULL` OR `learning_state = 'learning'`)).
*   **AI Flashcard Generator (`/prepare/ai-generate`):**
    *   Upload PDF or Image files.
    *   Trigger backend processing (`POST /api/extract-pdf`).
    *   Display generated flashcards and summary.
    *   Allow user to trigger intermediate AI processing (`POST /api/process-ai-step2`).
    *   Allow user to name new deck and save (`POST /api/decks`).

### 4.3 Practice Mode Features
*   **Study Session Initiation:** Start sessions based on:
    *   A specific Deck (from `/` page "Practice" button, initiates `'unified'` `SessionType`).
    *   All user cards (from `/study/select`, can be `'learn-only'` or `'review-only'` `SessionType`).
    *   A specific Tag (typically via a Smart Playlist that filters by tags).
    *   A saved Study Set ("Smart Playlist") (from `/study/sets` or `/study/select`, can be `'learn-only'` or `'review-only'` `SessionType`).
*   **Session Type Selection & Behavior:** The type of study session determines which cards are initially queued and how the session progresses.
    *   **`Learn-only` Session (e.g., from `/study/select` "Learn New" button):**
        *   Initially queues cards from the selected source where `srs_level = 0` AND (`learning_state IS NULL` OR `learning_state = 'learning'`).
        *   New cards (`learning_state IS NULL`) transition to `learning_state = 'learning'` (in DB) upon their first answer that doesn't graduate them.
        *   Card progression within this session follows the user's chosen `settings.studyAlgorithm` ('dedicated-learn' or 'standard-sm2') until graduated or the session ends.
    *   **`Review-only` Session (e.g., from `/study/select` "Review Due" button):**
        *   Initially queues cards from the selected source where (`srs_level >= 1` OR (`srs_level = 0` AND `learning_state = 'relearning'`)) AND `next_review_due <= NOW()`.
        *   Card progression follows SM-2 rules for review and relearning steps.
    *   **`Unified Practice` Session (e.g., from Deck List "Practice" button):**
        *   The `useStudySession` hook, when `sessionType` is `'unified'`, handles two phases:
            1.  **Learning Phase:** Prioritizes and processes all `learn-only` eligible cards from the source using the chosen `settings.studyAlgorithm`.
            2.  **Review Phase Transition:** After all learning cards are processed, if review-eligible cards exist, the user is prompted: "Learning phase complete. Continue to Review?".
            3.  **Review Phase:** If the user continues, the session proceeds with `review-only` eligible cards from the source, following SM-2 rules.
*   **Study Interface (`StudyFlashcardView.tsx`):**
    *   Display current card. Allow flipping. Provide grading buttons (Again, Hard, Good, Easy).
    *   Display session progress (e.g., Card X / Y based on `initialEligibleCardCount`).
    *   Display current card status (e.g., "Streak: 2/3", "Learn Step 1/2", "Review Lvl 3 • Due Now!").
    *   Display session completion feedback.
*   **SRS Engine & State Management (orchestrated by `useStudySession`, logic in `lib/study/card-state-handlers.ts` & `lib/srs.ts`):**
    *   **Initial Learning (`srs_level = 0`, `learning_state IS NULL` or `'learning'`):**
        *   If `settings.studyAlgorithm` is `'dedicated-learn'`: Uses streak (`InternalCardState.streak`) and in-session re-queueing. Graduation (streak >= `settings.masteryThreshold` or "Easy") transitions card to Review state (`srs_level = 1`, `learning_state = null`), EF calculated by `createGraduationPayload` using DB `failed_attempts_in_learn`/`hard_attempts_in_learn`.
        *   If `settings.studyAlgorithm` is `'standard-sm2'`: Uses timed steps (`settings.initialLearningStepsMinutes`). Graduation (completing steps or "Easy") transitions to Review state, EF calculated by `createGraduationPayload`.
    *   **Relearning (`srs_level = 0`, `learning_state = 'relearning'`):** Uses timed steps (`settings.relearningStepsMinutes`). Graduation re-enters Review state (`srs_level=1`), EF set by `createRelearningGraduationPayload`.
    *   **Review (`srs_level >= 1`):** Uses `calculateSm2State`. Lapses (Grade 1) transition to Relearning state (EF penalized). Successful reviews update SRS parameters.
    *   All card state updates (SRS fields, counts) are debounced and persisted via `progressActions.updateCardProgress`.
*   **Text-to-Speech (TTS):**
    *   Read card front/back content aloud. Language determined from deck settings. User can toggle in settings. Logic refined to re-speak question on flip-back.

### 4.4 Accessibility & Inclusivity
*   **Dyslexia Support:** Font choices (Settings), spacing (Theme/CSS), color themes (Theme), TTS.
*   **ADHD Support:** Minimalist UI, progress indicators, content chunking, clear session goals/completion, less punitive 'Hard' in Dedicated Learn.
*   **General:** TTS support.

### 4.5 Key User Interactions
1.  **Deck Creation Flow (Manual):** Navigate `/decks/new` -> Choose 'Manual' -> Fill Form -> `POST /api/decks` -> Navigate `/edit/[deckId]`.
2.  **Deck Creation Flow (AI):** Navigate `/prepare/ai-generate` (or via `/decks/new`) -> Upload -> `POST /api/extract-pdf` -> Review & Refine (optional `POST /api/process-ai-step2`) -> Name Deck -> `POST /api/decks` -> Navigate `/edit/[deckId]`.
3.  **Deck Editing Flow (`/edit/[deckId]`):** Page uses `useEditDeck`. Metadata changes trigger debounced `deckActions.updateDeck`. Card changes trigger `cardActions`. Tag changes trigger `tagActions`.
4.  Tag Management Flow (`/tags` page & `DeckTagEditor` on deck edit page).
5.  Study Set Creation Flow (`/study/sets/new` using `StudySetBuilder`).
6.  Study Session Initiation Flow (User selects content source & `SessionType`. Deck List "Practice" button initiates 'unified'. `/study/select` initiates 'learn-only' or 'review-only').
7.  Study Session Execution Flow (Handled by `useStudySession` based on `SessionType` and `studyAlgorithm` setting).
8.  Settings Flow (`/settings` page, UI for `studyAlgorithm` selection deferred - Task 4.4).

---

## 5. Technical Architecture

### 5.1 Technology Stack
*   Frontend: Next.js 15+ (App Router), React 19+, TypeScript
*   Backend: Serverless via Next.js Server Actions and API Routes
*   Database: Supabase (PostgreSQL)
*   Database Functions: `resolve_study_query` (pl/pgsql), `get_decks_with_complete_srs_counts` (pl/pgsql)
*   Database Views: `cards_with_srs_stage` (updated to use `srs_level` and `learning_state`)
*   Authentication: Supabase Auth via `@supabase/ssr`
*   State Management: Zustand (`studySessionStore`, `mobileSidebarStore`), React Context (`SettingsProvider`, `AuthProvider`)
*   UI: Tailwind CSS, `shadcn/ui`
*   Forms: `react-hook-form`, `zod`
*   Audio: Google Cloud TTS API (`@google-cloud/text-to-speech`) via `ttsActions` (server action) and `useTTS` (client hook).
*   AI Services: Google Cloud Document AI, Vision AI, Vertex AI (`@google-cloud/...` packages) via API routes.
*   PDF Processing: `pdf-lib`
*   File Storage: Supabase Storage (for AI Gen uploads > 4MB)
*   Utilities: `date-fns`, `lucide-react`, `sonner` (toasts)
*   Development Tools: TypeScript, ESLint, Prettier

### 5.2 Frontend Architecture
*   **Structure:** Next.js App Router (`app/`). Mix of Server and Client Components.
*   **Styling:** Tailwind CSS / `shadcn/ui`.
*   **Components:** Reusable UI (`components/ui/`), feature-specific (`components/study/`, `components/tags/`, `components/prepare/ai-generate/`, `components/deck/` etc.), layout (`components/layout/`).
*   **State Management:**
    *   Global Auth/Settings/Theme: React Context (`providers/`). `SettingsProvider` now includes `studyAlgorithm`, `themePreference`.
    *   Global UI State: Zustand (`store/` - e.g., `mobileSidebarStore`).
    *   Feature State/Logic: Custom Hooks (`hooks/`, page-specific hooks like `useEditDeck`, `useAiGenerate`).
    *   Study Session Parameters: Zustand (`studySessionStore` stores `StudySessionInput` and `SessionType`).
    *   Active Study Session Logic: `useStudySession` hook (refactored to be orchestrator, using helper modules for queue and state logic).
*   **Custom Hooks (`hooks/`, feature directories):**
    *   `useSupabase`, `useAuth`, `useSettings` (from `SettingsProvider`).
    *   `useDecks`: Manages deck list (uses `deckActions.getDecks` which calls `get_decks_with_complete_srs_counts` RPC), fetches single deck, updates metadata, creates (via `POST /api/decks`), deletes.
    *   `useTags`, `useStudySets`, `useCardTags` (for card-level tagging if implemented), `useDeckTags` (for deck-level tagging).
    *   `useStudySession`: Orchestrates the active study session.
    *   `useTTS`: Manages TTS playback logic.
    *   `useMobileSidebar`.
    *   `useEditDeck` (`app/edit/[deckId]/`).
    *   `useAiGenerate` (`app/prepare/ai-generate/`).

### 5.3 Backend Architecture
*   **Primary Mechanism:** Mix of Next.js Server Actions (`lib/actions/`) and API Routes (`app/api/`). Server Actions handle most direct data mutations and reads. API Routes handle AI processing orchestration and persistence of AI-generated content, as well as manual deck creation.
*   **Supabase Client:** Dedicated clients via `@supabase/ssr`.
*   **Key Actions (`lib/actions/`):**
    *   `cardActions`: `createCard`, `updateCard`, `deleteCard`, `getCardsByIds`, `getCardSrsStatesByIds`, `createCardsBatch`.
    *   `deckActions`: `getDecks` (Calls DB function `get_decks_with_complete_srs_counts`), `getDeck`, `createDeck` (called by `POST /api/decks`), `updateDeck`, `deleteDeck`.
    *   `tagActions`: `createTag`, `getTags`, `deleteTag`, `addTagToDeck`, `removeTagFromDeck`, `getDeckTags`, `addTagToCard`, `removeTagFromCard`, `getCardTags` (card-level if implemented).
    *   `studySetActions`: `createStudySet`, `getUserStudySets`, `getStudySet`, `updateStudySet`, `deleteStudySet`.
    *   `progressActions`: `updateCardProgress` (saves all SRS state fields).
    *   `studyQueryActions`: `resolveStudyQuery` (calls `resolve_study_query` DB function).
    *   `settingsActions`: Get/Update user settings (handles `studyAlgorithm`, `themePreference`, and all related study parameters).
    *   `ttsActions`: `generateTtsAction` for server-side TTS audio generation.
*   **Key API Routes (`app/api/`):**
    *   `extract-pdf/route.ts`: (Step 1 of AI Flow) Orchestrates AI file processing (upload, text extraction via `textExtractorService`, initial flashcard generation via `flashcardGeneratorService`).
    *   `process-ai-step2/route.ts`: (Step 2a - Intermediate AI Processing) Handles requests for classification or regeneration.
    *   `decks/route.ts`: (Used by Manual & AI Flow Step 2b - Final Persistence) Handles `POST` requests for creating new decks. For manual, it takes deck metadata and calls `deckActions.createDeck`. For AI flow, it takes deck metadata and final flashcards, creates the deck (via `deckActions.createDeck`), then calls `cardActions.createCardsBatch`.
*   **Database Function (`resolve_study_query`):** Filters cards based on `StudyQueryCriteria` JSON (including `srs_level`, `learning_state` via `includeLearning` flag, dates).
*   **Database Function (`get_decks_with_complete_srs_counts`):** Fetches decks with standard SRS stage counts AND `learn_eligible_count` and `review_eligible_count`.
*   **Database View (`cards_with_srs_stage`):** Categorizes cards into 'new', 'learning', 'relearning', 'young', 'mature' based on `srs_level`, `learning_state`, `interval_days`, and `settings.mature_interval_threshold`.
*   **AI Services (`app/api/extract-pdf/` services):**
    *   `textExtractorService.ts`: Abstracts Vision AI / Document AI logic for text extraction.
    *   `flashcardGeneratorService.ts`: Abstracts Vertex AI Gemini logic for multi-step flashcard generation (initial, classification, knowledge regeneration).
*   **Middleware (`middleware.ts`):** Manages session cookies/refresh.

### 5.4 Database Schema
#### 5.4.1 Tables
1.  **`users`** (Managed by Supabase Auth)
2.  **`settings`** (User preferences)
    *   `user_id`: `uuid` (PK, FK -> `auth.users.id`, ON DELETE CASCADE)
    *   `study_algorithm`: `text` (default: 'dedicated-learn', not null) - Stores 'dedicated-learn' or 'standard-sm2'.
    *   `enable_dedicated_learn_mode`: `boolean` (default: true, not null) - Potentially redundant if `study_algorithm` is primary.
    *   `mastery_threshold`: `integer` (default: 3, not null)
    *   `custom_learn_requeue_gap`: `integer` (default: 3, not null)
    *   `graduating_interval_days`: `integer` (default: 1, not null)
    *   `easy_interval_days`: `integer` (default: 4, not null)
    *   `relearning_steps_minutes`: `integer[]` (default: `'{10, 1440}'::integer[]`, not null)
    *   `initial_learning_steps_minutes`: `integer[]` (default: `'{1, 10}'::integer[]`, not null)
    *   `lapsed_ef_penalty`: `numeric` (default: 0.2, not null)
    *   `learn_again_penalty`: `numeric` (default: 0.2, not null)
    *   `learn_hard_penalty`: `numeric` (default: 0.05, not null)
    *   `min_easiness_factor`: `numeric` (default: 1.3, not null)
    *   `default_easiness_factor`: `numeric` (default: 2.5, not null)
    *   `mature_interval_threshold`: `integer` (default: 21, not null)
    *   `app_language`: `text` (default: 'en', not null)
    *   `card_font`: `text` (nullable)
    *   `language_dialects`: `jsonb` (nullable)
    *   `show_difficulty`: `boolean` (default: true, nullable)
    *   `show_deck_progress`: `boolean` (default: true, not null)
    *   `theme_light_dark_mode`: `text` (default: 'system', not null)
    *   `tts_enabled`: `boolean` (default: true, nullable)
    *   Other color-coding settings...
    *   `created_at`, `updated_at`
3.  **`decks`**
    *   `id`: `uuid` (PK)
    *   `user_id`: `uuid` (FK)
    *   `name`: `text` (Not null)
    *   `primary_language`, `secondary_language`: `text`
    *   `is_bilingual`: `boolean`
    *   `progress`: `jsonb` (Nullable) - Usage for aggregated stats needs review/clarification.
    *   `created_at`, `updated_at`
4.  **`tags`**
    *   `id`: `uuid` (PK)
    *   `user_id`: `uuid` (FK)
    *   `name`: `text` (Not null, Unique per user)
    *   `created_at`
5.  **`cards`**
    *   `id`: `uuid` (PK)
    *   `deck_id`: `uuid` (FK -> `decks.id`)
    *   `user_id`: `uuid` (FK -> `auth.users.id`)
    *   `question`: `text` (Not null)
    *   `answer`: `text` (Not null)
    *   `created_at`, `updated_at`
    *   **SRS Fields:**
        *   `last_reviewed_at`: `timestamptz` (nullable)
        *   `next_review_due`: `timestamptz` (nullable, INDEXED with user_id)
        *   `srs_level`: `integer` (default: 0, not null)
        *   `easiness_factor`: `float` (default: 2.5, not null)
        *   `interval_days`: `float` (default: 0, not null) - Stores fractional days for learning steps.
        *   `learning_state`: `text` (nullable, e.g., 'learning', 'relearning')
        *   `learning_step_index`: `integer` (nullable)
        *   `failed_attempts_in_learn`: `integer` (default: 0, not null)
        *   `hard_attempts_in_learn`: `integer` (default: 0, not null)
        *   `last_review_grade`: `integer` (nullable)
    *   **Grammar Fields (for AI):** `question_part_of_speech`, `question_gender`, `answer_part_of_speech`, `answer_gender` (`text`, nullable, default 'N/A').
    *   **General Stats:** `correct_count`, `incorrect_count`, `attempt_count` (integers, default 0).
6.  **`deck_tags`** (Join table for Decks and Tags)
    *   `deck_id`: `uuid` (FK -> `decks.id`)
    *   `tag_id`: `uuid` (FK -> `tags.id`)
    *   `user_id`: `uuid` (FK -> `auth.users.id`) - Denormalized for RLS.
    *   Primary Key: `(deck_id, tag_id)`
7.  **`study_sets`** ("Smart Playlists")
    *   `id`: `uuid` (PK)
    *   `user_id`: `uuid` (FK)
    *   `name`: `text` (Not null)
    *   `description`: `text` (Nullable)
    *   `query_criteria`: `jsonb` (Not null, Stores `StudyQueryCriteria`)
    *   `created_at`, `updated_at`

#### 5.4.2 Views
1.  **`cards_with_srs_stage`**
    *   **Purpose:** Joins `cards` with `settings` to categorize cards.
    *   **Updated Logic:** Calculates `srs_stage` ('new', 'learning', 'relearning', 'young', 'mature') based on `cards.srs_level`, `cards.learning_state`, `cards.interval_days`, and `settings.mature_interval_threshold`.

#### 5.4.3 Functions
1.  **`resolve_study_query(p_user_id uuid, p_query_criteria jsonb)`**
    *   **Arguments:** `p_user_id` (user's ID), `p_query_criteria` (JSONB object representing `StudyQueryCriteria`).
    *   **Return Type:** `SETOF uuid` (returns a set of card IDs).
    *   **Security:** `DEFINER`.
    *   **Purpose:** Takes `StudyQueryCriteria` JSON. Filters the `cards` table based on `user_id`, deck affiliation, deck tags, date ranges, SRS level (`srs_level`), and learning status (`learning_state` via the `includeLearning` flag in criteria). Returns all matching `card_id`s for a study session.

2.  **`get_decks_with_complete_srs_counts(p_user_id uuid)`**
    *   **Arguments:** `p_user_id` (user's ID).
    *   **Return Type:** `TABLE(id uuid, name text, primary_language text, secondary_language text, is_bilingual boolean, updated_at timestamp with time zone, new_count bigint, learning_count bigint, young_count bigint, mature_count bigint, relearning_count bigint, learn_eligible_count bigint, review_eligible_count bigint)`.
    *   **Security:** `DEFINER`.
    *   **Purpose:** Returns a list of all decks belonging to the specified user. For each deck, it includes metadata and a comprehensive breakdown of SRS counts:
        *   `new_count`: Cards with `srs_level = 0` and not in 'relearning'.
        *   `learning_count`: Cards with `srs_level = 0` and `learning_state = 'learning'`.
        *   `young_count`: Cards in early review stages (`srs_level > 0` and `interval_days < settings.mature_interval_threshold`).
        *   `mature_count`: Cards in advanced review stages (`srs_level > 0` and `interval_days >= settings.mature_interval_threshold`).
        *   `relearning_count`: Cards with `srs_level = 0` and `learning_state = 'relearning'`.
        *   `learn_eligible_count`: Cards eligible for a 'learn-only' session.
        *   `review_eligible_count`: Cards eligible for a 'review-only' session (due and not currently in initial learning).

3.  **`get_study_set_card_count(p_user_id uuid, p_query_criteria jsonb)`**
    *   **Arguments:** `p_user_id` (user's ID), `p_query_criteria` (JSONB object representing `StudyQueryCriteria`).
    *   **Return Type:** `integer` (returns a single count).
    *   **Security:** `DEFINER`.
    *   **Purpose:** Calculates and returns the total number of cards that match the provided `p_query_criteria` for the given `p_user_id`. This is a general utility function used by other functions and for dynamic count fetching.

4.  **`get_study_set_srs_distribution(p_user_id uuid, p_query_criteria jsonb)`**
    *   **Arguments:** `p_user_id` (user's ID), `p_query_criteria` (JSONB object representing `StudyQueryCriteria`).
    *   **Return Type:** `srs_distribution_counts` (a composite type: `new_count BIGINT, learning_count BIGINT, relearning_count BIGINT, young_count BIGINT, mature_count BIGINT, actionable_count BIGINT`).
    *   **Security:** `DEFINER`.
    *   **Purpose:** Calculates the distribution of cards across different SRS stages (new, learning, relearning, young, mature) based on the provided `p_query_criteria` for the given `p_user_id`. Also includes an `actionable_count` (new/review cards eligible for practice). Used for displaying progress bars on the `/practice/sets` page.

5.  **`get_user_global_srs_summary(p_user_id uuid)`**
    *   **Arguments:** `p_user_id` (user's ID).
    *   **Return Type:** `user_global_srs_summary_counts` (a composite type: `total_cards BIGINT, new_cards BIGINT, due_cards BIGINT, new_review_cards BIGINT`).
    *   **Security:** `DEFINER`.
    *   **Purpose:** Calculates and returns a summary of card counts across all cards belonging to the specified user: total cards, total new cards, total due cards (excluding those in initial learning/relearning), and total "new or review" cards. Used on the `/practice/select` page for the "All My Cards" option.

6.  **`get_user_study_sets_with_total_counts(p_user_id uuid)`**
    *   **Arguments:** `p_user_id` (user's ID).
    *   **Return Type:** `SETOF study_set_with_total_count` (a composite type that mirrors the `study_sets` table structure plus an additional `total_card_count BIGINT` field).
    *   **Security:** `DEFINER`.
    *   **Purpose:** Retrieves all study sets (smart playlists) for the given user. For each study set, it dynamically calculates the total number of cards matching that set's stored `query_criteria` and includes this count in the returned data. Used on the `/practice/select` page to efficiently load study sets with their counts.

7.  **`update_updated_at_column()`**
    *   **Arguments:** None (it's a trigger function).
    *   **Return Type:** `trigger`.
    *   **Security:** `INVOKER` (typical for trigger functions, runs with privileges of the statement that fired the trigger).
    *   **Purpose:** A standard trigger function designed to be attached to tables. When a row in an associated table is updated, this function automatically sets the `updated_at` column of that row to the current timestamp (`NOW()`).

### 5.5 Navigation Structure
*   **Sidebar (Primary Navigation):**
    *   Practice: "Start Session" (`/study/select`), "Smart Playlists" (`/study/sets`).
    *   Prepare: "Decks" (`/`), "Manage Tags" (`/tags`), "Create Deck" (`/decks/new`), "AI Flashcards" (`/prepare/ai-generate`).
    *   Other: "Settings" (`/settings`), Auth links.
*   **Header:** App Title/Logo, global icons, mobile Hamburger menu.
*   **Contextual Navigation:**
    *   Deck List (`/`): Links to Edit Deck (`/edit/[deckId]`). Single "Practice" button initiates `'unified'` `SessionType` to `/study/session`. "+ Create Deck" button navigates to `/decks/new`.
    *   Deck Creation (`/decks/new`): Offers choices (Manual, AI). Manual path form submits to `POST /api/decks`, then navigates to `/edit/[newDeckId]`. AI path links to `/prepare/ai-generate`.
    *   AI Generate Page (`/prepare/ai-generate`): Upload, generate, review, save form. Navigates to `/edit/[id]` on save via `POST /api/decks`.
    *   Study Set List (`/study/sets`): Links to Edit, New. "Learn"/"Review" buttons initiate `'learn-only'`/`'review-only'` `SessionType` to `/study/session`.
    *   Settings Page (`/settings`): UI for `studyAlgorithm` selection is deferred.

### 5.6 Code Structure and Organization
#### 5.6.1 Component Architecture
*   App Router structure with Server/Client components.
*   Custom hooks (`useEditDeck`, `useAiGenerate`, `useDecks`, `useStudySession`) encapsulate feature-level logic.
*   Breakdown into smaller, presentational sub-components.

#### 5.6.2 Directory Structure (Key Changes & Additions)
```plaintext
/
├── app/
│   ├── api/
│   │   ├── decks/route.ts      # POST for deck creation
│   │   ├── extract-pdf/      # AI Step 1 services & route
│   │   └── process-ai-step2/ # AI Step 2 services & route
│   ├── decks/
│   │   └── new/page.tsx        # Unified deck creation choice/form page
│   ├── edit/[deckId]/        # Deck Edit feature
│   ├── prepare/ai-generate/  # AI Generation UI & hook
│   ├── study/
│   │   ├── select/page.tsx   # Study Session Selection UI
│   │   ├── session/page.tsx  # Active Study Session UI
│   │   └── sets/             # Study Set (Smart Playlist) Management
│   └── tags/page.tsx         # Tag Management UI
├── components/
│   ├── deck-list.tsx         # Or DeckListClient.tsx - for home page
│   ├── study/
│   │   ├── StudySetSelector.tsx
│   │   └── StudyFlashcardView.tsx
│   └── ... (other UI components)
├── hooks/
│   ├── useStudySession.ts    # Refactored: orchestrates session logic
│   └── ... (other hooks like useDecks, useEditDeck, useAiGenerate, useTags)
├── lib/
│   ├── actions/              # Server Actions
│   ├── schema/               # Zod schemas (study-query.schema.ts updated)
│   ├── study/                # NEW: For study session core utilities
│   │   ├── card-state-handlers.ts
│   │   └── session-queue-manager.ts
│   └── srs.ts                # Core SM-2 math & algorithm helpers
├── providers/                # React Context providers
├── store/
│   └── studySessionStore.ts  # Stores StudySessionInput & SessionType
├── types/
│   ├── database.ts           # Auto-generated Supabase types
│   └── study.ts              # Central types for study (SessionCard, SessionType, etc.)
│                               # DELETED: card.ts, deck.ts
└── supabase/migrations/      # DB migrations
```

#### 5.6.3 Key Components and Their Functions (Selected Updates)
*   **`useStudySession` Hook:** Orchestrates the active study session. Receives `StudySessionInput` and `SessionType`. Fetches card data, uses `session-queue-manager` to prepare/update the queue, calls `card-state-handlers` to process answers based on card state and `settings.studyAlgorithm`, persists progress (debounced), manages UI state, and handles 'unified' session phase transitions.
*   **`DeckListClient.tsx` (or `deck-list.tsx`):** Displays decks from `useDecks`. Shows progress bars. Renders a single "Practice" button per deck, using `learn_eligible_count` and `review_eligible_count` for its label/state, initiating a `'unified'` `SessionType`.
*   **`StudySetSelector.tsx`:** UI on `/study/select`. Allows user to choose content source (All, Deck, Study Set) and then select study type (Learn New or Review Due), which translates to `'learn-only'` or `'review-only'` `SessionType`. Fetches and displays eligible card counts for these types.
*   **`app/settings/page.tsx`:** UI controls for `studyAlgorithm` selection and its parameters are deferred (Task 4.4).
*   **`app/decks/new/page.tsx`:** The primary entry point for creating decks, offering choices for manual or AI-assisted creation.
*   **`lib/study/card-state-handlers.ts`**: Contains pure functions applying SRS logic (from `lib/srs.ts`) based on card state, grade, and `settings.studyAlgorithm`. Returns `CardStateUpdateOutcome`.
*   **`lib/study/session-queue-manager.ts`**: Contains pure functions for `SessionCard[]` queue: `initializeQueue` (filters by `SessionType`, prioritizes, sets internal state, sorts), `findNextCardIndex`, `updateQueueAfterAnswer`, `getNextDueCheckDelay`.
*   **`types/study.ts`**: Defines core session types like `SessionCard`, `SessionType`, `CardStateUpdateOutcome`, `StudySessionInput`.
*   **`store/studySessionStore.ts`**: Zustand store now holds `currentInput: StudySessionInput | null` and `currentSessionType: SessionType | null`.


#### 5.6.4 State Management
*   **Global Auth/Settings/Theme:** React Context (`SettingsProvider` manages `studyAlgorithm`, etc.).
*   **Global UI State:** Zustand (`mobileSidebarStore`).
*   **Feature State/Logic:** Custom Hooks (`useEditDeck`, `useAiGenerate`).
*   **Study Session Parameters:** Zustand (`studySessionStore` stores `StudySessionInput` and `SessionType`).
*   **Active Study Session Logic:** The `useStudySession` hook manages all active session state internally, using helpers from `session-queue-manager.ts` and `card-state-handlers.ts`.

#### 5.6.5 Data Flow (Conceptual for Study Session)
1.  **Initiation:** UI (`DeckListClient` or `StudySetSelector`) -> `studySessionStore` (sets `StudySessionInput`, `SessionType`) -> Navigate to `/study/session`.
2.  **Session Page (`app/study/session/page.tsx`):** Reads from store -> Passes props to `useStudySession`.
3.  **`useStudySession`:**
    *   `resolveStudyQuery` action -> DB function -> Card IDs.
    *   `getCardsByIds` action -> DB -> `StudyCardDb[]`.
    *   `sessionQueueManager.initializeQueue` -> `SessionCard[]` queue.
    *   Presents card. User answers.
    *   `card-state-handlers` (using `lib/srs.ts`) -> `CardStateUpdateOutcome`.
    *   `sessionQueueManager.updateQueueAfterAnswer` -> New queue.
    *   `progressActions.updateCardProgress` -> DB.
    *   State updates trigger UI re-render.

#### 5.6.6 Performance Considerations
*   Leverage Next.js automatic code splitting. Use dynamic imports for large, non-critical client components.
*   Use Server Components for initial data loading where possible. Implement pagination/infinite scrolling for large lists.
*   Rely on Next.js Data Cache. Consider client-side caching libraries (SWR, TanStack Query) if complex client-side state synchronization is needed beyond custom hooks.
*   Monitor bundle size, minimize heavy client-side dependencies.
*   Ensure proper database indexing (especially for `resolve_study_query` filters, `cards.next_review_due`, and RLS lookups). Optimize queries.
*   Optimize client-side queue management in `session-queue-manager.ts` if performance issues arise with very large session queues.

#### 5.6.7 Logging Strategy

The application employs a hybrid logging strategy to ensure stability, provide useful debugging information across different environments, and allow for dedicated status tracking. All direct `console.log`, `console.error`, `console.warn` calls (outside of the logger setup itself) are to be replaced by the provided loggers.

*   **`appLogger` (`loglevel`-based):**
    *   **Library:** `loglevel`
    *   **Purpose:** General-purpose application-wide logging for events, debug information, warnings, and errors.
    *   **Configuration (`lib/logger.ts`):**
        *   **Client-side Development:** Uses `loglevel`'s default behavior, which maps directly to the browser's native `console.info()`, `console.warn()`, `console.error()`, and `console.debug()` methods. This preserves the browser's built-in log level filtering capabilities. Log level is set to 'debug'.
        *   **Server-side Development:** `loglevel`'s method factory is customized to output structured JSON to `stdout` (via `console.log`). Each log entry includes `level` (e.g., "INFO", "WARN"), `channel: 'app'`, `time` (timestamp), `msg` (the primary log message), and `err` (for Error objects, including message, stack, name) or `details` (for other accompanying data). Log level is set to 'debug'.
        *   **Server-side Production:** Similar to server-side development, outputs structured JSON to `stdout`. Log level is set to 'info'.
        *   **Client-side Production:** Uses `loglevel`'s default behavior (mapping to `console.*`). Log level is set to 'info'.

*   **`statusLogger` (`pino`-based):**
    *   **Library:** `pino`
    *   **Purpose:** Dedicated logging for specific system status updates, important milestones, or operational events that benefit from being recorded in a separate, persistent file.
    *   **Configuration (`lib/logger.ts`):**
        *   Uses `pino` with the `pino/file` transport.
        *   Outputs structured JSON to `./logs/status.log`. The `mkdir: true` option ensures the `logs` directory is created if it doesn't exist.
        *   Log entries include `level`, `channel: 'status'`, `time`, `pid`, `hostname`, `name: 'status'`, and any custom fields passed to the logger.
    *   **Server-Side Stability:** Requires `pino` and `thread-stream` (a pino dependency) to be listed in `serverExternalPackages` within `next.config.mjs`. This configuration instructs Next.js not to bundle these packages for the server, allowing them to be loaded via CommonJS from `node_modules` at runtime, which resolves worker thread conflicts.

*   **Intended Use:**
    *   `appLogger` should be the default choice for most logging needs within components, hooks, server actions, and API routes.
    *   `statusLogger` should be used sparingly for key events that need to be tracked in a dedicated log file, such as service initializations, critical background task completions, or significant state changes in persistent services.

### 5.7 Authentication Flow
The application utilizes Supabase Auth integrated with Next.js using the `@supabase/ssr` package.
*   **Middleware (`middleware.ts`):** Handles session cookie management and refresh using `createMiddlewareClient`.
*   **Server Clients (`lib/supabase/server.ts`):** Provides `createServerClient()` (for Server Components/Route Handlers) and `createActionClient()` (for Server Actions) using cookies.
*   **Client Client (`lib/supabase/client.ts` or hook):** Uses `createBrowserClient` for browser-side Supabase interactions.
*   **Auth Provider (`providers/AuthProvider.tsx` with `hooks/use-auth.tsx`):** Manages client-side session state and provides auth methods.

### 5.8 Codebase Structure and File Interactions
#### 5.8.1 File Structure Overview
*(Refer to Section 5.6.2 for the detailed directory structure snapshot.)*

#### 5.8.2 Core File Interactions (Diagram)

```mermaid
graph TD
    subgraph "Layout & Providers"
        A[app/layout.tsx] --> B_ClientProviders[ClientProviders/Providers]
        B_ClientProviders --> C_ThemeProvider[providers/ThemeProvider]; B_ClientProviders --> D_AuthProvider[providers/AuthProvider]; B_ClientProviders --> E_SettingsProvider[providers/SettingsProvider]
        E_SettingsProvider --> C_ThemeProvider # SettingsProvider influences ThemeProvider via useTheme
    end

    subgraph "Study Session Flow"
        F_useStudySession[hooks/useStudySession.ts] --> G_studyQueryActions[lib/actions/studyQueryActions.ts - resolveStudyQuery]
        F_useStudySession --> H_cardActions_Get[lib/actions/cardActions.ts - getCardsByIds]
        F_useStudySession --> I_progressActions[lib/actions/progressActions.ts - updateCardProgress]
        F_useStudySession --> K_studySessionStore[store/studySessionStore.ts] # Reads initial params (StudySessionInput, SessionType)
        F_useStudySession --> E_SettingsProvider # Reads settings

        F_useStudySession --> F_SQM[lib/study/session-queue-manager.ts] # Uses for queue logic
        F_useStudySession --> F_CSH[lib/study/card-state-handlers.ts] # Uses for answer processing
        F_CSH --> J_srs[lib/srs.ts] # card-state-handlers uses srs.ts for SM-2 math

        L_StudyFlashcardView[components/study/StudyFlashcardView.tsx] --> F_useStudySession # Triggers answerCard in useStudySession
        
        TTS_useTTS[hooks/useTTS.ts] --> TTS_ttsActions[lib/actions/ttsActions.ts - generateTtsAction]
        L_StudyFlashcardView --> TTS_useTTS # StudyFlashcardView uses useTTS for audio playback

        O_studySessionPage[app/study/session/page.tsx] --> F_useStudySession; O_studySessionPage --> L_StudyFlashcardView # Page uses hook & renders view
        
        P_studySelectPage[app/study/select/page.tsx] --> P_StudySelectClient[components/StudySelectClient.tsx]
        P_StudySelectClient --> K_studySessionStore # Sets initial params (SessionType: 'learn-only'/'review-only')
        P_StudySelectClient --> Q_StudySetSelector[components/study/StudySetSelector.tsx] # StudySelectClient renders StudySetSelector
        Q_StudySetSelector --> H_cardActions_Get # Needs cardActions/deckActions for initial counts for selector
        Q_StudySetSelector --> G_studyQueryActions # Needs studyQueryActions for initial counts for selector
    end

    subgraph "Deck List & Creation"
        R_useDecks[hooks/useDecks.ts] --> RA_deckActions[lib/actions/deckActions.ts - getDecks, getDeck, updateDeck, deleteDeck, createDeck]
        RA_deckActions -- getDecks calls --> DB_get_decks_with_complete_srs_counts[DB: get_decks_with_complete_srs_counts()]
        
        S_homePage[app/page.tsx] --> T_DeckListClient[components/DeckListClient.tsx]
        T_DeckListClient --> R_useDecks # For fetching list data
        T_DeckListClient --> T_DeckProgressBar[components/deck/DeckProgressBar.tsx] # Renders progress
        T_DeckListClient -- Practice Button Clicks --> K_studySessionStore # Sets initial params (SessionType: 'unified')
        
        S_createDeckPage[app/decks/new/page.tsx] -- Manual Path Form --> ZC_decksRoute_Manual[POST /api/decks/route.ts] # Manual creation uses /api/decks
        S_createDeckPage -- AI Path Link --> Y_aiGeneratePage[app/prepare/ai-generate/page.tsx]
        ZC_decksRoute_Manual -- uses internally --> RA_deckActions_create[lib/actions/deckActions.ts - createDeck] # API route calls server action for manual
    end

    subgraph "Deck Editing Flow"
        U_editDeckPage[app/edit/[deckId]/page.tsx] --> V_useEditDeck[hooks/useEditDeck.ts]
        V_useEditDeck --> R_useDecks # Uses getDeck, updateDeck from useDecks hook
        V_useEditDeck --> H_cardActions_Edit[lib/actions/cardActions.ts] # Uses cardActions (Create/Update/Delete cards)
        V_useEditDeck --> TA_tagActions_Deck[lib/actions/tagActions.ts] # Uses addTagToDeck, removeTagFromDeck, getDeckTags
        
        U_editDeckPage --> VA_DeckMetadataEditor[app/edit/[deckId]/DeckMetadataEditor.tsx]
        U_editDeckPage --> VB_EditableCardTable[app/edit/[deckId]/EditableCardTable.tsx] # May contain CardTagEditor
        U_editDeckPage --> VC_DeckTagEditor[app/edit/[deckId]/DeckTagEditor.tsx] # For assigning tags to deck
        U_editDeckPage --> VD_DeckDangerZone[app/edit/[deckId]/DeckDangerZone.tsx]
    end

    subgraph "AI Deck Creation Flow"
        Y_aiGeneratePage --> ZA_useAiGenerate[hooks/useAiGenerate.ts]
        ZA_useAiGenerate --> ZB_extractPdfRoute[POST /api/extract-pdf/route.ts]
        ZB_extractPdfRoute -- uses --> ZB_textExtractorService[api/extract-pdf/textExtractorService.ts]
        ZB_extractPdfRoute -- uses --> ZB_flashcardGeneratorService_initial[api/extract-pdf/flashcardGeneratorService.ts - generateInitialFlashcards]
        
        ZA_useAiGenerate --> ZD_processAiStep2Route[POST /api/process-ai-step2/route.ts] # For classification/regeneration
        ZD_processAiStep2Route -- uses --> ZD_flashcardGeneratorService_process[api/extract-pdf/flashcardGeneratorService.ts - classifyTranslationFlashcards, regenerateAsKnowledgeFlashcards]
        
        ZA_useAiGenerate --> ZC_decksRoute_AI[POST /api/decks/route.ts] # Final persistence for AI generated decks (sends metadata & cards)
        ZC_decksRoute_AI -- uses internally --> ZC_cardActions_batch[lib/actions/cardActions.ts - createCardsBatch]
    end

    subgraph "Tag Management (Global Tags & Deck Tags)"
        W_useTags_Global[hooks/useTags.ts] --> TAG_tagActions_Global[lib/actions/tagActions.ts - getTags, createTag, deleteTag] # For global tags
        TAG_TagManagerClient[components/tags/TagManagerClient.tsx] --> W_useTags_Global
        TAG_tagsPage[app/tags/page.tsx] --> TAG_TagManagerClient
        
        VC_DeckTagEditor --> TA_tagActions_Deck # DeckTagEditor uses addTagToDeck, removeTagFromDeck, getDeckTags from tagActions

        subgraph "Card-Level Tagging (If applicable, e.g., via EditableCardTable/CardEditor)"
            CARD_CardTagEditor_Comp[components/tags/CardTagEditor.tsx] --> CARD_useCardTags_Hook[hooks/useCardTags.ts]
            CARD_useCardTags_Hook --> TA_tagActions_CardLevel[lib/actions/tagActions.ts - addTagToCard, removeTagFromCard, getCardTags]
        end
    end

    subgraph "Study Set Management"
       AC_useStudySets[hooks/useStudySets.ts] --> AD_studySetActions[lib/actions/studySetActions.ts]
       AE_StudySetBuilder[components/study/StudySetBuilder.tsx] --> AD_studySetActions
       AF_studySetsPage[app/study/sets/page.tsx] --> AC_useStudySets
       AG_studySetsNewPage[app/study/sets/new/page.tsx] --> AE_StudySetBuilder
       AH_studySetsEditPage[app/study/sets/[id]/edit/page.tsx] --> AE_StudySetBuilder; AH_studySetsEditPage --> AC_useStudySets
    end

    subgraph "Authentication"
        AI_useAuth[hooks/useAuth.tsx] --> AJ_AuthProvider[providers/AuthProvider.tsx]
        AK_supabaseClient[lib/supabase/client.ts] --> AJ_AuthProvider
        AL_middleware[middleware.ts] -.-> AM_supabaseServerUtils[lib/supabase/server.ts] # Conceptually uses server client utils
        AN_ServerCode[Server Actions/API Routes] --> AM_supabaseServerUtils # Use server client for DB access
        AO_authPages[app/auth/*] --> AI_useAuth
    end

    subgraph "Settings Management"
        SET_settingsPage[app/settings/page.tsx] --> SET_useSettings[hooks/useSettings.ts] # Assuming useSettings is from SettingsProvider context
        SET_useSettings --> SET_settingsActions[lib/actions/settingsActions.ts - updateSettings, fetchSettings]
        SET_settingsPage --> NEXT_THEME_useTheme[hooks/useTheme (next-themes)] # To apply theme change
        SET_useSettings --> E_SettingsProvider # Reads from/updates SettingsProvider
        SET_settingsActions --> DB_settingsTable[DB: settings table]
    end

    subgraph "Database Interaction Layer"
        DB_cardsTable[DB: cards table]
        DB_decksTable[DB: decks table]
        DB_tagsTable[DB: tags table]
        DB_deck_tagsTable[DB: deck_tags table]
        DB_card_tagsTable[DB: card_tags table] # For card-level tags
        DB_study_setsTable[DB: study_sets table]
        DB_settingsTable

        G_studyQueryActions --> DB_cardsTable; H_cardActions_Get --> DB_cardsTable; I_progressActions --> DB_cardsTable
        RA_deckActions --> DB_decksTable; RA_deckActions --> DB_cardsTable 
        RA_deckActions_create --> DB_decksTable
        ZC_decksRoute_Manual --> DB_decksTable
        DB_get_decks_with_complete_srs_counts -- reads --> DB_decksTable; DB_get_decks_with_complete_srs_counts -- reads --> DB_cardsTable; DB_get_decks_with_complete_srs_counts -- reads --> DB_settingsTable

        TAG_tagActions_Global --> DB_tagsTable
        TA_tagActions_Deck --> DB_deck_tagsTable; TA_tagActions_Deck --> DB_tagsTable
        TA_tagActions_CardLevel --> DB_card_tagsTable; TA_tagActions_CardLevel --> DB_tagsTable 

        AD_studySetActions --> DB_study_setsTable
        AM_supabaseServerUtils --> DB_settingsTable; AM_supabaseServerUtils --> DB_decksTable; # etc.
        ZC_cardActions_batch --> DB_cardsTable
        ZB_extractPdfRoute -- may read --> DB_settingsTable # e.g. for API keys or user prefs for AI
    end
end
```

#### 5.8.3 File Descriptions (Key Updates)
*   **`hooks/useStudySession.ts`:** Orchestrates study session. Manages overall session lifecycle, UI state, and interactions. Delegates queue management to `session-queue-manager` and card state update logic to `card-state-handlers`. Handles different `SessionType`s, including the 'unified' mode's two-phase progression. Receives `StudySessionInput` and `SessionType`, resolves card IDs (via `studyQueryActions` and `cardActions`), prepares initial queue (via `sessionQueueManager`), manages the session loop, handles state transitions (via `cardStateHandlers`), triggers SRS calculations (from `lib/srs.ts` via handlers), saves progress (via `progressActions`), and provides state for UI (current card, progress, status display, completion).
*   **`lib/study/card-state-handlers.ts`:** Contains pure functions that determine the next state of a card after an answer (e.g., `handleInitialLearningAnswer`, `handleRelearningAnswer`, `handleReviewAnswer`). Takes current card data, internal session state, grade, and user settings. Uses `lib/srs.ts` for core SM-2 calculations and helpers like `createGraduationPayload`. Returns a `CardStateUpdateOutcome` object detailing database changes, next internal state, and queue management instructions.
*   **`lib/study/session-queue-manager.ts`:** Contains pure functions for managing the `SessionCard[]` queue. Includes `initializeQueue` (filters by `SessionType`, prioritizes, sets internal state, sorts), `findNextCardIndex` (finds next due card, considering timed steps), `updateQueueAfterAnswer` (modifies queue based on outcome from state handlers), and `getNextDueCheckDelay` (for timed steps).
*   **`types/study.ts`:** Defines core TypeScript types for the study session feature, such as `SessionCard`, `InternalCardState`, `SessionType`, `StudySessionInput`, `CardStateUpdateOutcome`. (Replaces `types/card.ts` and `types/deck.ts`).
*   **`store/studySessionStore.ts`:** Zustand store now holds `currentInput: StudySessionInput | null` and `currentSessionType: SessionType | null`, set by components like `DeckListClient` or `StudySelectClient`.
*   **`lib/actions/deckActions.ts`:**
    *   `getDecks`: Calls DB function `get_decks_with_complete_srs_counts` to fetch deck list with comprehensive SRS counts.
    *   `createDeck`: Server action used by `POST /api/decks/route.ts` to create the deck record in the database.
    *   Provides other standard CRUD operations (`getDeck`, `updateDeck`, `deleteDeck`).
*   **`hooks/useDecks.ts`**: Provides wrappers for `deckActions` (including `createDeck` which now likely calls the `/api/decks` route or a dedicated action for manual creation if the API route is solely for AI initial save), `updateDeck`, `deleteDeck`, `getDeck`, and `getDecks`.
*   **`lib/actions/studyQueryActions.ts`:** `resolveStudyQuery` action calls the updated `resolve_study_query` DB function which now supports `includeLearning` flag and has corrected date filtering.
*   **`lib/actions/ttsActions.ts`:** New server action `generateTtsAction` handles TTS requests, abstracting direct API calls from components.
*   **`lib/srs.ts`**: Contains all core Spaced Repetition (SM-2) calculation logic and state transition helpers, such as `calculateSm2State` (for review cards), `calculateInitialEasinessFactor`, `calculateNextStandardLearnStep`, `calculateNextRelearningStep`, `createGraduationPayload`, and `createRelearningGraduationPayload`.
*   **AI Services (`app/api/extract-pdf/services/*.ts`)**:
    *   `textExtractorService.ts`: Abstracts text extraction logic from PDF/Image files using Google Vision AI or Document AI. Includes page limit validation.
    *   `flashcardGeneratorService.ts`: Abstracts flashcard generation logic using Google Vertex AI (Gemini). Handles initial Q&A generation (`generateInitialFlashcards`), grammar classification (`classifyTranslationFlashcards`), and knowledge mode regeneration (`regenerateAsKnowledgeFlashcards`).

#### 5.8.4 Data Flow Patterns (Diagram)

```mermaid
graph TD
    subgraph "Study Session Flow"
        O_studySessionPage[app/study/session/page.tsx] -- "input (deckId/setId, etc.), sessionType" --> K_studySessionStore_WriteDP[store/studySessionStore.ts]
        K_studySessionStore_WriteDP -- "triggers navigation & provides" --> O_studySessionPage

        O_studySessionPage -- "passes input, sessionType" --> A_useStudySession[hooks/useStudySession.ts]
        A_useStudySession -- "1. calls (input)" --> G_studyQueryActions[lib/actions/studyQueryActions.ts - resolveStudyQuery]
        G_studyQueryActions -- "(cardIds)" --> A_useStudySession
        A_useStudySession -- "2. calls (cardIds)" --> H_cardActions_Get[lib/actions/cardActions.ts - getCardsByIds]
        H_cardActions_Get -- "(StudyCardDb[])" --> A_useStudySession
        
        A_useStudySession -- "3. uses (StudyCardDb[], sessionType, settings)" --> F_SQM_Util[lib/study/session-queue-manager.ts - initializeQueue, findNextCardIndex, updateQueueAfterAnswer]
        F_SQM_Util -- "(sessionQueue, nextCardIndex)" --> A_useStudySession
        
        L_StudyFlashcardView[components/study/StudyFlashcardView.tsx] -- "displays card from A_useStudySession.currentCard" --> UserInterface
        UserInterface -- "4. user grades card" --> L_StudyFlashcardView
        L_StudyFlashcardView -- "(grade)" --> A_useStudySession # answerCard method
        
        A_useStudySession -- "5. uses (currentCard, grade, internalState, settings)" --> F_CSH_Util[lib/study/card-state-handlers.ts - handleAnswer]
        F_CSH_Util -- "uses" --> J_srs_Util[lib/srs.ts - SM-2 Calculations]
        F_CSH_Util -- "(CardStateUpdateOutcome: dbChanges, nextInternalState, queueInstruction)" --> A_useStudySession
        
        A_useStudySession -- "6. calls (dbChanges from Outcome) (debounced)" --> I_progressActions[lib/actions/progressActions.ts - updateCardProgress]
        I_progressActions -- "(success/fail)" --> A_useStudySession
        A_useStudySession -- "7. updates its internal state (queue, currentCard, etc.)" --> L_StudyFlashcardView # Causes re-render
        A_useStudySession -- "provides session state (progress, current card status)" --> L_StudyFlashcardView


        E_SettingsProvider_Read[providers/SettingsProvider.ts] -- "(settings object)" --> A_useStudySession

        TTS_useTTS_Play[hooks/useTTS.ts] -- "used by" --> L_StudyFlashcardView
        L_StudyFlashcardView -- "requests TTS audio (text, lang)" --> TTS_useTTS_Play
        TTS_useTTS_Play -- "calls" --> TTS_ttsActions_Gen[lib/actions/ttsActions.ts - generateTtsAction]
        TTS_ttsActions_Gen -- "(audio URL/data)" --> TTS_useTTS_Play
        TTS_useTTS_Play -- "plays audio" --> UserInterface
    end

    subgraph "Manual Deck Creation Flow"
        CREATE_DECK_PAGE[app/decks/new/page.tsx] -- "User fills form (name, langs)" --> ClientAction_SubmitManualDeck
        ClientAction_SubmitManualDeck -- "(deckMetadata)" --> API_DECKS_CREATE_MANUAL[POST /api/decks/route.ts]
        API_DECKS_CREATE_MANUAL -- "internally calls (deckMetadata)" --> CREATE_DECK_ACTION_SRV[lib/actions/deckActions.ts - createDeck]
        CREATE_DECK_ACTION_SRV -- "creates deck in DB" --> DB_decksTable_Write[DB: decks table]
        CREATE_DECK_ACTION_SRV -- "(newDeckId)" --> API_DECKS_CREATE_MANUAL
        API_DECKS_CREATE_MANUAL -- "(newDeck: {id, name,...})" --> ClientAction_SubmitManualDeck
        ClientAction_SubmitManualDeck -- "navigates to /edit/[newDeckId]" --> UserInterface
    end
    
    subgraph "AI Deck Creation Flow"
        AI_GEN_PAGE[app/prepare/ai-generate/page.tsx] -- "uses" --> AI_GEN_HOOK[hooks/useAiGenerate.ts]
        UserInterface_Upload[User uploads files] --> AI_GEN_PAGE
        AI_GEN_PAGE -- "(files)" --> AI_GEN_HOOK # handleSubmit
        
        AI_GEN_HOOK -- "Step 1: (formData with files)" --> API_EXTRACT_PDF[POST /api/extract-pdf/route.ts]
        API_EXTRACT_PDF -- "uses" --> SVC_TEXT_EXTRACT[api/extract-pdf/textExtractorService.ts]
        API_EXTRACT_PDF -- "uses" --> SVC_FLASH_INIT[api/extract-pdf/flashcardGeneratorService.ts - generateInitialFlashcards]
        API_EXTRACT_PDF -- "(InitialGenerationResult[]: basicFlashcards, mode, langs; extractedTexts[])" --> AI_GEN_HOOK
        AI_GEN_HOOK -- "updates UI state" --> AI_GEN_PAGE # Displays results

        UserInterface_Review[User reviews, optionally triggers intermediate processing] --> AI_GEN_PAGE
        AI_GEN_PAGE -- "(action, data for specific file)" --> AI_GEN_HOOK # handleConfirmTranslation or handleForceKnowledge
        AI_GEN_HOOK -- "Step 2a: (action, filename, basicFlashcards/originalText)" --> API_PROCESS_AI[POST /api/process-ai-step2/route.ts]
        API_PROCESS_AI -- "uses" --> SVC_FLASH_PROCESS[api/extract-pdf/flashcardGeneratorService.ts - classifyTranslationFlashcards or regenerateAsKnowledgeFlashcards]
        API_PROCESS_AI -- "(Updated flashcard data for that file)" --> AI_GEN_HOOK
        AI_GEN_HOOK -- "updates UI state with processed flashcards" --> AI_GEN_PAGE

        UserInterface_SaveDeck[User names deck, clicks Save] --> AI_GEN_PAGE
        AI_GEN_PAGE -- "(deckName, finalFlashcards[])" --> AI_GEN_HOOK # handleSaveDeck
        AI_GEN_HOOK -- "Step 2b: (deckMetadata, finalFlashcards[])" --> API_DECKS_SAVE_AI[POST /api/decks/route.ts]
        API_DECKS_SAVE_AI -- "creates deck in DB" --> DB_decksTable_AI_Write[DB: decks table]
        API_DECKS_SAVE_AI -- "internally calls (finalFlashcards[], newDeckId)" --> CARD_ACTIONS_BATCH_AI[lib/actions/cardActions.ts - createCardsBatch]
        CARD_ACTIONS_BATCH_AI -- "creates cards in DB" --> DB_cardsTable_AI_Write[DB: cards table]
        API_DECKS_SAVE_AI -- "(newDeck: {id, name,...})" --> AI_GEN_HOOK
        AI_GEN_HOOK -- "navigates to /edit/[newDeckId]" --> UserInterface
    end
end
```

---

## 6. Core Feature Implementation Details

### 6.1 Study Session Initiation & Execution Flow

**Phase 1: Session Initiation (User Action -> Store -> Page Prop)**
1.  **Content & Type Selection:**
    *   **Deck List (`/`):** User clicks "Practice" on a deck. `DeckListClient.tsx` sets `StudySessionInput = { deckId }` and `SessionType = 'unified'` in `studySessionStore`.
    *   **Study Setup Page (`/study/select`):** User uses `StudySetSelector.tsx` to pick a source (All Cards, Deck, Study Set) creating a `StudySessionInput`, and selects a study type, which maps to `SessionType = 'learn-only'` or `SessionType = 'review-only'`. These are set in `studySessionStore`.
2.  **Navigation:** User is navigated to `/study/session`.
3.  **Parameter Passing:** `app/study/session/page.tsx` reads `StudySessionInput` and `SessionType` from the store and passes them as props to the `useStudySession` hook.

**Phase 2: Session Execution (`useStudySession` Hook)**
1.  **Initialization:**
    *   Hook receives `initialInput` and `sessionType`.
    *   Calls `resolveStudyQuery(initialInput)` action to get relevant `cardId[]` from DB (DB function filters by `deckId`, `studySetId`, or `criteria` including the `includeLearning` flag).
    *   Calls `getCardsByIds(cardId[])` action to fetch full `StudyCardDb` objects.
    *   Calls `sessionQueueManager.initializeQueue(fetchedCards, sessionType, settings)`:
        *   Filters cards based on `sessionType` and their current SRS state (`srs_level`, `learning_state`, `next_review_due`).
        *   Initializes `InternalCardState` for each eligible card.
        *   Sorts the queue (learn-eligible first in 'unified' mode, then by due time).
        *   If `sessionType` is 'unified', `useStudySession` determines initial `unifiedSessionPhase` ('learning' or 'review') based on initial queue content.
    *   Sets the `sessionQueue` state. `findNextCardIndex` determines the first card.
2.  **Study Loop:**
    *   The current card is displayed. TTS plays if enabled.
    *   User grades the card (1-4). `answerCard` method is called.
    *   `answerCard` calls the appropriate handler from `lib/study/card-state-handlers.ts` (e.g., `handleInitialLearningAnswer`) based on card's current `srs_level`, `learning_state`, and `settings.studyAlgorithm`.
    *   The handler function (using `lib/srs.ts` for SM-2 math) returns a `CardStateUpdateOutcome` detailing:
        *   `dbUpdatePayload`: Changes for `cards` table (new SRS state, counts, etc.).
        *   `nextInternalState`: Updated session-specific state for the card.
        *   `queueInstruction`: How to manage the card in the queue (`remove`, `re-queue-soon`, `re-queue-later`, `set-timed-step`).
        *   `sessionResultCategory`: If a metric like 'graduatedLearn' needs incrementing.
    *   `answerCard` updates `sessionResults` based on `sessionResultCategory` and grade.
    *   `answerCard` calls `debouncedUpdateProgress` to save `dbUpdatePayload`.
    *   `answerCard` calls `sessionQueueManager.updateQueueAfterAnswer` with the current queue and `CardStateUpdateOutcome`. This returns the `nextQueue`.
    *   `answerCard` updates `sessionQueue` state.
    *   **Unified Session Transition:** If `sessionType === 'unified'` and `unifiedSessionPhase === 'learning'`, and all learning cards are done, checks for review cards. If present, sets `showContinueReviewPrompt = true`.
    *   The `useEffect` watching `sessionQueue` calls `findNextCardIndex` to set the next `currentCardIndex` or handles completion/prompt. Timers managed via `getNextDueCheckDelay`.
3.  **Session Completion:** Occurs when `sessionQueue` is empty and no further phases (like 'unified' review phase) are pending.

### 6.2 SRS Algorithm: SM-2 & Custom Learning Algorithms

#### 6.2.1 SRS States & Transitions
1.  **New:** `srs_level = 0`, `learning_state = null`. Transitions to Initial Learning. The `learning_state` becomes `'learning'` and `learning_step_index` becomes `0` (in DB) upon the first graded answer that doesn't immediately graduate the card.
2.  **Initial Learning:** `srs_level = 0`, `learning_state = 'learning'`. Card progression depends on `settings.studyAlgorithm`. Transitions to Review on graduation.
3.  **Review:** `srs_level >= 1`, `learning_state = null`. Standard SM-2 cycle. Transitions to Review (updated SRS params) or Relearning (lapse).
4.  **Relearning:** `srs_level = 0`, `learning_state = 'relearning'`. Timed steps. Transitions to Review on completion.

#### 6.2.2 SM-2 Calculations & Algorithm Logic (`lib/srs.ts`, `lib/study/card-state-handlers.ts`)
*   Core SM-2 math (EF updates, interval calculations for review cards) is in `lib/srs.ts` (`calculateSm2State`).
*   Initial learning graduation logic (calculating initial EF, first interval) is in `lib/srs.ts` (`createGraduationPayload`). This uses the card's DB counters `failed_attempts_in_learn` and `hard_attempts_in_learn`.
*   Relearning graduation logic is in `lib/srs.ts` (`createRelearningGraduationPayload`).
*   Timed step progression logic for 'standard-sm2' initial learning and all relearning is in `lib/srs.ts` (`calculateNextStandardLearnStep`, `calculateNextRelearningStep`).
*   The **`lib/study/card-state-handlers.ts`** module contains:
    *   `handleInitialLearningAnswer`: Implements the `'dedicated-learn'` streak algorithm logic or calls `calculateNextStandardLearnStep` for the `'standard-sm2'` algorithm. Calls `createGraduationPayload` upon graduation.
    *   `handleRelearningAnswer`: Calls `calculateNextRelearningStep` and `createRelearningGraduationPayload`.
    *   `handleReviewAnswer`: Calls `calculateSm2State` to determine the next review state or a lapse into relearning.
    *   All handlers construct a `CardStateUpdateOutcome` object, which includes the `dbUpdatePayload` (fields to update in the `cards` table), the `nextInternalState` (for session management), and a `queueInstruction`.

### 6.3 AI Q&A Generation Workflow (Google Cloud)
1.  **Upload:** Client uploads PDF/Image files via `/prepare/ai-generate` page.
2.  **Step 1 - Extraction & Initial Generation (`POST /api/extract-pdf`):**
    *   Backend receives files (or storage paths).
    *   `textExtractorService.ts` uses Google Vision AI (images) or Document AI (PDFs - with logic to switch to imageless mode for larger PDFs up to `PAGE_LIMIT` if they exceed `DOCAI_OCR_PAGE_LIMIT`) to extract text.
    *   `flashcardGeneratorService.ts` (`generateInitialFlashcards`) sends extracted text to Google Vertex AI (Gemini) to generate basic Question/Answer pairs and detect `mode` ('translation' or 'knowledge') and languages.
    *   API returns `InitialGenerationResult[]` (Q/A, mode, langs per source), full `extractedTexts[]`, and `skippedFiles[]` to the client.
3.  **Step 2a - Client Review & Optional Intermediate AI Processing:**
    *   Client UI (`useAiGenerate` hook, `AiGenerateResultsCard`) displays initial Q/A and summary.
    *   If `mode` is 'translation', user may be prompted.
    *   User can trigger:
        *   "Add Grammar Details": Client sends basic Q/A to `POST /api/process-ai-step2` (action: `classify`). Backend calls `flashcardGeneratorService.classifyTranslationFlashcards` (uses Vertex AI) to get Part of Speech/Gender.
        *   "Change to Knowledge Mode": Client sends original extracted text (from `extractedTexts[]`) to `POST /api/process-ai-step2` (action: `force_knowledge`). Backend calls `flashcardGeneratorService.regenerateAsKnowledgeFlashcards` (uses Vertex AI).
    *   Client updates its internal flashcard data with results from Step 2a.
4.  **Step 2b - Final Persistence (`POST /api/decks`):**
    *   User names the new deck.
    *   Client (`useAiGenerate.handleSaveDeck`) sends deck metadata (name, final detected languages/mode) and the array of final `ApiFlashcard` objects (which now include any classifications from Step 2a, or regenerated Q/A) to the `POST /api/decks` route.
    *   The `/api/decks` route creates the `decks` record in the database (likely calling `deckActions.createDeck`).
    *   It then calls `cardActions.createCardsBatch` server action to insert all the flashcards into the `cards` table, associating them with the new deck ID and setting default SRS values.
5.  **Navigation:** On success, client navigates to `/edit/[newDeckId]`.

---

## 7. Component Breakdown (Key Components)

*   **Layout Components:**
    *   `app/layout.tsx` (`RootLayout`): Main layout wrapper integrating all providers (`ClientProviders`). Applies global theme via `ThemeProvider`.
    *   `components/layout/ResponsiveLayout.tsx`: Handles overall page structure including `Header` and `Sidebar`.
    *   `components/layout/Header.tsx` (formerly `SiteHeader`): Top navigation bar, app title/logo, global icons (Settings, Profile/Auth via `UserNav`), mobile menu toggle for `MobileNav`.
    *   `components/layout/Sidebar.tsx` (formerly `SiteSidebar`): Primary navigation menu (Prepare/Practice modes). Fixed on desktop, toggleable on mobile.
    *   `components/layout/MobileNav.tsx`: Mobile-specific navigation overlay.
*   **Providers (`providers/` & `components/ClientProviders.tsx`):**
    *   `components/ClientProviders.tsx`: Wraps client-side context providers like `AuthProvider` and `SettingsProvider`.
    *   `providers/AuthProvider.tsx`: Manages authentication state, user session, and provides auth methods (login, logout) via the `useAuth` hook.
    *   `providers/SettingsProvider.tsx`: Manages user preferences (theme, study algorithms, display options) via the `useSettings` hook. Persists settings to the database via `settingsActions`.
    *   `next-themes` (`ThemeProvider`): Handles application theming (light, dark, system), driven by `themePreference` from `SettingsProvider`.
*   **Core Study Components (`components/study/`, `app/study/`):**
    *   `app/study/session/page.tsx`: Main page orchestrating the study UI. Uses `hooks/useStudySession` hook. Displays `components/study/StudyFlashcardView.tsx`. Handles "Continue to Review" prompt for 'unified' sessions.
    *   `components/study/StudyFlashcardView.tsx`: Displays the current flashcard (question/answer content via `ContentRenderer`), handles flip animation, provides grading buttons (Again, Hard, Good, Easy), and shows card status information (e.g., streak, step, due time) derived from `useStudySession`. Integrates `hooks/useTTS` for audio playback.
    *   `app/study/select/page.tsx` & `components/StudySelectClient.tsx`: Entry point for starting custom study sessions. `StudySelectClient` renders `StudySetSelector`.
    *   `components/study/StudySetSelector.tsx`: UI for selecting content source (All Cards, specific Deck, or Study Set) and the `SessionType` ('learn-only' or 'review-only'). Displays eligible card counts using `cardActions` and `studyQueryActions`.
    *   `components/study/StudySetBuilder.tsx`: Form for creating and editing "Smart Playlists" (Study Sets) with various filter criteria (decks, tags, dates, SRS levels). Used with `hooks/useStudySetForm.ts`.
    *   `components/study/StudyCompletionSummary.tsx`: Displays results, statistics, and options at the end of a study session.
    *   `components/study/DifficultyIndicator.tsx`: (If implemented) Visual component showing SRS progress/difficulty of cards.
*   **Deck & Card Management Components (`components/deck/`, `app/decks/`, `app/edit/`):**
    *   `app/page.tsx` & `components/DeckListClient.tsx`: Displays the list of user's decks with `DeckProgressBar` and "Practice" buttons.
    *   `components/deck/DeckProgressBar.tsx`: Visual representation of card distribution within a deck across SRS stages (new, learning, relearning, young, mature).
    *   `app/decks/new/page.tsx`: Unified page for initiating deck creation, offering choices for manual or AI-assisted methods. Contains forms for manual deck metadata, which submit to `POST /api/decks`.
    *   `app/edit/[deckId]/page.tsx`: Orchestrates the deck editing interface using `hooks/useEditDeck.ts`. Renders various sub-components for metadata, cards, and tags.
    *   `app/edit/[deckId]/DeckMetadataEditor.tsx`: Component for editing deck-level details (name, languages, description).
    *   `app/edit/[deckId]/EditableCardTable.tsx`: Table-based view for managing cards within a deck. Allows for inline editing, adding, and deleting cards. Likely embeds or opens a more detailed `CardEditor` for complex edits.
    *   `components/CardEditor.tsx` (or similar form component): A comprehensive UI for creating or editing a single flashcard's question, answer, and potentially card-specific tags or other attributes. May include rich text editing capabilities.
    *   `app/edit/[deckId]/DeckTagEditor.tsx`: Component for assigning/unassigning global tags to the current deck using `tagActions`.
    *   `app/edit/[deckId]/DeckDangerZone.tsx`: Component for deck deletion, typically using a `ConfirmDialog`.
*   **Tag Management Components (`components/tags/`, `app/tags/`):**
    *   `app/tags/page.tsx` & `components/tags/TagManagerClient.tsx`: UI for creating, viewing, and deleting global tags using `tagActions`.
    *   `components/tags/CardTagEditor.tsx`: (If implemented for card-specific tagging) UI to assign/remove tags from individual cards, used within `CardEditor` or `EditableCardTable`.
*   **AI Generation Components (`components/prepare/ai-generate/`, `app/prepare/ai-generate/`):**
    *   `app/prepare/ai-generate/page.tsx`: Main page for the AI Flashcard Generator, using `hooks/useAiGenerate.ts`.
    *   `app/prepare/ai-generate/AiGenerateInputCard.tsx`: Handles file uploads (using `MediaCaptureTabs` and `FileUpload`) and initiating AI processing.
    *   `app/prepare/ai-generate/AiGenerateResultsCard.tsx`: Displays results from AI, including generated Q/A (potentially using `ContentRenderer`) and extracted text.
    *   `app/prepare/ai-generate/AiGenerateSaveDeckCard.tsx`: Form for naming and saving the AI-generated content as a new deck via `POST /api/decks`.
    *   `components/FileUpload.tsx`, `components/MediaCaptureTabs.tsx`: Reusable components for file handling.
*   **Settings Components (`components/settings/`, `app/settings/`):**
    *   `app/settings/page.tsx`: Main page for user settings.
    *   `components/settings/AppearanceSettings.tsx`, `CardSettings.tsx`, `SpeechSettings.tsx`, `WordColorSettings.tsx`: Sections within the settings page for different categories of preferences. (Study algorithm settings UI is deferred).
*   **Authentication Components (`app/auth/`, `components/auth/`):**
    *   Standard pages for login, signup, password reset, etc., primarily leveraging Supabase Auth UI or custom forms calling auth actions/hooks.
    *   `components/UserNav.tsx`: User avatar and menu dropdown in the header, providing links to profile, settings, and logout.
    *   `AuthGuard`: (Conceptual, if used) HOC or similar mechanism to protect routes requiring authentication, redirecting unauthenticated users.
*   **Shared/Utility Components (`components/ui/`, `components/`):**
    *   `components/ui/*`: Collection of base UI elements from `shadcn/ui` (Button, Input, Dialog, etc.).
    *   `components/LoadingSpinner.tsx`: Standardized loading indicator used across the application during data fetching or processing.
    *   `components/ErrorBoundary.tsx`: Wraps sections of the UI to catch rendering errors in component subtrees and display a fallback UI.
    *   `components/ConfirmDialog.tsx`: Reusable dialog component to prompt users for confirmation before performing dangerous actions (e.g., deleting a deck or card).
    *   `components/ContentRenderer.tsx`: Handles rendering of rich text content for card questions and answers, potentially supporting markdown, HTML, or other formats.
    *   Other specific utility components like `DeckHeader.tsx` (shared header for deck-related views), `SettingsButton.tsx` (quick link to settings).
*   **Core Data Hooks (`hooks/`):**
    *   `hooks/useStudySession.ts`: Orchestrates the entire active study session logic, managing card queue, state transitions, SRS calculations (delegating to utility modules), and UI state updates.
    *   `hooks/useDecks.ts`: Handles fetching deck lists (with SRS counts via `get_decks_with_complete_srs_counts` RPC), single deck data, and CRUD operations via `deckActions` and `POST /api/decks` for creation.
    *   `hooks/useEditDeck.ts`: Manages state and interactions for the deck editing page (`/edit/[deckId]`).
    *   `hooks/useAiGenerate.ts`: Manages state and interactions for the AI flashcard generation page.
    *   `hooks/useTags.ts`: For managing global tags.
    *   `hooks/useDeckTags.ts`: (Likely part of `useEditDeck`) For managing tags assigned to a specific deck.
    *   `hooks/useCardTags.ts`: (If card-level tagging is a distinct feature) For managing tags on individual cards.
    *   `hooks/useStudySets.ts`: For managing Study Sets (Smart Playlists).
    *   `hooks/useTTS.ts`: Client-side logic for TTS playback, interacting with `ttsActions`.
    *   `hooks/useAuth.ts`: Provides authentication state (user, session) and methods (login, logout, signup) from `AuthProvider`.
    *   `hooks/useSettings.ts`: (From `SettingsProvider`) Provides access to user settings values and update functions.
    *   `hooks/useSupabase.ts`: Provides a Supabase client instance for direct interaction when needed (though most DB access should be through actions/APIs).

---

## 8. Security Considerations
*   **Authentication:** Secure user authentication managed by Supabase Auth (JWT/Cookies managed via `@supabase/ssr`).
*   **Authorization (RLS):** Row Level Security policies strictly enforced on all user-specific tables (`settings`, `decks`, `cards`, `tags`, `deck_tags`, `study_sets`) ensuring users can only access/modify their own data. Policies cover SELECT, INSERT, UPDATE, DELETE. Denormalized `user_id` fields aid RLS.
*   **Server Action Validation:**
    *   Verify user session/authentication within each action.
    *   Validate all input data using Zod schemas before processing or database interaction.
*   **API Route Protection:** Secure API routes by verifying user authentication if they handle sensitive data or actions. Validate input payloads (e.g., file types/sizes, data structures).
*   **Environment Variables:** Store sensitive keys (Supabase URL/anon key, Google Cloud credentials, JWT secret) securely in environment variables. Do not commit sensitive keys to Git.
*   **Database Security:** Use parameterized queries (handled by Supabase client libraries) or properly sanitize inputs in DB functions to prevent SQL injection. Limit database user permissions.
*   **HTTPS:** Ensure all communication is over HTTPS (handled by Vercel/Supabase).
*   **Dependencies:** Regularly audit and update dependencies.
*   **Rate Limiting:** Consider for sensitive API routes or actions (AI generation, TTS) to prevent abuse.

---

## 9. Development & Deployment Workflow

*   **Version Control:** Git (GitHub/GitLab/Bitbucket) - Feature branches, Pull Requests, code review.
*   **Local Development:**
    *   Supabase CLI for local development environment (`supabase start`).
    *   Manage database schema changes via migrations (`supabase/migrations/`).
    *   Apply locally (`supabase db reset`), link project, push changes, generate types.
*   **Code Quality & Consistency:**
    *   TypeScript for static typing.
    *   Linting (`ESLint`) and Formatting (`Prettier`) enforced via pre-commit hooks.
*   **Testing (Phase 5 - Deferred):**
    *   Unit Tests (Jest/Vitest) for `lib/srs.ts`, `lib/study/card-state-handlers.ts`, `lib/study/session-queue-manager.ts`, utility functions.
    *   Integration Tests for `useStudySession` hook (all `SessionType`s), Server Actions, API Routes, DB function calls.
    *   End-to-End Tests (Cypress/Playwright) for critical user flows (Auth, Deck CRUD, AI Gen, Study Set CRUD, all study session types, Settings updates).
*   **Continuous Integration (CI):** GitHub Actions (or similar) - Run linters, formatters, type checks, tests on each push/PR. Build application.
*   **Deployment:**
    *   Vercel for hosting Next.js application.
    *   Automatic deployments from `main` branch, PR previews.
    *   Secure environment variable management in Vercel.
    *   Apply Supabase migrations to staging/production environments.

---

## 10. Known Issues / Future Roadmap

*   **Known Issues:**
    *   The `get_decks_with_complete_srs_counts` DB function needs to be updated to explicitly return a `relearning_count` if this stage is to be distinctly visualized in deck progress bars (the `cards_with_srs_stage` view *does* categorize 'relearning', but the RPC doesn't currently sum it separately).
    *   Comprehensive testing (Unit, Integration, E2E) is pending (Phase 5).
    *   Minor linter warnings (e.g., some unused local variables, console logs beyond warn/error/info) deferred for general cleanup.
*   **Future Roadmap:**
    *   Implement UI on Settings page for selecting `studyAlgorithm` and configuring its parameters (Task 4.4).
    *   Implement FSRS algorithm & parameter optimization UI/logic.
    *   Sharing Decks/Study Sets between users.
    *   System-generated Study Sets (e.g., "Hardest Cards", "Recently Lapsed", "Due Today").
    *   Enhanced Analytics/Stats page (progress charts, review heatmap, retention rates).
    *   Refine UI/UX, add subtle animations, improve layout consistency.
    *   Import/Export features (CSV, Anki format?).
    *   Image support on card fronts/backs.
    *   Alternative answer input methods (typing, speech-to-text).
    *   Offline support (Progressive Web App - PWA capabilities).
    *   Rich text editing for card content.
    *   Mobile App (React Native or native).
    *   Advanced query operators/UI in `StudySetBuilder`.
    *   Optimize AI 'force_knowledge' regeneration: Avoid resending large original text from client to server.

---

## 11. References
*   Next.js Documentation ([https://nextjs.org/docs](https://nextjs.org/docs))
*   React Documentation ([https://react.dev/](https://react.dev/))
*   Supabase Documentation ([https://supabase.com/docs](https://supabase.com/docs))
    *   `@supabase/ssr` Guide ([https://supabase.com/docs/guides/auth/server-side/nextjs](https://supabase.com/docs/guides/auth/server-side/nextjs))
    *   RLS Policies ([https://supabase.com/docs/guides/auth/row-level-security](https://supabase.com/docs/guides/auth/row-level-security))
    *   Database Functions ([https://supabase.com/docs/guides/database/functions](https://supabase.com/docs/guides/database/functions))
*   Tailwind CSS Documentation ([https://tailwindcss.com/docs](https://tailwindcss.com/docs))
*   shadcn/ui Documentation ([https://ui.shadcn.com/docs](https://ui.shadcn.com/docs))
*   Zustand Documentation ([https://github.com/pmndrs/zustand](https://github.com/pmndrs/zustand))
*   React Hook Form Documentation ([https://react-hook-form.com/](https://react-hook-form.com/))
*   Zod Documentation ([https://zod.dev/](https://zod.dev/))
*   Google Cloud Documentation (Document AI, Vision AI, Vertex AI, Text-to-Speech)
*   PDF Libraries: pdf-lib ([https://pdf-lib.js.org/](https://pdf-lib.js.org/))
*   SM-2 Algorithm Specification ([https://www.supermemo.com/en/archives1990-2015/english/ol/sm2](https://www.supermemo.com/en/archives1990-2015/english/ol/sm2))
*   `date-fns` Documentation ([https://date-fns.org/docs/Getting-Started](https://date-fns.org/docs/Getting-Started))
*   Sonner Documentation ([https://sonner.emilkowal.ski/](https://sonner.emilkowal.ski/))

---

## 12. Changelog

*   **v3.4 (2025-04-30):** Major refactor of study session logic & UI cleanup.
    *   Introduced `SessionType` ('learn-only', 'review-only', 'unified') to manage session behavior.
    *   Refactored monolithic `useStudySession` hook into an orchestrator using new utility modules: `lib/study/card-state-handlers.ts` and `lib/study/session-queue-manager.ts`.
    *   Updated Deck List to use a single "Practice" button initiating a 'unified' `SessionType`.
    *   Updated `/study/select` page to set 'learn-only' or 'review-only' `SessionType`.
    *   Implemented 'unified' session flow: learning phase -> prompt -> review phase.
    *   Refined TTS logic in study session page to prevent loops and control re-speak of question.
    *   Harmonized DB view (`cards_with_srs_stage`) to use `srs_level` & `learning_state`.
    *   Refined DB function (`resolve_study_query`) for consistent SRS state filtering (using `includeLearning`, removed `includeDifficult`, completed date filters).
    *   Deprecated old DB function `get_deck_list_with_srs_counts`; `deckActions.getDecks` now uses `get_decks_with_complete_srs_counts`.
    *   Standardized on `Tables<'...'>` types from `types/database.ts`, removing manual `types/card.ts` and `types/deck.ts`.
    *   Refactored deck creation flow to use `/decks/new` as primary entry.
    *   Cleaned up key linter warnings (hooks rules) and some unused components.
    *   Deferred UI implementation for study algorithm selection in Settings (Task 4.4).
*   **v4.0 (2025-05-29 - Current Progress from v3.4 onwards):** Performance optimizations and progress bar implementation.
    *   Added `get_study_set_srs_distribution` DB function and associated server action/types to calculate SRS stage counts for study sets, enabling progress bars on `/practice/sets`.
    *   Refined `get_study_set_srs_distribution` to also return `actionable_count`, optimizing data fetching for `/practice/sets` page.
    *   Added `get_user_global_srs_summary` DB function and server action to consolidate fetching of global card counts (total, new, due, new/review) for the `/practice/select` page, improving its load performance.
    *   Added `get_user_study_sets_with_total_counts` DB function and server action to fetch all study sets for a user along with their total card counts in a single call, further optimizing `/practice/select` page load time.
    *   Iteratively debugged SQL syntax and logic for the new database functions.
*   **v3.3 (2025-04-29):** Initial plan for refactoring Study Session logic with distinct Learn/Review modes and configurable algorithms. Added new SRS fields to `cards` and new study algorithm settings to `settings` table. Initial updates to `cards_with_srs_stage` view and related functions.
*   **v3.2 (2025-04-29 - Placeholder):** Added Deck Progress visualization and Theme Preference.
    *   Added `mature_interval_threshold`, `show_deck_progress`, `theme_light_dark_mode` to `settings` table.
    *   Added `cards_with_srs_stage` view.
    *   Added `get_deck_list_with_srs_counts` function.
    *   Updated `deckActions.getDecks` to use the new RPC.
    *   Updated `useDecks` hook to handle new data structure.
    *   Added `DeckProgressBar` component.
    *   Updated `DeckList` to display progress bars and legend, controlled by settings.
    *   Updated `SettingsProvider` and `settingsActions` to handle `themePreference`.
    *   Reorganized `SettingsPage` UI into sections (Card, Appearance, Speech, Color) and added Theme select, moved Show Deck Progress toggle.
    *   Integrated `next-themes` (`useTheme`) into `SettingsPage` for theme application.
    *   Updated documentation (DB Schema, Arch, Components, Diagrams, Action Plan).
*   **v3.1 (YYYY-MM-DD - Placeholder):** Major refactoring & clarification of Deck Creation, Edit Deck, and AI Generation flows based on detailed code review.
    *   Clarified manual deck creation uses `CreateDeckDialog` -> `useDecks` -> `createDeck` Server Action.
    *   Clarified AI deck creation uses `/prepare/ai-generate` -> `useAiGenerate` -> `POST /api/extract-pdf` -> `POST /api/decks`.
    *   Refactored `/edit/[deckId]` page using `useEditDeck` hook and sub-components, using Server Actions for persistence.
    *   Refactored `/prepare/ai-generate` page using `useAiGenerate` hook and sub-components.
    *   Confirmed AI backend logic resides in `/api/extract-pdf` route and dedicated services, restoring detailed implementation description in Section 6.3.
    *   Updated `useDecks` hook description.
    *   Fixed infinite loop issue in `useStudySession`.
    *   Removed `/decks/new` and `/decks/create-choice` pages from documentation.
    *   Updated documentation sections 4.2, 4.5, 5.3, 5.5, 5.6.2, 5.6.3, 5.6.5, 5.8.2, 5.8.3, 5.8.4, 6.3, 7, 13.
*   **v3.0 (YYYY-MM-DD - Placeholder):** Consolidated architecture from v2.x docs, added initial (less detailed) AI Generation plan & workflow, refined component breakdown and action plan. Merged business context and detailed code structure/auth flow from previous documentation. Updated technical architecture details.
*   **v2.3 (2024-04-05 - Based on original):**
    *   Removed deprecated `language` column from `decks` table, keeping `primary_language` and `secondary_language`.
    *   Deprecated and removed `lib/deckService.ts` in favor of Server Actions (`lib/actions/deckActions.ts`).
    *   Added comprehensive authentication flow details (Section 4.2 in original).
    *   Added Codebase Structure and File Interactions section (Section 14 in original).
*   **v2.2 (2024-04-05 - Based on original):** Consolidated documentation from prior `architecture-study-sets.md`. Updated version number.
*   **v2.1 (2025-04-09 - Based on docv2 / 2024-07-27 - Based on original):** Refactored study session flow (Card Selection vs. Study Mode), added Study Modes (Learn/Review), completed Study Set CRUD & UI structure, implemented Tagging system, finalized core SRS integration (SM-2), added `learn_mode_success_threshold` setting.
*   **v2.0 (2025-04-07 - Based on docv2 / 2024-07-26 - Based on original):** Initial integration plan/architecture for SRS, Tags, Study Sets. Updated data models, hooks, actions.
*   **v1.0 (Previous Date):** Basic deck/card management, auth, TTS, initial project documentation.

---

## 13. Implementation Action Plan & Status

**Historical Context: Key Completed Milestones (Pre v4.0 & Initial v4.0 Refactor)**
*   **Foundational Setup (largely from v3.3 "Phase 0"):**
    *   [x] Next.js project setup with App Router.
    *   [x] Supabase project setup & Auth integration (`@supabase/ssr`, Middleware, AuthProvider).
    *   [x] `shadcn/ui` and Tailwind setup.
    *   [x] Basic layout components (Header, Sidebar).
    *   [x] Initial Deck/Card CRUD functionalities.
    *   [x] TTS Integration (original `useTTS` and API route, now `ttsActions`).
    *   [x] Settings Provider/Service initial setup.
    *   [x] Supabase Type Generation.
*   **DB Schema & Core Backend (largely from v3.3 "Phase 1" & AI Gen "Phase 4", with v4.0 updates):**
    *   [x] SRS fields added to `cards` table; `tags`, `deck_tags`, `study_sets` tables created.
    *   [x] Supabase migrations for schema changes implemented.
    *   [x] Core SM-2 calculation logic in `lib/srs.ts` established.
    *   [x] `progressActions.updateCardProgress`, `settingsActions`, `cardActions`, `deckActions` (now using new RPC), `tagActions` (adapted for deck tags), `studySetActions` implemented.
    *   [x] `resolve_study_query` DB function and `studyQueryActions.resolveStudyQuery` Server Action implemented and refined.
    *   [x] `POST /api/decks`, `POST /api/extract-pdf`, `POST /api/process-ai-step2` routes and related AI services implemented.
    *   [x] `cards_with_srs_stage` view and `get_decks_with_complete_srs_counts` DB function implemented.
*   **AI Flashcard Generator (from v3.3 "Phase 4"):**
    *   [x] AI Key Setup, Dependencies, Client Upload, Backend API for Extraction/Initial Gen, Results Display, Save Deck UI/API, Error Handling, UI Entry Point.

**Current v4.0 Plan (Post-Study-Refactor & UI Cleanup):**

**Phase 1: Backend & Core Utilities Confirmation & Refinement** `[x]` (Completed as part of v4.0 refactor)
**Phase 2: Core Logic Extraction & New Utilities** `[x]` (Completed as part of v4.0 refactor - `lib/study/*` modules)
**Phase 3: Refactor `useStudySession` Hook** `[x]` (Completed as part of v4.0 refactor)

**Phase 4: UI Integration & Workflow Updates (v4.0 Focus)**
*   `[x]` **Task 4.1: Update Study Session Page (`app/study/session/page.tsx`)**
*   `[x]` **Task 4.2: Update Study Select Page (`app/study/select/page.tsx` & `components/study/StudySetSelector.tsx` / `StudySelectClient.tsx`)**
    *   `[x]` Optimized global count fetching using `get_user_global_srs_summary`.
    *   `[x]` Optimized study set total count fetching using `get_user_study_sets_with_total_counts`.
*   `[x]` **Task 4.3: Update Deck List Page (`app/page.tsx` & `components/DeckListClient.tsx`)**
*   `[x]` **Task 4.3a (Implicit): Update Study Sets Page (`app/practice/sets/page.tsx`)** 
    *   `[x]` Implemented progress bars using `get_study_set_srs_distribution`.
    *   `[x]` Optimized actionable count fetching by integrating it into `get_study_set_srs_distribution`.
*   `[ ]` **Task 4.4: Update Settings Page (`app/settings/page.tsx`)** - UI for `studyAlgorithm` selection **DEFERRED**. Other settings (theme, appearance) are in place.
*   `[x]` **Task 4.5: Refactor Deck Creation UI Flow.** (Now via `/decks/new` and `POST /api/decks`).
*   `[x]` **Task 4.6: General UI/Component Cleanup.** (Key cleanups done; minor linting deferred).

**Phase 5: Testing, Polish, and Optimization** `[ ]` (Deferred)
*   [ ] Unit testing (SRS utils, `lib/study/*` helpers, AI utils, hooks).
*   [ ] Integration testing (Server Actions, API Routes, Hooks, DB function calls).
*   [ ] E2E testing (Core user flows: Auth, Manual Deck Creation, AI Deck Creation, Deck Editing, Tagging, Study Set CRUD, all study session types, Settings update).
*   [ ] Manual cross-browser/device testing.
*   [ ] UI/UX polish (animations, layout consistency, wording, accessibility checks).
*   [ ] Performance review & optimization (DB queries, indexes, bundle size, API route performance).

---
