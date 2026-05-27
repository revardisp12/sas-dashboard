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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      bundles: {
        Row: {
          brand: string
          cogs: number
          components: Json
          created_at: string | null
          id: string
          margin: number
          name: string
          price: number
        }
        Insert: {
          brand: string
          cogs?: number
          components?: Json
          created_at?: string | null
          id?: string
          margin?: number
          name: string
          price?: number
        }
        Update: {
          brand?: string
          cogs?: number
          components?: Json
          created_at?: string | null
          id?: string
          margin?: number
          name?: string
          price?: number
        }
        Relationships: []
      }
      crm: {
        Row: {
          brand: string
          created_at: string | null
          customer_name: string | null
          date: string
          id: string
          phone: string | null
          product: string
          qty: number
          revenue: number
        }
        Insert: {
          brand: string
          created_at?: string | null
          customer_name?: string | null
          date: string
          id?: string
          phone?: string | null
          product?: string
          qty?: number
          revenue?: number
        }
        Update: {
          brand?: string
          created_at?: string | null
          customer_name?: string | null
          date?: string
          id?: string
          phone?: string | null
          product?: string
          qty?: number
          revenue?: number
        }
        Relationships: []
      }
      facebook_organic: {
        Row: {
          brand: string
          created_at: string | null
          date: string | null
          engagements: number | null
          id: string
          impressions: number | null
          reach: number | null
        }
        Insert: {
          brand: string
          created_at?: string | null
          date?: string | null
          engagements?: number | null
          id?: string
          impressions?: number | null
          reach?: number | null
        }
        Update: {
          brand?: string
          created_at?: string | null
          date?: string | null
          engagements?: number | null
          id?: string
          impressions?: number | null
          reach?: number | null
        }
        Relationships: []
      }
      google_ads: {
        Row: {
          brand: string
          campaign: string | null
          clicks: number | null
          conv_rate: number | null
          conversions: number | null
          cpc: number | null
          created_at: string | null
          ctr: number | null
          date: string
          id: string
          impressions: number | null
          roas: number | null
          spend: number | null
        }
        Insert: {
          brand: string
          campaign?: string | null
          clicks?: number | null
          conv_rate?: number | null
          conversions?: number | null
          cpc?: number | null
          created_at?: string | null
          ctr?: number | null
          date: string
          id?: string
          impressions?: number | null
          roas?: number | null
          spend?: number | null
        }
        Update: {
          brand?: string
          campaign?: string | null
          clicks?: number | null
          conv_rate?: number | null
          conversions?: number | null
          cpc?: number | null
          created_at?: string | null
          ctr?: number | null
          date?: string
          id?: string
          impressions?: number | null
          roas?: number | null
          spend?: number | null
        }
        Relationships: []
      }
      instagram: {
        Row: {
          brand: string
          created_at: string | null
          date: string
          engagements: number | null
          followers: number | null
          id: string
          impressions: number | null
          profile_visits: number | null
          reach: number | null
        }
        Insert: {
          brand: string
          created_at?: string | null
          date: string
          engagements?: number | null
          followers?: number | null
          id?: string
          impressions?: number | null
          profile_visits?: number | null
          reach?: number | null
        }
        Update: {
          brand?: string
          created_at?: string | null
          date?: string
          engagements?: number | null
          followers?: number | null
          id?: string
          impressions?: number | null
          profile_visits?: number | null
          reach?: number | null
        }
        Relationships: []
      }
      meta_ads: {
        Row: {
          brand: string
          campaign: string | null
          clicks: number | null
          cpm: number | null
          created_at: string | null
          ctr: number | null
          date: string
          id: string
          impressions: number | null
          purchases: number | null
          reach: number | null
          results: number | null
          roas: number | null
          spend: number | null
        }
        Insert: {
          brand: string
          campaign?: string | null
          clicks?: number | null
          cpm?: number | null
          created_at?: string | null
          ctr?: number | null
          date: string
          id?: string
          impressions?: number | null
          purchases?: number | null
          reach?: number | null
          results?: number | null
          roas?: number | null
          spend?: number | null
        }
        Update: {
          brand?: string
          campaign?: string | null
          clicks?: number | null
          cpm?: number | null
          created_at?: string | null
          ctr?: number | null
          date?: string
          id?: string
          impressions?: number | null
          purchases?: number | null
          reach?: number | null
          results?: number | null
          roas?: number | null
          spend?: number | null
        }
        Relationships: []
      }
      products: {
        Row: {
          brand: string
          cogs: number
          created_at: string | null
          id: string
          margin: number
          name: string
          price: number
          sku: string
        }
        Insert: {
          brand: string
          cogs?: number
          created_at?: string | null
          id?: string
          margin?: number
          name: string
          price?: number
          sku: string
        }
        Update: {
          brand?: string
          cogs?: number
          created_at?: string | null
          id?: string
          margin?: number
          name?: string
          price?: number
          sku?: string
        }
        Relationships: []
      }
      sales: {
        Row: {
          address: string | null
          brand: string
          channel: string | null
          cogs: number | null
          created_at: string | null
          customer_name: string | null
          date: string
          gross_profit: number | null
          id: string
          phone: string | null
          product: string
          qty: number
          revenue: number
          source: string | null
        }
        Insert: {
          address?: string | null
          brand: string
          channel?: string | null
          cogs?: number | null
          created_at?: string | null
          customer_name?: string | null
          date: string
          gross_profit?: number | null
          id?: string
          phone?: string | null
          product?: string
          qty?: number
          revenue?: number
          source?: string | null
        }
        Update: {
          address?: string | null
          brand?: string
          channel?: string | null
          cogs?: number | null
          created_at?: string | null
          customer_name?: string | null
          date?: string
          gross_profit?: number | null
          id?: string
          phone?: string | null
          product?: string
          qty?: number
          revenue?: number
          source?: string | null
        }
        Relationships: []
      }
      shopee: {
        Row: {
          ad_clicks: number | null
          ad_impressions: number | null
          ad_spend: number | null
          brand: string
          created_at: string | null
          date: string
          gmv: number | null
          id: string
          orders: number | null
          product_views: number | null
          revenue: number | null
          units_sold: number | null
        }
        Insert: {
          ad_clicks?: number | null
          ad_impressions?: number | null
          ad_spend?: number | null
          brand: string
          created_at?: string | null
          date: string
          gmv?: number | null
          id?: string
          orders?: number | null
          product_views?: number | null
          revenue?: number | null
          units_sold?: number | null
        }
        Update: {
          ad_clicks?: number | null
          ad_impressions?: number | null
          ad_spend?: number | null
          brand?: string
          created_at?: string | null
          date?: string
          gmv?: number | null
          id?: string
          orders?: number | null
          product_views?: number | null
          revenue?: number | null
          units_sold?: number | null
        }
        Relationships: []
      }
      targets: {
        Row: {
          brand: string
          created_at: string | null
          id: string
          month: number
          monthly_target: number | null
          weeks: Json | null
          year: number
        }
        Insert: {
          brand: string
          created_at?: string | null
          id?: string
          month: number
          monthly_target?: number | null
          weeks?: Json | null
          year: number
        }
        Update: {
          brand?: string
          created_at?: string | null
          id?: string
          month?: number
          monthly_target?: number | null
          weeks?: Json | null
          year?: number
        }
        Relationships: []
      }
      tasks: {
        Row: {
          brand: string
          created_at: string | null
          customer_name: string | null
          due_date: string | null
          id: string
          note: string | null
          phone: string | null
          segment: string | null
          status: string
        }
        Insert: {
          brand: string
          created_at?: string | null
          customer_name?: string | null
          due_date?: string | null
          id?: string
          note?: string | null
          phone?: string | null
          segment?: string | null
          status?: string
        }
        Update: {
          brand?: string
          created_at?: string | null
          customer_name?: string | null
          due_date?: string | null
          id?: string
          note?: string | null
          phone?: string | null
          segment?: string | null
          status?: string
        }
        Relationships: []
      }
      tiktok_organic: {
        Row: {
          brand: string
          comments: number | null
          created_at: string | null
          date: string
          followers: number | null
          id: string
          likes: number | null
          shares: number | null
          views: number | null
        }
        Insert: {
          brand: string
          comments?: number | null
          created_at?: string | null
          date: string
          followers?: number | null
          id?: string
          likes?: number | null
          shares?: number | null
          views?: number | null
        }
        Update: {
          brand?: string
          comments?: number | null
          created_at?: string | null
          date?: string
          followers?: number | null
          id?: string
          likes?: number | null
          shares?: number | null
          views?: number | null
        }
        Relationships: []
      }
      tiktok_shop: {
        Row: {
          ad_spent: number | null
          brand: string
          created_at: string | null
          date: string
          gmv: number | null
          id: string
          orders: number | null
          product_views: number | null
          revenue: number | null
          units_sold: number | null
        }
        Insert: {
          ad_spent?: number | null
          brand: string
          created_at?: string | null
          date: string
          gmv?: number | null
          id?: string
          orders?: number | null
          product_views?: number | null
          revenue?: number | null
          units_sold?: number | null
        }
        Update: {
          ad_spent?: number | null
          brand?: string
          created_at?: string | null
          date?: string
          gmv?: number | null
          id?: string
          orders?: number | null
          product_views?: number | null
          revenue?: number | null
          units_sold?: number | null
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          brand: string | null
          created_at: string | null
          full_name: string | null
          id: string
          role: string
        }
        Insert: {
          brand?: string | null
          created_at?: string | null
          full_name?: string | null
          id: string
          role?: string
        }
        Update: {
          brand?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          role?: string
        }
        Relationships: []
      }
    }
    Views: {
      user_profiles_with_email: {
        Row: {
          brand: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string | null
          role: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_update_user_profile: {
        Args: {
          new_brand: string
          new_full_name: string
          new_role: string
          target_id: string
        }
        Returns: {
          brand: string | null
          created_at: string | null
          full_name: string | null
          id: string
          role: string
        }
        SetofOptions: {
          from: "*"
          to: "user_profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_my_brand: { Args: never; Returns: string }
      get_my_role: { Args: never; Returns: string }
      is_super_or_admin: { Args: never; Returns: boolean }
      replace_brand_table: {
        Args: { p_brand: string; p_rows: Json; p_table: string }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
