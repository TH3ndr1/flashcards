export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      cards: {
        Row: {
          answer: string
          answer_gender: string | null
          answer_part_of_speech: string | null
          attempt_count: number | null
          correct_count: number | null
          created_at: string | null
          deck_id: string
          difficulty: number | null
          difficulty_score: number | null
          easiness_factor: number | null
          failed_attempts_in_learn: number
          hard_attempts_in_learn: number
          id: string
          incorrect_count: number | null
          interval_days: number | null
          last_review_grade: number | null
          last_reviewed_at: string | null
          last_studied: string | null
          learning_state: string | null
          learning_step_index: number | null
          next_review_due: string | null
          question: string
          question_gender: string | null
          question_part_of_speech: string | null
          srs_level: number
          stability: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          answer: string
          answer_gender?: string | null
          answer_part_of_speech?: string | null
          attempt_count?: number | null
          correct_count?: number | null
          created_at?: string | null
          deck_id: string
          difficulty?: number | null
          difficulty_score?: number | null
          easiness_factor?: number | null
          failed_attempts_in_learn?: number
          hard_attempts_in_learn?: number
          id?: string
          incorrect_count?: number | null
          interval_days?: number | null
          last_review_grade?: number | null
          last_reviewed_at?: string | null
          last_studied?: string | null
          learning_state?: string | null
          learning_step_index?: number | null
          next_review_due?: string | null
          question: string
          question_gender?: string | null
          question_part_of_speech?: string | null
          srs_level?: number
          stability?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          answer?: string
          answer_gender?: string | null
          answer_part_of_speech?: string | null
          attempt_count?: number | null
          correct_count?: number | null
          created_at?: string | null
          deck_id?: string
          difficulty?: number | null
          difficulty_score?: number | null
          easiness_factor?: number | null
          failed_attempts_in_learn?: number
          hard_attempts_in_learn?: number
          id?: string
          incorrect_count?: number | null
          interval_days?: number | null
          last_review_grade?: number | null
          last_reviewed_at?: string | null
          last_studied?: string | null
          learning_state?: string | null
          learning_step_index?: number | null
          next_review_due?: string | null
          question?: string
          question_gender?: string | null
          question_part_of_speech?: string | null
          srs_level?: number
          stability?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_deck"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "decks"
            referencedColumns: ["id"]
          },
        ]
      }
      deck_tags: {
        Row: {
          created_at: string
          deck_id: string
          tag_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deck_id: string
          tag_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          deck_id?: string
          tag_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deck_tags_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "decks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deck_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      decks: {
        Row: {
          created_at: string | null
          id: string
          is_bilingual: boolean
          name: string
          primary_language: string
          progress: Json
          secondary_language: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_bilingual?: boolean
          name: string
          primary_language?: string
          progress?: Json
          secondary_language?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_bilingual?: boolean
          name?: string
          primary_language?: string
          progress?: Json
          secondary_language?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          app_language: string
          card_font: string | null
          color_only_non_native: boolean | null
          created_at: string | null
          custom_learn_requeue_gap: number
          deck_list_grouping_preference: string
          default_easiness_factor: number
          easy_interval_days: number
          enable_advanced_color_coding: boolean | null
          enable_basic_color_coding: boolean | null
          enable_dedicated_learn_mode: boolean
          enable_study_timer: boolean
          enable_word_color_coding: boolean | null
          graduating_interval_days: number
          id: string
          initial_learning_steps_minutes: number[]
          language_dialects: Json | null
          lapsed_ef_penalty: number
          learn_again_penalty: number
          learn_hard_penalty: number
          mastery_threshold: number | null
          mature_interval_threshold: number
          min_easiness_factor: number
          preferred_voices: Json
          relearning_steps_minutes: number[]
          show_deck_progress: boolean
          show_difficulty: boolean | null
          study_timer_duration_minutes: number
          theme_light_dark_mode: string
          tts_enabled: boolean | null
          ui_language: string
          updated_at: string | null
          user_id: string
          word_palette_config: Json | null
        }
        Insert: {
          app_language?: string
          card_font?: string | null
          color_only_non_native?: boolean | null
          created_at?: string | null
          custom_learn_requeue_gap?: number
          deck_list_grouping_preference?: string
          default_easiness_factor?: number
          easy_interval_days?: number
          enable_advanced_color_coding?: boolean | null
          enable_basic_color_coding?: boolean | null
          enable_dedicated_learn_mode?: boolean
          enable_study_timer?: boolean
          enable_word_color_coding?: boolean | null
          graduating_interval_days?: number
          id?: string
          initial_learning_steps_minutes?: number[]
          language_dialects?: Json | null
          lapsed_ef_penalty?: number
          learn_again_penalty?: number
          learn_hard_penalty?: number
          mastery_threshold?: number | null
          mature_interval_threshold?: number
          min_easiness_factor?: number
          preferred_voices?: Json
          relearning_steps_minutes?: number[]
          show_deck_progress?: boolean
          show_difficulty?: boolean | null
          study_timer_duration_minutes?: number
          theme_light_dark_mode?: string
          tts_enabled?: boolean | null
          ui_language?: string
          updated_at?: string | null
          user_id: string
          word_palette_config?: Json | null
        }
        Update: {
          app_language?: string
          card_font?: string | null
          color_only_non_native?: boolean | null
          created_at?: string | null
          custom_learn_requeue_gap?: number
          deck_list_grouping_preference?: string
          default_easiness_factor?: number
          easy_interval_days?: number
          enable_advanced_color_coding?: boolean | null
          enable_basic_color_coding?: boolean | null
          enable_dedicated_learn_mode?: boolean
          enable_study_timer?: boolean
          enable_word_color_coding?: boolean | null
          graduating_interval_days?: number
          id?: string
          initial_learning_steps_minutes?: number[]
          language_dialects?: Json | null
          lapsed_ef_penalty?: number
          learn_again_penalty?: number
          learn_hard_penalty?: number
          mastery_threshold?: number | null
          mature_interval_threshold?: number
          min_easiness_factor?: number
          preferred_voices?: Json
          relearning_steps_minutes?: number[]
          show_deck_progress?: boolean
          show_difficulty?: boolean | null
          study_timer_duration_minutes?: number
          theme_light_dark_mode?: string
          tts_enabled?: boolean | null
          ui_language?: string
          updated_at?: string | null
          user_id?: string
          word_palette_config?: Json | null
        }
        Relationships: []
      }
      study_sets: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          query_criteria: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          query_criteria: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          query_criteria?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tags: {
        Row: {
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      cards_with_srs_stage: {
        Row: {
          answer: string | null
          answer_gender: string | null
          answer_part_of_speech: string | null
          attempt_count: number | null
          correct_count: number | null
          created_at: string | null
          deck_id: string | null
          difficulty: number | null
          easiness_factor: number | null
          failed_attempts_in_learn: number | null
          hard_attempts_in_learn: number | null
          id: string | null
          incorrect_count: number | null
          interval_days: number | null
          last_review_grade: number | null
          last_reviewed_at: string | null
          learning_state: string | null
          learning_step_index: number | null
          mature_interval_threshold: number | null
          next_review_due: string | null
          question: string | null
          question_gender: string | null
          question_part_of_speech: string | null
          srs_level: number | null
          srs_stage: string | null
          stability: number | null
          updated_at: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_deck"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "decks"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      get_decks_with_complete_srs_counts: {
        Args: { p_user_id: string }
        Returns: {
          id: string
          name: string
          primary_language: string
          secondary_language: string
          is_bilingual: boolean
          updated_at: string
          new_count: number
          learning_count: number
          young_count: number
          mature_count: number
          relearning_count: number
          learn_eligible_count: number
          review_eligible_count: number
          deck_tags_json: Json
        }[]
      }
      get_study_set_card_count: {
        Args: { p_user_id: string; p_query_criteria: Json }
        Returns: number
      }
      get_study_set_srs_distribution: {
        Args: { p_user_id: string; p_query_criteria: Json }
        Returns: Database["public"]["CompositeTypes"]["srs_distribution_counts"]
      }
      get_user_global_srs_summary: {
        Args: { p_user_id: string }
        Returns: Database["public"]["CompositeTypes"]["user_global_srs_summary_counts"]
      }
      get_user_study_sets_with_total_counts: {
        Args: { p_user_id: string }
        Returns: Database["public"]["CompositeTypes"]["study_set_with_total_count"][]
      }
      resolve_study_query: {
        Args: {
          p_user_id: string
          p_input_criteria?: Json
          p_study_set_id?: string
          p_random_seed?: number
        }
        Returns: string[]
      }
    }
    Enums: {
      font_option: "default" | "opendyslexic" | "atkinson"
    }
    CompositeTypes: {
      srs_distribution_counts: {
        new_count: number | null
        learning_count: number | null
        relearning_count: number | null
        young_count: number | null
        mature_count: number | null
        actionable_count: number | null
      }
      study_set_with_total_count: {
        id: string | null
        user_id: string | null
        name: string | null
        description: string | null
        query_criteria: Json | null
        created_at: string | null
        updated_at: string | null
        total_card_count: number | null
      }
      user_global_srs_summary_counts: {
        total_cards: number | null
        new_cards: number | null
        due_cards: number | null
        new_review_cards: number | null
      }
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      font_option: ["default", "opendyslexic", "atkinson"],
    },
  },
} as const
