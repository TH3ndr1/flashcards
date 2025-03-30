# Project Documentation: Flashcards App

**Version:** 2.0 (Integrated Study Sets & SRS)
**Date:** 2024-07-26

## 1. Executive Summary

### Purpose and Objectives
The Flashcards App is a modern, multilingual learning platform designed to help users create and study flashcards efficiently and effectively. The project aims to enhance the learning experience through:
- Interactive flashcard creation and management.
- **(New)** Flexible, query-based study sessions using tags, deck affiliation, and review status.
- **(New)** Implementation of proven Spaced Repetition System (SRS) algorithms (initially SM-2, expandable to FSRS) for optimized long-term retention.
- Multi-modal learning via integrated Text-to-Speech (TTS) audio support.
- Progress tracking and user-configurable settings.

### Target Users and Main Use Cases
- Language learners improving vocabulary (using audio, tags like 'verb', 'noun').
- Students studying any subject matter (organizing by chapter tags, studying due cards).
- Teachers creating and organizing study materials (using decks and tags).
- Self-learners requiring an organized and efficient study system (using query-based study sets like "difficult items" or "review all due").
- **(New)** Users with specific learning needs (Dyslexia, ADHD) benefiting from structured SRS, audio, and clear UI (addressed via separate accessibility features).

### Business Value and Expected Outcomes
- **Improved Learning Efficiency:** Through optimized SRS scheduling and focused query-based study.
- **Enhanced Retention:** Through active recall, spaced repetition, and multi-modal learning (text + audio).
- **Increased User Engagement:** Through progress tracking, flexible study options, and customizable settings (like SRS algorithm choice).
- **Flexible Learning Environment:** Supporting multiple languages, diverse content, and personalized study workflows.

## 2. Business Context

### Problem Statement
Traditional flashcard methods and simpler apps often lack the flexibility, efficiency, and features needed for modern, optimized learning:
- Limited accessibility across devices.
- No or basic audio support for pronunciation.
- Difficulty in tracking granular progress and understanding memory decay.
- Inflexible study options (often limited to single decks).
- Lack of robust, evidence-based spaced repetition integrated seamlessly.
- **(New)** Difficulty studying related concepts across different decks or focusing on specific card types (e.g., only difficult cards, only due cards).

### Key Stakeholders
- End Users (students, language learners, self-learners)
- Content Creators (teachers, education professionals)
- Platform Administrators
- Development Team

### User Personas
1. Language Learner
   - Primary need: Vocabulary acquisition with pronunciation and context.
   - Key features: TTS, bilingual cards, **(New)** tagging ('verbs', 'idioms'), SRS.
2. Student
   - Primary need: Subject matter revision and long-term retention.
   - Key features: Progress tracking, deck organization, **(New)** query-based study (due cards, chapter tags), SRS.
3. Teacher
   - Primary need: Content creation and organization.
   - Key features: Deck management, multi-language support, **(New)** tagging for structure.

### Business Workflows
1. User Registration and Authentication
2. Deck Creation and Management
3. **(New)** Tag Creation and Management (Assigning tags to cards)
4. **(New)** Study Set Creation and Management (Defining query criteria)
5. Study Session Execution (Based on Deck, Tag, Study Set, or dynamic query like "Due Cards")
6. Card Review and SRS Update (Answering card, system calculates next review)
7. Progress Tracking and Analytics (Overall stats, card-level SRS state)
8. User Settings Management (Including SRS algorithm preference)
9. Content Sharing and Collaboration (Future)

## 3. Functional Overview

### Main Features and Modules
1. Authentication System
   - Sign up/Login, Profile management, OAuth integration.
2. Deck Management
   - Create/Edit/Delete decks, Import/Export, Categorization.
3. **(New)** Tag Management
    - Create/Edit/Delete user-specific tags.
    - Assign/Remove tags from cards.
4. **(New)** Study Set Management
    - Create/Edit/Delete named study sets based on query criteria.
    - Query criteria include tags (include/exclude), decks (include/exclude), SRS status (e.g., is due, difficulty range).
5. Study System
   - Interactive study sessions based on decks, tags, study sets, or dynamic queries.
   - **(New)** Spaced Repetition System (SRS):
        - User-selectable algorithm (via Settings), starting with SM-2.
        - Automatic calculation of next review date based on user performance (grade) and chosen algorithm.
        - Card-level storage of SRS state (e.g., easiness factor, interval, stability, difficulty, next review date).
   - Progress tracking (overall and per card).
   - Flippable card interface.
6. Audio Support
   - Text-to-speech integration (Google Cloud TTS).
   - Multiple language support & voice customization.
7. User Settings
    - General preferences.
    - **(New)** SRS Algorithm selection ('sm2', 'fsrs' - future).
    - TTS preferences.

### Key User Interactions
1. Card Creation/Editing Flow
   - Enter content, select languages, **(New)** assign/remove tags, generate audio.
2. Tag Management Flow
    - Create new tag (e.g., "Chapter 3").
    - View/Edit/Delete existing tags.
3. **(New)** Study Set Creation Flow
    - Name the set (e.g., "Hard Verbs").
    - Define query criteria using UI (e.g., Tags: include 'verb', Difficulty > 0.7).
    - Save the Study Set.
4. Study Session Initiation Flow
   - Choose a Deck OR
   - Choose a Tag OR
   - Choose a saved Study Set OR
   - Choose a dynamic query (e.g., "Study 20 Due Cards").
5. Study Session Execution Flow
   - System resolves query to get list of card IDs.
   - System fetches card data.
   - User reviews cards one by one.
   - User flips card, listens to pronunciation.
   - User self-assesses (e.g., Again, Hard, Good, Easy).
   - System calculates next SRS state and schedules debounced save.
   - System presents next card.
6. Settings Flow
    - Navigate to settings page.
    - **(New)** Select preferred SRS Algorithm from dropdown.
    - Adjust other preferences (TTS, etc.).
    - Save settings.

## 4. Technical Architecture

### Technology Stack
- Frontend: Next.js 15.1.0 (or latest stable) with React 19 (or latest stable) - Using App Router
- Backend: Serverless via Next.js API routes and **Server Actions** (preferred for mutations/queries)
- Database: Supabase (PostgreSQL)
- **(New Recommendation)** Database Functions: Consider `pl/pgsql` functions for complex queries like `resolveStudyQuery`.
- Authentication: Supabase Auth integrated via `@supabase/ssr` library (client and server)
- Storage: Supabase Storage (For user-uploaded media if added later, TTS is currently generated on-the-fly)
- Text-to-Speech: Google Cloud TTS API (via `/api/tts` route)
- UI Framework: Tailwind CSS with shadcn/ui (using Radix UI primitives)
- Form Management: React Hook Form
- Validation: Zod
- State Management: React Context (`AuthProvider`, `SettingsProvider`), Custom Hooks (`useAuth`, `useDecks`, `useStudySession`, `useTags`, `useStudySets`, `useSettings`, etc.)
- Utility Libraries: `sonner` (toasts), `lucide-react` (icons)

### Frontend Architecture
- Next.js App Router structure (`app/`).
- Mix of Server and Client Components.
- Styling via Tailwind CSS / shadcn/ui.
- Reusable UI components (`components/ui/`).
- Application-specific components (`components/`) including:
    - **(New)** `StudySetBuilder`, `StudySetSelector`, `TagManager`, `CardTagEditor`, `SrsSelector`.
    - `study-flashcard-view`, `table-editor`, `card-editor`.
- State Management Strategy:
    - Global State (Auth, Settings): Managed via React Context (`AuthProvider`, `SettingsProvider`) and hooks (`useAuth`, `useSettings`).
    - Domain-Specific State: Managed by custom hooks:
        - `useDecks` (CRUD for decks)
        - **(New)** `useTags` (CRUD for tags, linking to cards)
        - **(New)** `useStudySets` (CRUD for study sets)
        - `useStudySession` (Orchestrates active study, refactored for queries & SRS)
    - Local Component State: `useState`, `useReducer`.
- Custom Hooks (`hooks/`) are central:
    - `useSupabase`, `useAuth`, `useSettings`.
    - `useDecks`, `useTags`, `useStudySets`.
    - `useDeckLoader` (still useful for viewing/editing a *single* deck's cards, but *not* for study session loading).
    - `useStudySession` (Refactored: takes query/setID, resolves card IDs via action, fetches cards via action, calculates SRS state via utils, persists progress via `progressActions`).
    - `useTTS`, `useStudyTTS` (Bridge study session state to TTS).
    - `useMobile`.

### Backend Architecture
- Primarily serverless logic within Next.js.
- **API Routes (`app/api/*`)**: Specific endpoints like `/api/tts`.
- **Server Actions (`*.actions.ts`)**: Preferred for data fetching and mutations. Encapsulate business logic and database interaction.
    - **(New)** `tagActions.ts` (CRUD for tags and card_tags)
    - **(New)** `studySetActions.ts` (CRUD for study_sets)
    - **(New)** `studyQueryActions.ts` (`resolveStudyQuery` - takes criteria/setID, executes DB query/function, returns card IDs)
    - **(New)** `cardActions.ts` (`getCardsByIds` - fetches full card data including SRS state for given IDs)
    - **(New)** `progressActions.ts` (`updateCardProgress` - saves calculated SRS state and stats for a single card)
    - **(New)** `settingsActions.ts` (Get/Update user settings including `srs_algorithm`)
    - Existing actions for deck/card CRUD (may be refactored into `deckActions.ts`, `cardActions.ts`).
- **Service Layer (`lib/*Service.ts`)**: May still exist for complex reusable logic called by Actions, or Actions might interact directly with Supabase client / DB functions. Less emphasis if Actions handle primary logic.
- **(New) SRS Logic Utilities (`lib/srs.ts` or `lib/study-utils.ts`)**:
    - `calculateNextSrsState(card, grade, algorithm)`: Selects correct algorithm implementation.
    - `calculateSm2State(currentSm2State, grade)`: Pure function implementing SM-2 logic.
    - `calculateFsrsState(...)`: Placeholder for FSRS.
    - Returns new SRS state (`nextReviewDue`, `easinessFactor`, `intervalDays`, `srsLevel`, etc.).
- **Database Interaction**: Supabase client (`@supabase/ssr`), RLS enforced. Consider DB functions for `resolveStudyQuery`. **Indexes are crucial** (esp. on `cards(user_id, next_review_due)`).
- **External Services**: Google Cloud TTS.
- **Middleware (`middleware.ts`)**: Manages session cookies via `@supabase/ssr`.

### Data Models (Supabase PostgreSQL Schema)

**(Note: This replaces the previous data model section entirely)**

1.  **`users`** (Managed by Supabase Auth)
2.  **`settings`** (User preferences)
    *   `user_id`: `uuid` (PK, FK -> `auth.users.id`, ON DELETE CASCADE)
    *   `srs_algorithm`: `text` (default: 'sm2', not null) - Stores 'sm2' or 'fsrs'.
    *   `fsrs_parameters`: `jsonb` (nullable) - For future user-specific FSRS tuning.
    *   `created_at`: `timestamptz` (default: `now()`)
    *   `updated_at`: `timestamptz` (default: `now()`)
    *   *... other setting fields (TTS preferences, etc.) ...*
    *   *RLS: User can only manage/view their own settings.*
3.  **`decks`**
    *   `id`: `uuid` (PK, default: `uuid_generate_v4()`)
    *   `user_id`: `uuid` (FK -> `auth.users.id`, ON DELETE CASCADE)
    *   `title`: `text` (Not null)
    *   `description`: `text` (Nullable)
    *   `primary_language`: `text` (Nullable)
    *   `secondary_language`: `text` (Nullable)
    *   `created_at`: `timestamptz` (default: `now()`)
    *   `updated_at`: `timestamptz` (default: `now()`)
    *   *RLS: User can only manage/view their own decks.*
4.  **`tags`**
    *   `id`: `uuid` (PK, default: `uuid_generate_v4()`)
    *   `user_id`: `uuid` (FK -> `auth.users.id`, ON DELETE CASCADE)
    *   `name`: `text` (Unique constraint per user: `UNIQUE(user_id, name)`)
    *   `created_at`: `timestamptz` (default: `now()`)
    *   *RLS: User can only manage/view their own tags.*
5.  **`cards`** (Core flashcard data and SRS state)
    *   `id`: `uuid` (PK, default: `uuid_generate_v4()`)
    *   `deck_id`: `uuid` (FK -> `decks.id`, ON DELETE CASCADE)
    *   `user_id`: `uuid` (FK -> `auth.users.id`, ON DELETE CASCADE) - Denormalized for query/RLS ease.
    *   `front_content`: `text` (Not null)
    *   `back_content`: `text` (Not null)
    *   `created_at`: `timestamptz` (default: `now()`)
    *   `updated_at`: `timestamptz` (default: `now()`)
    *   `# SRS Fields`
    *   `last_reviewed_at`: `timestamptz` (nullable)
    *   `next_review_due`: `timestamptz` (nullable) - **INDEXED along with user_id**
    *   `srs_level`: `integer` (default: 0, not null) - SM-2 'n' or general maturity.
    *   `easiness_factor`: `float` (default: 2.5, nullable) - SM-2 EF.
    *   `interval_days`: `integer` (default: 0, nullable) - SM-2 Interval.
    *   `stability`: `float` (nullable) - FSRS 'S'.
    *   `difficulty`: `float` (nullable) - FSRS 'D'.
    *   `last_review_grade`: `integer` (nullable) - Last user rating (1-4).
    *   `# Optional General Stats`
    *   `correct_count`: `integer` (default: 0)
    *   `incorrect_count`: `integer` (default: 0)
    *   *RLS: User can only manage/view their own cards.*
6.  **`card_tags`** (Join table)
    *   `card_id`: `uuid` (FK -> `cards.id`, ON DELETE CASCADE)
    *   `tag_id`: `uuid` (FK -> `tags.id`, ON DELETE CASCADE)
    *   `user_id`: `uuid` (FK -> `auth.users.id`, ON DELETE CASCADE) - Denormalized for RLS.
    *   Primary Key: `(card_id, tag_id)`
    *   *RLS: User can only manage/view links related to their own cards/tags.*
7.  **`study_sets`**
    *   `id`: `uuid` (PK, default: `uuid_generate_v4()`)
    *   `user_id`: `uuid` (FK -> `auth.users.id`, ON DELETE CASCADE)
    *   `name`: `text` (Not null)
    *   `description`: `text` (Nullable)
    *   `query_criteria`: `jsonb` (Stores filter rules, e.g., `{"includeTags": ["id"], "isDue": true, "limit": 50}`, Not null)
    *   `created_at`: `timestamptz` (default: `now()`)
    *   `updated_at`: `timestamptz` (default: `now()`)
    *   *RLS: User can only manage/view their own study sets.*

## 4.1 Code Structure and Organization

### Codebase Overview (Updated Diagram)

```mermaid
graph TD
    subgraph UserInteraction
        U[User Browser]
    end

    subgraph Next.jsApplicationVercel ["Next.js Application (Vercel)"]
        direction LR
        subgraph FrontendLayer ["Frontend Layer (Client Components/Pages)"]
            P[Pages (app/**/page.tsx)]
            CC[Client Components (components/)]
            H[Hooks (hooks/)]
            CTX[Context Providers (providers/)]
        end

        subgraph BackendLayer ["Backend Layer (Server-side Logic)"]
            MW[Middleware (middleware.ts)]
            SA[Server Actions (*.actions.ts)]
            API[API Routes (app/api/*)]
            DBF[(Optional) DB Functions]
            SVC[Service Layer (lib/*Service.ts) - Optional/Reduced]
            UTIL[Utilities (lib/utils.ts, lib/srs.ts)]
        end
    end

    subgraph ExternalServices
        SB_Auth[(Supabase Auth)]
        SB_DB[(Supabase DB)]
        SB_Store[(Supabase Storage)] -- Optional --> SA
        G_TTS[(Google Cloud TTS)]
    end

    %% User Flows
    U -- HTTP Request --> MW;
    U -- Renders --> P;
    P -- Uses --> CC;
    P -- Uses --> H;
    CC -- Uses --> H;

    %% Hook Dependencies & Calls
    H -- Uses --> CTX;
    H -- Calls --> SA;  # Primary backend interaction
    H -- Calls --> API; # e.g., useTTS -> /api/tts
    CTX -- Uses --> H; # e.g., AuthProvider uses useSupabase
    CTX -- Calls --> SA; # e.g., SettingsProvider -> settingsActions

    %% Backend Flows
    MW -- Verifies Session --> SB_Auth;
    MW -- Updates Cookie --> U;

    SA -- Uses --> UTIL; # e.g., useStudySession calls SRS utils before progressActions
    SA -- Interacts --> SB_Auth; # Auth checks
    SA -- Interacts --> SB_DB; # Direct DB calls
    SA -- Calls --> DBF; # Calls DB Functions
    SA -- Calls --> SVC; # Optional call to service layer

    API -- Interacts --> SB_Auth;
    API -- Interacts --> SB_DB; # e.g., TTS route might log usage
    API -- Calls --> G_TTS;

    DBF -- Interacts --> SB_DB; # DB Functions run inside Postgres

    classDef user fill:#cce5ff,stroke:#004085;
    classDef frontend fill:#e2f0d9,stroke:#385723;
    classDef backend fill:#fce5cd,stroke:#854000;
    classDef external fill:#f8d7da,stroke:#721c24;
    classDef database fill:#d1ecf1,stroke:#0c5460;
    classDef util fill:#e9ecef,stroke:#343a40;

    class U user;
    class P,CC,H,CTX frontend;
    class MW,SA,API,DBF,SVC backend;
    class SB_Auth,SB_DB,SB_Store,G_TTS external;
    class UTIL util;
```
*Diagram updated to emphasize Server Actions, include DB Functions, SRS Utils, and show hook/action dependencies.*

### Key Components and Their Functions (Updated & Added Details)

#### 1. Frontend Components (`/app/*`, `/components/*`)
*   **Application Components (`/components/`)**:
    *   `study-flashcard-view.tsx`: Displays flippable card, answer buttons (Again/Hard/Good/Easy), progress. Driven by `useStudySession`.
    *   `table-editor.tsx` & `card-editor.tsx`: Used in deck editing page. **(New)** Includes `CardTagEditor` integration.
    *   **(New)** `StudySetBuilder.tsx`: UI form to define `query_criteria`. Uses `useTags`, `useDecks` (for selection lists). Calls `studySetActions` via `useStudySets`.
    *   **(New)** `StudySetSelector.tsx`: UI to choose saved `StudySet`, tag, deck, or dynamic query (e.g., "Due Cards"). Uses `useStudySets`, `useTags`, `useDecks`. Initiates study via `useStudySession`.
    *   **(New)** `TagManager.tsx`: UI for CRUD operations on tags. Uses `useTags`.
    *   **(New)** `CardTagEditor.tsx`: Integrated into card editing, allows adding/removing tags from a card. Uses `useTags`.
    *   **(New)** `SrsSelector.tsx`: Dropdown in settings page to select SRS algorithm. Uses `useSettings`.

#### 2. Custom Hooks (`/hooks/*`) (Updated & Added Details)
1.  `useSupabase`: Provides Supabase browser client.
2.  `useAuth`: Manages auth state and methods (`AuthProvider`).
3.  **(Updated)** `useSettings`: Manages settings state (`srs_algorithm`, etc.) and updates via `settingsActions` (`SettingsProvider`).
4.  `useDecks`: Manages deck list/CRUD via `deckActions`. Used for selection lists.
5.  **(New)** `useTags`: Manages tag list/CRUD and card-tag links via `tagActions`.
6.  **(New)** `useStudySets`: Manages study set list/CRUD via `studySetActions`.
7.  `useDeckLoader`: Loads single deck details (used for editing view). **Not used by `useStudySession` anymore.**
8.  **(Refactored)** `useStudySession`: Orchestrates the active study session.
    *   Takes `queryCriteria` or `studySetId` as input.
    *   Calls `studyQueryActions.resolveStudyQuery` -> gets `cardIds`.
    *   Calls `cardActions.getCardsByIds` -> gets `FlashCard[]` with SRS state.
    *   Depends on `useSettings` for `srs_algorithm`.
    *   Manages study loop state (current card, queue, transitions).
    *   On `answerCard(grade)`:
        *   Calls `lib/srs.ts -> calculateNextSrsState(card, grade, algorithm)` -> gets `newSrsState`.
        *   Schedules debounced call to `progressActions.updateCardProgress(cardId, newSrsState + stats)`.
    *   Depends on: `useSettings`, `useStudyTTS`, `studyQueryActions`, `cardActions`, `progressActions`. **No longer depends on `useDecks` or `useDeckLoader` for core study logic.**
9.  `useTTS`, `useStudyTTS`: Handle text-to-speech generation and playback during study.
10. `useMobile`: Utility hook.

#### 3. API Routes (`/app/api/*`) & Server Actions (`*.actions.ts`)
1.  **API: `/app/api/tts/route.ts`**: Handles TTS generation via Google Cloud.
2.  **API: `/app/auth/callback/route.ts`**: Handles Supabase email confirmation.
3.  **Actions (`tagActions.ts`)**: CRUD for tags and card-tag links.
4.  **Actions (`studySetActions.ts`)**: CRUD for study sets.
5.  **Actions (`studyQueryActions.ts`)**: `resolveStudyQuery` - critical action, likely calls DB function.
6.  **Actions (`cardActions.ts`)**: `getCardsByIds`, potentially other card CRUD ops.
7.  **Actions (`progressActions.ts`)**: `updateCardProgress` - saves SRS state for one card.
8.  **Actions (`settingsActions.ts`)**: Get/Update user settings.
9.  **Actions (`deckActions.ts`)**: CRUD for decks (if refactored).

#### 4. Service Layer (`/lib/*Service.ts`) & Utilities (`/lib/*`)
*   Service layer potentially reduced in scope; actions may call Supabase directly or via DB functions.
*   **(New)** `lib/srs.ts` (or in `study-utils.ts`): Contains `calculateNextSrsState`, `calculateSm2State`, etc. **Pure functions with SRS logic.**
*   `lib/utils.ts`: General utility functions (debouncing, formatting, etc.).

#### 5. Database Models (`/supabase/migrations/*`)
*   Migrations define the schema described in section 4, Data Models.
*   **(New)** Consider DB function definition for `resolve_study_query(user_id, criteria_jsonb)`.

### State Management and Data Flow (Updated Diagrams)

1.  **Authentication Flow (`@supabase/ssr`)** *(Diagram remains largely the same as in previous version)*
   ```mermaid
   sequenceDiagram
       participant User
       participant Browser
       participant Middleware as Next.js Edge
       participant ServerComponent as Next.js Server
       participant ClientComponent as React Client
       participant useSupabase as Hook
       participant useAuth as Hook
       participant SupabaseAuth as Supabase Auth

       User->>Browser: Navigates to page
       Browser->>Middleware: Request
       Middleware->>SupabaseAuth: Reads/Refreshes Session via Cookie (Server Client)
       SupabaseAuth-->>Middleware: Session Info / Updated Cookie
       Middleware->>ServerComponent: Request + Session Context (via Headers/Cookies)
       ServerComponent->>SupabaseAuth: (Optional) Further server-side checks/data fetch (Server Client)
       ServerComponent-->>Browser: Rendered HTML
       Browser->>ClientComponent: Hydrates / Renders
       ClientComponent->>useSupabase: Initialize Hook
       useSupabase->>SupabaseAuth: createBrowserClient()
       useSupabase-->>ClientComponent: Supabase Client Instance
       ClientComponent->>useAuth: Initialize Hook (gets client from useSupabase)
       useAuth->>SupabaseAuth: getSession() / onAuthStateChange() (Browser Client)
       SupabaseAuth-->>useAuth: Auth State Update
       useAuth-->>ClientComponent: User/Session State
       ClientComponent-->>Browser: Updates UI based on Auth State
       opt User Action (Login/Logout)
           ClientComponent->>useAuth: Calls signIn() / signOut()
           useAuth->>SupabaseAuth: Calls Supabase function (Browser Client)
           SupabaseAuth-->>useAuth: Auth State Update (via listener)
           useAuth-->>ClientComponent: Updated User/Session State
           ClientComponent-->>Browser: Updates UI / Redirects
       end
   ```

2.  **Study Session Flow (Query-Based with SRS) (Major Update)**
    ```mermaid
    sequenceDiagram
        actor User
        participant Selector as UI: Study Selector
        participant useSettings as Hook
        participant useStudySession as Hook
        participant studyQueryActions as Action
        participant cardActions as Action
        participant StudyPage as UI: Study Page
        participant srsUtils as lib/srs.ts
        participant progressActions as Action
        participant SupabaseDB as Supabase DB

        User->>Selector: Selects "Study Due Cards" (query: {isDue: true, limit: 20})
        Selector->>useStudySession: initiateSession({ queryCriteria: {isDue: true, limit: 20} })

        %% Resolve Card IDs
        useStudySession->>studyQueryActions: resolveStudyQuery({isDue: true, limit: 20})
        note right of studyQueryActions: Calls DB Function/Query: cards WHERE user_id = _user AND next_review_due <= now() LIMIT 20
        studyQueryActions-->>useStudySession: Returns { cardIds: ["c3", "c7", "c2"] }

        %% Fetch Card Data
        useStudySession->>cardActions: getCardsByIds(["c3", "c7", "c2"])
        note right of cardActions: Fetches full card data including current SRS fields
        cardActions-->>useStudySession: Returns FlashCard[] Details

        %% Initialize Study UI
        useStudySession-->>StudyPage: Navigates/Provides initial state (cards list, index 0)
        StudyPage-->>User: Displays first card ("c3")

        %% User Answers
        User->>StudyPage: Clicks "Good (3)" for card "c3"
        StudyPage->>useStudySession: answerCard(grade = 3)

        %% Calculate Next SRS State
        useStudySession->>useSettings: get srs_algorithm (e.g., 'sm2') (from context)
        useStudySession->>srsUtils: calculateNextSrsState(card_c3, grade=3, algorithm='sm2')
        srsUtils-->>useStudySession: Returns newSrsState = { nextReviewDue: ..., easinessFactor: ..., ... }

        %% Update State & Schedule Save
        useStudySession->>useStudySession: Update card_c3 state in memory
        useStudySession->>useStudySession: Schedule debounced save: updateCardProgress("c3", payload)
        note right of useStudySession: payload = newSrsState + counts + lastReviewedAt + grade=3

        %% Move to Next Card
        useStudySession->>useStudySession: Determine next card index (e.g., 1)
        useStudySession-->>StudyPage: Update UI state (show card "c7", progress bar)
        StudyPage-->>User: Displays next card ("c7")

        %% Background Save (Later)
        opt Debounced Save Fires
            useStudySession->>progressActions: updateCardProgress("c3", payload)
            progressActions->>SupabaseDB: UPDATE cards SET next_review_due=..., ... WHERE id = "c3" AND user_id = _user
            SupabaseDB-->>progressActions: Success/Error
            progressActions-->>useStudySession: Result (toast on error)
        end
    ```

## 5. Component Breakdown
*(Existing components + New)*
- `StudySetBuilder`: Form for creating/editing study sets.
- `StudySetSelector`: Interface to choose how to start studying.
- `TagManager`: Interface for managing user tags.
- `CardTagEditor`: Component (likely modal or part of card form) to assign tags to cards.
- `SrsSelector`: Dropdown in settings for choosing SRS algorithm.
- `StudyFlashcardView`: Displays the interactive flashcard during study.
- `DeckList`, `DeckForm`, `CardForm`, `TableEditor`: Components for managing decks and cards directly.
- Standard UI elements from `shadcn/ui`.
- Layout components (`Header`, `Sidebar`, `Footer`).
- Authentication forms (`LoginForm`, `SignupForm`).

## 6. Data Models and Relationships

**(Updated ERD reflecting final schema)**

```mermaid
erDiagram
    USERS ||--o{ DECKS : owns
    USERS ||--o{ TAGS : owns
    USERS ||--o{ STUDY_SETS : owns
    USERS ||--|{ CARDS : owns
    USERS ||--|{ SETTINGS : has

    DECKS ||--o{ CARDS : contains

    CARDS ||--|{ CARD_TAGS : has

    TAGS ||--|{ CARD_TAGS : applied_via

    SETTINGS {
        uuid user_id PK, FK
        text srs_algorithm "Default 'sm2'"
        jsonb fsrs_parameters "Nullable"
        timestamptz created_at
        timestamptz updated_at
        # ... other settings
    }

    STUDY_SETS {
        uuid id PK
        uuid user_id FK
        text name
        text description "Nullable"
        jsonb query_criteria "Not Null"
        timestamptz created_at
        timestamptz updated_at
    }

    TAGS {
        uuid id PK
        uuid user_id FK
        text name "UNIQUE(user_id, name)"
        timestamptz created_at
    }

    CARD_TAGS {
        uuid card_id PK, FK
        uuid tag_id PK, FK
        uuid user_id FK "For RLS"
    }

    CARDS {
        uuid id PK
        uuid deck_id FK
        uuid user_id FK "Denormalized"
        text front_content "Not Null"
        text back_content "Not Null"
        timestamptz last_reviewed_at "Nullable"
        timestamptz next_review_due "Nullable, INDEX(user_id, next_review_due)"
        integer srs_level "Default 0"
        float easiness_factor "Nullable, Default 2.5"
        integer interval_days "Nullable, Default 0"
        float stability "Nullable"
        float difficulty "Nullable"
        integer last_review_grade "Nullable"
        integer correct_count "Default 0"
        integer incorrect_count "Default 0"
        timestamptz created_at
        timestamptz updated_at
    }

    DECKS {
       uuid id PK
       uuid user_id FK
       text title "Not Null"
       text description "Nullable"
       text primary_language "Nullable"
       text secondary_language "Nullable"
       timestamptz created_at
       timestamptz updated_at
    }
```
*Schema defined in section 4, Data Models.*

## 7. Security Considerations
- Supabase Auth for user management.
- JWT-based session handling via `@supabase/ssr` cookies.
- Secure password policies (enforced by Supabase).
- **Authorization**: Primarily enforced via **Row Level Security (RLS)** policies in Supabase for all data tables (`decks`, `cards`, `settings`, **(New)** `tags`, `card_tags`, `study_sets`). Backend Server Actions must operate under user context and rely on RLS.
- **Server Action Protection**: Actions must validate user session and inputs. Zod for input validation.
- API route protection (Checking session in `/api/tts`).
- Data Protection: Environment variable management for keys. Secure audio file handling (if stored). HTTPS-only access (Vercel).
- **(New)** Query Injection prevention in `resolveStudyQuery` (handled by Supabase client parameterization or carefully constructed DB functions).

## 8. Development and Deployment Workflow
- Git workflow (feature branches, PRs, code reviews).
- Local development using Next.js dev server and Supabase local dev environment.
- Linting (ESLint), Formatting (Prettier), Type Checking (TypeScript).
- **(New)** Database migrations managed via Supabase CLI (`supabase/migrations`).
- Automated testing (Unit tests for SRS utils, integration tests for actions/hooks).
- Deployment via Vercel (connected to Git repository). Environment variables managed in Vercel.

## 9. Known Issues and Future Roadmap
- **(New)** Need to backfill SRS default values for existing cards upon deployment.
- **(New)** Initial FSRS implementation will use default parameters; user-specific tuning is a future enhancement.
- Performance of `resolveStudyQuery` needs monitoring, especially with large datasets.
- TTS costs for Google Cloud need monitoring.
- Limited offline support (current architecture relies heavily on server connection).
- **Future Roadmap:**
    - **(New)** Implement FSRS algorithm alongside SM-2.
    - **(New)** Implement FSRS parameter optimization based on user review history.
    - **(New)** Allow sharing of Decks and/or Study Sets.
    - **(New)** Add more advanced query operators/UI for Study Sets.
    - **(New)** Implement system-generated Study Sets (e.g., "Hardest Cards", "Most Recent Lapses").
    - Enhanced analytics and visualizations.
    - Card import/export improvements.
    - Rich text editing for cards.
    - Mobile app development (potentially PWA or native).

## 10. References and Resources
- Next.js Documentation
- Supabase Documentation (`@supabase/ssr`, RLS, DB Functions)
- React Documentation (Hooks, Context)
- Tailwind CSS / shadcn/ui Documentation
- **(New)** SM-2 Algorithm Specification (e.g., via SuperMemo website archives or Anki manual)
- **(New)** FSRS Algorithm Resources (GitHub repository, related papers/articles)
- Google Cloud TTS Documentation

## 11. Changelog
- **v2.0 (2024-07-26):** Integrated architecture for Tagging, Query-Based Study Sets, and Spaced Repetition System (SRS) with initial SM-2 support. Updated data models, hooks, server actions, and documentation throughout.
- **v1.0 (Previous Date):** Initial project documentation covering basic deck/card management, authentication, and TTS. (Details from original file would go here).