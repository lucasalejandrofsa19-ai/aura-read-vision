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
      achievements: {
        Row: {
          code: string
          created_at: string
          description: string
          icon: string
          name: string
          requirement_type: string
          requirement_value: number
          sort_order: number
          xp_reward: number
        }
        Insert: {
          code: string
          created_at?: string
          description: string
          icon?: string
          name: string
          requirement_type: string
          requirement_value: number
          sort_order?: number
          xp_reward?: number
        }
        Update: {
          code?: string
          created_at?: string
          description?: string
          icon?: string
          name?: string
          requirement_type?: string
          requirement_value?: number
          sort_order?: number
          xp_reward?: number
        }
        Relationships: []
      }
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
        Relationships: []
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
      book_shares: {
        Row: {
          book_id: string
          created_at: string
          created_by: string
          expires_at: string
          id: string
          token: string
        }
        Insert: {
          book_id: string
          created_at?: string
          created_by: string
          expires_at?: string
          id?: string
          token: string
        }
        Update: {
          book_id?: string
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "book_shares_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
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
      daily_progress: {
        Row: {
          created_at: string
          date: string
          goal_met: boolean
          id: string
          pages_read: number
          updated_at: string
          user_id: string
          xp_earned: number
        }
        Insert: {
          created_at?: string
          date?: string
          goal_met?: boolean
          id?: string
          pages_read?: number
          updated_at?: string
          user_id: string
          xp_earned?: number
        }
        Update: {
          created_at?: string
          date?: string
          goal_met?: boolean
          id?: string
          pages_read?: number
          updated_at?: string
          user_id?: string
          xp_earned?: number
        }
        Relationships: []
      }
      deepen_exports: {
        Row: {
          book_title: string | null
          created_at: string
          file_path: string
          file_size: number | null
          id: string
          topics: string[] | null
          user_id: string
        }
        Insert: {
          book_title?: string | null
          created_at?: string
          file_path: string
          file_size?: number | null
          id?: string
          topics?: string[] | null
          user_id: string
        }
        Update: {
          book_title?: string | null
          created_at?: string
          file_path?: string
          file_size?: number | null
          id?: string
          topics?: string[] | null
          user_id?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      gamification_stats: {
        Row: {
          created_at: string
          current_streak: number
          daily_goal_pages: number
          freezes_available: number
          last_activity_date: string | null
          level: number
          longest_streak: number
          updated_at: string
          user_id: string
          xp_total: number
        }
        Insert: {
          created_at?: string
          current_streak?: number
          daily_goal_pages?: number
          freezes_available?: number
          last_activity_date?: string | null
          level?: number
          longest_streak?: number
          updated_at?: string
          user_id: string
          xp_total?: number
        }
        Update: {
          created_at?: string
          current_streak?: number
          daily_goal_pages?: number
          freezes_available?: number
          last_activity_date?: string | null
          level?: number
          longest_streak?: number
          updated_at?: string
          user_id?: string
          xp_total?: number
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
        Relationships: []
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
          is_free: boolean
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
          is_free?: boolean
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
          is_free?: boolean
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
          sync_reading_enabled: boolean | null
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
          sync_reading_enabled?: boolean | null
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
          sync_reading_enabled?: boolean | null
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
      story_videos: {
        Row: {
          book_id: string | null
          book_title: string | null
          created_at: string
          error_message: string | null
          file_mime: string | null
          file_path: string | null
          file_size: number | null
          id: string
          mode: string | null
          scenes_count: number | null
          status: string
          user_id: string
        }
        Insert: {
          book_id?: string | null
          book_title?: string | null
          created_at?: string
          error_message?: string | null
          file_mime?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          mode?: string | null
          scenes_count?: number | null
          status?: string
          user_id: string
        }
        Update: {
          book_id?: string | null
          book_title?: string | null
          created_at?: string
          error_message?: string | null
          file_mime?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          mode?: string | null
          scenes_count?: number | null
          status?: string
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
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      user_achievements: {
        Row: {
          achievement_code: string
          id: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          achievement_code: string
          id?: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          achievement_code?: string
          id?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_achievement_code_fkey"
            columns: ["achievement_code"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["code"]
          },
        ]
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
      award_action_xp: { Args: { _action: string }; Returns: Json }
      can_generate_story_video: { Args: { _user_id: string }; Returns: Json }
      check_achievements: { Args: { _user_id: string }; Returns: undefined }
      check_book_limit: { Args: { user_id: string }; Returns: boolean }
      compute_level: { Args: { xp: number }; Returns: number }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
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
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      register_pages_read: { Args: { _pages: number }; Returns: Json }
      set_daily_goal: { Args: { _pages: number }; Returns: undefined }
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
