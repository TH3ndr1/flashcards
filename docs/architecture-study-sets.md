# Project Documentation: Flashcards App

**Version:** 2.1 (Consolidated SRS & Study Flow Architecture)
**Date:** 2025-04-05

## 1. Executive Summary

### Purpose and Objectives
The Flashcards App is a modern, multilingual learning platform designed to help users create and study flashcards efficiently and effectively. The project aims to enhance the learning experience through:
- Interactive flashcard creation and management.
- Flexible, query-based study sessions using tags, deck affiliation, and other criteria.
- Implementation of proven Spaced Repetition System (SRS) algorithms (initially SM-2, expandable to FSRS) for optimized long-term retention.
- Multi-modal learning via integrated Text-to-Speech (TTS) audio support.
- Progress tracking and user-configurable settings.

### Target Users and Main Use Cases
- Language learners improving vocabulary (using audio, tags like 'verb', 'noun').
- Students studying any subject matter (organizing by chapter tags, studying due cards).
- Teachers creating and organizing study materials (using decks and tags).
- Self-learners requiring an organized and efficient study system (using query-based study sets like "difficult items" or "review all due").
- Users with specific learning needs (Dyslexia, ADHD) benefiting from structured SRS, audio, and clear UI (addressed via separate accessibility features).

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
- Difficulty studying related concepts across different decks or focusing on specific card types (e.g., only difficult cards, only due cards).

### Key Stakeholders
- End Users (students, language learners, self-learners)
- Content Creators (teachers, education professionals)
- Platform Administrators
- Development Team

### User Personas
1. Language Learner
   - Primary need: Vocabulary acquisition with pronunciation and context.
   - Key features: TTS, bilingual cards, tagging ('verbs', 'idioms'), SRS.
2. Student
   - Primary need: Subject matter revision and long-term retention.
   - Key features: Progress tracking, deck organization, query-based study (due cards, chapter tags), SRS.
3. Teacher
   - Primary need: Content creation and organization.
   - Key features: Deck management, multi-language support, tagging for structure.

### Business Workflows
1. User Registration and Authentication
2. Deck Creation and Management
3. Tag Creation and Management (Assigning tags to cards)
4. Study Set Creation and Management (Defining query criteria)
5. **(Revised)** Study Session Initiation (User selects Card Set + Study Mode)
6. **(Revised)** Study Session Execution (System presents cards based on Mode)
7. Card Review and SRS Update (Answering card, system calculates next review, saves state)
8. Progress Tracking and Analytics (Overall stats, card-level SRS state)
9. User Settings Management (Including SRS algorithm preference)
10. Content Sharing and Collaboration (Future)

## 3. Functional Overview

### Main Features and Modules
1. Authentication System
   - Sign up/Login, Profile management, OAuth integration.
2. Deck Management
   - Create/Edit/Delete decks, Import/Export, Categorization.
3. Tag Management
    - Create/Edit/Delete user-specific tags.
    - Assign/Remove tags from cards.
4. Study Set Management ("Smart Playlists")
    - Create/Edit/Delete named study sets based on query criteria.
    - Query criteria include tags (include/exclude), decks (include/exclude), date added/modified, language, etc.
5. Study System
   - Interactive study sessions based on flexible **Card Selections** (Deck, All Cards, Tags, Study Sets) and distinct **Study Modes**.
   - **Study Modes:**
        - **Learn Mode:** Comprehensive review of selected cards with session-based completion criteria.
        - **Review Mode:** SRS-prioritized review focusing only on cards due according to their `next_review_due` date.
   - **Spaced Repetition System (SRS):**
        - User-selectable algorithm (via Settings), starting with SM-2.
        - Automatic calculation of next review date based on user performance (grade) and chosen algorithm.
        - Card-level storage of SRS state (`next_review_due`, `srs_level`, `easiness_factor`, etc.).
        - **SRS state updated consistently regardless of Study Mode.**
   - Progress tracking (overall and per card).
   - Flippable card interface.
6. Audio Support
   - Text-to-speech integration (Google Cloud TTS).
   - Multiple language support & voice customization.
7. User Settings
    - General preferences (e.g., session completion threshold `X` for Learn Mode).
    - SRS Algorithm selection ('sm2', 'fsrs' - future).
    - TTS preferences.

### Key User Interactions
1. Card Creation/Editing Flow
   - Enter content, select languages, assign/remove tags, generate audio.
2. Tag Management Flow
    - Create new tag (e.g., "Chapter 3").
    - View/Edit/Delete existing tags.
3. Study Set Creation Flow ("Smart Playlist")
    - Name the set (e.g., "Hard Verbs Chapter 1").
    - Define query criteria using UI (e.g., Tags: include 'verb', Deck: 'Chapter 1', Added Date: newer than 14 days).
    - Save the Study Set.
4. **(Revised)** Study Session Initiation Flow
   - **Step 1: Select Cards:** Choose a Deck, "All Cards", a Tag, or a saved Study Set/Smart Playlist.
   - **Step 2: Select Study Mode:** Choose "Learn Mode" or "Review Mode".
   - Click "Start Studying".
5. **(Revised)** Study Session Execution Flow (depends on mode)
   - System resolves query -> gets initial Card IDs.
   - System fetches full card data.
   - **If Learn Mode:** Presents cards (e.g., shuffled), tracks session progress per card, removes cards from session queue when session threshold `X` is met.
   - **If Review Mode:** Filters fetched cards for `isDue`, sorts by due date, presents only due cards.
   - **In both modes:** User reviews, flips, listens, self-assesses (e.g., Again, Hard, Good, Easy). System calculates *next* SRS state via `calculateSm2State`, schedules debounced save via `progressActions.updateCardProgress`. System presents next card based on mode logic.
6. Settings Flow
    - Navigate to settings page.
    - Select preferred SRS Algorithm. Adjust Learn Mode threshold `X`.
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
- Utility Libraries: `sonner` (toasts), `lucide-react` (icons), `date-fns`

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
        - `useTags` (CRUD for tags, linking to cards)
        - `useStudySets` (CRUD for study sets)
        - `useStudySession` (Orchestrates active study, refactored for queries & SRS & Modes)
    - Local Component State: `useState`, `useReducer`.
- Custom Hooks (`hooks/`) are central:
    - `useSupabase`, `useAuth`, `useSettings`.
    - `useDecks`, `useTags`, `useStudySets`.
    - `useDeckLoader` (still useful for viewing/editing a *single* deck's cards, but *not* for study session loading).
    - `useStudySession` (Refactored: takes query/setID, resolves card IDs via action, fetches cards via action, calculates SRS state via utils, persists progress via `progressActions`, manages Learn/Review modes).
    - `useTTS`, `useStudyTTS` (Bridge study session state to TTS).
    - `useMobile`.

### Backend Architecture
- Primarily serverless logic within Next.js.
- **API Routes (`app/api/*`)**: Specific endpoints like `/api/tts`.
- **Server Actions (`*.actions.ts`)**: Preferred for data fetching and mutations. Encapsulate business logic and database interaction.
    - `tagActions.ts` (CRUD for tags and card_tags) (**Status: Placeholder**)
    - `studySetActions.ts` (CRUD for study_sets) (**Status: Placeholder**)
    - `studyQueryActions.ts` (`resolveStudyQuery` - takes criteria, executes DB query/function, returns card IDs) (**Status: Partially Implemented - Structure OK, RPC pending**)
    - `cardActions.ts` (`getCardsByIds`, `getCardById`) (**Status: Implemented**)
    - `progressActions.ts` (`updateCardProgress` - saves calculated SRS state for a single card) (**Status: Implemented**)
    - `settingsActions.ts` (Get/Update user settings) (**Status: Implemented**)
    - `deckActions.ts` (CRUD for decks) (**Status: Existing - Needs Review/Refactor**)
- **Service Layer (`lib/*Service.ts`)**: Potentially reduced role.
- **SRS Logic Utilities (`lib/srs.ts`)**:
    - `calculateNextSrsState(card, grade, algorithm)`: Selects algorithm.
    - `calculateSm2State(currentSm2State, grade)`: SM-2 logic. (**Status: Implemented**)
    - `calculateFsrsState(...)`: Placeholder.
- **Database Interaction**: Supabase client (`@supabase/ssr`), RLS enforced. **DB Function (`resolve_study_query`) highly recommended.** **Indexes crucial** (esp. `cards(user_id, next_review_due)`).
- **External Services**: Google Cloud TTS.
- **Middleware (`middleware.ts`)**: Manages session cookies via `@supabase/ssr`.

### Data Models (Supabase PostgreSQL Schema)

1.  **`users`** (Managed by Supabase Auth)
2.  **`settings`** (User preferences)
    *   `user_id`: `uuid` (PK, FK -> `auth.users.id`, ON DELETE CASCADE)
    *   `srs_algorithm`: `text` (default: 'sm2', not null) - Stores 'sm2' or 'fsrs'.
    *   `fsrs_parameters`: `jsonb` (nullable) - For future user-specific FSRS tuning.
    *   `learn_mode_success_threshold`: `integer` (default: 3, not null) - 'X' value for Learn Mode.
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
7.  **`study_sets`** ("Smart Playlists")
    *   `id`: `uuid` (PK, default: `uuid_generate_v4()`)
    *   `user_id`: `uuid` (FK -> `auth.users.id`, ON DELETE CASCADE)
    *   `name`: `text` (Not null)
    *   `description`: `text` (Nullable)
    *   `query_criteria`: `jsonb` (Stores filter rules, e.g., `{"logic": "AND", "filters": [...] }`, Not null)
    *   `created_at`: `timestamptz` (default: `now()`)
    *   `updated_at`: `timestamptz` (default: `now()`)
    *   *RLS: User can only manage/view their own study sets.*

### 4.1 Code Structure and Organization

*(Diagram and component/hook lists remain as described in previous version v2.0, reflecting the updated structure)*

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

### 4.2 SRS Calculation Utilities (`lib/srs.ts`)

*(This section details the `calculateSm2State` function, types, constants, implementation, explanation, integration, and dependencies as provided previously. It focuses *only* on the algorithm calculation.)*

```typescript
/**
 * Represents the relevant SRS state of a card before a review.
 * Matches fields from the 'cards' table data model.
 */
interface Sm2InputCardState {
  srsLevel: number;           // Current repetition count (n)
  easinessFactor: number | null; // Current Easiness Factor (EF)
  intervalDays: number | null;    // Interval used to schedule *this* review (I(n-1))
}

/**
 * Represents the grade given by the user after reviewing a card.
 * Maps to buttons like: 1: Again, 2: Hard, 3: Good, 4: Easy
 */
type ReviewGrade = 1 | 2 | 3 | 4;

/**
 * Represents the data payload needed to update the card's SRS state
 * in the database via the `progressActions.updateCardProgress` action.
 */
interface Sm2UpdatePayload {
  srsLevel: number;           // The new repetition count (n')
  easinessFactor: number;     // The new Easiness Factor (EF')
  intervalDays: number;       // The new interval in days (I(n'))
  nextReviewDue: Date;        // The calculated next review date
  lastReviewGrade: ReviewGrade; // The grade that led to this update
  // Note: progressActions.updateCardProgress should also update 'last_reviewed_at'
}

// --- Constants Used ---
const MIN_EASINESS_FACTOR = 1.3;
const DEFAULT_EASINESS_FACTOR = 2.5;
const FIRST_INTERVAL = 1; // days
const SECOND_INTERVAL = 6; // days

import { addDays, startOfDay } from 'date-fns'; // Using date-fns for reliable date math

/**
 * Calculates the next SM-2 state for a card based on the user's review grade.
 *
 * @param current The current SRS state of the card before review.
 * @param grade The user's assessment of recall difficulty (1=Again, 2=Hard, 3=Good, 4=Easy).
 * @returns An object containing the updated SRS fields (Sm2UpdatePayload) ready for saving.
 */
export function calculateSm2State(
  current: Sm2InputCardState,
  grade: ReviewGrade
): Sm2UpdatePayload {
  // Initialize values from input or defaults if first review
  const currentSrsLevel = current.srsLevel;
  const currentEasinessFactor = current.easinessFactor ?? DEFAULT_EASINESS_FACTOR;
  // If intervalDays is null/0 (e.g., first review or lapse), treat the previous interval as 0 for calculation purposes.
  const previousIntervalDays = current.intervalDays ?? 0;

  let newSrsLevel: number;
  let newEasinessFactor: number;
  let newIntervalDays: number;

  // --- Grade Handling ---

  // Case 1: Failed Recall (Grade 1: Again)
  if (grade < 3) {
    // Reset repetition count
    newSrsLevel = 0;
    // Interval resets to the first interval
    newIntervalDays = FIRST_INTERVAL;
    // Keep the easiness factor the same (standard SM-2).
    // Ensure EF doesn't go below minimum if it was already low.
    newEasinessFactor = Math.max(MIN_EASINESS_FACTOR, currentEasinessFactor);
  }
  // Case 2: Successful Recall (Grade 2: Hard, 3: Good, 4: Easy)
  else {
    // Increment repetition count
    newSrsLevel = currentSrsLevel + 1;

    // Calculate new Easiness Factor (EF')
    // Map our 1-4 grade to the formula's conceptual 0-5 quality (q):
    // Grade 2 (Hard) -> q=3
    // Grade 3 (Good) -> q=4
    // Grade 4 (Easy) -> q=5
    const quality = grade + 1; // Map 2->3, 3->4, 4->5
    // Standard SM-2 formula: EF' = EF + (0.1 - (5-q)*(0.08 + (5-q)*0.02))
    const efAdjustment = 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02);
    newEasinessFactor = Math.max(MIN_EASINESS_FACTOR, currentEasinessFactor + efAdjustment);

    // Calculate new Interval (I(n'))
    if (newSrsLevel === 1) {
      newIntervalDays = FIRST_INTERVAL;
    } else if (newSrsLevel === 2) {
      newIntervalDays = SECOND_INTERVAL;
    } else {
      // I(n) = I(n-1) * EF'
      // Use the interval that *led* to this review (previousIntervalDays)
      newIntervalDays = Math.ceil(previousIntervalDays * newEasinessFactor);
    }
  }

  // --- Calculate Next Review Date ---
  // Add the new interval (in days) to today's date (at the start of the day).
  const reviewDate = startOfDay(new Date());
  const nextReviewDue = addDays(reviewDate, newIntervalDays);

  // --- Return Payload ---
  return {
    srsLevel: newSrsLevel,
    easinessFactor: newEasinessFactor,
    intervalDays: newIntervalDays,
    nextReviewDue: nextReviewDue,
    lastReviewGrade: grade,
  };
}

// Placeholder for future calculateNextSrsState function
// export function calculateNextSrsState(card: any, grade: ReviewGrade, algorithm: 'sm2' | 'fsrs'): any {
//   if (algorithm === 'sm2') {
//     // Map card data to Sm2InputCardState if needed
//     const sm2Input: Sm2InputCardState = {
//         srsLevel: card.srs_level,
//         easinessFactor: card.easiness_factor,
//         intervalDays: card.interval_days
//     };
//     return calculateSm2State(sm2Input, grade);
//   } else if (algorithm === 'fsrs') {
//     // Call calculateFsrsState (to be implemented)
//     // return calculateFsrsState(cardFsrsState, grade);
//     throw new Error("FSRS algorithm not yet implemented.");
//   } else {
//     throw new Error(`Unknown SRS algorithm: ${algorithm}`);
//   }
// }
```

---

## 5. Study Session Architecture & Flow (v2.1 Target)

This section provides the definitive architecture for how study sessions are initiated and executed, incorporating flexible card selection and distinct study modes.

**Overall Process:** The user first defines *which cards* they want to potentially study (**Card Selection**), and then chooses *how* they want to study that set (**Study Mode**).

### 5.1 Phase 1: Card Selection

**Goal:** Determine the initial pool of card IDs the user is interested in, based on their chosen criteria, before considering study mode or SRS due status.

1.  **User Initiation & Criteria Definition:**
    *   User interacts with UI (`StudySetSelector` or query builder). Options:
        *   **A) Single Deck:** User selects a deck.
            *   *Resulting `queryCriteria`:* `{ deckId: "uuid" }`
        *   **B) All User Cards:** User selects "All Cards".
            *   *Resulting `queryCriteria`:* `{ allCards: true }` (or `{}`)
        *   **C) Tag(s):** User selects one or more tags.
            *   *Resulting `queryCriteria`:* `{ includeTags: ["uuid1", "uuid2"], tagLogic: "ANY" | "ALL" }` (UI determines logic)
        *   **D) "Smart Playlist" / Study Set:** User selects a saved `Study Set` or builds a dynamic query using criteria like:
            *   Deck Title (contains)
            *   Date Added/Modified (relative/absolute)
            *   Language
            *   Tags (Include/Exclude, Any/All)
            *   *(Future)* Specific SRS properties (e.g., low level, high difficulty)
            *   **Logic:** UI allows AND/OR/NOT combinations.
            *   *Resulting `queryCriteria`:* Complex JSON object (e.g., `{"logic": "AND", "filters": [...] }`) saved in `study_sets` or generated dynamically.

2.  **Backend: Resolve Initial Card IDs (`studyQueryActions.resolveStudyQuery`):**
    *   Frontend (`useStudySession` init) calls `resolveStudyQuery` Server Action with the `queryCriteria` (or `studySetId`).
    *   Action/RPC translates criteria into a SQL query:
        *   **Always** filters by `user_id`.
        *   Applies filters for decks, tags (JOIN `card_tags`), dates, etc. based on criteria.
        *   **Does NOT filter by `next_review_due` at this stage.**
    *   **Returns:** Array of all `cardIds` matching the selection criteria.

### 5.2 Phase 2: Study Mode Execution

**Goal:** Take the initial list of card IDs, fetch their data, and then execute the study session according to the user's chosen mode.

1.  **User Mode Selection:** User chooses **Mode 1 (Learn)** or **Mode 2 (Review)** in the UI, typically alongside Card Selection.

2.  **Backend: Fetch Full Card Data (`cardActions.getCardsByIds`):**
    *   `useStudySession` calls `getCardsByIds` with the `cardIds` array from Phase 1.
    *   **Returns:** Array of fully populated `FlashCard` objects (content, current SRS state, etc.).

3.  **Frontend: Session Preparation & Loop (`useStudySession` Hook Logic):**
    *   Receives the `FlashCard[]` array.
    *   Prepares the study queue and manages the loop based on the **selected Study Mode**:

    *   **If Mode 1: Learn Mode (Comprehensive Review):**
        *   **Queue Init:** Includes **all** fetched cards.
        *   **Ordering:** Apply shuffling or smart prioritization (e.g., recently failed cards). Define strategy.
        *   **Goal:** Review each card until session success threshold `X` (from `settings.learn_mode_success_threshold`) is met *for this session*.
        *   **Progression:**
            *   Track consecutive correct answers *per card* within session state.
            *   Increment on correct, reset to 0 on incorrect.
            *   Remove card from active queue when count reaches `X`.
            *   Ensure incorrect cards are repeated.
        *   **SRS Update:** **Crucially, after every answer, calculate the *next* SRS state using `calculateSm2State` (mapping answer to grade 1-4) and schedule a debounced save via `progressActions.updateCardProgress`**.
        *   **End:** Session ends when active queue is empty.

    *   **If Mode 2: Review Mode (SRS-Prioritized):**
        *   **Filtering:** Filter the fetched `FlashCard[]` array *locally in the hook* to keep only cards where `card.next_review_due <= now()`.
        *   **Empty Queue Handling:** Notify user if no cards are due from the initial selection.
        *   **Ordering:** Sort the filtered (due) cards by `next_review_due ASC`.
        *   **Queue Init:** Includes only the *filtered and sorted due* cards.
        *   **Goal:** Review all due cards identified.
        *   **Progression:** Present cards sequentially from the sorted due queue.
        *   **SRS Update:** After every answer (grade 1-4), calculate the *next* SRS state using `calculateSm2State` and schedule a debounced save via `progressActions.updateCardProgress`.
        *   **End:** Session ends when the due queue is exhausted.

### 5.3 Key Considerations & Implementation Notes

*   **UI Clarity:** Clearly separate Card Selection and Study Mode choices. Explain mode differences.
*   **Backend Query (`resolveStudyQuery`):** Handling complex "Smart Playlist" criteria requires careful SQL/RPC implementation and indexing. Performance is key.
*   **Frontend Hook (`useStudySession`):** Needs robust state management for both modes, including session-specific tracking for Learn Mode.
*   **Tagging Integration:** Requires implementing `tagActions`, tag-related UI, and adding tag filtering logic to `resolve_study_query`.
*   **Consistency:** Ensure SRS state is always calculated and saved correctly in both modes based on user input/grades (map Learn Mode right/wrong to grades 1 & 3 for SRS calc).

---

## 6. Component Breakdown
*(List remains as described previously)*
- `StudySetBuilder`
- `StudySetSelector`
- `TagManager`
- `CardTagEditor`
- `SrsSelector`
- `StudyFlashcardView`
- `DeckList`, `DeckForm`, `CardForm`, `TableEditor`
- Standard UI elements from `shadcn/ui`.
- Layout components (`Header`, `Sidebar`, `Footer`).
- Authentication forms (`LoginForm`, `SignupForm`).

## 7. Data Models and Relationships
*(Schema defined in Section 4 - Data Models remains the source of truth)*

## 8. Security Considerations
*(Points remain as described previously)*
- Supabase Auth, JWT/Cookies (@supabase/ssr)
- RLS on all tables (`decks`, `cards`, `settings`, `tags`, `card_tags`, `study_sets`)
- Server Action validation (Session, Input via Zod)
- API route protection
- Environment variable security
- Query parameterization (via Supabase client or DB function)

## 9. Development and Deployment Workflow
*(Points remain as described previously)*
- Git workflow
- Supabase local dev + migrations (`supabase/migrations`)
- Linting/Formatting/Typing
- Testing (Unit for SRS utils, Integration for Actions/Hooks)
- Vercel deployment

## 10. Known Issues and Future Roadmap
*(Updated based on Section 5 architecture)*
*   Need to implement UI for `StudySetSelector`, `StudySetBuilder`, `TagManager`, `CardTagEditor`.
*   Need to implement backend logic for `tagActions`, `studySetActions`.
*   Need to implement complex filtering (tags, dates, languages etc.) in `resolve_study_query` DB function/RPC.
*   Need to implement the specific card ordering/shuffling strategy for Learn Mode in `useStudySession`.
*   Need to finalize UI changes for `StudyFlashcardView` (4-grade input) and `StudyPage`.
*   Need to address TTS language determination in `useStudyTTS` (fetch languages with card data?).
*   Backfilling SRS/user_id data for existing cards is required (migration script needed).
*   Performance testing of `resolve_study_query` with large datasets.
*   **Future Roadmap:**
    - Implement FSRS algorithm + optimization.
    - Sharing Decks/Study Sets.
    - Advanced Query Operators/UI.
    - System-generated Study Sets ("Hardest", "Recent Lapses").
    - Enhanced Analytics.
    - Import/Export improvements.
    - Rich text editing.
    - Mobile App / PWA.

## 11. References and Resources
*(List remains as described previously)*
- Next.js, Supabase (@supabase/ssr, RLS, Functions), React, Tailwind/shadcn/ui Docs
- SM-2 Algorithm Specification
- FSRS Algorithm Resources
- Google Cloud TTS Docs
- `date-fns` Docs

## 12. Changelog
*   **v2.1 (2024-07-27):** Refactored study session architecture into Section 5. Clarified Card Selection vs. Study Mode execution. Consolidated SRS details. Updated functional overview and workflows. Added `learn_mode_success_threshold` to settings.
*   **v2.0 (2024-07-26):** Integrated architecture for Tagging, Query-Based Study Sets, and Spaced Repetition System (SRS) with initial SM-2 support. Updated data models, hooks, server actions, and documentation throughout.
*   **v1.0 (Previous Date):** Initial project documentation covering basic deck/card management, authentication, and TTS.

## 13. Implementation Plan & Status (v2.1 Refactor)
*(Updated Status based on Section 5)*
*   **Phase 1: Data Model & Core Backend Setup:** (Largely Completed - Migration `YYYYMMDDHHMMSS_add_srs_study_sets.sql` includes schema, `calculateSm2State` done, core Actions `settings/progress/card` done, Action placeholders created, **Supabase Types Integrated**).
*   **Phase 2: Study Session Hook Refactoring:** (**Completed** - `useStudySession` refactored for store-based initialization, mode handling, data fetching, and SRS logic).
*   **Phase 3: UI Adaptation & New Features:** (**Largely Completed for Core Study Loop & Study Set Definition**)
    *   Implement `StudySetSelector` (Card Selection + Mode Selection UI). **(Largely Completed - Added Study Set Selection)**
    *   Implement `StudySetBuilder` (Smart Playlist UI): **(Completed)**
        *   Structure Implemented with Hooks. **(Completed)**
        *   Implement Full `onSubmit` Criteria Mapping. **(Completed)**
        *   Implement Multi-Select Combobox UI for Tag selection. **(Completed)**
        *   Implement Date Picker UI (onDate, betweenDates) for Date filters. **(Completed)**
        *   Implement SRS Level filter UI. **(Completed)**
        *   Implement other required filter UIs (updatedDate, lastReviewed, etc.). **(Completed)**
        *   Update `studySetBuilderSchema` to include fields for all implemented filters. **(Completed)**
    *   Implement `TagManager`, `CardTagEditor`. **(Completed)**
    *   Implement `useTags`, `useCardTags`, `useDecks`, `useStudySets` hooks. **(Completed)**
    *   Update `StudyFlashcardView` for 4-grade input. (**Pending**)
    *   Implement `app/study/session/page.tsx` Study Page: **(Completed - Core Functionality)**
        *   Use Settings Context. **(Completed)**
        *   Implement Flip State Management & `isTransitioning`. **(Completed)**
        *   Integrate `useStudySession` and `StudyFlashcardView`. **(Completed)**
        *   Handle Loading/Error/Completion States. **(Completed)**
    *   Implement `app/study/sets/new/page.tsx` (Create Study Set Page). **(Completed)**
    *   Implement `app/study/sets/page.tsx` (List/Manage Study Sets Page). **(Completed)**
    *   Implement `app/study/sets/[setId]/edit/page.tsx` (Edit Study Set Page). **(Completed)**
*   **Phase 4: Backend Implementation:** (**Largely Completed, StudySet Actions Implemented**)
    *   Implement complex filtering (tags, dates, etc.) in `resolve_study_query` DB function/RPC. **(Completed)** 
    *   Implement Server Action `studyQueryActions.resolveStudyQuery` to call the DB function and handle criteria/studySetId input. **(Completed)**
    *   Implement `tagActions`. **(Completed)**
    *   Implement `studySetActions`. (**Completed**)

```