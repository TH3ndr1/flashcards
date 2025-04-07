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
  question: string; // text - Reverted from front_content
  answer: string; // text - Reverted from back_content
  created_at: string; // timestamptz
  updated_at: string; // timestamptz
  
  // SRS Fields 
  last_reviewed_at: string | null; // timestamptz
  next_review_due: string | null; // timestamptz
  srs_level: number; // integer
  easiness_factor: number | null; // float
  interval_days: number | null; // integer
  stability: number | null; // float
  difficulty: number | null; // float
  last_review_grade: number | null; // integer

  // Stats 
  correct_count: number; 
  incorrect_count: number; 
  attempt_count?: number; 
  
  // Card-specific language (Remove if not in DB schema)
  // questionLanguage?: string | null;
  // answerLanguage?: string | null;

  // Nested deck language info 
  decks?: { 
    primary_language: string | null;
    secondary_language: string | null;
  } | null; 
}

// --- Existing 'decks' Table (Ensure it includes user_id) ---
export interface DbDeck {
    id: string; // uuid
    user_id: string; // uuid (Ensure this exists)
    name: string; // text in DB, use 'name' if DB uses 'name'
    description: string | null; // text
    primary_language?: string | null; // text
    secondary_language?: string | null; // text
    is_bilingual?: boolean | null;
    created_at: string; // timestamptz
    updated_at: string; // timestamptz
    // Add optional card count field from aggregation
    card_count?: number;
}

// --- Supabase Database Type (Optional but Recommended) ---
// If you generate types using `supabase gen types typescript`:
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]
export type Database = {
  public: {
    Tables: {
      settings: { Row: DbSettings; Insert: Partial<DbSettings>; Update: Partial<DbSettings> }; // Added Insert/Update for example
      tags: { Row: DbTag; Insert: Pick<DbTag, 'user_id' | 'name'>; Update: Partial<Pick<DbTag, 'name'>> }; // Added Insert/Update
      card_tags: { Row: DbCardTag; Insert: DbCardTag; Update: never }; // Join table, often no direct update
      study_sets: { Row: DbStudySet; Insert: Pick<DbStudySet, 'user_id' | 'name' | 'description' | 'query_criteria'>; Update: Partial<Pick<DbStudySet, 'name' | 'description' | 'query_criteria'>> }; // Added Insert/Update
      cards: { Row: DbCard; Insert: Partial<DbCard>; Update: Partial<DbCard> }; // Added Insert/Update
      decks: { Row: DbDeck; Insert: Pick<DbDeck, 'user_id' | 'name' | 'description' | 'primary_language' | 'secondary_language' | 'is_bilingual'>; Update: Partial<Pick<DbDeck, 'name' | 'description' | 'primary_language' | 'secondary_language' | 'is_bilingual'>> }; // Added Insert/Update
      // Add other tables here with Row, Insert, Update definitions
    };
    Views: { // Add views if you have them
        [_ in never]: never
    };
    Functions: { // Add functions if you have them
        resolve_study_query: { // Example function
             Args: {
                 p_user_id: string; 
                 p_query_criteria: Json; 
                 p_order_by_field?: string; 
                 p_order_by_direction?: string; 
             };
             Returns: { card_id: string }[]; 
         }
         // Add other functions here
    };
    Enums: { // Add enums if you have them
        [_ in never]: never
    };
    CompositeTypes: { // Add composite types if you have them
        [_ in never]: never
    };
  };
}; 

// Helper type to extract Row type from Tables
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
// Add Insert and Update helpers if needed
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T]; 