export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      assets: {
        Row: {
          alt_text: string | null;
          brand_id: string | null;
          created_at: string;
          created_by: string | null;
          file_path: string;
          height: number | null;
          id: string;
          mime_type: string | null;
          prompt_used: string | null;
          type: Database["public"]["Enums"]["asset_type"];
          width: number | null;
          workspace_id: string;
        };
        Insert: {
          alt_text?: string | null;
          brand_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          file_path: string;
          height?: number | null;
          id?: string;
          mime_type?: string | null;
          prompt_used?: string | null;
          type: Database["public"]["Enums"]["asset_type"];
          width?: number | null;
          workspace_id: string;
        };
        Update: {
          alt_text?: string | null;
          brand_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          file_path?: string;
          height?: number | null;
          id?: string;
          mime_type?: string | null;
          prompt_used?: string | null;
          type?: Database["public"]["Enums"]["asset_type"];
          width?: number | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "assets_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assets_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_logs: {
        Row: {
          action: string;
          actor_user_id: string | null;
          created_at: string;
          entity_id: string | null;
          entity_type: string;
          id: string;
          metadata: Json;
          workspace_id: string;
        };
        Insert: {
          action: string;
          actor_user_id?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type: string;
          id?: string;
          metadata?: Json;
          workspace_id: string;
        };
        Update: {
          action?: string;
          actor_user_id?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string;
          id?: string;
          metadata?: Json;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "audit_logs_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      brand_profiles: {
        Row: {
          brand_id: string;
          created_at: string;
          cta_library: string[] | null;
          hashtag_library: string[] | null;
          id: string;
          posting_notes: string | null;
          primary_color: string | null;
          secondary_color: string | null;
          tone_keywords: string[] | null;
          updated_at: string;
        };
        Insert: {
          brand_id: string;
          created_at?: string;
          cta_library?: string[] | null;
          hashtag_library?: string[] | null;
          id?: string;
          posting_notes?: string | null;
          primary_color?: string | null;
          secondary_color?: string | null;
          tone_keywords?: string[] | null;
          updated_at?: string;
        };
        Update: {
          brand_id?: string;
          created_at?: string;
          cta_library?: string[] | null;
          hashtag_library?: string[] | null;
          id?: string;
          posting_notes?: string | null;
          primary_color?: string | null;
          secondary_color?: string | null;
          tone_keywords?: string[] | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "brand_profiles_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: true;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
        ];
      };
      brands: {
        Row: {
          app_store_url: string | null;
          created_at: string;
          description: string | null;
          id: string;
          name: string;
          play_store_url: string | null;
          slug: string;
          target_audience: string | null;
          voice_summary: string | null;
          website_url: string | null;
          workspace_id: string;
        };
        Insert: {
          app_store_url?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          name: string;
          play_store_url?: string | null;
          slug: string;
          target_audience?: string | null;
          voice_summary?: string | null;
          website_url?: string | null;
          workspace_id: string;
        };
        Update: {
          app_store_url?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          name?: string;
          play_store_url?: string | null;
          slug?: string;
          target_audience?: string | null;
          voice_summary?: string | null;
          website_url?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "brands_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      budget_rules: {
        Row: {
          alert_threshold_percent: number;
          brand_id: string | null;
          created_at: string;
          id: string;
          period: Database["public"]["Enums"]["metric_period"];
          spend_limit: number;
          workspace_id: string;
        };
        Insert: {
          alert_threshold_percent?: number;
          brand_id?: string | null;
          created_at?: string;
          id?: string;
          period: Database["public"]["Enums"]["metric_period"];
          spend_limit: number;
          workspace_id: string;
        };
        Update: {
          alert_threshold_percent?: number;
          brand_id?: string | null;
          created_at?: string;
          id?: string;
          period?: Database["public"]["Enums"]["metric_period"];
          spend_limit?: number;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "budget_rules_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "budget_rules_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      campaigns: {
        Row: {
          brand_id: string;
          created_at: string;
          end_date: string | null;
          goal: string | null;
          id: string;
          name: string;
          start_date: string | null;
          status: string;
          workspace_id: string;
        };
        Insert: {
          brand_id: string;
          created_at?: string;
          end_date?: string | null;
          goal?: string | null;
          id?: string;
          name: string;
          start_date?: string | null;
          status?: string;
          workspace_id: string;
        };
        Update: {
          brand_id?: string;
          created_at?: string;
          end_date?: string | null;
          goal?: string | null;
          id?: string;
          name?: string;
          start_date?: string | null;
          status?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "campaigns_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaigns_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      cost_entries: {
        Row: {
          amount: number;
          brand_id: string | null;
          cost_source_id: string | null;
          created_at: string;
          entry_date: string;
          id: string;
          metadata: Json;
          notes: string | null;
          quantity: number | null;
          unit: string | null;
          workspace_id: string;
        };
        Insert: {
          amount: number;
          brand_id?: string | null;
          cost_source_id?: string | null;
          created_at?: string;
          entry_date: string;
          id?: string;
          metadata?: Json;
          notes?: string | null;
          quantity?: number | null;
          unit?: string | null;
          workspace_id: string;
        };
        Update: {
          amount?: number;
          brand_id?: string | null;
          cost_source_id?: string | null;
          created_at?: string;
          entry_date?: string;
          id?: string;
          metadata?: Json;
          notes?: string | null;
          quantity?: number | null;
          unit?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cost_entries_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cost_entries_cost_source_id_fkey";
            columns: ["cost_source_id"];
            isOneToOne: false;
            referencedRelation: "cost_sources";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cost_entries_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      cost_sources: {
        Row: {
          active: boolean;
          billing_cycle: Database["public"]["Enums"]["cost_cycle"];
          category: string;
          created_at: string;
          id: string;
          max_estimated_cost: number | null;
          min_estimated_cost: number | null;
          name: string;
          notes: string | null;
          vendor: string;
          workspace_id: string;
        };
        Insert: {
          active?: boolean;
          billing_cycle: Database["public"]["Enums"]["cost_cycle"];
          category: string;
          created_at?: string;
          id?: string;
          max_estimated_cost?: number | null;
          min_estimated_cost?: number | null;
          name: string;
          notes?: string | null;
          vendor: string;
          workspace_id: string;
        };
        Update: {
          active?: boolean;
          billing_cycle?: Database["public"]["Enums"]["cost_cycle"];
          category?: string;
          created_at?: string;
          id?: string;
          max_estimated_cost?: number | null;
          min_estimated_cost?: number | null;
          name?: string;
          notes?: string | null;
          vendor?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cost_sources_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      credit_purchases: {
        Row: {
          id: string;
          workspace_id: string;
          vendor: string;
          amount_usd: number;
          credits: number;
          purchased_at: string;
          notes: string | null;
          created_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          vendor: string;
          amount_usd: number;
          credits: number;
          purchased_at: string;
          notes?: string | null;
          created_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          vendor?: string;
          amount_usd?: number;
          credits?: number;
          purchased_at?: string;
          notes?: string | null;
          created_at?: string;
          created_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "credit_purchases_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      credential_vault: {
        Row: {
          created_at: string;
          created_by: string | null;
          encrypted_value: string;
          environment: string;
          id: string;
          iv: string;
          key_metadata: Json;
          last_rotated_at: string | null;
          name: string;
          rotation_due_at: string | null;
          service: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          encrypted_value: string;
          environment?: string;
          id?: string;
          iv: string;
          key_metadata?: Json;
          last_rotated_at?: string | null;
          name: string;
          rotation_due_at?: string | null;
          service: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          encrypted_value?: string;
          environment?: string;
          id?: string;
          iv?: string;
          key_metadata?: Json;
          last_rotated_at?: string | null;
          name?: string;
          rotation_due_at?: string | null;
          service?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "credential_vault_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      platform_metrics: {
        Row: {
          captured_at: string;
          comments: number | null;
          engagement_rate: number | null;
          id: string;
          impressions: number | null;
          likes: number | null;
          outbound_clicks: number | null;
          platform: Database["public"]["Enums"]["platform_type"];
          post_id: string;
          reach: number | null;
          saves: number | null;
          shares: number | null;
        };
        Insert: {
          captured_at?: string;
          comments?: number | null;
          engagement_rate?: number | null;
          id?: string;
          impressions?: number | null;
          likes?: number | null;
          outbound_clicks?: number | null;
          platform: Database["public"]["Enums"]["platform_type"];
          post_id: string;
          reach?: number | null;
          saves?: number | null;
          shares?: number | null;
        };
        Update: {
          captured_at?: string;
          comments?: number | null;
          engagement_rate?: number | null;
          id?: string;
          impressions?: number | null;
          likes?: number | null;
          outbound_clicks?: number | null;
          platform?: Database["public"]["Enums"]["platform_type"];
          post_id?: string;
          reach?: number | null;
          saves?: number | null;
          shares?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "platform_metrics_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
        ];
      };
      post_assets: {
        Row: {
          asset_id: string;
          id: string;
          post_id: string;
          sort_order: number;
        };
        Insert: {
          asset_id: string;
          id?: string;
          post_id: string;
          sort_order?: number;
        };
        Update: {
          asset_id?: string;
          id?: string;
          post_id?: string;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "post_assets_asset_id_fkey";
            columns: ["asset_id"];
            isOneToOne: false;
            referencedRelation: "assets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "post_assets_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
        ];
      };
      post_variants: {
        Row: {
          caption: string | null;
          created_at: string;
          hashtags: string[] | null;
          hook: string | null;
          id: string;
          post_id: string;
          variant_label: string;
        };
        Insert: {
          caption?: string | null;
          created_at?: string;
          hashtags?: string[] | null;
          hook?: string | null;
          id?: string;
          post_id: string;
          variant_label: string;
        };
        Update: {
          caption?: string | null;
          created_at?: string;
          hashtags?: string[] | null;
          hook?: string | null;
          id?: string;
          post_id?: string;
          variant_label?: string;
        };
        Relationships: [
          {
            foreignKeyName: "post_variants_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
        ];
      };
      posts: {
        Row: {
          brand_id: string;
          campaign_id: string | null;
          caption: string | null;
          created_at: string;
          created_by: string | null;
          destination_url: string | null;
          external_post_id: string | null;
          failure_reason: string | null;
          hashtags: string[] | null;
          hook: string | null;
          id: string;
          media_type: string;
          platform: Database["public"]["Enums"]["platform_type"];
          published_at: string | null;
          scheduled_for: string | null;
          social_account_id: string | null;
          status: Database["public"]["Enums"]["post_status"];
          title: string | null;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          brand_id: string;
          campaign_id?: string | null;
          caption?: string | null;
          created_at?: string;
          created_by?: string | null;
          destination_url?: string | null;
          external_post_id?: string | null;
          failure_reason?: string | null;
          hashtags?: string[] | null;
          hook?: string | null;
          id?: string;
          media_type?: string;
          platform: Database["public"]["Enums"]["platform_type"];
          published_at?: string | null;
          scheduled_for?: string | null;
          social_account_id?: string | null;
          status?: Database["public"]["Enums"]["post_status"];
          title?: string | null;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          brand_id?: string;
          campaign_id?: string | null;
          caption?: string | null;
          created_at?: string;
          created_by?: string | null;
          destination_url?: string | null;
          external_post_id?: string | null;
          failure_reason?: string | null;
          hashtags?: string[] | null;
          hook?: string | null;
          id?: string;
          media_type?: string;
          platform?: Database["public"]["Enums"]["platform_type"];
          published_at?: string | null;
          scheduled_for?: string | null;
          social_account_id?: string | null;
          status?: Database["public"]["Enums"]["post_status"];
          title?: string | null;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "posts_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "posts_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "posts_social_account_id_fkey";
            columns: ["social_account_id"];
            isOneToOne: false;
            referencedRelation: "social_accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "posts_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      publish_jobs: {
        Row: {
          attempt_count: number;
          created_at: string;
          id: string;
          last_error: string | null;
          post_id: string;
          run_at: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          attempt_count?: number;
          created_at?: string;
          id?: string;
          last_error?: string | null;
          post_id: string;
          run_at: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          attempt_count?: number;
          created_at?: string;
          id?: string;
          last_error?: string | null;
          post_id?: string;
          run_at?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "publish_jobs_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
        ];
      };
      recommendations: {
        Row: {
          action: Database["public"]["Enums"]["recommendation_action"];
          brand_id: string | null;
          confidence_score: number | null;
          created_at: string;
          id: string;
          period: Database["public"]["Enums"]["metric_period"];
          source_data: Json;
          summary: string;
          workspace_id: string;
        };
        Insert: {
          action: Database["public"]["Enums"]["recommendation_action"];
          brand_id?: string | null;
          confidence_score?: number | null;
          created_at?: string;
          id?: string;
          period: Database["public"]["Enums"]["metric_period"];
          source_data?: Json;
          summary: string;
          workspace_id: string;
        };
        Update: {
          action?: Database["public"]["Enums"]["recommendation_action"];
          brand_id?: string | null;
          confidence_score?: number | null;
          created_at?: string;
          id?: string;
          period?: Database["public"]["Enums"]["metric_period"];
          source_data?: Json;
          summary?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "recommendations_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recommendations_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      social_accounts: {
        Row: {
          access_token: string | null;
          account_identifier: string | null;
          account_name: string;
          avatar_url: string | null;
          brand_id: string | null;
          created_at: string;
          external_account_id: string | null;
          id: string;
          platform: Database["public"]["Enums"]["platform_type"];
          refresh_token: string | null;
          scopes: string | null;
          status: string;
          token_expires_at: string | null;
          workspace_id: string;
        };
        Insert: {
          access_token?: string | null;
          account_identifier?: string | null;
          account_name: string;
          avatar_url?: string | null;
          brand_id?: string | null;
          created_at?: string;
          external_account_id?: string | null;
          id?: string;
          platform: Database["public"]["Enums"]["platform_type"];
          refresh_token?: string | null;
          scopes?: string | null;
          status?: string;
          token_expires_at?: string | null;
          workspace_id: string;
        };
        Update: {
          access_token?: string | null;
          account_identifier?: string | null;
          account_name?: string;
          avatar_url?: string | null;
          brand_id?: string | null;
          created_at?: string;
          external_account_id?: string | null;
          id?: string;
          platform?: Database["public"]["Enums"]["platform_type"];
          refresh_token?: string | null;
          scopes?: string | null;
          status?: string;
          token_expires_at?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "social_accounts_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "social_accounts_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      workspace_members: {
        Row: {
          created_at: string;
          id: string;
          role: string;
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: string;
          user_id: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: string;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      workspaces: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          owner_user_id: string;
          slug: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          owner_user_id: string;
          slug: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          owner_user_id?: string;
          slug?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      is_workspace_member: {
        Args: { check_workspace_id: string };
        Returns: boolean;
      };
    };
    Enums: {
      asset_type: "generated_image" | "uploaded_image" | "template_image" | "uploaded_video";
      cost_cycle: "one_time" | "daily" | "weekly" | "monthly" | "yearly";
      metric_period: "daily" | "weekly" | "monthly" | "yearly";
      platform_type:
        | "facebook"
        | "instagram"
        | "linkedin"
        | "pinterest"
        | "snapchat"
        | "threads"
        | "tiktok"
        | "x"
        | "youtube";
      post_status:
        | "draft"
        | "ready_for_review"
        | "approved"
        | "scheduled"
        | "publishing"
        | "published"
        | "failed"
        | "archived";
      recommendation_action:
        | "scale"
        | "keep_testing"
        | "rewrite"
        | "pause"
        | "remove";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      asset_type: ["generated_image", "uploaded_image", "template_image"],
      cost_cycle: ["one_time", "daily", "weekly", "monthly", "yearly"],
      metric_period: ["daily", "weekly", "monthly", "yearly"],
      platform_type: ["facebook", "instagram", "linkedin", "pinterest", "snapchat", "threads", "tiktok", "x", "youtube"],
      post_status: [
        "draft",
        "ready_for_review",
        "approved",
        "scheduled",
        "publishing",
        "published",
        "failed",
        "archived",
      ],
      recommendation_action: [
        "scale",
        "keep_testing",
        "rewrite",
        "pause",
        "remove",
      ],
    },
  },
} as const;
