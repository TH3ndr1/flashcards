# Project Documentation

## 1. Executive Summary

### Purpose and Objectives
The Flashcards App is a modern, multilingual learning platform designed to help users create and study flashcards efficiently. The project aims to enhance the learning experience through interactive features and audio support.

### Target Users and Main Use Cases
- Language learners seeking to improve vocabulary
- Students studying any subject matter
- Teachers creating study materials
- Self-learners requiring an organized study system

### Business Value and Expected Outcomes
- Improved learning efficiency through spaced repetition
- Enhanced retention through multi-modal learning (text + audio)
- Increased user engagement through progress tracking
- Flexible learning environment supporting multiple languages

## 2. Business Context

### Problem Statement
Traditional flashcard methods lack the flexibility and features needed for modern learning:
- Limited accessibility across devices
- No audio support for language learning
- Difficulty in tracking progress
- No built-in bilingual support

### Key Stakeholders
- End Users (students, language learners)
- Content Creators (teachers, education professionals)
- Platform Administrators
- Development Team

### User Personas
1. Language Learner
   - Primary need: Vocabulary acquisition with pronunciation
   - Key features: Text-to-speech, bilingual cards

2. Student
   - Primary need: Subject matter revision
   - Key features: Progress tracking, deck organization

3. Teacher
   - Primary need: Content creation and sharing
   - Key features: Deck management, multi-language support

### Business Workflows
1. User Registration and Authentication
2. Deck Creation and Management
3. Study Session Execution
4. Progress Tracking and Analytics
5. Content Sharing and Collaboration

## 3. Functional Overview

### Main Features and Modules
1. Authentication System
   - Sign up/Login
   - Profile management
   - OAuth integration

2. Deck Management
   - Create/Edit/Delete decks
   - Import/Export functionality
   - Categorization and tagging

3. Study System
   - Interactive study sessions
   - Spaced repetition
   - Progress tracking

4. Audio Support
   - Text-to-speech integration
   - Multiple language support
   - Voice customization

### Key User Interactions
1. Card Creation Flow
   - Enter card content
   - Select languages
   - Generate audio

2. Study Session Flow
   - Select deck
   - Review cards
   - Mark progress
   - Listen to pronunciations

## 4. Technical Architecture

### Technology Stack
- Frontend: Next.js 15.1.0 (or latest stable) with React 19 (or latest stable) - Using App Router
- Backend: Serverless via Next.js API routes and Server Actions (Server Actions preferred for mutations)
- Database: Supabase (PostgreSQL)
- Authentication: Supabase Auth integrated via `@supabase/ssr` library (client and server)
- Storage: Supabase Storage (Assumed, verify usage if necessary)
- Text-to-Speech: Google Cloud TTS API (via `/api/tts` route)
- UI Framework: Tailwind CSS with shadcn/ui (using Radix UI primitives)
- Form Management: React Hook Form (likely used in forms like login/signup/deck creation)
- Validation: Zod (likely used with React Hook Form and/or Server Actions)
- State Management: React Context (`AuthProvider`, `SettingsProvider`), Custom Hooks (`useAuth`, `useDecks`, `useStudySession`, etc.)
- Utility Libraries: `sonner` (toasts), `lucide-react` (icons)

### Frontend Architecture
- Next.js App Router structure (`app/` directory).
- Mix of Server Components (for data fetching, static content) and Client Components (`"use client"` directive for interactivity, state, lifecycle effects).
- Styling via Tailwind CSS utility classes, potentially organized using `@apply` or component-specific CSS modules if needed.
- Reusable UI components built using shadcn/ui (`components/ui/`).
- Application-specific components (`components/`) composed from UI primitives.
- State Management Strategy:
    - Global State (Auth, Settings): Managed via React Context (`AuthProvider`, `SettingsProvider`) and corresponding hooks (`useAuth`, `useSettings`). These providers often depend on `useSupabase`.
    - Domain-Specific State (Decks, Study Session): Managed by custom hooks (`useDecks`, `useStudySession`). These hooks encapsulate data fetching, mutations (often delegating to services/actions), state logic, and expose a clean API to components.
    - Local Component State: Managed using `useState` and `useReducer` within individual components for UI-specific state (e.g., form inputs, modal visibility).
- Custom Hooks (`hooks/`) are central to encapsulating logic and interacting with contexts or backend services. Key hooks include `useSupabase`, `useAuth`, `useSettings`, `useDecks`, `useDeckLoader`, `useStudySession`, `useStudyTTS`, `useTTS`.

### Backend Architecture
- Primarily serverless logic integrated within the Next.js application.
- **API Routes (`app/api/*`)**: Used for specific backend tasks that don't fit the Server Action model well, or require direct HTTP endpoint access (e.g., `/api/tts` for generating audio). These routes use `createSupabaseServerClient` for authentication and backend interactions.
- **Server Actions**: Increasingly the preferred method for handling data mutations (CRUD operations) initiated from Client Components, especially forms. They run server-side, have direct access to the database (via server Supabase client or services), and simplify data flow compared to traditional API routes + client-side fetching for mutations. Assumed to be used for deck/card updates triggered by hooks like `useDecks`.
- **Service Layer (`lib/*Service.ts`)**: Functions like `deckService.ts` and `settingsService.ts` encapsulate direct database interactions with Supabase. They are called by Server Actions or API Routes (and sometimes Hooks directly, though less ideal for mutations). They standardize the `{ data, error }` return pattern and handle data transformation.
- **Database Interaction**: Supabase client (`@supabase/ssr` for both server and client) is used for all database operations (PostgreSQL), authentication checks, and potentially storage. Row Level Security (RLS) is crucial for data protection.
- **External Services**: Google Cloud TTS accessed via its Node.js client library within the `/api/tts` route. Credentials managed via environment variables (`.env.local`, Vercel environment variables).
- **Middleware (`middleware.ts`)**: Uses `@supabase/ssr` server client to refresh session tokens stored in cookies, ensuring session consistency for both server-rendered pages and subsequent client-side requests.

### Data Models
1. Users (Managed by Supabase Auth, profile data potentially in a `profiles` table)
   - Authentication details
   - Preferences (likely stored in a `settings` or `profiles` table)
   - Study statistics (aggregated or derived from `study_progress`)

2. Decks (`decks` table)
   - Metadata (title, description, languages)
   - Owner information (`user_id`)
   - Timestamps

3. Cards (`cards` table)
   - Front/Back content
   - Deck relationship (`deck_id`)
   - Audio references (potentially URLs in Supabase Storage)
   - Timestamps
   - Statistics (`correct_count`, `incorrect_count`, `attempt_count`, `last_studied`, `difficulty_score`)

4. Progress (`study_progress` table - *Verify existence/structure - Note: Current implementation seems to store progress directly on `cards` table*)
   - Links user and card (`user_id`, `card_id`)
   - Spaced repetition data (`last_reviewed_at`, `next_review_due`, `difficulty_score`/`correct_streak`, etc.)

4. **Card Progress** (Stored directly on `cards` table):
   - `correct_count`: `integer` (Number of times answered correctly)
   - `incorrect_count`: `integer` (Number of times answered incorrectly)
   - `attempt_count`: `integer` (Total number of times answered)
   - `last_studied`: `timestamp with time zone` (Timestamp of the last review)
   - `difficulty_score`: `float` (Calculated score indicating card difficulty, 0-1)

## 4.1 Code Structure and Organization

### Codebase Overview (Updated Diagram)
```mermaid
graph TD
    subgraph User Interaction
        U[User Browser]
    end

    subgraph Next.js Application (Vercel)
        direction LR
        subgraph Frontend Layer (Client Components/Pages)
            P[Pages (app/**/page.tsx)]
            CC[Client Components (components/)]
            H[Hooks (hooks/)]
            CTX[Context Providers (providers/)]
        end

        subgraph Backend Layer (Server-side Logic)
            MW[Middleware (middleware.ts)]
            SA[Server Actions (*.actions.ts)]
            API[API Routes (app/api/*)]
            SVC[Service Layer (lib/*Service.ts)]
            UTIL[Utilities (lib/utils.ts, lib/fonts.ts, lib/study-utils.ts)]
        end
    end

    subgraph External Services
        SB_Auth[(Supabase Auth)]
        SB_DB[(Supabase DB)]
        SB_Store[(Supabase Storage)] -- Optional --> SVC
        G_TTS[(Google Cloud TTS)]
    end

    U -- HTTP Request --> MW;
    U -- Renders --> P;
    P -- Uses --> CC;
    P -- Uses --> H;
    CC -- Uses --> H;
    H -- Uses --> CTX;
    H -- Calls --> SA;
    H -- Calls --> SVC;  // Primarily for reads; writes prefer Actions
    H -- Calls --> API; // e.g., useTTS -> /api/tts
    CTX -- Uses --> H; // e.g., AuthProvider uses useSupabase
    CTX -- Calls --> SVC; // e.g., SettingsProvider calls settingsService

    MW -- Verifies Session --> SB_Auth;
    MW -- Updates Cookie --> U;

    SA -- Uses --> SVC;
    SA -- Interacts --> SB_Auth;
    API -- Uses --> SVC;
    API -- Interacts --> SB_Auth;
    API -- Calls --> G_TTS;
    SVC -- Interacts --> SB_DB;

    classDef user fill:#cce5ff,stroke:#004085;
    classDef frontend fill:#e2f0d9,stroke:#385723;
    classDef backend fill:#fce5cd,stroke:#854000;
    classDef external fill:#f8d7da,stroke:#721c24;
    classDef data fill:#d1ecf1,stroke:#0c5460;
    classDef util fill:#e9ecef,stroke:#343a40;

    class U user;
    class P,CC,H,CTX frontend;
    class MW,SA,API,SVC backend;
    class SB_Auth,SB_DB,SB_Store,G_TTS external;
    class UTIL util;
```
*Diagram refined to show layers, dependencies, and external services more clearly.*

### Key Components and Their Functions (Updated & Added Details)

#### 1. Frontend Components (`/app/*`, `/components/*`)
*(Existing descriptions accurate, focusing on updates)*

*   **Application Components (`/components/`)**:
    *   `study-flashcard-view.tsx`: Displays the flippable card, answer buttons, progress indicators. Receives state and callbacks from the parent page (likely driven by `useStudySession`). Applies dynamic font from settings.
    *   `table-editor.tsx` & `card-editor.tsx`: Used within `app/edit/[deckId]/page.tsx` for editing card details. Utilize debouncing for updates to improve performance.

#### 2. Custom Hooks (`/hooks/*`) (Updated & Added Details)

1.  **`useSupabase`**: Provides the memoized Supabase browser client instance (`createBrowserClient` from `@supabase/ssr`). Initializes client only after mount. Essential dependency for other hooks needing client-side Supabase access.
2.  **`useAuth`**: (Inside `AuthProvider`) Manages `user`, `session`, `loading` state via `useSupabase` and `onAuthStateChange`. Provides `signIn`, `signUp`, `signOut`, `resetPassword`.
3.  **`useSettings`**: (Inside `SettingsProvider`) Manages `settings` state and `loading`. Depends on `useAuth` (for `user`) and `useSupabase`. Fetches/updates settings via `settingsService.ts`.
4.  **`useDecks`**: Manages deck list state (`decks`, `loading`). Depends on `useAuth` and `useSupabase`. Loads initial state from localStorage, then fetches/updates via `deckService.ts`. Provides CRUD actions (`getDecks`, `createDeck`, `getDeck`, `updateDeck`, `deleteDeck`, `updateCardResult`).
5.  **`useDeckLoader`**: Specifically loads a *single* deck by ID using `getDeck` from `useDecks`. Handles its own loading/error state and implements retry logic for cases where the deck might not be immediately available (e.g., after creation). Crucial dependency for `useStudySession`.
6.  **`useStudySession`**: Orchestrates the study session.
    *   Depends on `useDeckLoader` (to get the deck), `useSettings` (for configuration), `useDecks` (for `updateDeck` persistence), and `useStudyTTS`.
    *   Manages the core study loop: current card, card queue (`studyCards`), progress tracking, flip state, transitions.
    *   Uses utility functions from `lib/study-utils.ts` for logic (preparing cards, updating stats, determining next card).
    *   Handles user interactions (`flipCard`, `answerCardCorrect`/`Incorrect`, `practiceDifficultCards`, `resetDeckProgress`).
    *   Persists card progress via debounced calls to `updateDeck`.
7.  **`useTTS`**: Lower-level hook managing interaction with the `/api/tts` endpoint. Provides `speak` function (fetches audio blob, plays it using `HTMLAudioElement`, handles loading state) and `setLanguage` (configures language for subsequent `speak` calls). Uses `useSettings` to check if TTS is enabled and get dialect preferences.
8.  **`useStudyTTS`**: Bridge between `useStudySession` and `useTTS`. Listens to changes in `useStudySession` state (`currentStudyCard`, `isFlipped`, `isLoading`, `isTransitioning`, `deck`, `settings.ttsEnabled`). Determines the correct text and language based on the flipped state and deck settings, then calls `useTTS.speak()` with appropriate delay.
9.  **`useMobile`**: Utility hook to detect mobile viewport size.

*Note:* `lib/study-utils.ts` contains crucial pure helper functions for study logic (card preparation, difficulty calculation, state updates), promoting separation of concerns from the main `useStudySession` hook.

#### 3. API Routes (`/app/api/*`) & Server Actions

1.  **Text-to-Speech API (`/app/api/tts/route.ts`)**:
    *   Handles POST requests with `{ text, language }`.
    *   Authenticates using `createSupabaseServerClient`.
    *   Calls Google Cloud TTS service via `@google-cloud/text-to-speech`.
    *   Returns `audio/mpeg` blob.
2.  **Auth Callback (`/app/auth/callback/route.ts`)**: Handles Supabase email confirmation code exchange using server client.
3.  **Data Mutations (Likely Server Actions)**: Functions for creating, updating, deleting decks and cards are likely implemented as Server Actions, called directly from hooks (`useDecks`) or potentially form components. These actions encapsulate calls to the service layer (`deckService.ts`) and interact with Supabase on the server.

#### 4. Service Layer (`/lib/*Service.ts`)

*   **`deckService.ts`**: Provides functions (`createDeckService`, `fetchDecks`, `getDeckService`, `updateDeckService`, `deleteDeckService`, `updateCardResultService`) for interacting with the `decks` and `cards` tables in Supabase. Handles data mapping (snake_case to camelCase) and returns `{ data, error }`. `updateCardResultService` now also updates the `difficulty_score`.
*   **`settingsService.ts`**: Functions (`fetchSettings`, `updateSettings`) to fetch/upsert user settings in the `settings` table. Handles data mapping and default value merging.

#### 5. Database Models (`/supabase/migrations/*`)
*(Schema definition as previously documented, reflecting progress stored on `cards`)*

### State Management and Data Flow (Updated Diagrams)

1.  **Authentication Flow (`@supabase/ssr`)** *(Diagram mostly accurate, adding client init step)*
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

2.  **Study Session Flow (Detailed)**
   ```mermaid
   sequenceDiagram
       participant User
       participant StudyPage as UI Page (Client Comp)
       participant useStudySession as Hook
       participant useDeckLoader as Hook
       participant useDecks as Hook
       participant DeckService as lib/deckService.ts
       participant useStudyTTS as Hook
       participant useTTS as Hook
       participant StudyUtils as lib/study-utils.ts
       participant TTS_API as /api/tts Route Handler
       participant SupabaseDB as Supabase DB

       User->>StudyPage: Navigates to /study/[deckId]
       StudyPage->>useStudySession: Initialize with deckId & settings
       useStudySession->>useDeckLoader: Initialize with deckId
       useDeckLoader->>useDecks: getDeck(deckId)
       Note over useDecks, DeckService, SupabaseDB: useDecks calls DeckService.getDeckService
which queries SupabaseDB
       SupabaseDB-->>DeckService: Raw Deck Data/Error
       DeckService-->>useDecks: { data: Deck | null, error }
       useDecks-->>useDeckLoader: { data: Deck | null, error }
       opt Deck Load Retry
         useDeckLoader->useDeckLoader: If data is null, retry after delay
         useDeckLoader->>useDecks: getDeck(deckId) again...
       end
       useDeckLoader-->>useStudySession: loadedDeck / isLoading / error
       
       opt Deck Loaded Successfully
           useStudySession->>StudyUtils: prepareStudyCards(deck.cards, settings)
           StudyUtils-->>useStudySession: Initial studyCards list & state
           useStudySession->>useStudyTTS: Initialize/Update state (deck available)
           useStudySession-->>StudyPage: Update state (currentCard, isLoading=false)
           StudyPage-->>User: Displays first card UI

           opt TTS Triggered (New Card)
               useStudyTTS->>useTTS: setLanguage(deck.questionLanguage)
               useStudyTTS->>useTTS: speak(card.question) after delay
               useTTS->>TTS_API: POST /api/tts { text, language }
               TTS_API-->>useTTS: Audio Blob
               useTTS->>Browser: Plays Audio
           end
       end

       opt User Answers Card
           User->>StudyPage: Clicks Correct/Incorrect
           StudyPage->>useStudySession: answerCard(isCorrect)
           useStudySession->>StudyUtils: updateCardStats(currentCard, isCorrect)
           StudyUtils-->>useStudySession: Updated Card Stats (incl. difficulty)
           useStudySession->>StudyUtils: determineNextCardState(studyCards, updatedCard, settings)
           StudyUtils-->>useStudySession: { nextStudyCards, nextIndex, cardJustMastered }
           useStudySession->>useStudySession: Update local deck state with updated card stats
           useStudySession->>useStudySession: Schedule debounced save: updateDeck(updatedLocalDeck)
           useStudySession->>useStudySession: Update state (currentCardIndex=nextIndex, studyCards=nextStudyCards)
           useStudySession->>useStudyTTS: Update state (triggers potential speak)
           useStudySession-->>StudyPage: Update UI (next card, progress)
           StudyPage-->>User: Displays next card

           opt Debounced Save Fires
              useStudySession->>useDecks: updateDeck(updatedLocalDeck)
              Note over useDecks, DeckService, SupabaseDB: useDecks calls DeckService.updateDeckService
which updates SupabaseDB
              SupabaseDB-->>DeckService: Success/Error
              DeckService-->>useDecks: { error }
              useDecks-->>useStudySession: Result (toast on error)
           end
       end

       opt User Flips Card
            User->>StudyPage: Clicks Flip
            StudyPage->>useStudySession: flipCard()
            useStudySession->>useStudySession: Update isFlipped state
            useStudySession->>useStudyTTS: Update state (isFlipped changed)

            opt TTS Triggered (Flip)
                 useStudyTTS->>useTTS: setLanguage(deck.answerLanguage)
                 useStudyTTS->>useTTS: speak(card.answer) after delay
                 useTTS->>TTS_API: POST /api/tts { text, language }
                 TTS_API-->>useTTS: Audio Blob
                 useTTS->>Browser: Plays Audio
            end
            useStudySession-->>StudyPage: Update UI (shows flipped card)
            StudyPage-->>User: Sees flipped card
       end
   ```

## 5. Component Breakdown
*(Keep existing component list, descriptions should be accurate)*

## 6. Data Models and Relationships
*(Keep existing schema, updated progress note is correct)*

## 7. Security Considerations
*(Keep existing points, add emphasis on RLS)*
- Supabase Auth for user management
- JWT-based session handling via `@supabase/ssr` cookies
- Secure password policies (enforced by Supabase)
- **Authorization**: Primarily enforced via **Row Level Security (RLS)** policies in Supabase for all data tables (`decks`, `cards`, `settings`). Backend services (`lib/*Service.ts`) operate under user context where possible, relying on RLS. API routes and Server Actions must validate user sessions.
- Role-based access control (If applicable beyond user ownership)
- API route protection (Checking session in `/api/tts`)
- Server Action protection (Next.js handles session access within actions)
- Data Protection: Environment variable management (e.g., `.env.local`, Vercel env vars for Supabase keys, GCP keys). Secure audio file storage (if TTS results were stored instead of streamed). HTTPS-only access (handled by Vercel).

## 8. Development and Deployment Workflow
*(Keep existing workflow)*

## 9. Known Issues and Future Roadmap
*(Keep existing points)*

## 10. References and Resources
*(Keep existing points)*

### 4.4 Authentication Flow *(Updated based on diagram)*

The application utilizes Supabase Auth integrated with Next.js using the `@supabase/ssr` package. This ensures seamless authentication handling across Server Components, Client Components, API/Route Handlers, and Server Actions.

Key aspects include:

- **Middleware (`middleware.ts`):** Handles session cookie management and refresh for incoming requests using the Supabase *server* client, making the user session available server-side contexts via cookies/headers.
- **Client Client (`hooks/use-supabase.tsx`):** Provides a memoized Supabase *browser* client instance (`createBrowserClient`) initialized after mount in client components. Ensures consistency with the server-managed session via cookie reading.
- **Auth Provider (`hooks/use-auth.tsx`):** A context provider (`AuthProvider`) and hook (`useAuth`) that leverages `useSupabase` for the browser client. Manages authentication state (`user`, `session`, `loading`) primarily through `onAuthStateChange`. Provides functions (`signIn`, `signUp`, `signOut`, `resetPassword`) that call Supabase browser client methods.
- **Server Client (`lib/supabase/server.ts`):** Provides a utility to create Supabase *server* clients within server contexts (Route Handlers, Server Components, Server Actions) that interact correctly with cookies managed by the middleware. Used for auth checks in API routes and potentially data fetching/mutations in Server Actions/Components.
- **Email Confirmation (`app/auth/callback/route.ts`):** A server-side Route Handler processes the email confirmation link. Uses the server client to securely exchange the confirmation code for a session and redirects the user.
- **Login/Signup Pages:** Client components (`app/login/page.tsx`, `app/signup/page.tsx`) use the `useAuth` hook (and thus the browser client) for sign-in/sign-up operations.

## 11. Changelog
*(Keep existing changelog)*

---
*(End of proposed edits for project-documentation.md)* 