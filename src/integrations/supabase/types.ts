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
      estimate_items: {
        Row: {
          description: string
          estimate_id: string | null
          id: string
          quantity: number | null
          total_price: number
          unit_price: number
        }
        Insert: {
          description: string
          estimate_id?: string | null
          id?: string
          quantity?: number | null
          total_price: number
          unit_price: number
        }
        Update: {
          description?: string
          estimate_id?: string | null
          id?: string
          quantity?: number | null
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "estimate_items_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
        ]
      }
      estimates: {
        Row: {
          amount: number
          created_at: string | null
          description: string | null
          flat_id: string | null
          id: string
          shared_link: string | null
          status: string | null
          tenant_id: string | null
          title: string
          valid_until: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          description?: string | null
          flat_id?: string | null
          id?: string
          shared_link?: string | null
          status?: string | null
          tenant_id?: string | null
          title: string
          valid_until?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          description?: string | null
          flat_id?: string | null
          id?: string
          shared_link?: string | null
          status?: string | null
          tenant_id?: string | null
          title?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "estimates_flat_id_fkey"
            columns: ["flat_id"]
            isOneToOne: false
            referencedRelation: "flat_expense_report"
            referencedColumns: ["flat_id"]
          },
          {
            foreignKeyName: "estimates_flat_id_fkey"
            columns: ["flat_id"]
            isOneToOne: false
            referencedRelation: "flats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          created_at: string
          date: string
          description: string | null
          flat_id: string | null
          id: string
          title: string
          category: string | null
          receipt_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          date: string
          description?: string | null
          flat_id?: string | null
          id?: string
          title: string
          category?: string | null
          receipt_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          date?: string
          description?: string | null
          flat_id?: string | null
          id?: string
          title?: string
          category?: string | null
          receipt_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_flat_id_fkey"
            columns: ["flat_id"]
            isOneToOne: false
            referencedRelation: "flats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "property_documents"
            referencedColumns: ["id"]
          }
        ]
      }
      flats: {
        Row: {
          address: string
          created_at: string
          id: string
          monthly_rent_target: number
          name: string
          description: string | null
          property_tags?: {
            id: string
            tag_name: string
          }[] | null
        }
        Insert: {
          address: string
          created_at?: string
          id?: string
          monthly_rent_target: number
          name: string
          description?: string | null
        }
        Update: {
          address?: string
          created_at?: string
          id?: string
          monthly_rent_target?: number
          name?: string
          description?: string | null
        }
        Relationships: []
      }
      furniture_items: {
        Row: {
          available_quantity: number
          condition: Database["public"]["Enums"]["furniture_condition"]
          created_at: string
          flat_id: string | null
          id: string
          name: string
          total_quantity: number
          unit_rent: number
        }
        Insert: {
          available_quantity?: number
          condition?: Database["public"]["Enums"]["furniture_condition"]
          created_at?: string
          flat_id?: string | null
          id?: string
          name: string
          total_quantity?: number
          unit_rent: number
        }
        Update: {
          available_quantity?: number
          condition?: Database["public"]["Enums"]["furniture_condition"]
          created_at?: string
          flat_id?: string | null
          id?: string
          name?: string
          total_quantity?: number
          unit_rent?: number
        }
        Relationships: [
          {
            foreignKeyName: "furniture_items_flat_id_fkey"
            columns: ["flat_id"]
            isOneToOne: false
            referencedRelation: "flat_expense_report"
            referencedColumns: ["flat_id"]
          },
          {
            foreignKeyName: "furniture_items_flat_id_fkey"
            columns: ["flat_id"]
            isOneToOne: false
            referencedRelation: "flats"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          link: string | null
          message: string
          read: boolean | null
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          link?: string | null
          message: string
          read?: boolean | null
          type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          link?: string | null
          message?: string
          read?: boolean | null
          type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      payment_links: {
        Row: {
          amount: number
          completed_at: string | null
          description: string | null
          expires_at: string | null
          generated_at: string | null
          id: string
          notes: string | null
          payment_link: string
          screenshot_url: string | null
          status: string | null
          tenant_id: string | null
        }
        Insert: {
          amount: number
          completed_at?: string | null
          description?: string | null
          expires_at?: string | null
          generated_at?: string | null
          id?: string
          notes?: string | null
          payment_link: string
          screenshot_url?: string | null
          status?: string | null
          tenant_id?: string | null
        }
        Update: {
          amount?: number
          completed_at?: string | null
          description?: string | null
          expires_at?: string | null
          generated_at?: string | null
          id?: string
          notes?: string | null
          payment_link?: string
          screenshot_url?: string | null
          status?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_links_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          created_at?: string
          id: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: []
      }
      property_documents: {
        Row: {
          document_type: string
          file_path: string
          flat_id: string | null
          id: string
          name: string
          tenant_id: string | null
          uploaded_at: string | null
        }
        Insert: {
          document_type: string
          file_path: string
          flat_id?: string | null
          id?: string
          name: string
          tenant_id?: string | null
          uploaded_at?: string | null
        }
        Update: {
          document_type?: string
          file_path?: string
          flat_id?: string | null
          id?: string
          name?: string
          tenant_id?: string | null
          uploaded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_documents_flat_id_fkey"
            columns: ["flat_id"]
            isOneToOne: false
            referencedRelation: "flat_expense_report"
            referencedColumns: ["flat_id"]
          },
          {
            foreignKeyName: "property_documents_flat_id_fkey"
            columns: ["flat_id"]
            isOneToOne: false
            referencedRelation: "flats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      property_photos: {
        Row: {
          description: string | null
          file_path: string
          flat_id: string | null
          id: string
          uploaded_at: string | null
        }
        Insert: {
          description?: string | null
          file_path: string
          flat_id?: string | null
          id?: string
          uploaded_at?: string | null
        }
        Update: {
          description?: string | null
          file_path?: string
          flat_id?: string | null
          id?: string
          uploaded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_photos_flat_id_fkey"
            columns: ["flat_id"]
            isOneToOne: false
            referencedRelation: "flat_expense_report"
            referencedColumns: ["flat_id"]
          },
          {
            foreignKeyName: "property_photos_flat_id_fkey"
            columns: ["flat_id"]
            isOneToOne: false
            referencedRelation: "flats"
            referencedColumns: ["id"]
          },
        ]
      }
      reminders: {
        Row: {
          assigned_to: string
          created_at: string | null
          description: string | null
          due_date: string
          id: string
          priority: string
          status: string
          tenant_id: string | null
          title: string
        }
        Insert: {
          assigned_to?: string
          created_at?: string | null
          description?: string | null
          due_date: string
          id?: string
          priority?: string
          status?: string
          tenant_id?: string | null
          title: string
        }
        Update: {
          assigned_to?: string
          created_at?: string | null
          description?: string | null
          due_date?: string
          id?: string
          priority?: string
          status?: string
          tenant_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      rents: {
        Row: {
          id: string;
          tenant_id: string;
          flat_id: string;
          amount: number;
          due_date: string;
          is_paid: boolean;
          paid_on: string | null;
          whatsapp_sent: boolean;
          custom_message: string | null;
          created_at: string;
          payment_frequency: 'one_time' | 'monthly' | null;
          reminder_day: number | null;
          last_reminder_date: string | null;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          flat_id: string;
          amount: number;
          due_date: string;
          is_paid?: boolean;
          paid_on?: string | null;
          whatsapp_sent?: boolean;
          custom_message?: string | null;
          created_at?: string;
          payment_frequency?: 'one_time' | 'monthly' | null;
          reminder_day?: number | null;
          last_reminder_date?: string | null;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          flat_id?: string;
          amount?: number;
          due_date?: string;
          is_paid?: boolean;
          paid_on?: string | null;
          whatsapp_sent?: boolean;
          custom_message?: string | null;
          created_at?: string;
          payment_frequency?: 'one_time' | 'monthly' | null;
          reminder_day?: number | null;
          last_reminder_date?: string | null;
        };
      }
      rent_reminders: {
        Row: {
          id: string;
          rent_id: string;
          tenant_id: string;
          next_reminder_date: string;
          reminder_day: number;
          is_active: boolean;
          amount: number;
          message_template: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          rent_id: string;
          tenant_id: string;
          next_reminder_date: string;
          reminder_day: number;
          is_active?: boolean;
          amount: number;
          message_template: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          rent_id?: string;
          tenant_id?: string;
          next_reminder_date?: string;
          reminder_day?: number;
          is_active?: boolean;
          amount?: number;
          message_template?: string;
          created_at?: string;
        };
      }
      tenant_furniture: {
        Row: {
          assigned_on: string
          assigned_quantity: number
          furniture_item_id: string
          id: string
          rent_part: number
          tenant_id: string
        }
        Insert: {
          assigned_on?: string
          assigned_quantity?: number
          furniture_item_id: string
          id?: string
          rent_part: number
          tenant_id: string
        }
        Update: {
          assigned_on?: string
          assigned_quantity?: number
          furniture_item_id?: string
          id?: string
          rent_part?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_furniture_furniture_item_id_fkey"
            columns: ["furniture_item_id"]
            isOneToOne: false
            referencedRelation: "furniture_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_furniture_furniture_item_id_fkey"
            columns: ["furniture_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_usage_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_furniture_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          documents: string[] | null
          email: string | null
          flat_id: string | null
          id: string
          is_active: boolean
          name: string
          owner_name: string | null
          phone: string
          start_date: string
          tenant_photo: string | null
        }
        Insert: {
          created_at?: string
          documents?: string[] | null
          email?: string | null
          flat_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          owner_name?: string | null
          phone: string
          start_date: string
          tenant_photo?: string | null
        }
        Update: {
          created_at?: string
          documents?: string[] | null
          email?: string | null
          flat_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          owner_name?: string | null
          phone?: string
          start_date?: string
          tenant_photo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenants_flat_id_fkey"
            columns: ["flat_id"]
            isOneToOne: false
            referencedRelation: "flat_expense_report"
            referencedColumns: ["flat_id"]
          },
          {
            foreignKeyName: "tenants_flat_id_fkey"
            columns: ["flat_id"]
            isOneToOne: false
            referencedRelation: "flats"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          id: string
          included_payment_link: boolean | null
          message: string
          recipient_phone: string
          sent_at: string | null
          tenant_id: string | null
          flat_id: string | null
          rent_id: string | null
          status: string | null
        }
        Insert: {
          id?: string
          included_payment_link?: boolean | null
          message: string
          recipient_phone: string
          sent_at?: string | null
          tenant_id?: string | null
          flat_id?: string | null
          rent_id?: string | null
          status?: string | null
        }
        Update: {
          id?: string
          included_payment_link?: boolean | null
          message?: string
          recipient_phone?: string
          sent_at?: string | null
          tenant_id?: string | null
          flat_id?: string | null
          rent_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_flat_id_fkey"
            columns: ["flat_id"]
            isOneToOne: false
            referencedRelation: "flats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_rent_id_fkey"
            columns: ["rent_id"]
            isOneToOne: false
            referencedRelation: "rents"
            referencedColumns: ["id"]
          }
        ]
      }
      maintenance_requests: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          status: string;
          priority: string;
          created_at: string;
          flat_id: string;
          tenant_id: string | null;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          status?: string;
          priority?: string;
          created_at?: string;
          flat_id: string;
          tenant_id?: string | null;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string | null;
          status?: string;
          priority?: string;
          created_at?: string;
          flat_id?: string;
          tenant_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "maintenance_requests_flat_id_fkey";
            columns: ["flat_id"];
            isOneToOne: false;
            referencedRelation: "flats";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "maintenance_requests_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          }
        ];
      }
    }
    Views: {
      flat_expense_report: {
        Row: {
          expense_count: number | null
          flat_id: string | null
          flat_name: string | null
          total_expenses: number | null
        }
        Relationships: []
      }
      inventory_usage_summary: {
        Row: {
          available_quantity: number | null
          id: string | null
          in_use_quantity: number | null
          name: string | null
          total_quantity: number | null
          usage_percentage: number | null
        }
        Insert: {
          available_quantity?: number | null
          id?: string | null
          in_use_quantity?: never
          name?: string | null
          total_quantity?: number | null
          usage_percentage?: never
        }
        Update: {
          available_quantity?: number | null
          id?: string | null
          in_use_quantity?: never
          name?: string | null
          total_quantity?: number | null
          usage_percentage?: never
        }
        Relationships: []
      }
      monthly_revenue_summary: {
        Row: {
          month: string | null
          total_payments: number | null
          total_revenue: number | null
        }
        Relationships: []
      }
      pending_rents_view: {
        Row: {
          amount: number | null
          days_overdue: number | null
          due_date: string | null
          flat_name: string | null
          id: string | null
          tenant_name: string | null
          tenant_phone: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      furniture_condition: "new" | "used" | "damaged"
      user_role: "admin" | "manager" | "viewer"
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
  public: {
    Enums: {
      furniture_condition: ["new", "used", "damaged"],
      user_role: ["admin", "manager", "viewer"],
    },
  },
} as const
