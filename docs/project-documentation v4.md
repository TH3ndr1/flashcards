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
    *   `useDecks`: Manages deck list (uses `deckActions.getDecks` which calls `get_decks_with_complete_srs_counts` RPC), fetches single deck, updates metadata, creates, deletes.
    *   `useTags`, `useStudySets`, `useCardTags` (for card-level tagging if implemented), `useDeckTags` (for deck-level tagging).
    *   `useStudySession`: Orchestrates the active study session.
    *   `useTTS`: Manages TTS playback logic.
    *   `useMobileSidebar`.
    *   `useEditDeck` (`app/edit/[deckId]/`).
    *   `useAiGenerate` (`app/prepare/ai-generate/`).

### 5.3 Backend Architecture
*   **Primary Mechanism:** Mix of Next.js Server Actions (`lib/actions/`) and API Routes (`app/api/`). Server Actions handle most direct data mutations and reads. API Routes handle AI processing orchestration and persistence of AI-generated content.
*   **Supabase Client:** Dedicated clients via `@supabase/ssr`.
*   **Key Actions (`lib/actions/`):**
    *   `cardActions`: `createCard`, `updateCard`, `deleteCard`, `getCardsByIds`, `getCardSrsStatesByIds`.
    *   `deckActions`: `getDecks` (Calls DB function `get_decks_with_complete_srs_counts`), `getDeck`, `createDeck`, `updateDeck`, `deleteDeck`.
    *   `tagActions`: `createTag`, `getTags`, `deleteTag`, `addTagToDeck`, `removeTagFromDeck`, `getDeckTags`.
    *   `studySetActions`: `createStudySet`, `getUserStudySets`, `getStudySet`, `updateStudySet`, `deleteStudySet`.
    *   `progressActions`: `updateCardProgress` (saves all SRS state fields).
    *   `studyQueryActions`: `resolveStudyQuery` (calls `resolve_study_query` DB function).
    *   `settingsActions`: Get/Update user settings (handles `studyAlgorithm`, `themePreference`, and all related study parameters).
    *   `ttsActions`: `generateTtsAction` for server-side TTS audio generation.
*   **Key API Routes (`app/api/`):**
    *   `extract-pdf/route.ts`: (Step 1 of AI Flow) Orchestrates AI file processing (upload, text extraction via `textExtractorService`, initial flashcard generation via `flashcardGeneratorService`).
    *   `process-ai-step2/route.ts`: (Step 2a - Intermediate AI Processing) Handles requests for classification or regeneration.
    *   `decks/route.ts`: (Used by Manual & AI Flow Step 2b - Final Persistence) Handles `POST` requests for creating new decks with metadata and (for AI flow) initial flashcards.
*   **Database Function (`resolve_study_query`):** Filters cards based on `StudyQueryCriteria` JSON (including `srs_level`, `learning_state` via `includeLearning` flag, dates).
*   **Database Function (`get_decks_with_complete_srs_counts`):** Fetches decks with standard SRS stage counts AND `learn_eligible_count`, `review_eligible_count`. *(Note: Needs update to include 'relearning' count for progress bar if desired).*
*   **Database View (`cards_with_srs_stage`):** Categorizes cards into 'new', 'learning', 'relearning', 'young', 'mature' based on `srs_level`, `learning_state`, `interval_days`, and `settings.mature_interval_threshold`.
*   **AI Services (`app/api/extract-pdf/` services):**
    *   `textExtractorService.ts`: Abstracts Vision AI / Document AI logic.
    *   `flashcardGeneratorService.ts`: Abstracts Vertex AI Gemini logic (multi-step: initial generation, classification, knowledge regeneration).
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
    *   **Updated Logic:** Takes `StudyQueryCriteria` JSON. Filters `cards` table by `user_id`, `deck_id`, deck tags (via `deck_tags` table), date ranges, `srs_level`, and the `includeLearning` flag (which checks for `srs_level = 0 AND (learning_state IS NULL OR learning_state = 'learning')`). Returns matching `card_id`s.
2.  **`get_decks_with_complete_srs_counts(p_user_id uuid)`**
    *   **Updated Logic:** Returns list of user's decks with standard SRS stage counts (new, learning, young, mature – *relearning count needs explicit addition if desired for progress bar*) AND `learn_eligible_count` and `review_eligible_count`.
3.  **`get_deck_list_with_srs_counts(p_user_id uuid)` - DEPRECATED/REMOVED.**

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

### 5.7 Authentication Flow
The application utilizes Supabase Auth integrated with Next.js using the `@supabase/ssr` package.
*   **Middleware (`middleware.ts`):** Handles session cookie management and refresh using `createMiddlewareClient`.
*   **Server Clients (`lib/supabase/server.ts`):** Provides `createServerClient()` (for Server Components/Route Handlers) and `createActionClient()` (for Server Actions) using cookies.
*   **Client Client (`lib/supabase/client.ts` or hook):** Uses `createBrowserClient` for browser-side Supabase interactions.
*   **Auth Provider (`providers/AuthProvider.tsx` with `hooks/use-auth.tsx`):** Manages client-side session state and provides auth methods.

### 5.8 Codebase Structure and File Interactions
#### 5.8.1 File Structure Overview
*(Refer to Section 5.6.2 for the detailed directory structure snapshot.)*

#### 5.8.2 Core File Interactions (Diagram) - **NEEDS SIGNIFICANT UPDATE**
*The Mermaid diagram from v3.3 is now outdated due to the `useStudySession` refactor and introduction of new utility modules.*
*   **Key changes needed in diagram:**
    *   `useStudySession.ts` should show dependencies on `session-queue-manager.ts` and `card-state-handlers.ts`.
    *   `card-state-handlers.ts` should show a dependency on `lib/srs.ts`.
    *   `DeckListClient.tsx` interaction with `useStudySessionStore` should reflect setting `SessionType='unified'`.
    *   `StudySetSelector.tsx` interaction with `useStudySessionStore` should reflect setting `SessionType='learn-only'` or `'review-only'`.
    *   `deckActions.ts` should show `getDecks` calling `get_decks_with_complete_srs_counts` DB function.
    *   Show `ttsActions.ts` (server action) being used for TTS instead of an API route.

#### 5.8.3 File Descriptions (Key Updates)
*   **`hooks/useStudySession.ts`:** Orchestrates study session. Manages overall session lifecycle, UI state, and interactions. Delegates queue management to `session-queue-manager` and card state update logic to `card-state-handlers`. Handles different `SessionType`s, including the 'unified' mode's two-phase progression.
*   **`lib/study/card-state-handlers.ts`:** Contains pure functions that determine the next state of a card after an answer. Takes current card data, internal session state, grade, and user settings. Uses `lib/srs.ts` for core SM-2 calculations. Returns a `CardStateUpdateOutcome` object detailing database changes, next internal state, and queue management instructions.
*   **`lib/study/session-queue-manager.ts`:** Contains pure functions for managing the `SessionCard[]` queue. Includes `initializeQueue` (filters by `SessionType`, prioritizes, sets internal state, sorts), `findNextCardIndex`, `updateQueueAfterAnswer` (modifies queue based on outcome from state handlers), and `getNextDueCheckDelay`.
*   **`types/study.ts`:** Defines core TypeScript types for the study session feature, such as `SessionCard`, `InternalCardState`, `SessionType`, `StudySessionInput`, `CardStateUpdateOutcome`. (Replaces `types/card.ts` and `types/deck.ts`).
*   **`store/studySessionStore.ts`:** Zustand store now holds `currentInput: StudySessionInput | null` and `currentSessionType: SessionType | null`.
*   **`lib/actions/deckActions.ts`:** `getDecks` action now calls `get_decks_with_complete_srs_counts` RPC to fetch deck list with comprehensive SRS counts.
*   **`lib/actions/studyQueryActions.ts`:** `resolveStudyQuery` action calls the updated `resolve_study_query` DB function which now supports `includeLearning` flag and has corrected date filtering.
*   **`lib/actions/ttsActions.ts`:** New server action `generateTtsAction` handles TTS requests.

#### 5.8.4 Data Flow Patterns (Diagram) - **NEEDS SIGNIFICANT UPDATE**
*Similar to 5.8.2, this diagram needs to reflect the new modular architecture of the study session logic.*

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
    *   The `/api/decks` route creates the `decks` record in the database.
    *   It then calls `cardActions.createCardsBatch` server action to insert all the flashcards into the `cards` table, associating them with the new deck ID and setting default SRS values.
5.  **Navigation:** On success, client navigates to `/edit/[newDeckId]`.

---

## 7. Component Breakdown (Key Components)
*   **Layout:** `RootLayout`, `ResponsiveLayout` (with `Header`, `Sidebar`).
*   **Providers:** `ClientProviders` (wrapping `ThemeProvider`, `AuthProvider`, `SettingsProvider`).
*   **Core Study:**
    *   `app/study/session/page.tsx`: Main page orchestrating the study UI, uses `useStudySession`. Displays `StudyFlashcardView`. Handles "Continue to Review" prompt.
    *   `StudyFlashcardView.tsx`: Displays individual card, grading buttons, status.
*   **Study Setup:**
    *   `app/study/select/page.tsx` & `StudySelectClient.tsx`: Entry point for custom sessions.
    *   `StudySetSelector.tsx`: UI for selecting source (All, Deck, StudySet) and `SessionType` ('learn-only', 'review-only'). Fetches and displays eligible card counts for these types.
    *   `StudySetBuilder.tsx` & `useStudySetForm.ts`: For creating/editing Study Sets.
*   **Deck/Card Management:**
    *   `app/page.tsx` & `DeckListClient.tsx`: Displays deck list with "Practice" buttons.
    *   `app/decks/new/page.tsx`: Unified deck creation entry point.
    *   `app/edit/[deckId]/page.tsx` & `useEditDeck.ts`: Deck editing interface.
    *   `CardEditor.tsx`, `EditableCardTable.tsx`: For card manipulation.
    *   `DeckTagEditor.tsx`: For assigning tags to decks.
*   **Tag Management:** `app/tags/page.tsx` & `TagManagerClient.tsx`.
*   **AI Generation:** `app/prepare/ai-generate/page.tsx` & `useAiGenerate.ts` and sub-components (`AiGenerateInputCard`, `AiGenerateResultsCard`, `AiGenerateSaveDeckCard`).
*   **Settings (`app/settings/page.tsx`):** Configuration UI. (Study algorithm settings UI deferred).
*   **Hooks:**
    *   `useStudySession`: Orchestrates study session logic using new utility modules.
    *   `useDecks`: Manages deck data, uses `get_decks_with_complete_srs_counts` RPC.
    *   `useEditDeck`, `useAiGenerate`, `useTags`, `useStudySets`, `useTTS`, `useAuth`, `useSettings`.

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
*   **v3.3 (2025-04-29):** Initial plan for refactoring Study Session logic with distinct Learn/Review modes and configurable algorithms. Added new SRS fields to `cards` and new study algorithm settings to `settings` table. Initial updates to `cards_with_srs_stage` view and related functions.
*   **v3.2 (2025-04-29 - Placeholder based on original doc):** Added Deck Progress visualization and Theme Preference.
*   **v3.1 (YYYY-MM-DD - Placeholder based on original doc):** Major refactoring & clarification of Deck Creation, Edit Deck, and AI Generation flows.
*   **(Older changelog entries from original v3.3 would follow here, adjusted for historical accuracy if needed)**

---

## 13. Implementation Action Plan & Status

**Phase 1: Backend & Core Utilities Confirmation & Refinement** `[x]`
**Phase 2: Core Logic Extraction & New Utilities** `[x]`
**Phase 3: Refactor `useStudySession` Hook** `[x]`

**Phase 4: UI Integration & Workflow Updates**
*   `[x]` **Task 4.1: Update Study Session Page (`app/study/session/page.tsx`)**
*   `[x]` **Task 4.2: Update Study Select Page (`app/study/select/page.tsx` & `components/study/StudySetSelector.tsx` / `StudySelectClient.tsx`)**
*   `[x]` **Task 4.3: Update Deck List Page (`app/page.tsx` & `components/DeckListClient.tsx`)**
*   `[ ]` **Task 4.4: Update Settings Page (`app/settings/page.tsx`)** - **DEFERRED**
*   `[x]` **Task 4.5: Refactor Deck Creation UI Flow.**
*   `[x]` **Task 4.6: General UI/Component Cleanup.** (Key cleanups done; minor linting deferred).

**Phase 5: Testing, Polish, and Optimization** `[ ]` (Deferred)

---