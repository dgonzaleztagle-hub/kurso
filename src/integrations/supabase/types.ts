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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {

      app_users: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          is_superadmin: boolean | null
          whatsapp_number: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          is_superadmin?: boolean | null
          whatsapp_number: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          is_superadmin?: boolean | null
          whatsapp_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_users_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      tenants: {
        Row: {
          created_at: string | null
          id: string
          name: string
          organization_id: string | null
          owner_id: string | null
          settings: Json | null
          slug: string | null
          subscription_status: Database["public"]["Enums"]["subscription_status"] | null
          trial_ends_at: string | null
          updated_at: string | null
          valid_until: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          organization_id?: string | null
          owner_id?: string | null
          settings?: Json | null
          slug?: string | null
          subscription_status?: Database["public"]["Enums"]["subscription_status"] | null
          trial_ends_at?: string | null
          updated_at?: string | null
          valid_until?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          organization_id?: string | null
          owner_id?: string | null
          settings?: Json | null
          slug?: string | null
          subscription_status?: Database["public"]["Enums"]["subscription_status"] | null
          trial_ends_at?: string | null
          updated_at?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenants_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenants_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          }
        ]
      }
      tenant_members: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"] | null
          status: string | null
          tenant_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"] | null
          status?: string | null
          tenant_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"] | null
          status?: string | null
          tenant_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          }
        ]
      }
      organizations: {
        Row: {
          created_at: string | null
          director_contact: string | null
          id: string
          name: string
          plan_type: Database["public"]["Enums"]["plan_type"] | null
          valid_until: string | null
        }
        Insert: {
          created_at?: string | null
          director_contact?: string | null
          id?: string
          name: string
          plan_type?: Database["public"]["Enums"]["plan_type"] | null
          valid_until?: string | null
        }
        Update: {
          created_at?: string | null
          director_contact?: string | null
          id?: string
          name?: string
          plan_type?: Database["public"]["Enums"]["plan_type"] | null
          valid_until?: string | null
        }
        Relationships: []
      }
      activities: {
        Row: {
          activity_date: string | null
          amount: number
          can_redirect_to_fees: boolean
          created_at: string
          id: number
          name: string
        }
        Insert: {
          activity_date?: string | null
          amount: number
          can_redirect_to_fees?: boolean
          created_at?: string
          id?: never
          name: string
        }
        Update: {
          activity_date?: string | null
          amount?: number
          can_redirect_to_fees?: boolean
          created_at?: string
          id?: never
          name?: string
        }
        Relationships: []
      }
      activity_donations: {
        Row: {
          amount: string
          cantidad_original: string | null
          created_at: string
          donated_at: string | null
          id: string
          name: string
          scheduled_activity_id: string
          student_id: number | null
          unit: string
        }
        Insert: {
          amount?: string
          cantidad_original?: string | null
          created_at?: string
          donated_at?: string | null
          id?: string
          name?: string
          scheduled_activity_id: string
          student_id?: number | null
          unit?: string
        }
        Update: {
          amount?: string
          cantidad_original?: string | null
          created_at?: string
          donated_at?: string | null
          id?: string
          name?: string
          scheduled_activity_id?: string
          student_id?: number | null
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_donations_scheduled_activity_id_fkey"
            columns: ["scheduled_activity_id"]
            isOneToOne: false
            referencedRelation: "scheduled_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_donations_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_exclusions: {
        Row: {
          activity_id: number
          created_at: string
          id: number
          student_id: number
        }
        Insert: {
          activity_id: number
          created_at?: string
          id?: never
          student_id: number
        }
        Update: {
          activity_id?: number
          created_at?: string
          id?: never
          student_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "activity_exclusions_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_exclusions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_permissions: {
        Row: {
          created_at: string | null
          id: string
          module: Database["public"]["Enums"]["app_module"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          module: Database["public"]["Enums"]["app_module"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          module?: Database["public"]["Enums"]["app_module"]
          user_id?: string
        }
        Relationships: []
      }
      credit_movements: {
        Row: {
          amount: number
          created_at: string
          created_by: string
          description: string
          details: Json | null
          id: string
          source_payment_id: number | null
          student_id: number
          type: Database["public"]["Enums"]["credit_movement_type"]
        }
        Insert: {
          amount: number
          created_at?: string
          created_by: string
          description: string
          details?: Json | null
          id?: string
          source_payment_id?: number | null
          student_id: number
          type: Database["public"]["Enums"]["credit_movement_type"]
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string
          description?: string
          details?: Json | null
          id?: string
          source_payment_id?: number | null
          student_id?: number
          type?: Database["public"]["Enums"]["credit_movement_type"]
        }
        Relationships: [
          {
            foreignKeyName: "credit_movements_source_payment_id_fkey"
            columns: ["source_payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_movements_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_notifications: {
        Row: {
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          message: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          message: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          message?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          concept: string
          created_at: string
          created_by: string | null
          expense_date: string
          folio: number
          id: number
          supplier: string
        }
        Insert: {
          amount: number
          concept: string
          created_at?: string
          created_by?: string | null
          expense_date: string
          folio: number
          id?: number
          supplier: string
        }
        Update: {
          amount?: number
          concept?: string
          created_at?: string
          created_by?: string | null
          expense_date?: string
          folio?: number
          id?: number
          supplier?: string
        }
        Relationships: []
      }
      form_exclusions: {
        Row: {
          created_at: string
          created_by: string | null
          form_id: string
          id: string
          reason: string | null
          student_id: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          form_id: string
          id?: string
          reason?: string | null
          student_id: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          form_id?: string
          id?: string
          reason?: string | null
          student_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "form_exclusions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_exclusions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      form_fields: {
        Row: {
          conditional_logic: Json | null
          created_at: string | null
          description: string | null
          field_type: string
          form_id: string
          id: string
          is_required: boolean | null
          label: string
          options: Json | null
          order_index: number
        }
        Insert: {
          conditional_logic?: Json | null
          created_at?: string | null
          description?: string | null
          field_type: string
          form_id: string
          id?: string
          is_required?: boolean | null
          label: string
          options?: Json | null
          order_index: number
        }
        Update: {
          conditional_logic?: Json | null
          created_at?: string | null
          description?: string | null
          field_type?: string
          form_id?: string
          id?: string
          is_required?: boolean | null
          label?: string
          options?: Json | null
          order_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "form_fields_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
        ]
      }
      form_responses: {
        Row: {
          form_id: string
          id: string
          response_data: Json
          student_id: number | null
          submitted_at: string | null
          user_id: string | null
        }
        Insert: {
          form_id: string
          id?: string
          response_data?: Json
          student_id?: number | null
          submitted_at?: string | null
          user_id?: string | null
        }
        Update: {
          form_id?: string
          id?: string
          response_data?: Json
          student_id?: number | null
          submitted_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "form_responses_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_responses_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      forms: {
        Row: {
          allow_multiple_responses: boolean | null
          closes_at: string | null
          created_at: string | null
          created_by: string
          description: string | null
          id: string
          is_active: boolean | null
          is_public: boolean | null
          requires_login: boolean | null
          title: string
          updated_at: string | null
        }
        Insert: {
          allow_multiple_responses?: boolean | null
          closes_at?: string | null
          created_at?: string | null
          created_by: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_public?: boolean | null
          requires_login?: boolean | null
          title: string
          updated_at?: string | null
        }
        Update: {
          allow_multiple_responses?: boolean | null
          closes_at?: string | null
          created_at?: string | null
          created_by?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_public?: boolean | null
          requires_login?: boolean | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      payment_notifications: {
        Row: {
          amount: number
          bank: string
          created_at: string
          id: string
          payer_name: string
          payment_date: string
          payment_details: Json
          processed_at: string | null
          processed_by: string | null
          reference: string | null
          rejection_reason: string | null
          status: string
          student_id: number
          user_id: string
        }
        Insert: {
          amount: number
          bank: string
          created_at?: string
          id?: string
          payer_name: string
          payment_date: string
          payment_details?: Json
          processed_at?: string | null
          processed_by?: string | null
          reference?: string | null
          rejection_reason?: string | null
          status?: string
          student_id: number
          user_id: string
        }
        Update: {
          amount?: number
          bank?: string
          created_at?: string
          id?: string
          payer_name?: string
          payment_date?: string
          payment_details?: Json
          processed_at?: string | null
          processed_by?: string | null
          reference?: string | null
          rejection_reason?: string | null
          status?: string
          student_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_notifications_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          activity_id: number | null
          amount: number
          concept: string
          created_at: string
          created_by: string | null
          credit_applied: number | null
          folio: number
          id: number
          month_period: string | null
          payment_date: string
          redirected_from_payment_id: number | null
          student_id: number | null
          student_name: string | null
        }
        Insert: {
          activity_id?: number | null
          amount: number
          concept: string
          created_at?: string
          created_by?: string | null
          credit_applied?: number | null
          folio: number
          id?: number
          month_period?: string | null
          payment_date: string
          redirected_from_payment_id?: number | null
          student_id?: number | null
          student_name?: string | null
        }
        Update: {
          activity_id?: number | null
          amount?: number
          concept?: string
          created_at?: string
          created_by?: string | null
          credit_applied?: number | null
          folio?: number
          id?: number
          month_period?: string | null
          payment_date?: string
          redirected_from_payment_id?: number | null
          student_id?: number | null
          student_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_redirected_from_payment_id_fkey"
            columns: ["redirected_from_payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      reimbursements: {
        Row: {
          account_info: Json
          amount: number
          attachments: Json
          created_at: string
          expense_folio: number | null
          folio: number | null
          id: string
          payment_proof: Json | null
          processed_at: string | null
          processed_by: string | null
          rejection_reason: string | null
          status: Database["public"]["Enums"]["reimbursement_status"]
          subject: string
          supplier_name: string | null
          type: Database["public"]["Enums"]["reimbursement_type"]
          user_id: string
        }
        Insert: {
          account_info?: Json
          amount: number
          attachments?: Json
          created_at?: string
          expense_folio?: number | null
          folio?: number | null
          id?: string
          payment_proof?: Json | null
          processed_at?: string | null
          processed_by?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["reimbursement_status"]
          subject: string
          supplier_name?: string | null
          type?: Database["public"]["Enums"]["reimbursement_type"]
          user_id: string
        }
        Update: {
          account_info?: Json
          amount?: number
          attachments?: Json
          created_at?: string
          expense_folio?: number | null
          folio?: number | null
          id?: string
          payment_proof?: Json | null
          processed_at?: string | null
          processed_by?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["reimbursement_status"]
          subject?: string
          supplier_name?: string | null
          type?: Database["public"]["Enums"]["reimbursement_type"]
          user_id?: string
        }
        Relationships: []
      }
      scheduled_activities: {
        Row: {
          activity_id: number | null
          completed: boolean
          created_at: string
          created_by: string | null
          fee_amount: number | null
          id: string
          is_with_donations: boolean
          is_with_fee: boolean
          name: string
          requires_management: boolean
          scheduled_date: string
        }
        Insert: {
          activity_id?: number | null
          completed?: boolean
          created_at?: string
          created_by?: string | null
          fee_amount?: number | null
          id?: string
          is_with_donations?: boolean
          is_with_fee?: boolean
          name: string
          requires_management?: boolean
          scheduled_date: string
        }
        Update: {
          activity_id?: number | null
          completed?: boolean
          created_at?: string
          created_by?: string | null
          fee_amount?: number | null
          id?: string
          is_with_donations?: boolean
          is_with_fee?: boolean
          name?: string
          requires_management?: boolean
          scheduled_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_activities_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_activity_exclusions: {
        Row: {
          created_at: string
          id: number
          scheduled_activity_id: string
          student_id: number
        }
        Insert: {
          created_at?: string
          id?: number
          scheduled_activity_id: string
          student_id: number
        }
        Update: {
          created_at?: string
          id?: number
          scheduled_activity_id?: string
          student_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_activity_exclusions_scheduled_activity_id_fkey"
            columns: ["scheduled_activity_id"]
            isOneToOne: false
            referencedRelation: "scheduled_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_activity_exclusions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_credits: {
        Row: {
          amount: number
          created_at: string
          id: string
          student_id: number
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          student_id: number
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          student_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_credits_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          created_at: string
          enrollment_date: string
          id: number
          first_name: string
          last_name: string
          rut: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          enrollment_date?: string
          id?: number
          first_name: string
          last_name: string
          rut?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          enrollment_date?: string
          id?: number
          first_name?: string
          last_name?: string
          rut?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          }
        ]
      }
      twilio_accounts: {
        Row: {
          account_name: string
          account_sid: string
          auth_token: string
          created_at: string
          id: string
          is_active: boolean
          phone_number: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_name: string
          account_sid: string
          auth_token: string
          created_at?: string
          id?: string
          is_active?: boolean
          phone_number: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_name?: string
          account_sid?: string
          auth_token?: string
          created_at?: string
          id?: string
          is_active?: boolean
          phone_number?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          first_login: boolean | null
          id: string
          phone: string | null
          position: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
          user_name: string | null
        }
        Insert: {
          created_at?: string | null
          first_login?: boolean | null
          id?: string
          phone?: string | null
          position?: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
          user_name?: string | null
        }
        Update: {
          created_at?: string | null
          first_login?: boolean | null
          id?: string
          phone?: string | null
          position?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
          user_name?: string | null
        }
        Relationships: []
      }
      user_students: {
        Row: {
          created_at: string | null
          display_name: string | null
          id: string
          student_id: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          display_name?: string | null
          id?: string
          student_id: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          display_name?: string | null
          id?: string
          student_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_own_tenant: {
        Args: {
          new_tenant_name: string
          new_institution_name?: string | null
        }
        Returns: Json
      }
      admin_has_permission: {
        Args: {
          _module: Database["public"]["Enums"]["app_module"]
          _user_id: string
        }
        Returns: boolean
      }
      get_next_expense_folio: { Args: never; Returns: number }
      get_next_payment_folio: { Args: never; Returns: number }
      get_next_reimbursement_folio: { Args: never; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_module:
      | "dashboard"
      | "students"
      | "income"
      | "expenses"
      | "debt_reports"
      | "payment_reports"
      | "balance"
      | "import"
      | "movements"
      | "activities"
      | "activity_exclusions"
      | "activity_payments"
      | "monthly_fees"
      | "payment_notifications"
      | "reimbursements"
      | "scheduled_activities"
      | "student_profile"
      | "credit_management"
      | "credit_movements"
      app_role: "owner" | "master" | "admin" | "member" | "student" | "alumnos"
      plan_type: "basic" | "institutional"
      subscription_status: "trial" | "active" | "past_due" | "canceled"
      credit_movement_type:
      | "payment_redirect"
      | "activity_refund"
      | "payment_deduction"
      | "manual_adjustment"
      reimbursement_status: "pending" | "approved" | "rejected"
      reimbursement_type: "reimbursement" | "supplier_payment"
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
      app_module: [
        "dashboard",
        "students",
        "income",
        "expenses",
        "debt_reports",
        "payment_reports",
        "balance",
        "import",
        "movements",
        "activities",
        "activity_exclusions",
        "activity_payments",
        "monthly_fees",
        "payment_notifications",
        "reimbursements",
        "scheduled_activities",
        "student_profile",
        "credit_management",
        "credit_movements",
      ],
      app_role: ["owner", "master", "admin", "member", "student", "alumnos"],
      plan_type: ["basic", "institutional"],
      subscription_status: ["trial", "active", "past_due", "canceled"],
      credit_movement_type: [
        "payment_redirect",
        "activity_refund",
        "payment_deduction",
        "manual_adjustment",
      ],
      reimbursement_status: ["pending", "approved", "rejected"],
      reimbursement_type: ["reimbursement", "supplier_payment"],
    },
  },
} as const
