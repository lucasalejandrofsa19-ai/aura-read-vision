export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      audiobook_progress: {
        Row: {
          book_id: string
          created_at: string
          current_page: number
          id: string
          playback_position: number
          playback_rate: number
          updated_at: string
          user_id: string
        }
        Insert: {
          book_id: string
          created_at?: string
          current_page?: number
          id?: string
          playback_position?: number
          playback_rate?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          book_id?: string
          created_at?: string
          current_page?: number
          id?: string
          playback_position?: number
          playback_rate?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audiobook_progress_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
      blocked_ips: {
        Row: {
          auto_blocked: boolean
          blocked_at: string
          blocked_by: string | null
          blocked_until: string | null
          created_at: string
          id: string
          ip_address: string
          is_threat: boolean | null
          metadata: Json | null
          reason: string
          reputation_data: Json | null
          reputation_score: number | null
          threat_categories: string[] | null
        }
        Insert: {
          auto_blocked?: boolean
          blocked_at?: string
          blocked_by?: string | null
          blocked_until?: string | null
          created_at?: string
          id?: string
          ip_address: string
          is_threat?: boolean | null
          metadata?: Json | null
          reason: string
          reputation_data?: Json | null
          reputation_score?: number | null
          threat_categories?: string[] | null
        }
        Update: {
          auto_blocked?: boolean
          blocked_at?: string
          blocked_by?: string | null
          blocked_until?: string | null
          created_at?: string
          id?: string
          ip_address?: string
          is_threat?: boolean | null
          metadata?: Json | null
          reason?: string
          reputation_data?: Json | null
          reputation_score?: number | null
          threat_categories?: string[] | null
        }
        Relationships: []
      }
      books: {
        Row: {
          author: string | null
          cover_color: string | null
          cover_image_url: string | null
          created_at: string | null
          current_page: number | null
          extracted_text: string | null
          file_path: string
          file_size: number | null
          id: string
          progress: number | null
          summary: string | null
          title: string
          total_pages: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          author?: string | null
          cover_color?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          current_page?: number | null
          extracted_text?: string | null
          file_path: string
          file_size?: number | null
          id?: string
          progress?: number | null
          summary?: string | null
          title: string
          total_pages?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          author?: string | null
          cover_color?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          current_page?: number | null
          extracted_text?: string | null
          file_path?: string
          file_size?: number | null
          id?: string
          progress?: number | null
          summary?: string | null
          title?: string
          total_pages?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      highlight_images: {
        Row: {
          created_at: string | null
          highlight_id: string
          id: string
          image_url: string
          prompt: string | null
          storage_path: string
          style: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          highlight_id: string
          id?: string
          image_url: string
          prompt?: string | null
          storage_path: string
          style: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          highlight_id?: string
          id?: string
          image_url?: string
          prompt?: string | null
          storage_path?: string
          style?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "highlight_images_highlight_id_fkey"
            columns: ["highlight_id"]
            isOneToOne: false
            referencedRelation: "highlights"
            referencedColumns: ["id"]
          },
        ]
      }
      highlights: {
        Row: {
          book_id: string
          color: string | null
          created_at: string | null
          id: string
          page_number: number
          position_data: Json | null
          text: string
          user_id: string
        }
        Insert: {
          book_id: string
          color?: string | null
          created_at?: string | null
          id?: string
          page_number: number
          position_data?: Json | null
          text: string
          user_id: string
        }
        Update: {
          book_id?: string
          color?: string | null
          created_at?: string | null
          id?: string
          page_number?: number
          position_data?: Json | null
          text?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "highlights_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          book_id: string
          created_at: string
          id: string
          note_text: string
          page_number: number
          updated_at: string
          user_id: string
        }
        Insert: {
          book_id: string
          created_at?: string
          id?: string
          note_text: string
          page_number: number
          updated_at?: string
          user_id: string
        }
        Update: {
          book_id?: string
          created_at?: string
          id?: string
          note_text?: string
          page_number?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      premium_access_audit: {
        Row: {
          action: string
          created_at: string
          feature: string
          granted: boolean
          id: string
          ip_address: string | null
          metadata: Json | null
          reason: string | null
          reputation_checked: boolean | null
          reputation_score: number | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          feature: string
          granted: boolean
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          reason?: string | null
          reputation_checked?: boolean | null
          reputation_score?: number | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          feature?: string
          granted?: boolean
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          reason?: string | null
          reputation_checked?: boolean | null
          reputation_score?: number | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      premium_books: {
        Row: {
          author: string | null
          cover_color: string | null
          cover_image_url: string | null
          created_at: string | null
          extracted_text: string | null
          file_path: string
          file_size: number | null
          id: string
          summary: string | null
          title: string
          total_pages: number | null
          updated_at: string | null
        }
        Insert: {
          author?: string | null
          cover_color?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          extracted_text?: string | null
          file_path: string
          file_size?: number | null
          id?: string
          summary?: string | null
          title: string
          total_pages?: number | null
          updated_at?: string | null
        }
        Update: {
          author?: string | null
          cover_color?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          extracted_text?: string | null
          file_path?: string
          file_size?: number | null
          id?: string
          summary?: string | null
          title?: string
          total_pages?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bookmark_sound_enabled: boolean | null
          created_at: string | null
          delete_sound_enabled: boolean | null
          email: string | null
          full_name: string | null
          has_seen_library_tour: boolean
          has_seen_welcome: boolean
          highlight_sensitivity: number | null
          highlight_sound_enabled: boolean | null
          id: string
          note_sound_enabled: boolean | null
          page_turn_sound_enabled: boolean | null
          stripe_customer_id: string | null
          subscription_status: string | null
          subscription_tier: string | null
          theme_preference: string | null
          tts_provider: string | null
          ultra_performance_mode: boolean | null
          updated_at: string | null
          zoom_sensitivity: number | null
        }
        Insert: {
          avatar_url?: string | null
          bookmark_sound_enabled?: boolean | null
          created_at?: string | null
          delete_sound_enabled?: boolean | null
          email?: string | null
          full_name?: string | null
          has_seen_library_tour?: boolean
          has_seen_welcome?: boolean
          highlight_sensitivity?: number | null
          highlight_sound_enabled?: boolean | null
          id: string
          note_sound_enabled?: boolean | null
          page_turn_sound_enabled?: boolean | null
          stripe_customer_id?: string | null
          subscription_status?: string | null
          subscription_tier?: string | null
          theme_preference?: string | null
          tts_provider?: string | null
          ultra_performance_mode?: boolean | null
          updated_at?: string | null
          zoom_sensitivity?: number | null
        }
        Update: {
          avatar_url?: string | null
          bookmark_sound_enabled?: boolean | null
          created_at?: string | null
          delete_sound_enabled?: boolean | null
          email?: string | null
          full_name?: string | null
          has_seen_library_tour?: boolean
          has_seen_welcome?: boolean
          highlight_sensitivity?: number | null
          highlight_sound_enabled?: boolean | null
          id?: string
          note_sound_enabled?: boolean | null
          page_turn_sound_enabled?: boolean | null
          stripe_customer_id?: string | null
          subscription_status?: string | null
          subscription_tier?: string | null
          theme_preference?: string | null
          tts_provider?: string | null
          ultra_performance_mode?: boolean | null
          updated_at?: string | null
          zoom_sensitivity?: number | null
        }
        Relationships: []
      }
      reading_sessions: {
        Row: {
          book_id: string
          created_at: string
          duration_minutes: number | null
          end_page: number | null
          ended_at: string | null
          id: string
          pages_read: number
          start_page: number
          started_at: string
          user_id: string
        }
        Insert: {
          book_id: string
          created_at?: string
          duration_minutes?: number | null
          end_page?: number | null
          ended_at?: string | null
          id?: string
          pages_read?: number
          start_page: number
          started_at?: string
          user_id: string
        }
        Update: {
          book_id?: string
          created_at?: string
          duration_minutes?: number | null
          end_page?: number | null
          ended_at?: string | null
          id?: string
          pages_read?: number
          start_page?: number
          started_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          id: string
          status: string
          stripe_price_id: string | null
          stripe_subscription_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          status: string
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          status?: string
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_suggestions: {
        Row: {
          category: string
          created_at: string
          description: string
          id: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          description: string
          id?: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          id?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      whitelisted_ips: {
        Row: {
          added_at: string
          added_by: string | null
          created_at: string
          description: string
          expires_at: string | null
          id: string
          ip_address: string
          metadata: Json | null
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          created_at?: string
          description: string
          expires_at?: string | null
          id?: string
          ip_address: string
          metadata?: Json | null
        }
        Update: {
          added_at?: string
          added_by?: string | null
          created_at?: string
          description?: string
          expires_at?: string | null
          id?: string
          ip_address?: string
          metadata?: Json | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_book_limit: { Args: { user_id: string }; Returns: boolean }
      has_premium_access: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_ip_blocked: { Args: { check_ip: string }; Returns: boolean }
      is_ip_whitelisted: { Args: { check_ip: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "premium" | "free"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "premium", "free"],
    },
  },
} as const
