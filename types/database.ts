/**
 * Represents the structure of the 'settings' table.
 */
export interface Settings {
  user_id: string; // UUID -> string
  srs_algorithm: 'sm2' | 'fsrs'; // Assuming these are the only valid values initially
  fsrs_parameters: Record<string, any> | null; // JSONB -> object or null
  created_at: string; // timestamptz -> string (ISO 8601)
  updated_at: string; // timestamptz -> string
  // Add other settings fields matching the DB schema
}

/**
 * Represents the structure of the 'tags' table.
 */
export interface Tag {
  id: string; // UUID -> string
  user_id: string; // UUID -> string
  name: string;
  created_at: string; // timestamptz -> string
}

/**
 * Represents the structure of the 'card_tags' join table.
 */
export interface CardTag {
  card_id: string; // UUID -> string
  tag_id: string; // UUID -> string
  user_id: string; // UUID -> string
}

/**
 * Represents the structure of the 'study_sets' table.
 */
export interface StudySet {
  id: string; // UUID -> string
  user_id: string; // UUID -> string
  name: string;
  description: string | null;
  query_criteria: StudySetQueryCriteria; // JSONB -> specific object type
  created_at: string; // timestamptz -> string
  updated_at: string; // timestamptz -> string
}

/**
 * Defines the expected structure for the 'query_criteria' JSONB field
 * in the 'study_sets' table. Adapt this based on your actual query needs.
 */
export interface StudySetQueryCriteria {
  includeTags?: string[]; // Array of tag IDs to include
  excludeTags?: string[]; // Array of tag IDs to exclude
  includeDecks?: string[]; // Array of deck IDs to include
  excludeDecks?: string[]; // Array of deck IDs to exclude
  isDue?: boolean; // Include cards where next_review_due <= now()
  isNew?: boolean; // Include cards never reviewed (srs_level = 0 or last_reviewed_at IS NULL)
  difficultyRange?: [number, number]; // Min/Max FSRS difficulty (e.g., [0.7, 1.0])
  srsLevelRange?: [number, number]; // Min/Max SRS level
  limit?: number; // Max number of cards to return
  // Add other potential filter fields: e.g., content search term?
}

/**
 * Represents the structure of the 'cards' table, including SRS fields.
 * Updates the existing FlashCard type or creates a new one.
 * Make sure field names match your actual table columns.
 */
export interface FlashCard {
  id: string; // UUID -> string
  deck_id: string; // UUID -> string
  user_id: string; // UUID -> string (Newly added)
  front_content: string; // Example field name
  back_content: string; // Example field name
  created_at: string; // timestamptz -> string
  updated_at: string; // timestamptz -> string

  // SRS Fields (Newly added)
  last_reviewed_at: string | null; // timestamptz -> string | null
  next_review_due: string | null; // timestamptz -> string | null
  srs_level: number; // integer -> number
  easiness_factor: number | null; // real -> number | null
  interval_days: number | null; // integer -> number | null
  stability: number | null; // real -> number | null (for FSRS)
  difficulty: number | null; // real -> number | null (for FSRS)
  last_review_grade: 1 | 2 | 3 | 4 | null; // integer -> specific number union | null

  // Optional General Stats (Consider if still needed)
  correct_count?: number; // integer -> number
  incorrect_count?: number; // integer -> number
}

/**
 * Represents the structure of the 'decks' table.
 * Ensure this matches your schema and includes FKs/relationships as needed.
 */
export interface Deck {
    id: string;
    user_id: string;
    title: string; // Assuming 'title' based on docs
    description: string | null;
    primary_language: string | null;
    secondary_language: string | null;
    created_at: string;
    updated_at: string;
    cards: FlashCard[]; // Embed cards or fetch separately
    // Add any other deck-specific fields
}

// Based on your Supabase schema (snake_case)

// --- From Supabase Auth ---
// Assuming you have User type from @supabase/supabase-js elsewhere

// --- New Tables ---

export interface DbSettings {
  user_id: string; // uuid
  srs_algorithm: 'sm2' | 'fsrs'; // Assuming limited text options
  fsrs_parameters: Record<string, any> | null; // jsonb
  created_at: string; // timestamptz
  updated_at: string; // timestamptz
  // Add other setting fields if defined in SQL (e.g., tts_enabled, card_font)
  tts_enabled?: boolean; // Example
  card_font?: string;    // Example
}

export interface DbTag {
  id: string; // uuid
  user_id: string; // uuid
  name: string;
  created_at: string; // timestamptz
}

export interface DbCardTag {
  card_id: string; // uuid
  tag_id: string; // uuid
  user_id: string; // uuid
}

export interface DbStudySet {
  id: string; // uuid
  user_id: string; // uuid
  name: string;
  description: string | null;
  query_criteria: Record<string, any>; // jsonb - Define specific structure later if needed
  created_at: string; // timestamptz
  updated_at: string; // timestamptz
}

// --- Updated 'cards' Table ---

export interface DbCard {
  id: string; // uuid
  deck_id: string; // uuid
  user_id: string; // uuid 
  front_content: string; // text - This should match the DB
  back_content: string; // text - This should match the DB
  created_at: string; // timestamptz
  updated_at: string; // timestamptz
  
  // SRS Fields (match DB column names exactly)
  last_reviewed_at: string | null; // timestamptz
  next_review_due: string | null; // timestamptz
  srs_level: number; // integer
  easiness_factor: number | null; // float
  interval_days: number | null; // integer
  stability: number | null; // float
  difficulty: number | null; // float
  last_review_grade: number | null; // integer

  // Stats (match DB column names exactly)
  correct_count: number; 
  incorrect_count: number; 
  attempt_count?: number; 
  
  // Card-specific language (if exists)
  questionLanguage?: string | null;
  answerLanguage?: string | null;

  // For potential joins (optional typing)
  decks?: { name?: string | null, primary_language?: string | null, secondary_language?: string | null }; 
}

// --- Existing 'decks' Table (Ensure it includes user_id) ---
export interface DbDeck {
    id: string; // uuid
    user_id: string; // uuid (Ensure this exists)
    name: string; // text in DB, was 'title' in docs? Use 'name' if DB uses 'name'
    description: string | null; // text
    // Use specific language fields if they exist
    primary_language?: string | null; // text
    secondary_language?: string | null; // text
    // Legacy fields (if any)
    language?: string | null; // text
    is_bilingual?: boolean | null;
    // progress?: Record<string, any> | null; // jsonb (If used)
    created_at: string; // timestamptz
    updated_at: string; // timestamptz
}

// --- Supabase Database Type (Optional but Recommended) ---
// If you generate types using `supabase gen types typescript`:
// export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]
// export type Database = {
//   public: {
//     Tables: {
//       settings: { Row: DbSettings; Insert: /*...*/; Update: /*...*/ };
//       tags: { Row: DbTag; Insert: /*...*/; Update: /*...*/ };
//       card_tags: { Row: DbCardTag; Insert: /*...*/; Update: /*...*/ };
//       study_sets: { Row: DbStudySet; Insert: /*...*/; Update: /*...*/ };
//       cards: { Row: DbCard; Insert: /*...*/; Update: /*...*/ };
//       decks: { Row: DbDeck; Insert: /*...*/; Update: /*...*/ };
//       // ... other tables
//     };
//     Views: { /* ... */ };
//     Functions: { /* ... */ };
//   };
// }; 