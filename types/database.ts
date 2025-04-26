export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          operationName?: string
          query?: string
          variables?: Json
          extensions?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
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
          id: string
          incorrect_count: number | null
          interval_days: number | null
          last_review_grade: number | null
          last_reviewed_at: string | null
          last_studied: string | null
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
          id?: string
          incorrect_count?: number | null
          interval_days?: number | null
          last_review_grade?: number | null
          last_reviewed_at?: string | null
          last_studied?: string | null
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
          id?: string
          incorrect_count?: number | null
          interval_days?: number | null
          last_review_grade?: number | null
          last_reviewed_at?: string | null
          last_studied?: string | null
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
          enable_advanced_color_coding: boolean | null
          enable_basic_color_coding: boolean | null
          enable_word_color_coding: boolean | null
          id: string
          language_dialects: Json | null
          mastery_threshold: number | null
          preferred_voices: Json
          show_difficulty: boolean | null
          tts_enabled: boolean | null
          updated_at: string | null
          user_id: string
          word_palette_config: Json | null
        }
        Insert: {
          app_language?: string
          card_font?: string | null
          color_only_non_native?: boolean | null
          created_at?: string | null
          enable_advanced_color_coding?: boolean | null
          enable_basic_color_coding?: boolean | null
          enable_word_color_coding?: boolean | null
          id?: string
          language_dialects?: Json | null
          mastery_threshold?: number | null
          preferred_voices?: Json
          show_difficulty?: boolean | null
          tts_enabled?: boolean | null
          updated_at?: string | null
          user_id: string
          word_palette_config?: Json | null
        }
        Update: {
          app_language?: string
          card_font?: string | null
          color_only_non_native?: boolean | null
          created_at?: string | null
          enable_advanced_color_coding?: boolean | null
          enable_basic_color_coding?: boolean | null
          enable_word_color_coding?: boolean | null
          id?: string
          language_dialects?: Json | null
          mastery_threshold?: number | null
          preferred_voices?: Json
          show_difficulty?: boolean | null
          tts_enabled?: boolean | null
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
      [_ in never]: never
    }
    Functions: {
      resolve_study_query: {
        Args: {
          p_user_id: string
          p_query_criteria: Json
          p_order_by_field?: string
          p_order_by_direction?: string
        }
        Returns: {
          card_id: string
        }[]
      }
    }
    Enums: {
      font_option: "default" | "opendyslexic" | "atkinson"
    }
    CompositeTypes: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      font_option: ["default", "opendyslexic", "atkinson"],
    },
  },
} as const
