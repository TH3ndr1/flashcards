# Project Documentation: StudyCards App

**Version:** 3.2 (Added Deck Progress & Theme Settings)
**Date:** 2025-04-24 (Placeholder - Adjust as needed)

**(Consolidated based on user requirements and iterative AI discussions)**

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
    *   [6.2 SRS Algorithm: SM-2 Implementation](#62-srs-algorithm-sm-2-implementation)
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
*   **Effective Spaced Repetition:** Implementing proven SRS algorithms (starting with SM-2) integrated into flexible study modes.
*   **Flexible Content Management:** Allowing users to organize content via decks and tags, and create custom study sessions using "Smart Playlists" (Study Sets).
*   **AI-Powered Content Creation:** Enabling users to automatically generate flashcards from uploaded PDF documents or images.
*   **Accessibility:** Providing features specifically designed to support learners with dyslexia, ADHD, and other challenges (font choices, colors, TTS, simple UI).
*   **Multi-modal Learning:** Supporting text and audio (TTS).

### Target Users
Students of all ages, language learners, self-learners, teachers, particularly benefiting those seeking efficient study methods and users with learning differences.

### Key Differentiators
*   Robust and flexible SRS implementation.
*   Seamless AI-powered card generation from user documents/images.
*   Strong focus on accessibility and inclusivity features.
*   Clean, intuitive, distraction-free user interface optimized for learning.
*   Flexible, query-based study sessions using tags, deck affiliation, and other criteria ("Smart Playlists").

---

## 2. Conceptual Overview: Prepare vs. Practice

The application's functionality is divided into two main modes:

*   **Prepare Mode:** Encompasses all aspects of content creation, organization, and setup. This includes managing decks, creating/editing individual cards, managing tags, creating/editing Study Sets ("Smart Playlists"), and using the AI Flashcard Generator.
*   **Practice Mode:** Focuses entirely on the active learning and review process using the prepared content. This includes initiating study sessions (via decks, tags, playlists, or global review), interacting with flashcards (flipping, grading), and leveraging the SRS scheduling.

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
2. **[UPDATED]** Deck Creation (Manual or AI) and Management
3. Tag Creation and Management (Assigning tags to cards)
4. Study Set Creation and Management (Defining query criteria)
5. Study Session Initiation (User selects Card Set + Study Mode)
6. Study Session Execution (System presents cards based on Mode)
7. Card Review and SRS Update (Answering card, system calculates next review, saves state)
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
    *   **[UPDATED]** Create Decks:
        *   **Manual Path:** Initiated via a central "Create Deck" button (in `<DeckList />`) which opens the `<CreateDeckDialog />`. User fills metadata -> Submit triggers `useDecks().createDeck` -> Calls `createDeck` Server Action (`lib/actions/deckActions.ts`) -> On success, dialog closes and navigates to `/edit/[newDeckId]`.
        *   **AI Path:** User navigates to `/prepare/ai-generate` page -> Upload file(s) -> Client calls `POST /api/extract-pdf` -> Review results -> Enter Deck Name in `<AiGenerateSaveDeckCard />` -> Submit triggers `useAiGenerate().handleSaveDeck` -> Calls `POST /api/decks` API route with metadata and generated `flashcards` -> On success, navigates to `/edit/[newDeckId]`.
    *   View Decks: List user's decks (`/` via `<DeckList />`).
    *   Edit Decks: Modify deck metadata and manage cards (`/edit/[deckId]` page via `<useEditDeck />`).
    *   Delete Decks: Remove decks and associated cards (via `<DeckDangerZone />` component on `/edit/[deckId]` page, triggering `useEditDeck().handleDeleteDeck` -> `useDecks().deleteDeck` -> `deleteDeck` Server Action).
*   **Card Management:** Create, view, edit, delete individual cards within the deck edit page (`/edit/[deckId]`, managed by `useEditDeck` hook calling `cardActions`).
*   **Tag Management:**
    *   Create, view, delete user-specific tags (`/tags` page via `<TagManager />`).
    *   Assign/remove tags to/from specific cards (via `<CardTagEditor />` in card editing view on `/edit/[deckId]`).
*   **Study Set ("Smart Playlist") Management:**
    *   Create/Save complex filter criteria as named Study Sets (`/study/sets/new` via `<StudySetBuilder />`).
    *   View/List saved Study Sets (`/study/sets` page).
    *   Edit existing Study Sets (`/study/sets/[id]/edit` via `<StudySetBuilder />`).
    *   Delete saved Study Sets (`/study/sets` page).
    *   **Filter Criteria:** Support filtering by Deck(s), Included Tags (Any/All), Excluded Tags, Date ranges (Created, Updated, Last Reviewed, Next Due - including 'never', 'isDue'), SRS Level (equals, <, >).
*   **AI Flashcard Generator (`/prepare/ai-generate`):**
    *   Upload PDF or Image files via `<MediaCaptureTabs />` (containing `<FileUpload />`).
    *   Trigger backend processing via `useAiGenerate().handleSubmit` -> `POST /api/extract-pdf`.
    *   Display generated flashcards and processing summary via `<AiGenerateResultsCard />`.
    *   Allow user to name the new deck and save via `<AiGenerateSaveDeckCard />` -> `useAiGenerate().handleSaveDeck`.
    *   Trigger deck and card creation via `POST /api/decks`.

### 4.3 Practice Mode Features
*   **Study Session Initiation:** Start sessions based on:
    *   A specific Deck.
    *   All user cards.
    *   A specific Tag (Future UI).
    *   A saved Study Set ("Smart Playlist").
    *   A dynamic query (e.g., "All Due Cards" - implicitly via Study Set Selector).
*   **Study Mode Selection:** Choose between:
    *   **Learn Mode:** Reviews *all* selected cards, repeating cards answered incorrectly within the session until a configurable consecutive correct answer threshold (`settings.mastery_threshold`) is met *for that session*.
    *   **Review Mode (SRS):** Reviews *only* cards from the selection that are due (`cards.next_review_due <= now()` or `cards.next_review_due IS NULL`), prioritized by due date.
*   **Study Interface:**
    *   Display current card (`<StudyFlashcardView />`).
    *   Allow flipping between front and back.
    *   Provide grading buttons (e.g., Again, Hard, Good, Easy - mapped to grades 1-4).
    *   Display session progress (e.g., Card X / Y).
    *   Display session completion feedback.
*   **SRS Engine:**
    *   Utilize SM-2 algorithm initially (`lib/srs.ts -> calculateSm2State`). Expandable to FSRS.
    *   Calculate and update card SRS state (`srs_level`, `easiness_factor`, `interval_days`, `next_review_due`, `last_reviewed_at`, `last_review_grade`) after *every* card review, regardless of study mode.
    *   Persist SRS state updates to the database (`lib/actions/progressActions.ts -> updateCardProgress`).
*   **Text-to-Speech (TTS):**
    *   Read card front/back content aloud using Google Cloud TTS.
    *   Determine language based on card's deck (`decks.primary_language`, `decks.secondary_language`).
    *   Allow user to enable/disable TTS in settings.

### 4.4 Accessibility & Inclusivity
*   **Dyslexia Support:** Font choices (Settings), spacing (Theme/CSS), color themes (Theme), TTS.
*   **ADHD Support:** Minimalist UI, optional timers, progress indicators, content chunking.
*   **General:** TTS support.

### 4.5 Key User Interactions
1.  **[UPDATED] Deck Creation Flow (Manual):**
    *   Click "Create Deck" in `<DeckList />`.
    *   `<CreateDeckDialog />` opens.
    *   Fill Name, select Language(s)/Bilingual mode.
    *   Click "Create Deck" in the dialog.
    *   Dialog calls `useDecks().createDeck`.
    *   Hook calls `createDeck` Server Action (`lib/actions/deckActions.ts`).
    *   On success, dialog closes, navigates to `/edit/[newDeckId]`.
2.  **[UPDATED] Deck Creation Flow (AI):**
    *   Navigate to `/prepare/ai-generate` (e.g., via Sidebar).
    *   Upload file(s) using `<AiGenerateInputCard />`.
    *   Click "Generate Flashcards".
    *   `useAiGenerate().handleSubmit` calls `fetch('POST', '/api/extract-pdf')`.
    *   Results (flashcards, languages, summary) are displayed in `<AiGenerateResultsCard />`.
    *   User reviews results and enters a Deck Name in `<AiGenerateSaveDeckCard />`.
    *   Click "Create Deck".
    *   `useAiGenerate().handleSaveDeck` calls `fetch('POST', '/api/decks')` with name, detected languages, and the generated `flashcards` array.
    *   On success, navigates to `/edit/[newDeckId]`.
3.  **[ADDED] Deck Editing Flow (`/edit/[deckId]`):**
    *   Navigate to page (e.g., from link in `<DeckList />`).
    *   `useEditDeck` hook fetches deck data using `useDecks().getDeck`.
    *   Metadata changes in `<DeckMetadataEditor />` trigger `useEditDeck().handleDeckMetadataChange`.
    *   Hook updates local state and queues debounced save via `useDecks().updateDeck` -> `updateDeck` Server Action.
    *   Card changes (add/edit/delete) in `<CardViewTabContent />` or `<TableViewTabContent />` trigger respective handlers in `useEditDeck`.
    *   Hook calls relevant `cardActions` Server Actions (`createCard`, `updateCard`, `deleteCard`) and refetches data.
    *   Tag changes via `<CardTagEditor />` trigger handlers calling `tagActions` Server Actions.
    *   Deck deletion via `<DeckDangerZone />` triggers `useEditDeck().handleDeleteDeck` -> `useDecks().deleteDeck` -> `deleteDeck` Server Action.
4.  Tag Management Flow
5.  Study Set Creation Flow
6.  Study Session Initiation Flow
7.  Study Session Execution Flow (Learn vs Review Modes)
8.  Settings Flow

---

## 5. Technical Architecture

### 5.1 Technology Stack
*   Frontend: Next.js 15+ (App Router), React 19+, TypeScript
*   Backend: Serverless via Next.js Server Actions and API Routes
*   Database: Supabase (PostgreSQL)
*   Database Functions: `resolve_study_query` (pl/pgsql)
*   Authentication: Supabase Auth via `@supabase/ssr`
*   State Management: Zustand (`studySessionStore`, `mobileSidebarStore`), React Context (`SettingsProvider`, `AuthProvider`)
*   UI: Tailwind CSS, `shadcn/ui`
*   Forms: `react-hook-form`, `zod`
*   Audio: Google Cloud TTS API (`@google-cloud/text-to-speech`)
*   AI Services: Google Cloud Document AI, Vision AI, Vertex AI (`@google-cloud/...` packages)
*   PDF Processing: `pdf-lib`
*   File Storage: Supabase Storage (for AI Gen uploads > 4MB)
*   Utilities: `date-fns`, `lucide-react`, `sonner` (toasts), `lodash/isEqual` (optional)
*   Development Tools: TypeScript, ESLint, Prettier, Context7 MCP

### 5.2 Frontend Architecture
*   **Structure:** Next.js App Router (`app/`). Mix of Server and Client Components.
*   **Styling:** Tailwind CSS / `shadcn/ui`.
*   **Components:** Reusable UI (`components/ui/`), feature-specific (`components/study/`, `components/tags/`, `components/prepare/ai-generate/`, `components/deck/` etc.), layout (`components/layout/`).
*   **State Management:**
    *   Global Auth/Settings/Theme: React Context (`providers/`). Settings Provider now includes `themePreference`.
    *   Global UI State: Zustand (`store/` - e.g., `mobileSidebarStore`).
    *   Feature State/Logic: Custom Hooks (`hooks/`, page-specific hooks like `useEditDeck`, `useAiGenerate`).
    *   Study Session: Zustand (`studySessionStore`) for params + Custom Hook (`useStudySession`) for active session logic.
*   **Custom Hooks (`hooks/`, feature directories):** Central for state and logic:
    *   `useSupabase`, `useAuth`, `useSettingsContext`.
    *   `useDecks` (Manages deck *list* state via `get_deck_list_with_srs_counts` RPC, fetches single deck, updates metadata, deletes. **Does not create**).
    *   `useTags`, `useStudySets`, `useCardTags`.
    *   `useStudySession`.
    *   `useTTS`, `useStudyTTS`.
    *   `useMobileSidebar`.
    *   **[ADDED]** `useEditDeck` (`app/edit/[deckId]/`).
    *   **[ADDED]** `useAiGenerate` (`app/prepare/ai-generate/`).

### 5.3 Backend Architecture
*   **Primary Mechanism:** Mix of Next.js Server Actions (`lib/actions/`) and API Routes (`app/api/`). Server Actions handle most direct data mutations and reads initiated from components/hooks (e.g., deck updates, card/tag operations, manual deck creation). API Routes handle specific workflows like AI processing orchestration (`/api/extract-pdf`) and consolidated deck creation for the AI flow (`/api/decks`).
*   **Supabase Client:** Dedicated clients via `@supabase/ssr` (`createActionClient`, `createRouteHandlerClient`).
*   **Key Actions (`lib/actions/`):**
    *   `cardActions`: `createCard`, `updateCard`, `deleteCard`, `getCardsByIds`.
    *   `deckActions`: **`createDeck` (used by manual flow via hook)**, `updateDeck`, `deleteDeck`, **`getDecks` (Calls DB function `get_deck_list_with_srs_counts`)**, `getDeck`.
    *   `tagActions`: `createTag`, `getTags`, `deleteTag`, `addTagToCard`, `removeTagFromCard`, `getCardTags`.
    *   `studySetActions`: `createStudySet`, `getUserStudySets`, `getStudySet`, `updateStudySet`, `deleteStudySet`.
    *   `progressActions`: `updateCardProgress` (saves SRS state).
    *   `studyQueryActions`: `resolveStudyQuery` (calls DB function).
    *   `settingsActions`: Get/Update user settings (includes mapping `themePreference` to `theme_light_dark_mode`).
    *   `ttsActions`: Generate TTS audio.
*   **Key API Routes (`app/api/`):**
    *   `tts/route.ts`: Handles TTS generation requests.
    *   `extract-pdf/route.ts`: Orchestrates AI file processing workflow (extraction & generation).
    *   `decks/route.ts`: Handles `POST` requests for consolidated deck creation **(used by AI flow)**.
*   **Database Function (`resolve_study_query`):** Handles complex card filtering.
*   **Database Function (`get_deck_list_with_srs_counts`):** Fetches decks along with counts of cards in different SRS stages (new, learning, mature).
*   **Database View (`cards_with_srs_stage`):** Categorizes cards into 'new', 'learning', 'mature' based on `interval_days` and `mature_interval_threshold` setting.
*   **AI Services (`app/api/extract-pdf/` services):**
    *   `textExtractorService.ts`: Abstracts Vision AI / Document AI logic.
    *   `flashcardGeneratorService.ts`: Abstracts Vertex AI Gemini logic.
    *   `config.ts`, `gcpClients.ts`, `fileUtils.ts`, `types.ts`: Supporting modules.
*   **Middleware (`middleware.ts`):** Manages session cookies/refresh.

### 5.4 Database Schema
#### 5.4.1 Tables
1.  **`users`** (Managed by Supabase Auth)
2.  **`settings`** (User preferences)
    *   `user_id`: `uuid` (PK, FK -> `auth.users.id`, ON DELETE CASCADE)
    *   `srs_algorithm`: `text` (default: 'sm2', not null) - Stores 'sm2' or 'fsrs'.
    *   `fsrs_parameters`: `jsonb` (nullable) - For future user-specific FSRS tuning.
    *   `mastery_threshold`: `integer` (default: 3, not null) - Renamed from `learn_mode_success_threshold`.
    *   `mature_interval_threshold`: `integer` (default: 21, not null) - Interval (days) after which a card is considered 'mature'.
    *   `app_language`: `text` (default: 'en', not null)
    *   `card_font`: `text` (nullable) - Use `Enums.font_option` type if defined via Supabase types.
    *   `language_dialects`: `jsonb` (nullable) - Store preferred voices per language code.
    *   `show_difficulty`: `boolean` (default: true, nullable) - If UI should show difficulty buttons.
    *   `show_deck_progress`: `boolean` (default: true, not null) - If deck list should show progress bars.
    *   `theme_light_dark_mode`: `text` (default: 'system', not null) - User's preferred theme ('light', 'dark', 'system').
    *   `tts_enabled`: `boolean` (default: true, nullable) - Master TTS toggle.
    *   `enable_basic_color_coding`: `boolean` (default: true, not null)
    *   `enable_advanced_color_coding`: `boolean` (default: true, not null)
    *   `color_only_non_native`: `boolean` (default: true, not null)
    *   `word_palette_config`: `jsonb` (nullable)
    *   `created_at`: `timestamptz` (default: `now()`)
    *   `updated_at`: `timestamptz` (default: `now()`)
    *   *RLS: User can only manage/view their own settings.*
3.  **`decks`**
    *   `id`: `uuid` (PK, default: `uuid_generate_v4()`)
    *   `user_id`: `uuid` (FK -> `auth.users.id`, ON DELETE CASCADE)
    *   `name`: `text` (Not null)
    *   `description`: `text` (Nullable) - Consider removing if unused.
    *   `primary_language`: `text` (Not null, default 'en'?) - 2-letter code (e.g., 'en', 'fr').
    *   `secondary_language`: `text` (Not null, default 'en'?) - 2-letter code.
    *   `is_bilingual`: `boolean` (default: false, not null) - Derived or set during creation.
    *   `progress`: `jsonb` (Nullable) - Store aggregated progress stats if needed.
    *   `created_at`: `timestamptz` (default: `now()`)
    *   `updated_at`: `timestamptz` (default: `now()`)
    *   *RLS: User can only manage/view their own decks.*
4.  **`tags`**
    *   `id`: `uuid` (PK, default: `uuid_generate_v4()`)
    *   `user_id`: `uuid` (FK -> `auth.users.id`, ON DELETE CASCADE)
    *   `name`: `text` (Not null, Unique constraint per user: `UNIQUE(user_id, name)`)
    *   `created_at`: `timestamptz` (default: `now()`)
    *   *RLS: User can only manage/view their own tags.*
5.  **`cards`** (Core flashcard data and SRS state)
    *   `id`: `uuid` (PK, default: `uuid_generate_v4()`)
    *   `deck_id`: `uuid` (FK -> `decks.id`, ON DELETE CASCADE)
    *   `user_id`: `uuid` (FK -> `auth.users.id`, ON DELETE CASCADE) - Denormalized for query/RLS ease.
    *   `question`: `text` (Not null) - Renamed from `front_content`.
    *   `answer`: `text` (Not null) - Renamed from `back_content`.
    *   `created_at`: `timestamptz` (default: `now()`)
    *   `updated_at`: `timestamptz` (default: `now()`)
    *   `# SRS Fields`
    *   `last_reviewed_at`: `timestamptz` (nullable)
    *   `next_review_due`: `timestamptz` (nullable) - **INDEXED along with user_id**
    *   `srs_level`: `integer` (default: 0, not null)
    *   `easiness_factor`: `float` (default: 2.5, nullable) - SM-2 EF.
    *   `interval_days`: `integer` (default: 0, not null) - SM-2 Interval. **INDEXED for performance**
    *   `stability`: `float` (nullable) - FSRS 'S'.
    *   `difficulty`: `float` (nullable) - FSRS 'D'.
    *   `last_review_grade`: `integer` (nullable) - Last user rating (1-4).
    *   `# General Stats`
    *   `correct_count`: `integer` (default: 0, not null)
    *   `incorrect_count`: `integer` (default: 0, not null)
    *   `attempt_count`: `integer` (default: 0, not null) - Added explicit default.
    *   `last_studied`: `timestamptz` (nullable) - DEPRECATED if `last_reviewed_at` is used.
    *   `difficulty_score`: `float` (nullable) - DEPRECATED if `difficulty` (FSRS D) is used.
    *   *RLS: User can only manage/view their own cards.*
6.  **`card_tags`** (Join table)
    *   `card_id`: `uuid` (FK -> `cards.id`, ON DELETE CASCADE)
    *   `tag_id`: `uuid` (FK -> `tags.id`, ON DELETE CASCADE)
    *   `user_id`: `uuid` (FK -> `auth.users.id`, ON DELETE CASCADE) - Denormalized for RLS.
    *   Primary Key: `(card_id, tag_id)`
    *   *RLS: User can only manage/view links related to their own cards/tags.*
7.  **`study_sets`** ("Smart Playlists")
    *   `id`: `uuid` (PK, default: `uuid_generate_v4()`)
    *   `user_id`: `uuid` (FK -> `auth.users.id`, ON DELETE CASCADE)
    *   `name`: `text` (Not null)
    *   `description`: `text` (Nullable)
    *   `query_criteria`: `jsonb` (Not null, Stores filter rules matching `StudyQueryCriteria` Zod schema)
    *   `created_at`: `timestamptz` (default: `now()`)
    *   `updated_at`: `timestamptz` (default: `now()`)
    *   *RLS: User can only manage/view their own study sets.*

#### 5.4.2 Views

1.  **`cards_with_srs_stage`**
    *   **Purpose:** Joins `cards` with `settings` to categorize cards based on their SRS learning stage.
    *   **Key Logic:**
        *   Selects all columns from `cards`.
        *   Adds `srs_stage`: `text` calculated as:
            *   'new' if `interval_days` = 0.
            *   'learning' if `interval_days` > 0 AND `interval_days` < `settings.mature_interval_threshold`.
            *   'mature' if `interval_days` >= `settings.mature_interval_threshold`.
    *   **RLS:** Inherits RLS from the underlying `cards` table (user can only see their own cards).

#### 5.4.3 Functions

1.  **`resolve_study_query(query_criteria jsonb, user_id uuid)`**
    *   **Purpose:** Takes a JSON object defining filter criteria (decks, tags, dates, SRS level etc.) and returns an array of matching `card_id`s for the specified user.
    *   **Usage:** Called by `studyQueryActions.resolveStudyQuery` server action.
    *   **Security:** `SECURITY DEFINER` (requires careful permission management) or checks `user_id` argument against `auth.uid()`.

2.  **`get_deck_list_with_srs_counts(user_id uuid)`**
    *   **Purpose:** Returns a list of decks for the specified user, augmented with counts of cards in each SRS stage ('new', 'learning', 'mature') based on the `cards_with_srs_stage` view.
    *   **Returns:** `TABLE(id uuid, name text, description text, ..., new_count integer, learning_count integer, mature_count integer, total_cards integer)`
    *   **Usage:** Called by `deckActions.getDecks` server action to populate the main deck list.
    *   **Security:** `SECURITY DEFINER` or filters by `user_id` argument against `auth.uid()`.

### 5.5 Navigation Structure
*   **Sidebar (Primary Navigation):**
    *   Practice: "Start Session" (`/study/select`), "Smart Playlists" (`/study/sets`).
    *   Prepare: "Decks" (`/`), "Manage Tags" (`/tags`), "AI Flashcards" (`/prepare/ai-generate`).
    *   Other: "Settings" (`/settings`), Auth links.
*   **Header:** App Title/Logo (links to `/`), global icons (Settings, Profile/Auth), mobile Hamburger menu.
*   **Contextual Navigation:**
    *   Deck List (`/`): Links to Edit Deck (`/edit/[deckId]`), Learn/Review buttons navigate to `/study/session` via store. **"+ Create Deck" button opens `<CreateDeckDialog />`**.
    *   Create Deck Dialog (`<CreateDeckDialog />`): On success, navigates to `/edit/[id]`.
    *   AI Generate Page (`/prepare/ai-generate`): File upload, generation, review, save form. Navigates to `/edit/[id]` on successful save via `/api/decks`.
    *   Study Set List (`/study/sets`): Links to Edit (`.../[id]/edit`), New (`.../new`), Learn/Review (`/study/session`). Delete buttons. "+ Create Playlist" button links to `/study/sets/new`.
    *   Edit Deck (`/edit/[id]`): Save (auto for metadata/manual for cards), Delete.
    *   Edit Study Set (`/study/sets/[id]/edit`): Save, Cancel/Delete.
    *   **Settings Page (`/settings`):** Reorganized into "Card Settings", "Appearance Settings", "Speech Settings", and "Word Color Coding" sections. Includes controls for theme preference, showing deck progress, font, mastery threshold, etc.
    *   *(Removed: `/decks/new` page, `/decks/create-choice` page)*

### 5.6 Code Structure and Organization
#### 5.6.1 Component Architecture
**(Updated)**
*   App Router structure with Server/Client components.
*   Emphasis on custom hooks (`useEditDeck`, `useAiGenerate`, `useDecks`) to encapsulate page/feature-level logic and state, keeping page components lean (orchestrators).
*   Breakdown of complex pages/dialogs into smaller, presentational sub-components (`DeckMetadataEditor`, `AiGenerateInputCard`, `CreateDeckDialog`, etc.).

#### 5.6.2 Directory Structure
**(Updated)**
```plaintext
/
├── app/                      # Next.js App Router root
│   ├── layout.tsx            # Root layout
│   ├── layout-script.tsx     # Script for layout (e.g., theme)
│   ├── page.tsx              # Home page (Deck List)
│   ├── globals.css           # Global styles
│   ├── sw.js                 # Service Worker (if applicable)
│   ├── api/                  # API Routes
│   │   ├── decks/
│   │   │   └── route.ts      # API for consolidated deck creation (AI flow)
│   │   ├── extract-pdf/      # API and services for AI generation
│   │   │   ├── route.ts
│   │   │   ├── config.ts
│   │   │   ├── gcpClients.ts
│   │   │   ├── fileUtils.ts
│   │   │   ├── types.ts
│   │   │   ├── textExtractorService.ts
│   │   │   └── flashcardGeneratorService.ts
│   │   └── tts/
│   │       └── route.ts      # API for Text-to-Speech
│   ├── auth/                 # Auth-related pages (callback, etc.)
│   ├── edit/
│   │   └── [deckId]/         # Deck Edit Feature
│   │       ├── page.tsx
│   │       ├── useEditDeck.ts # Specific hook for this page
│   │       ├── DeckMetadataEditor.tsx
│   │       ├── CardViewTabContent.tsx
│   │       ├── TableViewTabContent.tsx
│   │       └── DeckDangerZone.tsx
│   ├── login/                # Login Page
│   ├── prepare/
│   │   └── ai-generate/      # AI Generation Feature
│   │       ├── page.tsx
│   │       ├── useAiGenerate.ts # Specific hook
│   │       ├── AiGenerateInputCard.tsx
│   │       ├── AiGenerateResultsCard.tsx
│   │       └── AiGenerateSaveDeckCard.tsx
│   ├── profile/              # User Profile Page
│   ├── settings/             # Settings Feature
│   │   ├── page.tsx
│   │   └── (components moved to components/settings/*)
│   ├── signup/               # Signup Page
│   ├── study/                # Study Feature
│   │   ├── select/           # Study Session Selection Page
│   │   │   └── page.tsx
│   │   ├── session/          # Active Study Session Page
│   │   │   └── page.tsx
│   │   └── sets/             # Study Set Management
│   │       ├── page.tsx      # List Study Sets
│   │       ├── new/          # Create New Study Set
│   │       │   └── page.tsx
│   │       └── [id]/         # View/Edit Study Set
│   │           └── edit/
│   │               └── page.tsx
│   └── tags/                 # Tag Management Feature
│       └── page.tsx
├── components/               # Shared React components
│   ├── ui/                   # shadcn/ui components (managed by CLI)
│   ├── layout/               # Layout components (Header, Sidebar, etc.)
│   │   ├── site-header.tsx
│   │   ├── site-sidebar.tsx
│   │   └── mobile-nav.tsx
│   ├── deck/                 # Deck-related components
│   │   └── DeckProgressBar.tsx
│   ├── settings/             # Settings page sections/components
│   │   ├── AppearanceSettings.tsx
│   │   ├── CardSettings.tsx
│   │   ├── SpeechSettings.tsx
│   │   └── WordColorSettings.tsx
│   ├── study/                # Study-related components
│   │   ├── StudySetBuilder.tsx
│   │   └── (other study components...)
│   ├── tags/                 # Tag-related components
│   │   ├── TagManager.tsx
│   │   └── CardTagEditor.tsx
│   ├── ClientProviders.tsx   # Wrapper for client-side context providers
│   ├── deck-list.tsx         # Component for home page deck list
│   ├── create-deck-dialog.tsx # Dialog for manual deck creation
│   ├── file-upload.tsx       # Reusable file upload component
│   ├── media-capture-tabs.tsx # Tabs for media input (file/camera)
│   ├── camera-capture.tsx    # Component for camera input
│   ├── deck-header.tsx       # Header for deck-related views
│   ├── settings-button.tsx   # Button linking to settings
│   ├── tts-toggle-button.tsx # Button for TTS toggle
│   ├── user-nav.tsx          # User avatar/menu dropdown
│   └── (other shared components...)
├── hooks/                    # Custom React hooks
│   ├── use-auth.tsx
│   ├── use-decks.tsx         # Hook specifically for Deck List page logic (uses useDecks.ts)
│   ├── useDecks.ts           # Core deck actions hook
│   ├── use-mobile.tsx
│   ├── use-supabase.tsx
│   ├── use-tts.ts
│   ├── useCardTags.ts
│   ├── useStudySetForm.ts
│   ├── useStudySets.ts
│   ├── useStudySession.ts
│   └── useTags.ts
├── lib/                      # Utilities, actions, schemas, etc.
│   ├── actions/              # Server Actions (card, deck, progress, settings, etc.)
│   ├── schema/               # Zod schemas for validation
│   ├── supabase/             # Supabase client setup (server, client)
│   ├── fonts.ts
│   ├── localStorageUtils.ts
│   ├── palettes.ts
│   ├── srs.ts                # Spaced Repetition algorithm logic
│   ├── study-utils.ts        # Utilities specific to studying
│   └── utils.ts              # General utility functions
├── providers/                # React Context providers
│   ├── settings-provider.tsx # Manages settings state & persistence
│   └── theme-provider.tsx    # (May be deprecated if using next-themes directly in RootLayout/ClientProviders)
├── public/                   # Static assets
├── store/                    # Zustand global state stores
│   └── studySessionStore.ts
├── styles/                   # Global styles (if not using app/globals.css primarily)
├── types/                    # TypeScript type definitions
│   └── database.ts           # Auto-generated Supabase types
├── .env.local                # Local environment variables (DO NOT COMMIT)
├── .eslintrc.json            # ESLint configuration
├── .gitignore                # Git ignore rules
├── next.config.mjs           # Next.js configuration
├── package.json              # Project dependencies and scripts
├── postcss.config.js         # PostCSS configuration
├── prettier.config.js        # Prettier configuration
├── README.md                 # Project README
├── supabase/                 # Supabase local dev files (migrations, config)
├── tailwind.config.ts        # Tailwind CSS configuration
└── tsconfig.json             # TypeScript configuration
```

#### 5.6.3 Key Components and Their Functions

1.  **Root Layout (`app/layout.tsx`)**
    *   Main layout wrapper that integrates all providers (AuthProvider, SettingsProvider, ThemeProvider). Handles global UI elements like Header/Sidebar that appear on all pages. Applies theme changes from `next-themes`.
2.  **Layout Components (`components/layout/`)**
    *   **`SiteHeader` (`layout/site-header.tsx`)**: App title/logo, global navigation icons, mobile menu toggle. Displayed on all pages.
    *   **`SiteSidebar` (`layout/site-sidebar.tsx`)**: Primary navigation menu (grouped by Prepare/Practice modes). Fixed on desktop, toggleable drawer on mobile.
    *   **`MobileNav` (`layout/mobile-nav.tsx`)**: Mobile-specific navigation overlay triggered by hamburger menu in header.
3.  **Study Components (`components/study/`)**
    *   **`StudyFlashcardView`**: Core flashcard UI for study sessions. Manages card flipping, displays question/answer, handles grading UI and animations.
    *   **`StudySetSelector`**: Interface for selecting study content source (deck, study set, or all cards) and mode (Learn/Review). Displayed on `/study/select` page.
    *   **`StudySetBuilder`**: Complex form for creating/editing saved study sets ("Smart Playlists") with criteria like deck, tags, dates, SRS level. Used in `/study/sets/new` and `/study/sets/[id]/edit`.
    *   **`StudyCompletionSummary`**: Results screen displayed at the end of a study session showing progress stats.
    *   **`DifficultyIndicator`**: Visual component showing SRS progress/difficulty of cards.
4.  **Deck/Card/Tag Editing & Management Components**
    *   **`/edit/[deckId]/page.tsx`**: Orchestrator page for editing a deck. Uses `useEditDeck` hook and renders sub-components.
    *   **`DeckList` (`components/deck-list.tsx`)**: Displays the user's decks on the homepage (`/`). Fetches data via `useDecks` (which calls the `get_deck_list_with_srs_counts` RPC). Renders deck information, action buttons, and the `<DeckProgressBar />` if enabled in settings. Also includes the "Create Deck" button triggering `<CreateDeckDialog />`.
    *   **`DeckProgressBar` (`components/deck/DeckProgressBar.tsx`)**: Visual representation of card distribution within a deck across SRS stages (new, learning, mature). Takes counts as props.
    *   **`CreateDeckDialog` (`components/create-deck-dialog.tsx`)**: Modal form for creating a new deck manually.
    *   **`DeckForm`**: Main form for creating or editing a deck's core properties (name, description, etc.).
    *   **`CardEditor`**: Complex UI for editing a single flashcard. Includes rich text editors for question/answer, tagging, image uploads.
    *   **`CardList`**: Sortable, filterable list of cards within a deck. Rendered in the deck edit page, with inline quick editing capabilities.
    *   **`TagManager`**: UI for creating, editing, and assigning tags to cards.
    *   **`DeckImporter`**: Component that handles importing cards from various formats (CSV, Anki packages, text).
5.  **AI Features** 
    *   **`AIAssistant`**: Dialog component for the AI assistant interface with chat-like UI, action buttons, and various generation modes.
    *   **`AICardGenerator`**: Specialized UI for generating cards via AI, showing progress, previewing results, and reviewing before saving.
    *   **`AIExplanationGenerator`**: Component that lets users generate and view AI explanations for cards they're struggling with.
6.  **Dashboard Components**
    *   **`DashboardCard`**: Widget that appears on the dashboard, following a standardized layout but with customizable content.
    *   **`StudyProgressSummary`**: Displays summary statistics of study history with charts and key metrics.
    *   **`UpcomingReviewsWidget`**: Shows preview of cards due for review today, tomorrow, and later this week.
    *   **`RecentDecksWidget`**: Quick access list showing recently used decks with progress indicators.
7.  **Shared/Utility Components**
    *   **`SearchBar`**: Reusable global search component with auto-suggestions and result categorization.
    *   **`LoadingSpinner`**: Standardized loading indicator used throughout the app.
    *   **`ErrorBoundary`**: Error catching component for graceful failure handling.
    *   **`ContentRenderer`**: Handles rendering rich text content for cards, with support for markdown, math equations, code blocks, and media.
    *   **`ConfirmDialog`**: Reusable confirmation dialog for dangerous actions.
8.  **Authentication Components**
    *   **`SignIn`/`SignUp`**: Authentication forms with validation, OAuth options, and password reset flow.
    *   **`AuthGuard`**: HOC that protects routes requiring authentication.
    *   **`ProfileSettings`**: User profile management form for account settings.
9.  **Core Data Hooks**
    *   **`useAuth`**: Provides authentication state and methods (login, logout, etc.).
    *   **`useDecks`**: Manages deck list state by calling `get_deck_list_with_srs_counts` RPC via `getDecks` action. Provides wrappers for `getDeck`, `updateDeck`, `deleteDeck`, and `createDeck` Server Actions.
    *   **`useCards`**: Provides card-level operations, filtering, and manipulation.
    *   **`useStudySession`**: Complex hook managing the active study session state, card sequencing, and spaced repetition algorithms.
    *   **`useSettings`**: Manages user preference settings with persistence (handles `themePreference` mapping).
    *   **`useAIAssistant`**: Encapsulates AI generation functionality with request state management.

#### 5.6.4 State Management

1. **Global State**
   - Auth: `AuthProvider` with `useAuth` hook.
   - Settings: `SettingsProvider` with `useSettingsContext` hook (manages `themePreference`, `showDeckProgress`, etc.).
   *   Theme: `ThemeProvider` (`next-themes`) with `useTheme` hook, driven by `themePreference` from settings.
   *   Mobile Sidebar: `useMobileSidebar` Zustand store.

2. **Study Session State**
   - Managed by `useStudySessionStore` (Zustand) for params and `useStudySession` hook for active logic.
   - Handles card queue, progress, SRS calculations, interaction with TTS.

3. **Data Fetching & Caching**
   - Server Components: Direct data fetching (preferred).
   - Client Components: Custom hooks (`useDecks`, `useTags`, etc.) calling Server Actions.
   - Mutations: Server Actions.
   - Real-time: Consider Supabase Realtime for updates if needed.

#### 5.6.5 Data Flow

1. **Server to Client**
   - Initial data loaded in Server Components or fetched via Server Actions called from Client Components/Hooks.
   - Hydrated on client via Providers/Hooks.

2. **Client to Server**
   - User interactions trigger event handlers.
   - Handlers call custom hooks or directly invoke Server Actions for mutations/queries.
   - Server Actions interact with Database/External Services.
   - UI updates based on Action results or optimistic updates.

#### 5.6.6 Performance Considerations

1. **Code Splitting:** Leverage Next.js automatic code splitting per route. Use dynamic imports (`next/dynamic`) for large, non-critical client components.
2. **Data Loading:** Use Server Components for initial data where possible. Use React Suspense for loading states. Implement pagination/infinite scrolling for large lists.
3. **Caching:** Rely on Next.js Data Cache for fetches in Server Components/Route Handlers. Consider client-side caching libraries (SWR, TanStack Query) if complex client-side state synchronization is needed beyond custom hooks.
4. **Bundle Size:** Monitor bundle size, minimize heavy client-side dependencies.
5. **Database:** Ensure proper indexing (especially for `resolve_study_query` filters and RLS lookups). Optimize queries.

### 5.7 Authentication Flow
The application utilizes Supabase Auth integrated with Next.js using the `@supabase/ssr` package. This ensures seamless authentication handling across Server Components, Client Components, API/Route Handlers, and Server Actions.

Key aspects include:

- **Middleware (`middleware.ts`):** Handles session cookie management and refresh for incoming requests using `createMiddlewareClient` from `@supabase/ssr`. It intercepts requests, refreshes expired sessions if necessary, and ensures authentication state is available server-side.
- **Server Clients (`lib/supabase/server.ts`):** Provides utility functions to create Supabase server clients using cookies:
  - `createServerClient()`: For Server Components/Route Handlers.
  - `createActionClient()`: For Server Actions.
These functions properly read cookies available in the server context.
- **Client Client (`lib/supabase/client.ts` or hook):** Creates the browser client instance using `createBrowserClient` from `@supabase/ssr`. This client automatically manages auth state via browser storage (cookies/localStorage). Usually accessed via a hook like `useSupabase`.
- **Auth Provider (`providers/AuthProvider.tsx`):** A client-side context provider that uses the browser client to:
    - Manage the session state (`useState`).
    - Listen to `onAuthStateChange`.
    - Provide the session object and auth helper functions (login, logout, etc.) to the application via the `useAuth` hook.

This setup ensures secure and consistent authentication across the Next.js App Router architecture.

### 5.8 Codebase Structure and File Interactions
#### 5.8.1 File Structure Overview

*(See Section 5.6.2 for the updated directory structure)*

#### 5.8.2 Core File Interactions (Diagram)

```mermaid
graph TD
    subgraph "Layout & Providers"
        A[app/layout.tsx] --> B[ClientProviders/Providers]
        B --> C[providers/ThemeProvider]; B --> D[providers/AuthProvider]; B --> E[providers/SettingsProvider]
        E --> C # SettingsProvider influences ThemeProvider via useTheme
    end

    subgraph "Study Session Flow"
        F[hooks/useStudySession.ts] --> G[lib/actions/studyQueryActions.ts]
        F --> H[lib/actions/cardActions.ts - Get]
        F --> I[lib/actions/progressActions.ts]
        F --> J[lib/srs.ts]
        F --> K[store/studySessionStore.ts]
        L[components/study/study-flashcard-view.tsx] --> F
        L --> M[hooks/useStudyTTS.ts]
        M --> N[api/tts/route.ts]
        O[app/study/session/page.tsx] --> F; O --> L
        P[app/study/select/page.tsx] --> K; P --> Q[components/study/StudySetSelector.tsx]
    end

    subgraph "Deck List & Manual Create"
        R[hooks/useDecks.ts] --> RA[lib/actions/deckActions.ts - Get/Update/Delete/Create]
        RA -- calls --> DB_FUNC[DB: get_deck_list_with_srs_counts()]
        S[app/page.tsx] --> T[components/deck-list.tsx]
        T --> R # For fetching list data (with counts)
        T --> T_PB[components/deck/DeckProgressBar.tsx] # Renders progress
        T --> UC[components/create-deck-dialog.tsx] # Opens dialog
        UC --> R # Calls createDeck from hook
    end

    subgraph "Deck Editing Flow"
        U[app/edit/[deckId]/page.tsx] --> V[hooks/useEditDeck.ts]
        V --> R # Uses getDeck, updateDeck from useDecks
        V --> H # cardActions - Create/Update/Delete
        V --> TA[lib/actions/tagActions.ts] # link/unlink tags
        V --> VA[app/edit/[deckId]/DeckMetadataEditor.tsx]; V --> VB[app/edit/[deckId]/CardViewTabContent.tsx]
        V --> VC[app/edit/[deckId]/TableViewTabContent.tsx]; V --> VD[app/edit/[deckId]/DeckDangerZone.tsx]
    end

    subgraph "AI Deck Creation Flow"
        Y[app/prepare/ai-generate/page.tsx] --> ZA[hooks/useAiGenerate.ts]
        ZA --> ZB[api/extract-pdf/route.ts POST] # Extraction/Generation API
        ZA --> ZC[api/decks/route.ts POST] # Deck Persistence API
        ZC --> H # cardActions - Create (called internally by API route)
    end

    subgraph "AI Backend Service"
       ZB --> ZD[api/extract-pdf/textExtractorService.ts]; ZB --> ZE[api/extract-pdf/flashcardGeneratorService.ts]
       ZD --> ZF[api/extract-pdf/gcpClients.ts]; ZE --> ZF
    end

    subgraph "Tag Management"
        W[hooks/useTags.ts] --> TA; YW[hooks/useCardTags.ts] --> TA
        ZW[components/tags/CardTagEditor.tsx] --> YW
        AA[components/tags/TagManager.tsx] --> W
        AB[app/tags/page.tsx] --> AA
    end

    subgraph "Study Set Management"
       AC[hooks/useStudySets.ts] --> AD[lib/actions/studySetActions.ts]
       AE[components/study/StudySetBuilder.tsx] --> AD
       AF[app/study/sets/page.tsx] --> AC
       AG[app/study/sets/new/page.tsx] --> AE
       AH[app/study/sets/[id]/edit/page.tsx] --> AE; AH --> AC
    end

    subgraph "Authentication"
        AI[hooks/useAuth.tsx] --> AJ[providers/AuthProvider.tsx]
        AK[lib/supabase/client.ts] --> AJ
        AL[middleware.ts] -.-> AM[lib/supabase/server.ts] # conceptually
        AN[Server Actions/API Routes] --> AM[lib/supabase/server.ts]
        AO[app/auth/*] --> AI
    end

    subgraph "Settings Management"
        SET_PAGE[app/settings/page.tsx] --> SET_HOOK[hooks/useSettingsContext.ts]
        SET_HOOK --> SET_ACTIONS[lib/actions/settingsActions.ts]
        SET_PAGE --> NEXT_THEME[hooks/useTheme (next-themes)] # To apply theme change
        SET_HOOK --> E # Reads from SettingsProvider
        SET_ACTIONS --> DB_SETTINGS[DB: settings table]
    end

```

#### 5.8.3 File Descriptions

1.  **Core Hooks (`hooks/`)**:
    *   `useDecks`: Manages deck list state by calling `get_deck_list_with_srs_counts` RPC via `getDecks` action. Provides wrappers for `getDeck`, `updateDeck`, `deleteDeck`, and **`createDeck` (used by manual flow)** Server Actions. Returns data including SRS counts for progress bars.
    *   `useEditDeck` (`app/edit/[deckId]/`): Manages state/logic for the deck edit page (fetch, metadata save, card actions, tag actions).
    *   `useAiGenerate` (`app/prepare/ai-generate/`): Manages state/logic for AI generation page (file handling, API calls to `/extract-pdf` and `/decks`).
    *   Study Session Management: `useStudySession`, `useStudyTTS`.
    *   Data Fetching: `useTags`, `useStudySets`, `useCardTags`.
    *   Authentication: `useAuth`.
    *   Settings: `useSettingsContext` (Provides access to all settings, including `themePreference`, `showDeckProgress`).
    *   UI State: `useMobileSidebar`.
    *   `useSupabase`: Provides Supabase client.

2.  **Server Actions (`lib/actions/`)**:
    *   `deckActions`: **`createDeck` (used by manual flow)**, `updateDeck`, `deleteDeck`, **`getDecks` (Calls DB function `get_deck_list_with_srs_counts`)**, `getDeck`.
    *   `cardActions`: `createCard`, `updateCard`, `deleteCard`, `getCardsByIds`.
    *   `tagActions`: `createTag`, `getTags`, `deleteTag`, `addTagToCard`, `removeTagFromCard`, `getCardTags`.
    *   `studySetActions`: `createStudySet`, `getUserStudySets`, `getStudySet`, `updateStudySet`, `deleteStudySet`.
    *   `progressActions`: `updateCardProgress`.
    *   `studyQueryActions`: `resolveStudyQuery`.
    *   `settingsActions`: Get/Update user settings (Handles mapping `themePreference` to `theme_light_dark_mode`).
    *   `ttsActions`: Generate TTS audio.

3.  **API Routes (`app/api/`)**:
    *   `decks/route.ts`: Handles `POST` requests for creating new decks, primarily used by the **AI flow**. Accepts deck metadata and flashcard data. Calls `cardActions` internally to create cards.
    *   `extract-pdf/route.ts`: Orchestrates the AI file processing workflow (upload -> extraction -> generation). Uses services defined within its directory. Returns results to the client.
    *   `tts/route.ts`: Handles TTS generation requests.

4.  **Backend Services (`app/api/extract-pdf/`)**:
    *   `textExtractorService.ts`: Abstracts text extraction logic (Vision/Document AI).
    *   `flashcardGeneratorService.ts`: Abstracts flashcard generation logic (Vertex AI Gemini).
    *   `config.ts`, `gcpClients.ts`, `fileUtils.ts`, `types.ts`: Support modules for the AI service.

5.  **Zustand Stores (`store/`)**:
    *   `studySessionStore`: Study session parameters and state.
    *   `mobileSidebarStore`: UI navigation state.

6.  **Utility Libraries (`lib/`)**:
    *   Core Utils: `srs.ts`, `utils.ts`.
    *   Database: `supabase/` (client setup).
    *   Schema: `schema/` (Zod schemas).

7.  **Components (`components/`)**:
    *   Study: `study/StudyFlashcardView`, `study/StudySetBuilder`, `study/StudySetSelector`.
    *   Tags: `tags/TagManager`, `tags/CardTagEditor`.
    *   Layout: `layout/SiteHeader`, `layout/SiteSidebar`.
    *   Deck: `deck-list.tsx` (Displays decks with progress bars), `deck/DeckProgressBar.tsx`, **`create-deck-dialog.tsx` (Manual creation form)**.
    *   File Upload: `file-upload.tsx`, `media-capture-tabs.tsx`.
    *   UI: `ui/` (shadcn).

8.  **Page Components (`app/`)**:
    *   Deck Editing: `edit/[deckId]/page.tsx` (Orchestrator). Sub-components: `DeckMetadataEditor`, `CardViewTabContent`, `TableViewTabContent`, `DeckDangerZone`.
    *   AI Generation: `prepare/ai-generate/page.tsx` (Orchestrator). Sub-components: `AiGenerateInputCard`, `AiGenerateResultsCard`, `AiGenerateSaveDeckCard`.
    *   Study Flow: `study/session/page.tsx`, `study/select/page.tsx`, `study/sets/*`.
    *   Content Management: `page.tsx` (Home/Deck List), `tags/page.tsx`.
    *   Settings: `settings/page.tsx` (Reorganized UI with Appearance/Card/Speech/Color sections, handles theme changes via `useTheme`).
    *   Authentication: `auth/*`.
    *   *(Removed: `/decks/new/page.tsx`, `/decks/create-choice/page.tsx`)*

9.  **Providers (`providers/`)**:
    *   `AuthProvider`: Authentication state.
    *   `SettingsProvider`: User preferences (includes `themePreference`, maps to DB column).
    *   `ThemeProvider`: UI theming (`next-themes`), updated by settings changes.

#### 5.8.4 Data Flow Patterns (Diagram)

```mermaid
graph TD
    subgraph "Study Session Flow"
        A[useStudySession Hook] --> B(studyQueryActions);
        A --> C(cardActions - get);
        A --> D(progressActions - update);
        E[useStudyTTS Hook] --> F[api/tts route];
        G[StudyFlashcardView Comp] --> A;
        G --> E;
    end

    subgraph "Deck List & Manual Creation"
        H[useDecks Hook] --> I(deckActions - Get/Update/Delete/Create);
        I -- calls --> DB_FUNC[DB: get_deck_list_with_srs_counts()];
        K[DeckList Comp] --> H; # Fetch List data (with counts)
        K --> K_PB[DeckProgressBar Comp]; # Renders progress
        K --> L[CreateDeckDialog Comp]; # Open Dialog
        L --> H; # Call createDeck from hook
    end

    subgraph "Deck Editing Flow"
        LE[EditDeck Page] --> ME[useEditDeck Hook];
        ME --> H; # Uses getDeck, updateDeck from useDecks
        ME --> C; # cardActions - Create/Update/Delete
        ME --> NE[tagActions]; # Manage Tags
    end

    subgraph "AI Deck Creation Flow"
        QE[AIGenerate Page] --> RE[useAiGenerate Hook];
        RE --> SE[api/extract-pdf route POST]; # Process Files
        RE --> PE[api/decks route POST]; # Save Deck + Cards
        SE --> TE[AI Backend Services]; # Extraction/Generation
        PE --> C; # Create Cards (called internally by API)
    end

    subgraph "Tag Management"
        M[useTags Hook] --> NE;
        O[useCardTags Hook] --> NE;
        P[CardTagEditor Comp] --> O;
        Q[TagManager Comp] --> M;
    end

    subgraph "Study Set Management"
        R[useStudySets Hook] --> S(studySetActions);
        T[StudySetBuilder Comp] --> S;
        U[StudySetList Page] --> R;
        V[StudySet Edit Page] --> R;
        V --> T;
    end

    subgraph "Settings Management"
        W[SettingsPage Comp] --> X[useSettingsContext Hook];
        X --> Y(settingsActions);
        W --> Z[useTheme Hook (next-themes)];
        X --> AA[SettingsProvider Context]; # Reads settings
        Y --> BB[DB: settings table]; # Saves settings
    end

    subgraph "Authentication"
        CC[useAuth Hook] --> DD[AuthProvider Context];
        EE[Login/Signup Forms] --> CC;
        FF[Server Action/API Route] --> GG(Supabase Server Client);
        HH[Middleware] -.-> GG;
    end
```

---

## 6. Core Feature Implementation Details

### 6.1 Study Session Initiation & Execution Flow
**Overall Process:** The user first defines *which cards* they want to potentially study (**Card Selection**), and then chooses *how* they want to study that set (**Study Mode**).

**Phase 1: Card Selection**

1.  **User Initiation & Criteria Definition:** (via `/study/select`, using `<StudySetSelector />`)
    *   User selects source: Deck, "All Cards", Tag(s), or saved/dynamic Study Set.
    *   If Study Set, criteria like Deck(s), Tags (Include/Exclude, Any/All), Date ranges, SRS Level are used.
    *   *Resulting `queryCriteria`:* JSON object representing the selection.

2.  **Backend: Resolve Initial Card IDs (`studyQueryActions.resolveStudyQuery`):**
    *   Frontend (`useStudySessionStore` triggers `useStudySession` hook init) calls `resolveStudyQuery` Server Action with the `queryCriteria` (or `studySetId`).
    *   Action calls `resolve_study_query` DB function/RPC.
    *   DB function translates criteria into SQL:
        *   Filters by `user_id`.
        *   Applies filters based on `queryCriteria`.
        *   **Does NOT filter by `next_review_due` at this stage.**
    *   **Returns:** Array of `card_id`s matching the criteria.

**Phase 2: Study Mode Execution**

1.  **User Mode Selection:** User chooses **Mode 1 (Learn)** or **Mode 2 (Review)** in the UI (usually `/study/select`).

2.  **Frontend/Backend Handoff:**
    *   Card IDs and selected Mode are stored (e.g., in `studySessionStore`).
    *   User navigates to `/study/session`.

3.  **Frontend: Session Initialization (`useStudySession` Hook):**
    *   Reads Card IDs and Mode from the store.
    *   Calls `cardActions.getCardsByIds` with the `cardIds` array.
    *   **Returns:** Array of fully populated `Card` objects (content, current SRS state, deck languages, etc.).

4.  **Frontend: Session Preparation & Loop (`useStudySession` Hook Logic):**
    *   Receives the `Card[]` array.
    *   Prepares the study queue and manages the loop based on the **selected Study Mode**:

    *   **If Mode 1: Learn Mode (Comprehensive Review):**
        *   **Queue Init:** Includes **all** fetched cards.
        *   **Ordering:** Apply shuffling or smart prioritization (TBD).
        *   **Goal:** Review each card until session success threshold (`learn_mode_success_threshold` from settings) is met *for this session*.
        *   **Progression:**
            *   Track consecutive correct answers *per card* within session state.
            *   Increment on correct, reset to 0 on incorrect.
            *   Remove card from active queue when count reaches threshold.
            *   Ensure incorrect cards are repeated (pushed to end or similar).
        *   **SRS Update:** **After every answer (map correct/incorrect to grade), calculate the *next* SRS state using `calculateSm2State` and schedule a debounced save via `progressActions.updateCardProgress`**.
        *   **End:** Session ends when active queue is empty. Display summary.

    *   **If Mode 2: Review Mode (SRS-Prioritized):**
        *   **Filtering:** Filter the fetched `Card[]` array *locally in the hook* to keep only cards where `card.next_review_due <= now()` or `card.next_review_due IS NULL`.
        *   **Empty Queue Handling:** Notify user if no cards are due from the initial selection.
        *   **Ordering:** Sort the filtered (due) cards by `next_review_due ASC`.
        *   **Queue Init:** Includes only the *filtered and sorted due* cards.
        *   **Goal:** Review all due cards identified.
        *   **Progression:** Present cards sequentially from the sorted due queue.
        *   **SRS Update:** After every answer (grade 1-4), calculate the *next* SRS state using `calculateSm2State` and schedule a debounced save via `progressActions.updateCardProgress`.
        *   **End:** Session ends when the due queue is exhausted. Display summary.

### 6.2 SRS Algorithm: SM-2 Implementation
The core SM-2 logic resides in the `calculateSm2State` function within `lib/srs.ts`.

**Input:**
*   `currentSm2State`: Object containing `{ interval_days, easiness_factor, srs_level }` for the card *before* the review.
*   `grade`: User's assessment of recall difficulty (integer 1-4, where 1='Again', 2='Hard', 3='Good', 4='Easy').

**Output:**
*   `newSm2State`: Object containing `{ interval_days, easiness_factor, srs_level, next_review_due, last_reviewed_at, last_review_grade }` for the card *after* the review.

**Simplified Logic:**

1.  **Handle Failing Grades (Grade < 3):**
    *   Reset `srs_level` to 0 (or 1 depending on interpretation).
    *   Reset `interval_days` to 0 (or 1, meaning review tomorrow).
    *   Adjust `easiness_factor` slightly (usually no change or small decrease for grade < 3).
2.  **Handle Passing Grades (Grade >= 3):**
    *   Increment `srs_level`.
    *   Calculate the new `easiness_factor` based on the old EF and the grade:
        *   `EF' = EF + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02))`
        *   Ensure EF does not drop below 1.3.
    *   Calculate the new `interval_days`:
        *   If `srs_level` is 1, interval is 1 day.
        *   If `srs_level` is 2, interval is 6 days.
        *   If `srs_level` > 2, interval is `previous_interval * EF'`.
        *   Round the interval to the nearest integer.
3.  **Calculate `next_review_due`:** Add the calculated `interval_days` to the current date (`last_reviewed_at`).
4.  **Set `last_reviewed_at`:** Record the timestamp of the review.
5.  **Set `last_review_grade`:** Store the user's input grade.

*(Actual implementation in `lib/srs.ts` provides the precise calculations)*

### 6.3 AI Q&A Generation Workflow (Google Cloud)
**(Updated & Restored)** This workflow enables users to automatically generate flashcards from uploaded documents, orchestrated between the client (`useAiGenerate` hook), a backend API for processing (`/api/extract-pdf`), and another backend API for persistence (`/api/decks`).

#### Implementation Details & Status:
- **PDF/Image Upload:** Uses `<FileUpload>` within `<MediaCaptureTabs>` on the `/prepare/ai-generate` page. Handles client-side validation (type, size up to 25MB). Large files (>4MB) or large batches are uploaded to Supabase Storage first; smaller uploads go directly via FormData.
- **Text Extraction (`/api/extract-pdf` -> `textExtractorService`):**
    - Multi-method approach: Google Document AI for PDFs (primary), Google Vision AI for Images and PDF fallback.
    - `pdf-lib` used for PDF page count validation (limit: 30 pages).
    - Error handling with cascading fallbacks between services.
    - Memory-efficient processing suitable for serverless environments.
- **Flashcard Generation (`/api/extract-pdf` -> `flashcardGeneratorService`):**
    - Uses Google Cloud Vertex AI (Gemini Flash model) via `gcpClients`.
    - Employs structured output requests to ensure consistent JSON format.
    - Performs language detection (`detectLanguages` helper).
    - Intelligently determines mode ('translation' vs. 'knowledge') based on detected languages and content patterns.
    - Assigns correct languages based on mode (swapping for translation, single language for knowledge).
    - Text is truncated (50,000 chars) before sending to the model.
- **User Review (Client - `AiGenerateResultsCard`):**
    - Displays generated flashcards.
    - Shows extracted text preview.
    - Provides processing summary (files processed/skipped, cards generated per file).
- **Persistence (Client -> `/api/decks` -> `cardActions`):**
    - `useAiGenerate.handleSaveDeck` sends deck metadata and flashcard content (`{question, answer}`) to `/api/decks`.
    - `/api/decks` route creates the `decks` record and calls `cardActions.createCard` to insert `cards` records.
- **Infrastructure & Ops:**
    - Vercel deployment with Node.js runtime config (memory, timeout).
    - Google Cloud services (Document AI, Vision AI, Vertex AI) configured via environment variables.
    - Supabase Storage used for large uploads.
    - Comprehensive error handling and user feedback via `sonner` toasts with unique IDs.

#### Workflow Steps (Simplified):

1.  **Select & Upload Files** (Client: `useAiGenerate`, `AiGenerateInputCard`, `FileUpload`)
2.  **Trigger Generation** (Client: `useAiGenerate.handleSubmit` -> `POST /api/extract-pdf`)
3.  **Extract Text & Generate Cards** (Backend: `/api/extract-pdf/route.ts` using `textExtractorService`, `flashcardGeneratorService`)
4.  **Return Results** (Backend -> Client)
5.  **Display & Review Results** (Client: `useAiGenerate`, `AiGenerateResultsCard`)
6.  **Name & Save Deck** (Client: `useAiGenerate.handleSaveDeck` -> `POST /api/decks`)
7.  **Persist Deck & Cards** (Backend: `/api/decks/route.ts` using `cardActions`)
8.  **Confirm & Navigate** (Backend -> Client: `useAiGenerate` updates state, navigates)

#### Language Detection and Mode Handling:
- Detects languages using Document/Vision AI results.
- Determines mode ('translation'/'knowledge') based on detected languages and card content heuristics.
- Correctly assigns `primary_language`, `secondary_language`, and `is_bilingual` flag during the save step (`POST /api/decks`) based on analysis performed in `/api/extract-pdf` and passed back to the client.

---

## 7. Component Breakdown (Key Components)

*   **Layout:** `RootLayout`, `SiteHeader`, `SiteSidebar`.
*   **Providers:** `AuthProvider`, `SettingsProvider`, `ThemeProvider`.
*   **Core Study:** `StudySessionPage` (`app/study/session/page.tsx`), `StudyFlashcardView`, `DifficultyIndicator`.
*   **Study Setup:** `StudySetSelector`, `StudySetBuilder`, Study Setup Page (`app/study/select/page.tsx`).
*   **Deck/Card Management:**
    *   `DeckList` (`components/deck-list.tsx`): Displays decks, progress bars (via `<DeckProgressBar>`), and actions.
    *   `DeckProgressBar` (`components/deck/DeckProgressBar.tsx`): Shows SRS stage distribution.
    *   `CreateDeckDialog` (`components/create-deck-dialog.tsx`) - Manual creation.
    *   Edit Deck Page (`app/edit/[deckId]/page.tsx`).
    *   `DeckMetadataEditor`, `CardViewTabContent`, `TableViewTabContent`, `DeckDangerZone` (Sub-components for Edit Deck).
    *   `CardEditor`.
*   **Tag Management:** `TagManager`, `CardTagEditor`, Tag Management Page (`app/tags/page.tsx`).
*   **Study Set Management:** List page (`app/study/sets/page.tsx`), New page (`.../new`), Edit page (`.../[id]/edit`).
*   **AI Generation:**
    *   AI Generate Page (`app/prepare/ai-generate/page.tsx`).
    *   `AiGenerateInputCard`, `AiGenerateResultsCard`, `AiGenerateSaveDeckCard` (Sub-components for AI Generate).
    *   `FileUpload`, `MediaCaptureTabs`.
*   **Settings:** Settings Page (`app/settings/page.tsx`) - Reorganized UI with controls for theme, progress bars, etc.
*   **Authentication:** Login/Signup Forms (`app/auth/...`).
*   **Hooks:** `useAuth`, `useSettingsContext`, `useMobileSidebar`, `useStudySessionStore`, `useDecks`, `useTags`, `useCardTags`, `useStudySets`, `useTTS`, `useEditDeck`, `useAiGenerate`, `useSupabase`, `useTheme`.

---

## 8. Security Considerations

*   **Authentication:** Secure user authentication managed by Supabase Auth (JWT/Cookies managed via `@supabase/ssr`).
*   **Authorization (RLS):** Row Level Security policies strictly enforced on all user-specific tables (`settings`, `decks`, `cards`, `tags`, `card_tags`, `study_sets`) ensuring users can only access/modify their own data. Policies must cover SELECT, INSERT, UPDATE, DELETE. Denormalized `user_id` fields aid RLS implementation.
*   **Server Action Validation:**
    *   Verify user session/authentication within each action.
    *   Validate all input data using Zod schemas before processing or database interaction.
*   **API Route Protection:** Secure API routes (e.g., `/api/tts`) by verifying user authentication if they handle sensitive data or actions.
*   **Environment Variables:** Store sensitive keys (Supabase URL/anon key, Google Cloud credentials, JWT secret) securely in environment variables (`.env.local`, Vercel environment variables). Do not commit sensitive keys to Git.
*   **Database Security:** Use parameterized queries (handled by Supabase client libraries) or properly sanitize inputs in DB functions (`resolve_study_query`) to prevent SQL injection. Limit database user permissions if not using Supabase defaults.
*   **HTTPS:** Ensure all communication is over HTTPS (handled by Vercel/Supabase).
*   **Dependencies:** Regularly audit and update dependencies to patch security vulnerabilities.
*   **Rate Limiting:** Consider rate limiting on sensitive API routes or actions (e.g., AI generation, TTS) to prevent abuse.

---

## 9. Development & Deployment Workflow

*   **Version Control:** Git (GitHub/GitLab/Bitbucket)
    *   Feature branches (`feat/`, `fix/`, `chore/`)
    *   Pull Requests with code review
    *   Clear, descriptive commit messages
*   **Local Development:**
    *   Supabase CLI for local development environment (`supabase start`)
    *   Manage database schema changes via migrations (`supabase/migrations/`)
    *   Apply locally (`supabase db reset`), link project (`supabase link`), push changes (`supabase db push`), generate types (`supabase gen types typescript`)
*   **Code Quality & Consistency:**
    *   TypeScript for static typing
    *   Linting (`ESLint`) and Formatting (`Prettier`) enforced via pre-commit hooks (`husky`, `lint-staged`)
    *   Adherence to coding standards defined in custom instructions
*   **Documentation & API Integration:**
    *   Context7 MCP for real-time library documentation access
    *   Automatic API documentation updates through Context7
    *   Integration best practices from official sources
    *   Implementation examples for Google Cloud services
*   **Testing:**
    *   Unit Tests (Jest/Vitest) for utility functions (e.g., `lib/srs.ts`, `lib/utils.ts`)
    *   Integration Tests for Server Actions, custom hooks, potentially database functions
    *   End-to-End Tests (Cypress/Playwright) for critical user flows (Auth, Card CRUD, Study Session, Review Mode Session, AI Gen flow, Settings update)
    *   Aim for reasonable test coverage
*   **Continuous Integration (CI):** GitHub Actions (or similar)
    *   Run linters, formatters, type checks, tests on each push/PR
    *   Build the application
*   **Deployment:**
    *   Vercel for hosting the Next.js application
    *   Connect Vercel to Git repository for automatic deployments from `main` branch
    *   Preview deployments for Pull Requests
    *   Manage environment variables securely in Vercel
    *   Apply Supabase migrations to staging/production environments (`supabase migration up`)

---

## 10. Known Issues / Future Roadmap

*   **Known Issues:**
    *   TTS Language determination relies on joined deck data in `getCardsByIds`; need robust handling if deck data is missing or for card-level overrides (future).
    *   `StudyFlashcardView` needs final prop/state implementation (e.g., `isTransitioning` refinement).
    *   Learn mode card ordering/repetition logic is basic (needs defined strategy: random shuffle, push-to-end, smarter prioritization?).
    *   Need comprehensive testing coverage (Unit, Integration, E2E).
    *   Database backfilling script required for existing users' cards (`user_id`, SRS defaults, potentially tag links).
    *   Performance testing of `resolve_study_query` with large datasets and complex criteria is needed.
    *   UI for Settings page (`app/settings/page.tsx`) needs full implementation connecting controls to the Settings context/service.
    *   Study session completion/summary UI needs refinement (clear "No Cards Found" state, child-friendly summary).
    *   Potential UI/UX inconsistencies across different modules.
*   **Future Roadmap:**
    *   Implement FSRS algorithm & parameter optimization UI/logic.
    *   Implement remaining `StudySetBuilder` filters (text search within cards, other SRS props like stability/difficulty).
    *   Sharing Decks/Study Sets between users.
    *   System-generated Study Sets (e.g., "Hardest Cards", "Recently Lapsed", "Due Today").
    *   Enhanced Analytics/Stats page (progress charts, review heatmap, retention rates).
    *   Refine UI/UX, add subtle animations, improve layout consistency.
    *   Import/Export features (CSV, Anki format?).
    *   Image support on card fronts/backs.
    *   Alternative answer input methods (typing, potentially speech-to-text).
    *   Offline support (Progressive Web App - PWA capabilities).
    *   Rich text editing for card content.
    *   Mobile App (React Native or native).
    *   Advanced query operators/UI in `StudySetBuilder`.

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
*   Google Cloud Documentation:
    *   Document AI ([https://cloud.google.com/document-ai/docs](https://cloud.google.com/document-ai/docs))
    *   Vision AI ([https://cloud.google.com/vision/docs](https://cloud.google.com/vision/docs))
    *   Vertex AI / Gemini ([https://cloud.google.com/vertex-ai/docs/generative-ai/model-reference/gemini](https://cloud.google.com/vertex-ai/docs/generative-ai/model-reference/gemini))
    *   Text-to-Speech ([https://cloud.google.com/text-to-speech/docs](https://cloud.google.com/text-to-speech/docs))
    *   Authentication ([https://cloud.google.com/docs/authentication](https://cloud.google.com/docs/authentication))
    *   Best Practices ([https://cloud.google.com/apis/docs/best-practices](https://cloud.google.com/apis/docs/best-practices))
*   PDF Libraries:
    *   pdf-lib ([https://pdf-lib.js.org/](https://pdf-lib.js.org/))
*   Context7 MCP Documentation:
    *   Google Generative AI SDK ([https://github.com/google-gemini/generative-ai-js](https://github.com/google-gemini/generative-ai-js))
    *   Google Cloud Document AI ([https://cloud.google.com/document-ai/docs/reference](https://cloud.google.com/document-ai/docs/reference))
    *   Google Cloud Vision AI ([https://cloud.google.com/vision/docs/reference](https://cloud.google.com/vision/docs/reference))
    *   Google Cloud Vertex AI ([https://cloud.google.com/vertex-ai/docs](https://cloud.google.com/vertex-ai/docs))
    *   Vertex AI Gemini Model Reference ([https://cloud.google.com/vertex-ai/docs/generative-ai/model-reference/gemini](https://cloud.google.com/vertex-ai/docs/generative-ai/model-reference/gemini))
*   SM-2 Algorithm Specification ([https://www.supermemo.com/en/archives1990-2015/english/ol/sm2](https://www.supermemo.com/en/archives1990-2015/english/ol/sm2))
*   FSRS Algorithm Resources ([https://github.com/open-spaced-repetition/fsrs4anki](https://github.com/open-spaced-repetition/fsrs4anki))
*   `date-fns` Documentation ([https://date-fns.org/docs/Getting-Started](https://date-fns.org/docs/Getting-Started))
*   Sonner Documentation ([https://sonner.emilkowal.ski/](https://sonner.emilkowal.ski/))

---

## 12. Changelog

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

**(Status Key: `[x]`=Done, `[/]`=In Progress, `[ ]`=Pending)**

**Phase 0: Foundational Setup (Assumed Mostly Done)**
*   [x] Next.js project setup with App Router.
*   [x] Supabase project setup.
*   [x] Supabase Auth integration (`@supabase/ssr`, Middleware, AuthProvider).
*   [x] `shadcn/ui` and Tailwind setup.
*   [x] Basic layout components (Header, Footer - pre-refactor).
*   [x] Initial Deck/Card CRUD (pre-refactor).
*   [x] TTS Integration (`useTTS`, `/api/tts` or action).
*   [x] Settings Provider/Service initial setup.
*   [x] Supabase Type Generation initial setup.

**Phase 1: DB Schema & Core Backend Refactor (Completed)**
*   [x] Add SRS fields & `user_id` to `cards` table schema.
*   [x] Create `tags`, `card_tags`, `study_sets`, `settings` table schemas.
*   [x] Implement Supabase migrations for all schema changes. (`..._add_srs_study_sets.sql`, `..._add_card_id_default.sql`, `..._enhance_resolve_study_query.sql`, etc.)
*   [x] Finalize Supabase type definitions (`types/database.ts` or equivalent) and integrate imports.
*   [x] Implement core SM-2 calculation logic (`lib/srs.ts`).
*   [x] Implement `progressActions.updateCardProgress`.
*   [x] Implement `settingsActions` (`fetchSettings`, `updateSettings` including `srs_algorithm`).
*   [x] Implement `cardActions.*` (CRUD).
*   [x] Implement `deckActions.*` (CRUD, Get).
*   [x] Implement `resolve_study_query` DB function.
*   [x] Implement `studyQueryActions.resolveStudyQuery` Server Action.
*   [x] Implement `tagActions.ts` (CRUD, link/unlink).
*   [x] Implement `studySetActions.ts` (CRUD).
*   [x] Removed deprecated `deckService.ts`.
*   [x] Implement `POST /api/decks` route (for AI flow persistence).
*   [x] Implement `POST /api/extract-pdf` route and related services.
*   [x] Add DB View: `cards_with_srs_stage`.
*   [x] Add DB Function: `get_deck_list_with_srs_counts`.
*   [x] Update `deckActions.getDecks` to use RPC.

**Phase 2: Core Study Flow Refactoring (Completed)**
*   [x] Implement Zustand store (`store/studySessionStore.ts`).
*   [x] Refactor `useStudySession` hook (initialize via store, handle Learn/Review modes, fetch data via actions, trigger SRS calcs, save progress). Fixed infinite loop.
*   [x] Refactor `app/study/session/page.tsx`.
*   [x] Refactor `components/study/study-flashcard-view.tsx`.
*   [x] Implement Study Setup UI (`StudySetSelector`, `/study/select` page).
*   [x] Update Deck List (`components/deck-list.tsx`) to use new study initiation flow & trigger `CreateDeckDialog`.
*   [x] Implement `CreateDeckDialog` for manual deck creation.
*   [x] Implement Deck Progress Bar UI (`components/deck/DeckProgressBar.tsx`).
*   [x] Integrate Progress Bar into `DeckList` (`components/deck-list.tsx`), controlled by settings.
*   [x] Implement Settings Page UI (`app/settings/page.tsx`) - **Reorganized with Theme/Appearance Settings**.
    *   [x] Add Theme preference select control (`ThemePreference`).
    *   [x] Integrate `next-themes` via `useTheme` hook.
    *   [x] Add Show Deck Progress toggle.
    *   [x] Implement Card Settings section.
    *   [x] Restore Speech Settings section.
    *   [x] Implement Word Color Coding section.
*   [x] Finalize Study Session Page UI (`app/study/session/page.tsx`) - **Partially Done**
    *   (Sub-tasks unchanged)
*   [x] Add/Update main navigation links for new/changed sections.

**Phase 3: UI Implementation & Integration (Updated)**
*   [x] Implement Responsive Navigation.
*   [x] Implement Tag Management UI (`TagManager`, `/tags` page, `CardTagEditor`, `useTags`, `useCardTags`).
*   [x] Implement Edit Deck Page (`app/edit/[deckId]/page.tsx`):
    *   [x] Implement `useEditDeck` hook.
    *   [x] Implement `DeckMetadataEditor` component.
    *   [x] Implement `CardViewTabContent` component.
    *   [x] Implement `TableViewTabContent` component.
    *   [x] Implement `DeckDangerZone` component.
    *   [x] Integrate `CardTagEditor`.
    *   [x] Refactor `CardEditor` for use within tabs.
*   [x] Implement Study Set Management UI (`StudySetBuilder`, `/study/sets/*` pages, `useStudySets`).
*   [x] Implement Study Setup UI (`StudySetSelector`, `/study/select` page).
*   [x] Update Deck List (`components/deck-list.tsx`) to use new study initiation flow & trigger `CreateDeckDialog`.
*   [x] Implement `CreateDeckDialog` for manual deck creation.
*   [x] Implement Deck Progress Bar UI (`components/deck/DeckProgressBar.tsx`).
*   [x] Integrate Progress Bar into `DeckList` (`components/deck-list.tsx`), controlled by settings.
*   [x] Implement Settings Page UI (`app/settings/page.tsx`) - **Reorganized with Theme/Appearance Settings**.
    *   [x] Add Theme preference select control (`ThemePreference`).
    *   [x] Integrate `next-themes` via `useTheme` hook.
    *   [x] Add Show Deck Progress toggle.
    *   [x] Implement Card Settings section.
    *   [x] Restore Speech Settings section.
    *   [x] Implement Word Color Coding section.
*   [/] Finalize Study Session Page UI (`app/study/session/page.tsx`) - **Partially Done**
    *   (Sub-tasks unchanged)
*   [x] Add/Update main navigation links for new/changed sections.

**Phase 4: AI Flashcard Generator (Completed)**
*   [x] Task 1.1: AI Key Setup
*   [x] Task 1.2: Install AI Dependencies
*   [x] Task 1.3: Implement Client-side Upload (`useAiGenerate`, `AiGenerateInputCard`, `FileUpload`).
*   [x] Task 1.4: Implement Backend Extraction/Generation API (`/api/extract-pdf`, services).
*   [x] Task 2.1: Integrate API call in `useAiGenerate`.
*   [x] Task 2.2: Implement Results Display (`useAiGenerate`, `AiGenerateResultsCard`).
*   [x] Task 3.1: Implement Save Deck UI/Logic (`useAiGenerate`, `AiGenerateSaveDeckCard`).
*   [x] Task 3.2: Implement Save Deck API Call (`useAiGenerate` -> `POST /api/decks`).
*   [x] Task 4.1: Implement JSON Export (Client-side).
*   [x] Task 4.2: Add comprehensive error handling and toast notifications.
*   [x] Task 4.3: Add AI Gen Entry Point in Main UI (`/prepare/ai-generate` sidebar link).
*   [x] Task 5.1: Implement Vercel-specific configurations.
*   [ ] Database Backfilling script creation & testing (Staging).
*   [ ] Unit testing (SRS utils, helpers, AI utils, hooks).
*   [ ] Integration testing (Server Actions, API Routes, Hooks, DB function calls, Views).
*   [ ] E2E testing (Core user flows: Auth, **Manual Deck Creation (Dialog)**, **AI Deck Creation**, **Deck Editing**, Tagging, Study Set CRUD, Learn Mode Session, Review Mode Session, Settings update - **including Theme change & Deck Progress toggle**).
*   [ ] Manual cross-browser/device testing.
*   [ ] UI/UX polish (animations, layout consistency, wording, accessibility checks).
*   [ ] Performance review & optimization (DB queries, indexes, bundle size, API route performance).

**Phase 5: Testing & Polish (Pending)**
*   [ ] Unit testing (SRS utils, helpers, AI utils, hooks).
*   [ ] Integration testing (Server Actions, API Routes, Hooks, DB function calls).
*   [ ] E2E testing (Core user flows: Auth, **Manual Deck Creation (Dialog)**, **AI Deck Creation**, **Deck Editing**, Tagging, Study Set CRUD, Learn Mode Session, Review Mode Session, Settings update).
*   [ ] Manual cross-browser/device testing.
*   [ ] UI/UX polish (animations, layout consistency, wording, accessibility checks).
*   [ ] Performance review & optimization (DB queries, indexes, bundle size, API route performance).

--- 