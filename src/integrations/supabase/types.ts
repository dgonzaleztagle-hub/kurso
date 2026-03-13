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
      activities: {
        Row: {
          activity_date: string | null
          amount: number
          can_redirect_to_fees: boolean
          created_at: string | null
          description: string | null
          id: string
          name: string
          tenant_id: string
        }
        Insert: {
          activity_date?: string | null
          amount: number
          can_redirect_to_fees?: boolean
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          tenant_id: string
        }
        Update: {
          activity_date?: string | null
          amount?: number
          can_redirect_to_fees?: boolean
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_donations: {
        Row: {
          amount: number
          cantidad_original: string | null
          created_at: string
          donated_at: string | null
          id: string
          name: string
          scheduled_activity_id: string
          student_id: string | null
          tenant_id: string
          unit: string
        }
        Insert: {
          amount?: number
          cantidad_original?: string | null
          created_at?: string
          donated_at?: string | null
          id?: string
          name: string
          scheduled_activity_id: string
          student_id?: string | null
          tenant_id: string
          unit?: string
        }
        Update: {
          amount?: number
          cantidad_original?: string | null
          created_at?: string
          donated_at?: string | null
          id?: string
          name?: string
          scheduled_activity_id?: string
          student_id?: string | null
          tenant_id?: string
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
          {
            foreignKeyName: "activity_donations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_exclusions: {
        Row: {
          activity_id: string | null
          created_at: string | null
          id: string
          reason: string | null
          student_id: string | null
          tenant_id: string
        }
        Insert: {
          activity_id?: string | null
          created_at?: string | null
          id?: string
          reason?: string | null
          student_id?: string | null
          tenant_id: string
        }
        Update: {
          activity_id?: string | null
          created_at?: string | null
          id?: string
          reason?: string | null
          student_id?: string | null
          tenant_id?: string
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
          {
            foreignKeyName: "activity_exclusions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_permissions: {
        Row: {
          can_create: boolean
          can_delete: boolean
          can_update: boolean
          can_view: boolean
          created_at: string
          id: string
          module: string
          updated_at: string
          user_id: string
        }
        Insert: {
          can_create?: boolean
          can_delete?: boolean
          can_update?: boolean
          can_view?: boolean
          created_at?: string
          id?: string
          module: string
          updated_at?: string
          user_id: string
        }
        Update: {
          can_create?: boolean
          can_delete?: boolean
          can_update?: boolean
          can_view?: boolean
          created_at?: string
          id?: string
          module?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      account_deletion_requests: {
        Row: {
          auth_user_id: string | null
          created_at: string
          deletion_mode: string
          email_before_deletion: string | null
          id: string
          metadata: Json
          notes: string | null
          processed_at: string | null
          role_before_deletion: string | null
          status: string
          tenant_id: string | null
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          deletion_mode?: string
          email_before_deletion?: string | null
          id?: string
          metadata?: Json
          notes?: string | null
          processed_at?: string | null
          role_before_deletion?: string | null
          status?: string
          tenant_id?: string | null
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          deletion_mode?: string
          email_before_deletion?: string | null
          id?: string
          metadata?: Json
          notes?: string | null
          processed_at?: string | null
          role_before_deletion?: string | null
          status?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "account_deletion_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      app_users: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          is_superadmin: boolean | null
          updated_at: string | null
          whatsapp_number: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          is_superadmin?: boolean | null
          updated_at?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          is_superadmin?: boolean | null
          updated_at?: string | null
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          id: string
          payload: Json | null
          record_id: string | null
          table_name: string | null
          tenant_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          payload?: Json | null
          record_id?: string | null
          table_name?: string | null
          tenant_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          payload?: Json | null
          record_id?: string | null
          table_name?: string | null
          tenant_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_applications: {
        Row: {
          amount: number
          applied_movement_id: string
          created_at: string
          created_by: string | null
          id: string
          reversal_reason: string | null
          reversed_amount: number
          reversed_at: string | null
          reversed_by: string | null
          source_credit_movement_id: string
          source_payment_id: string | null
          status: string
          student_id: string
          target_activity_id: string | null
          target_month: string | null
          target_type: string
          tenant_id: string
        }
        Insert: {
          amount: number
          applied_movement_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          reversal_reason?: string | null
          reversed_amount?: number
          reversed_at?: string | null
          reversed_by?: string | null
          source_credit_movement_id: string
          source_payment_id?: string | null
          status?: string
          student_id: string
          target_activity_id?: string | null
          target_month?: string | null
          target_type: string
          tenant_id: string
        }
        Update: {
          amount?: number
          applied_movement_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          reversal_reason?: string | null
          reversed_amount?: number
          reversed_at?: string | null
          reversed_by?: string | null
          source_credit_movement_id?: string
          source_payment_id?: string | null
          status?: string
          student_id?: string
          target_activity_id?: string | null
          target_month?: string | null
          target_type?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_applications_applied_movement_id_fkey"
            columns: ["applied_movement_id"]
            isOneToOne: false
            referencedRelation: "credit_movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_applications_source_credit_movement_id_fkey"
            columns: ["source_credit_movement_id"]
            isOneToOne: false
            referencedRelation: "credit_movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_applications_source_payment_id_fkey"
            columns: ["source_payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_applications_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_applications_target_activity_id_fkey"
            columns: ["target_activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_applications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_movements: {
        Row: {
          amount: number
          created_at: string | null
          created_by: string | null
          description: string | null
          details: Json
          id: string
          related_movement_id: string | null
          reversal_reason: string | null
          reversed_at: string | null
          reversed_by: string | null
          source_payment_id: string | null
          student_id: string | null
          target_activity_id: string | null
          target_month: string | null
          target_type: string | null
          tenant_id: string
          type: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          details?: Json
          id?: string
          related_movement_id?: string | null
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          source_payment_id?: string | null
          student_id?: string | null
          target_activity_id?: string | null
          target_month?: string | null
          target_type?: string | null
          tenant_id: string
          type: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          details?: Json
          id?: string
          related_movement_id?: string | null
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          source_payment_id?: string | null
          student_id?: string | null
          target_activity_id?: string | null
          target_month?: string | null
          target_type?: string | null
          tenant_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_movements_related_movement_id_fkey"
            columns: ["related_movement_id"]
            isOneToOne: false
            referencedRelation: "credit_movements"
            referencedColumns: ["id"]
          },
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
          {
            foreignKeyName: "credit_movements_target_activity_id_fkey"
            columns: ["target_activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_movements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_notifications: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          message: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          message: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          message?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_notifications_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dashboard_notifications_tenant_id_fkey"
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
          category: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          expense_date: string | null
          folio: string | null
          id: string
          supplier: string | null
          tenant_id: string
        }
        Insert: {
          amount: number
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          expense_date?: string | null
          folio?: string | null
          id?: string
          supplier?: string | null
          tenant_id: string
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          expense_date?: string | null
          folio?: string | null
          id?: string
          supplier?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      form_exclusions: {
        Row: {
          created_at: string
          created_by: string | null
          form_id: string
          id: string
          reason: string | null
          student_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          form_id: string
          id?: string
          reason?: string | null
          student_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          form_id?: string
          id?: string
          reason?: string | null
          student_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_exclusions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
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
          {
            foreignKeyName: "form_exclusions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      form_fields: {
        Row: {
          conditional_logic: Json | null
          created_at: string
          description: string | null
          field_type: string
          form_id: string
          id: string
          is_required: boolean
          label: string
          options: Json | null
          order_index: number
        }
        Insert: {
          conditional_logic?: Json | null
          created_at?: string
          description?: string | null
          field_type?: string
          form_id: string
          id?: string
          is_required?: boolean
          label: string
          options?: Json | null
          order_index?: number
        }
        Update: {
          conditional_logic?: Json | null
          created_at?: string
          description?: string | null
          field_type?: string
          form_id?: string
          id?: string
          is_required?: boolean
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
          responder_email: string | null
          responder_name: string | null
          response_data: Json
          responses: Json
          student_id: string | null
          submitted_at: string
          tenant_id: string
          user_id: string | null
        }
        Insert: {
          form_id: string
          id?: string
          responder_email?: string | null
          responder_name?: string | null
          response_data?: Json
          responses?: Json
          student_id?: string | null
          submitted_at?: string
          tenant_id: string
          user_id?: string | null
        }
        Update: {
          form_id?: string
          id?: string
          responder_email?: string | null
          responder_name?: string | null
          response_data?: Json
          responses?: Json
          student_id?: string | null
          submitted_at?: string
          tenant_id?: string
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
          {
            foreignKeyName: "form_responses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      forms: {
        Row: {
          allow_multiple_responses: boolean
          closes_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          is_public: boolean
          requires_login: boolean
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          allow_multiple_responses?: boolean
          closes_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_public?: boolean
          requires_login?: boolean
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          allow_multiple_responses?: boolean
          closes_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_public?: boolean
          requires_login?: boolean
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "forms_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forms_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_minutes: {
        Row: {
          content: string | null
          created_at: string
          created_by: string | null
          id: string
          image_url: string | null
          meeting_date: string
          status: string | null
          tenant_id: string
          title: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          image_url?: string | null
          meeting_date?: string
          status?: string | null
          tenant_id: string
          title?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          image_url?: string | null
          meeting_date?: string
          status?: string | null
          tenant_id?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_minutes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_minutes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
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
      support_requests: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string
          metadata: Json
          name: string
          request_type: string
          source: string
          status: string
          subject: string
          tenant_id: string | null
          tenant_name: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          message: string
          metadata?: Json
          name: string
          request_type?: string
          source?: string
          status?: string
          subject: string
          tenant_id?: string | null
          tenant_name?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string
          metadata?: Json
          name?: string
          request_type?: string
          source?: string
          status?: string
          subject?: string
          tenant_id?: string | null
          tenant_name?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_notifications: {
        Row: {
          amount: number | null
          bank: string | null
          created_at: string | null
          id: string
          payer_name: string | null
          payment_date: string | null
          payment_details: Json | null
          processed_at: string | null
          processed_by: string | null
          reference: string | null
          rejection_reason: string | null
          status: string | null
          student_id: string | null
          submitted_by: string | null
          tenant_id: string
          user_id: string | null
          voucher_url: string | null
        }
        Insert: {
          amount?: number | null
          bank?: string | null
          created_at?: string | null
          id?: string
          payer_name?: string | null
          payment_date?: string | null
          payment_details?: Json | null
          processed_at?: string | null
          processed_by?: string | null
          reference?: string | null
          rejection_reason?: string | null
          status?: string | null
          student_id?: string | null
          submitted_by?: string | null
          tenant_id: string
          user_id?: string | null
          voucher_url?: string | null
        }
        Update: {
          amount?: number | null
          bank?: string | null
          created_at?: string | null
          id?: string
          payer_name?: string | null
          payment_date?: string | null
          payment_details?: Json | null
          processed_at?: string | null
          processed_by?: string | null
          reference?: string | null
          rejection_reason?: string | null
          status?: string | null
          student_id?: string | null
          submitted_by?: string | null
          tenant_id?: string
          user_id?: string | null
          voucher_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_notifications_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_notifications_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_notifications_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_notifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          activity_id: string | null
          amount: number
          concept: string | null
          created_at: string | null
          folio: string | null
          id: string
          last_redirected_at: string | null
          last_redirected_by: string | null
          month_period: string | null
          payment_date: string | null
          payment_method: string | null
          redirect_locked: boolean
          redirect_notes: string | null
          redirect_status: string
          redirected_amount: number
          status: string | null
          student_id: string | null
          student_name: string | null
          tenant_id: string
        }
        Insert: {
          activity_id?: string | null
          amount: number
          concept?: string | null
          created_at?: string | null
          folio?: string | null
          id?: string
          last_redirected_at?: string | null
          last_redirected_by?: string | null
          month_period?: string | null
          payment_date?: string | null
          payment_method?: string | null
          redirect_locked?: boolean
          redirect_notes?: string | null
          redirect_status?: string
          redirected_amount?: number
          status?: string | null
          student_id?: string | null
          student_name?: string | null
          tenant_id: string
        }
        Update: {
          activity_id?: string | null
          amount?: number
          concept?: string | null
          created_at?: string | null
          folio?: string | null
          id?: string
          last_redirected_at?: string | null
          last_redirected_by?: string | null
          month_period?: string | null
          payment_date?: string | null
          payment_method?: string | null
          redirect_locked?: boolean
          redirect_notes?: string | null
          redirect_status?: string
          redirected_amount?: number
          status?: string | null
          student_id?: string | null
          student_name?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          author_id: string | null
          content: string
          created_at: string | null
          id: string
          image_url: string | null
          is_official: boolean | null
          is_pinned: boolean | null
          status: string | null
          tenant_id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          author_id?: string | null
          content: string
          created_at?: string | null
          id?: string
          image_url?: string | null
          is_official?: boolean | null
          is_pinned?: boolean | null
          status?: string | null
          tenant_id: string
          title: string
          updated_at?: string | null
        }
        Update: {
          author_id?: string | null
          content?: string
          created_at?: string | null
          id?: string
          image_url?: string | null
          is_official?: boolean | null
          is_pinned?: boolean | null
          status?: string | null
          tenant_id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "posts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      reimbursements: {
        Row: {
          account_info: Json | null
          amount: number
          attachments: Json | null
          created_at: string | null
          description: string | null
          expense_folio: number | null
          folio: string | null
          id: string
          payment_proof: Json | null
          processed_at: string | null
          processed_by: string | null
          rejection_reason: string | null
          requester_id: string | null
          status: string | null
          subject: string | null
          supplier_name: string | null
          tenant_id: string
          type: string | null
          user_id: string | null
          voucher_url: string | null
        }
        Insert: {
          account_info?: Json | null
          amount: number
          attachments?: Json | null
          created_at?: string | null
          description?: string | null
          expense_folio?: number | null
          folio?: string | null
          id?: string
          payment_proof?: Json | null
          processed_at?: string | null
          processed_by?: string | null
          rejection_reason?: string | null
          requester_id?: string | null
          status?: string | null
          subject?: string | null
          supplier_name?: string | null
          tenant_id: string
          type?: string | null
          user_id?: string | null
          voucher_url?: string | null
        }
        Update: {
          account_info?: Json | null
          amount?: number
          attachments?: Json | null
          created_at?: string | null
          description?: string | null
          expense_folio?: number | null
          folio?: string | null
          id?: string
          payment_proof?: Json | null
          processed_at?: string | null
          processed_by?: string | null
          rejection_reason?: string | null
          requester_id?: string | null
          status?: string | null
          subject?: string | null
          supplier_name?: string | null
          tenant_id?: string
          type?: string | null
          user_id?: string | null
          voucher_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reimbursements_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reimbursements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      saas_payment_logs: {
        Row: {
          amount: number | null
          applied_at: string | null
          created_at: string
          currency: string | null
          expected_amount: number | null
          external_reference: string | null
          id: string
          payer_email: string | null
          payment_id: string
          payment_method: string | null
          plan_code: string | null
          pricing_stage: string | null
          raw_data: Json
          requires_manual_review: boolean
          status: string
          status_detail: string | null
          tenant_id: string
          updated_at: string
          webhook_payload: Json | null
        }
        Insert: {
          amount?: number | null
          applied_at?: string | null
          created_at?: string
          currency?: string | null
          expected_amount?: number | null
          external_reference?: string | null
          id?: string
          payer_email?: string | null
          payment_id: string
          payment_method?: string | null
          plan_code?: string | null
          pricing_stage?: string | null
          raw_data?: Json
          requires_manual_review?: boolean
          status: string
          status_detail?: string | null
          tenant_id: string
          updated_at?: string
          webhook_payload?: Json | null
        }
        Update: {
          amount?: number | null
          applied_at?: string | null
          created_at?: string
          currency?: string | null
          expected_amount?: number | null
          external_reference?: string | null
          id?: string
          payer_email?: string | null
          payment_id?: string
          payment_method?: string | null
          plan_code?: string | null
          pricing_stage?: string | null
          raw_data?: Json
          requires_manual_review?: boolean
          status?: string
          status_detail?: string | null
          tenant_id?: string
          updated_at?: string
          webhook_payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "saas_payment_logs_plan_code_fkey"
            columns: ["plan_code"]
            isOneToOne: false
            referencedRelation: "saas_plans"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "saas_payment_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      saas_plans: {
        Row: {
          amount: number
          billing_days: number
          code: string
          created_at: string
          currency: string
          description: string | null
          is_active: boolean
          name: string
        }
        Insert: {
          amount: number
          billing_days?: number
          code: string
          created_at?: string
          currency?: string
          description?: string | null
          is_active?: boolean
          name: string
        }
        Update: {
          amount?: number
          billing_days?: number
          code?: string
          created_at?: string
          currency?: string
          description?: string | null
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      scheduled_activities: {
        Row: {
          amount: number
          completed: boolean
          created_at: string
          id: string
          is_with_donations: boolean
          name: string
          scheduled_date: string
          tenant_id: string
        }
        Insert: {
          amount?: number
          completed?: boolean
          created_at?: string
          id?: string
          is_with_donations?: boolean
          name: string
          scheduled_date?: string
          tenant_id: string
        }
        Update: {
          amount?: number
          completed?: boolean
          created_at?: string
          id?: string
          is_with_donations?: boolean
          name?: string
          scheduled_date?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_activities_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_activity_exclusions: {
        Row: {
          created_at: string
          id: string
          reason: string | null
          scheduled_activity_id: string
          student_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason?: string | null
          scheduled_activity_id: string
          student_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string | null
          scheduled_activity_id?: string
          student_id?: string
          tenant_id?: string
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
          {
            foreignKeyName: "scheduled_activity_exclusions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      student_credits: {
        Row: {
          amount: number
          id: string
          student_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount?: number
          id?: string
          student_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          id?: string
          student_id?: string
          tenant_id?: string
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
          {
            foreignKeyName: "student_credits_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      student_guardians: {
        Row: {
          created_at: string | null
          guardian_id: string | null
          id: string
          is_prymary: boolean | null
          relationship: string | null
          student_id: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string | null
          guardian_id?: string | null
          id?: string
          is_prymary?: boolean | null
          relationship?: string | null
          student_id?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string | null
          guardian_id?: string | null
          id?: string
          is_prymary?: boolean | null
          relationship?: string | null
          student_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_guardians_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_guardians_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_guardians_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          birth_date: string | null
          created_at: string | null
          enrollment_date: string
          first_name: string
          id: string
          is_active: boolean | null
          last_name: string
          rut: string | null
          tenant_id: string
        }
        Insert: {
          birth_date?: string | null
          created_at?: string | null
          enrollment_date?: string
          first_name: string
          id?: string
          is_active?: boolean | null
          last_name: string
          rut?: string | null
          tenant_id: string
        }
        Update: {
          birth_date?: string | null
          created_at?: string | null
          enrollment_date?: string
          first_name?: string
          id?: string
          is_active?: boolean | null
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
          },
        ]
      }
      tenant_folio_counters: {
        Row: {
          created_at: string
          next_value: number
          scope: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          next_value?: number
          scope: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          next_value?: number
          scope?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_folio_counters_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
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
          },
        ]
      }
      tenant_opening_balances: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          effective_date: string
          folio: number
          id: string
          notes: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          effective_date?: string
          folio: number
          id?: string
          notes?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          effective_date?: string
          folio?: number
          id?: string
          notes?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_opening_balances_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_opening_balances_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          billing_plan_code: string | null
          created_at: string | null
          fiscal_year: number | null
          id: string
          last_saas_payment_at: string | null
          name: string
          next_tenant_id: string | null
          organization_id: string | null
          owner_id: string | null
          previous_tenant_id: string | null
          saas_paid_cycle_count: number
          settings: Json | null
          slug: string | null
          status: string | null
          subscription_status:
            | Database["public"]["Enums"]["subscription_status"]
            | null
          trial_ends_at: string | null
          updated_at: string | null
          valid_until: string | null
        }
        Insert: {
          billing_plan_code?: string | null
          created_at?: string | null
          fiscal_year?: number | null
          id?: string
          last_saas_payment_at?: string | null
          name: string
          next_tenant_id?: string | null
          organization_id?: string | null
          owner_id?: string | null
          previous_tenant_id?: string | null
          saas_paid_cycle_count?: number
          settings?: Json | null
          slug?: string | null
          status?: string | null
          subscription_status?:
            | Database["public"]["Enums"]["subscription_status"]
            | null
          trial_ends_at?: string | null
          updated_at?: string | null
          valid_until?: string | null
        }
        Update: {
          billing_plan_code?: string | null
          created_at?: string | null
          fiscal_year?: number | null
          id?: string
          last_saas_payment_at?: string | null
          name?: string
          next_tenant_id?: string | null
          organization_id?: string | null
          owner_id?: string | null
          previous_tenant_id?: string | null
          saas_paid_cycle_count?: number
          settings?: Json | null
          slug?: string | null
          status?: string | null
          subscription_status?:
            | Database["public"]["Enums"]["subscription_status"]
            | null
          trial_ends_at?: string | null
          updated_at?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenants_billing_plan_code_fkey"
            columns: ["billing_plan_code"]
            isOneToOne: false
            referencedRelation: "saas_plans"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "tenants_next_tenant_id_fkey"
            columns: ["next_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
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
          },
          {
            foreignKeyName: "tenants_previous_tenant_id_fkey"
            columns: ["previous_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_students: {
        Row: {
          created_at: string | null
          display_name: string | null
          id: string
          student_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          display_name?: string | null
          id?: string
          student_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          display_name?: string | null
          id?: string
          student_id?: string
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
          {
            foreignKeyName: "user_students_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_credit_manually: {
        Args: {
          p_amount?: number
          p_notes?: string
          p_student_id: string
          p_target_activity_id?: string
          p_target_month?: string
          p_target_type: string
        }
        Returns: string
      }
      apply_saas_payment_log: {
        Args: { target_payment_id: string }
        Returns: {
          applied: boolean
          paid_cycle_count: number
          valid_until: string
        }[]
      }
      approve_payment_notification_transaction: {
        Args: {
          payment_entries: Json
          target_notification_id: string
          target_processed_by: string
        }
        Returns: {
          inserted_payment_ids: number[]
          notification_id: string
        }[]
      }
      approve_reimbursement_transaction: {
        Args: {
          payment_proof_files?: Json
          target_processed_by: string
          target_reimbursement_id: string
        }
        Returns: {
          expense_folio: number
          reimbursement_id: string
        }[]
      }
      archive_tenant: { Args: { target_tenant_id: string }; Returns: undefined }
      auth_is_superadmin: { Args: never; Returns: boolean }
      auth_owns_tenant: { Args: { target_tenant_id: string }; Returns: boolean }
      bump_tenant_folio_counter: {
        Args: {
          requested_count?: number
          target_scope: string
          target_tenant_id: string
        }
        Returns: number
      }
      can_manage_credit: {
        Args: { target_tenant_id: string }
        Returns: boolean
      }
      check_is_superadmin: { Args: never; Returns: boolean }
      create_auth_user_from_rut: {
        Args: { p_first_name: string; p_last_name: string; p_rut: string }
        Returns: string
      }
      create_db_user: {
        Args: { p_email: string; p_metadata: Json; p_password: string }
        Returns: string
      }
      create_own_tenant:
        | {
            Args: { new_institution_name: string; new_tenant_name: string }
            Returns: {
              billing_plan_code: string | null
              created_at: string | null
              fiscal_year: number | null
              id: string
              last_saas_payment_at: string | null
              name: string
              next_tenant_id: string | null
              organization_id: string | null
              owner_id: string | null
              previous_tenant_id: string | null
              saas_paid_cycle_count: number
              settings: Json | null
              slug: string | null
              status: string | null
              subscription_status:
                | Database["public"]["Enums"]["subscription_status"]
                | null
              trial_ends_at: string | null
              updated_at: string | null
              valid_until: string | null
            }
            SetofOptions: {
              from: "*"
              to: "tenants"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: { new_tenant_name: string }
            Returns: {
              billing_plan_code: string | null
              created_at: string | null
              fiscal_year: number | null
              id: string
              last_saas_payment_at: string | null
              name: string
              next_tenant_id: string | null
              organization_id: string | null
              owner_id: string | null
              previous_tenant_id: string | null
              saas_paid_cycle_count: number
              settings: Json | null
              slug: string | null
              status: string | null
              subscription_status:
                | Database["public"]["Enums"]["subscription_status"]
                | null
              trial_ends_at: string | null
              updated_at: string | null
              valid_until: string | null
            }
            SetofOptions: {
              from: "*"
              to: "tenants"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      delete_reimbursement_transaction: {
        Args: { target_processed_by: string; target_reimbursement_id: string }
        Returns: string
      }
      ensure_student_account: { Args: { p_student_id: number }; Returns: Json }
      generate_missing_accounts: {
        Args: { p_tenant_id: string }
        Returns: Json
      }
      get_next_expense_folio: { Args: never; Returns: string }
      get_next_expense_folio_for_tenant: {
        Args: { target_tenant_id: string }
        Returns: number
      }
      get_next_payment_folio: { Args: never; Returns: string }
      get_next_payment_folio_for_tenant: {
        Args: { target_tenant_id: string }
        Returns: number
      }
      get_next_reimbursement_folio: { Args: never; Returns: string }
      get_next_reimbursement_folio_for_tenant: {
        Args: { target_tenant_id: string }
        Returns: number
      }
      get_platform_clients: {
        Args: never
        Returns: {
          created_at: string
          organization_name: string
          owner_email: string
          status: string
          subscription_status: Database["public"]["Enums"]["subscription_status"]
          tenant_id: string
          tenant_name: string
          valid_until: string
        }[]
      }
      get_users_by_tenant: {
        Args: { target_tenant_id: string }
        Returns: {
          email: string
          full_name: string
          role: Database["public"]["Enums"]["app_role"]
          status: string
          user_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      mark_first_login_completed: { Args: never; Returns: undefined }
      migrate_course_year: {
        Args: {
          new_fiscal_year: number
          new_tenant_name: string
          source_tenant_id: string
        }
        Returns: {
          billing_plan_code: string | null
          created_at: string | null
          fiscal_year: number | null
          id: string
          last_saas_payment_at: string | null
          name: string
          next_tenant_id: string | null
          organization_id: string | null
          owner_id: string | null
          previous_tenant_id: string | null
          saas_paid_cycle_count: number
          settings: Json | null
          slug: string | null
          status: string | null
          subscription_status:
            | Database["public"]["Enums"]["subscription_status"]
            | null
          trial_ends_at: string | null
          updated_at: string | null
          valid_until: string | null
        }
        SetofOptions: {
          from: "*"
          to: "tenants"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      recompute_student_credit_balance: {
        Args: { p_student_id: string; p_tenant_id: string }
        Returns: number
      }
      redirect_payment_to_credit: {
        Args: { p_amount: number; p_notes?: string; p_payment_id: string }
        Returns: string
      }
      reject_payment_notification_transaction: {
        Args: {
          target_notification_id: string
          target_processed_by: string
          target_rejection_reason: string
        }
        Returns: string
      }
      reject_reimbursement_transaction: {
        Args: {
          target_processed_by: string
          target_reimbursement_id: string
          target_rejection_reason: string
        }
        Returns: string
      }
      reopen_reimbursement_transaction: {
        Args: { target_processed_by: string; target_reimbursement_id: string }
        Returns: string
      }
      reserve_payment_folios_for_tenant: {
        Args: { requested_count?: number; target_tenant_id: string }
        Returns: number
      }
      reverse_credit_movement: {
        Args: { p_amount: number; p_movement_id: string; p_reason?: string }
        Returns: string
      }
      rls_is_superadmin: { Args: { _uid: string }; Returns: boolean }
      rls_is_tenant_member: {
        Args: { _tenant_id: string; _uid: string }
        Returns: boolean
      }
      rls_is_tenant_owner: {
        Args: { _tenant_id: string; _uid: string }
        Returns: boolean
      }
      student_auth_email_from_rut: { Args: { p_rut: string }; Returns: string }
      student_auth_initial_password_from_rut: {
        Args: { p_rut: string }
        Returns: string
      }
    }
    Enums: {
      app_role: "owner" | "admin" | "member" | "student" | "master" | "alumnos"
      plan_type: "basic" | "institutional"
      subscription_status: "trial" | "active" | "past_due" | "canceled"
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
      app_role: ["owner", "admin", "member", "student", "master", "alumnos"],
      plan_type: ["basic", "institutional"],
      subscription_status: ["trial", "active", "past_due", "canceled"],
    },
  },
} as const
