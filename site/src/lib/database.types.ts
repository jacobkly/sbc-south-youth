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
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
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
      activity_log: {
        Row: {
          action: string
          actor_id: string | null
          changes: Json | null
          created_at: string
          entity_id: string | null
          entity_name: string | null
          entity_type: string
          id: string
          scope: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          changes?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_name?: string | null
          entity_type: string
          id?: string
          scope: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          changes?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_name?: string | null
          entity_type?: string
          id?: string
          scope?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          allow_external_approval: boolean
          id: number
          late_submission_days: number
          updated_at: string
        }
        Insert: {
          allow_external_approval?: boolean
          id?: number
          late_submission_days?: number
          updated_at?: string
        }
        Update: {
          allow_external_approval?: boolean
          id?: number
          late_submission_days?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_log: {
        Row: {
          attempts: number
          counts_toward_quota: boolean
          created_at: string
          env: string
          error: string | null
          id: string
          priority: number
          related_id: string | null
          related_type: string | null
          resend_id: string | null
          scope: string
          sent_at: string | null
          status: Database["public"]["Enums"]["email_status"]
          subject: string | null
          template: string
          to_address: string | null
          updated_at: string
        }
        Insert: {
          attempts?: number
          counts_toward_quota?: never
          created_at?: string
          env?: string
          error?: string | null
          id?: string
          priority: number
          related_id?: string | null
          related_type?: string | null
          resend_id?: string | null
          scope: string
          sent_at?: string | null
          status: Database["public"]["Enums"]["email_status"]
          subject?: string | null
          template: string
          to_address?: string | null
          updated_at?: string
        }
        Update: {
          attempts?: number
          counts_toward_quota?: never
          created_at?: string
          env?: string
          error?: string | null
          id?: string
          priority?: number
          related_id?: string | null
          related_type?: string | null
          resend_id?: string | null
          scope?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["email_status"]
          subject?: string | null
          template?: string
          to_address?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      email_suppressions: {
        Row: {
          address: string
          created_at: string
          email_log_id: string | null
          id: string
          reason: string
        }
        Insert: {
          address: string
          created_at?: string
          email_log_id?: string | null
          id?: string
          reason: string
        }
        Update: {
          address?: string
          created_at?: string
          email_log_id?: string | null
          id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_suppressions_email_log_id_fkey"
            columns: ["email_log_id"]
            isOneToOne: false
            referencedRelation: "email_log"
            referencedColumns: ["id"]
          },
        ]
      }
      invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          invited_by: string | null
          last_sent_at: string
          roles: Database["public"]["Enums"]["app_role"][]
          sent_count: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          invited_by?: string | null
          last_sent_at?: string
          roles: Database["public"]["Enums"]["app_role"][]
          sent_count?: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          invited_by?: string | null
          last_sent_at?: string
          roles?: Database["public"]["Enums"]["app_role"][]
          sent_count?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      payees: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          linked_at: string | null
          linked_by: string | null
          notes: string | null
          payment_handle: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          is_active?: boolean
          linked_at?: string | null
          linked_by?: string | null
          notes?: string | null
          payment_handle?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          linked_at?: string | null
          linked_by?: string | null
          notes?: string | null
          payment_handle?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payees_linked_by_fkey"
            columns: ["linked_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payees_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      receipts: {
        Row: {
          created_at: string
          height: number | null
          id: string
          line_id: string
          mime_type: string
          original_filename: string
          request_id: string
          sha256: string
          size_bytes: number
          storage_location: string
          storage_path: string
          uploaded_by: string | null
          width: number | null
        }
        Insert: {
          created_at?: string
          height?: number | null
          id?: string
          line_id: string
          mime_type: string
          original_filename: string
          request_id: string
          sha256: string
          size_bytes: number
          storage_location?: string
          storage_path: string
          uploaded_by?: string | null
          width?: number | null
        }
        Update: {
          created_at?: string
          height?: number | null
          id?: string
          line_id?: string
          mime_type?: string
          original_filename?: string
          request_id?: string
          sha256?: string
          size_bytes?: number
          storage_location?: string
          storage_path?: string
          uploaded_by?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "receipts_line_fkey"
            columns: ["request_id", "line_id"]
            isOneToOne: false
            referencedRelation: "request_lines"
            referencedColumns: ["request_id", "id"]
          },
          {
            foreignKeyName: "receipts_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "reimbursement_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "request_report"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      reimbursement_requests: {
        Row: {
          admin_note: string | null
          amount_cents: number
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string
          description: string | null
          event_name: string | null
          external_approver: string | null
          id: string
          no_receipt: boolean
          no_receipt_reason: string | null
          paid_at: string | null
          paid_by: string | null
          payee_id: string
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          payment_reference: string | null
          purchase_date: string
          request_number: number
          sort_at: string
          status: Database["public"]["Enums"]["request_status"]
          submitted_at: string | null
          type: Database["public"]["Enums"]["reimbursement_type"]
          updated_at: string
          vendor: string | null
          missing_receipt: boolean | null
        }
        Insert: {
          admin_note?: string | null
          amount_cents: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          event_name?: string | null
          external_approver?: string | null
          id?: string
          no_receipt?: boolean
          no_receipt_reason?: string | null
          paid_at?: string | null
          paid_by?: string | null
          payee_id: string
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          payment_reference?: string | null
          purchase_date: string
          request_number?: never
          sort_at?: never
          status?: Database["public"]["Enums"]["request_status"]
          submitted_at?: string | null
          type: Database["public"]["Enums"]["reimbursement_type"]
          updated_at?: string
          vendor?: string | null
        }
        Update: {
          admin_note?: string | null
          amount_cents?: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          event_name?: string | null
          external_approver?: string | null
          id?: string
          no_receipt?: boolean
          no_receipt_reason?: string | null
          paid_at?: string | null
          paid_by?: string | null
          payee_id?: string
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          payment_reference?: string | null
          purchase_date?: string
          request_number?: never
          sort_at?: never
          status?: Database["public"]["Enums"]["request_status"]
          submitted_at?: string | null
          type?: Database["public"]["Enums"]["reimbursement_type"]
          updated_at?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reimbursement_requests_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reimbursement_requests_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reimbursement_requests_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reimbursement_requests_payee_id_fkey"
            columns: ["payee_id"]
            isOneToOne: false
            referencedRelation: "payees"
            referencedColumns: ["id"]
          },
        ]
      }
      request_events: {
        Row: {
          action: string
          actor_id: string | null
          changes: Json | null
          created_at: string
          from_status: Database["public"]["Enums"]["request_status"] | null
          id: string
          note: string | null
          request_id: string
          to_status: Database["public"]["Enums"]["request_status"] | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          changes?: Json | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["request_status"] | null
          id?: string
          note?: string | null
          request_id: string
          to_status?: Database["public"]["Enums"]["request_status"] | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          changes?: Json | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["request_status"] | null
          id?: string
          note?: string | null
          request_id?: string
          to_status?: Database["public"]["Enums"]["request_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "request_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_events_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "reimbursement_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_events_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "request_report"
            referencedColumns: ["id"]
          },
        ]
      }
      request_lines: {
        Row: {
          amount_cents: number
          created_at: string
          id: string
          position: number
          request_id: string
          updated_at: string
          vendor: string | null
        }
        Insert: {
          amount_cents: number
          created_at?: string
          id?: string
          position: number
          request_id: string
          updated_at?: string
          vendor?: string | null
        }
        Update: {
          amount_cents?: number
          created_at?: string
          id?: string
          position?: number
          request_id?: string
          updated_at?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "request_lines_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "reimbursement_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_lines_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "request_report"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_path: string | null
          created_at: string
          created_by: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean
          last_seen_at: string | null
          role: Database["public"]["Enums"]["user_role"]
          roles: Database["public"]["Enums"]["app_role"][]
          theme: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          avatar_path?: string | null
          created_at?: string
          created_by?: string | null
          email: string
          full_name: string
          id: string
          is_active?: boolean
          last_seen_at?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          roles?: Database["public"]["Enums"]["app_role"][]
          theme?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          avatar_path?: string | null
          created_at?: string
          created_by?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          last_seen_at?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          roles?: Database["public"]["Enums"]["app_role"][]
          theme?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      request_report: {
        Row: {
          amount_cents: number | null
          approved_at: string | null
          approved_by: string | null
          created_by: string | null
          description: string | null
          event_name: string | null
          external_approver: string | null
          id: string | null
          no_receipt: boolean | null
          no_receipt_reason: string | null
          paid_at: string | null
          paid_by: string | null
          paid_date: string | null
          payee_id: string | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          payment_reference: string | null
          purchase_date: string | null
          request_number: number | null
          status: Database["public"]["Enums"]["request_status"] | null
          submitted_at: string | null
          type: Database["public"]["Enums"]["reimbursement_type"] | null
          vendor: string | null
        }
        Insert: {
          amount_cents?: number | null
          approved_at?: string | null
          approved_by?: string | null
          created_by?: string | null
          description?: string | null
          event_name?: string | null
          external_approver?: string | null
          id?: string | null
          no_receipt?: boolean | null
          no_receipt_reason?: string | null
          paid_at?: string | null
          paid_by?: string | null
          paid_date?: never
          payee_id?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          payment_reference?: string | null
          purchase_date?: string | null
          request_number?: number | null
          status?: Database["public"]["Enums"]["request_status"] | null
          submitted_at?: string | null
          type?: Database["public"]["Enums"]["reimbursement_type"] | null
          vendor?: string | null
        }
        Update: {
          amount_cents?: number | null
          approved_at?: string | null
          approved_by?: string | null
          created_by?: string | null
          description?: string | null
          event_name?: string | null
          external_approver?: string | null
          id?: string | null
          no_receipt?: boolean | null
          no_receipt_reason?: string | null
          paid_at?: string | null
          paid_by?: string | null
          paid_date?: never
          payee_id?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          payment_reference?: string | null
          purchase_date?: string | null
          request_number?: number | null
          status?: Database["public"]["Enums"]["request_status"] | null
          submitted_at?: string | null
          type?: Database["public"]["Enums"]["reimbursement_type"] | null
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reimbursement_requests_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reimbursement_requests_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reimbursement_requests_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reimbursement_requests_payee_id_fkey"
            columns: ["payee_id"]
            isOneToOne: false
            referencedRelation: "payees"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_invite: { Args: never; Returns: boolean }
      approve_request: {
        Args: { p_external_approver?: string; p_request_id: string }
        Returns: undefined
      }
      assert_receipt_rule: {
        Args: { p_request_id: string }
        Returns: undefined
      }
      cancel_request: { Args: { p_request_id: string }; Returns: undefined }
      current_app_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      current_payee_id: { Args: never; Returns: string }
      email_claim: {
        Args: { p_env: string; p_limit?: number }
        Returns: {
            attempts: number
            counts_toward_quota: boolean
            created_at: string
            env: string
            error: string | null
            id: string
            priority: number
            related_id: string | null
            related_type: string | null
            resend_id: string | null
            scope: string
            sent_at: string | null
            status: Database["public"]["Enums"]["email_status"]
            subject: string | null
            template: string
            to_address: string | null
            updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "email_log"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      email_details: { Args: { p_log_id: string }; Returns: Json }
      email_mark: {
        Args: {
          p_error?: string
          p_id: string
          p_resend_id?: string
          p_status: Database["public"]["Enums"]["email_status"]
        }
        Returns: undefined
      }
      email_record_webhook: {
        Args: {
          p_at?: string
          p_error?: string
          p_log_id?: string
          p_resend_id: string
          p_status: Database["public"]["Enums"]["email_status"]
          p_subject?: string
          p_to?: string
        }
        Returns: undefined
      }
      email_reserve: {
        Args: {
          p_env?: string
          p_priority: number
          p_related_id?: string
          p_related_type?: string
          p_scope: string
          p_send_now?: boolean
          p_subject: string
          p_template: string
          p_to: string
        }
        Returns: {
            attempts: number
            counts_toward_quota: boolean
            created_at: string
            env: string
            error: string | null
            id: string
            priority: number
            related_id: string | null
            related_type: string | null
            resend_id: string | null
            scope: string
            sent_at: string | null
            status: Database["public"]["Enums"]["email_status"]
            subject: string | null
            template: string
            to_address: string | null
            updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "email_log"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      email_unsuppress: { Args: { p_id: string }; Returns: undefined }
      has_role: {
        Args: { p_roles: Database["public"]["Enums"]["app_role"][] }
        Returns: boolean
      }
      import_paid_requests: {
        Args: {
          p_external_approver?: string
          p_method: Database["public"]["Enums"]["payment_method"]
          p_rows: Json
        }
        Returns: Json
      }
      link_payee: {
        Args: { p_payee_id: string; p_user_id: string }
        Returns: undefined
      }
      lock_request: {
        Args: { p_request_id: string }
        Returns: {
          admin_note: string | null
          amount_cents: number
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string
          description: string | null
          event_name: string | null
          external_approver: string | null
          id: string
          no_receipt: boolean
          no_receipt_reason: string | null
          paid_at: string | null
          paid_by: string | null
          payee_id: string
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          payment_reference: string | null
          purchase_date: string
          request_number: number
          sort_at: string
          status: Database["public"]["Enums"]["request_status"]
          submitted_at: string | null
          type: Database["public"]["Enums"]["reimbursement_type"]
          updated_at: string
          vendor: string | null
        }
        SetofOptions: {
          from: "*"
          to: "reimbursement_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      log_event: {
        Args: { p_action: string; p_entity_id?: string; p_entity_name?: string }
        Returns: undefined
      }
      mark_paid: {
        Args: {
          p_method: Database["public"]["Enums"]["payment_method"]
          p_paid_at?: string
          p_reference?: string
          p_request_id: string
        }
        Returns: undefined
      }
      missing_receipt: {
        Args: {
          "": Database["public"]["Tables"]["reimbursement_requests"]["Row"]
        }
        Returns: {
          error: true
        } & "the function public.missing_receipt with parameter or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache"
      }
      people_directory: {
        Args: never
        Returns: {
          avatar_path: string
          full_name: string
          id: string
        }[]
      }
      record_as_paid: {
        Args: {
          p_external_approver?: string
          p_method: Database["public"]["Enums"]["payment_method"]
          p_paid_at: string
          p_reference: string
          p_request_id: string
        }
        Returns: undefined
      }
      record_invite: {
        Args: { p_user_id: string }
        Returns: {
          accepted_at: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          invited_by: string | null
          last_sent_at: string
          roles: Database["public"]["Enums"]["app_role"][]
          sent_count: number
          status: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "invites"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reinstate: { Args: { p_user_id: string }; Returns: undefined }
      reject_request: {
        Args: { p_note: string; p_request_id: string }
        Returns: undefined
      }
      remove_access: { Args: { p_user_id: string }; Returns: undefined }
      request_info: {
        Args: { p_note: string; p_request_id: string }
        Returns: undefined
      }
      request_lines_summary: { Args: { p_request_id: string }; Returns: Json }
      request_vendor_list: { Args: { p_request_id: string }; Returns: string }
      require_aal2: { Args: never; Returns: undefined }
      require_note: { Args: { p_note: string }; Returns: string }
      save_request: {
        Args: {
          p_description: string
          p_event_name: string
          p_lines: Json
          p_no_receipt: boolean
          p_no_receipt_reason: string
          p_payee_id: string
          p_purchase_date: string
          p_request_id: string
          p_type: Database["public"]["Enums"]["reimbursement_type"]
        }
        Returns: {
          admin_note: string | null
          amount_cents: number
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string
          description: string | null
          event_name: string | null
          external_approver: string | null
          id: string
          no_receipt: boolean
          no_receipt_reason: string | null
          paid_at: string | null
          paid_by: string | null
          payee_id: string
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          payment_reference: string | null
          purchase_date: string
          request_number: number
          sort_at: string
          status: Database["public"]["Enums"]["request_status"]
          submitted_at: string | null
          type: Database["public"]["Enums"]["reimbursement_type"]
          updated_at: string
          vendor: string | null
        }
        SetofOptions: {
          from: "*"
          to: "reimbursement_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_member_active: {
        Args: { p_is_active: boolean; p_user_id: string }
        Returns: undefined
      }
      set_member_role: {
        Args: {
          p_role: Database["public"]["Enums"]["user_role"]
          p_user_id: string
        }
        Returns: undefined
      }
      set_roles: {
        Args: {
          p_roles: Database["public"]["Enums"]["app_role"][]
          p_user_id: string
        }
        Returns: undefined
      }
      storage_summary: { Args: never; Returns: Json }
      storage_usage: { Args: never; Returns: number }
      submit_request: { Args: { p_request_id: string }; Returns: undefined }
      touch_last_seen: { Args: never; Returns: boolean }
      unapprove_request: {
        Args: { p_note: string; p_request_id: string }
        Returns: undefined
      }
      unlink_payee: { Args: { p_payee_id: string }; Returns: undefined }
      unmark_paid: {
        Args: { p_note: string; p_request_id: string }
        Returns: undefined
      }
      vendor_list: { Args: { p_vendors: string[] }; Returns: string }
    }
    Enums: {
      app_role:
        | "owner"
        | "finance_viewer"
        | "finance_requester"
        | "site_editor"
        | "site_messages"
      email_status:
        | "skipped_quota"
        | "suppressed"
        | "queued"
        | "sending"
        | "sent"
        | "failed"
        | "delivered"
        | "bounced"
        | "complained"
      payment_method: "cash_app" | "bank_transfer" | "check" | "cash" | "other"
      reimbursement_type: "cafe" | "youth"
      request_status:
        | "draft"
        | "submitted"
        | "needs_info"
        | "approved"
        | "paid"
        | "rejected"
        | "cancelled"
      user_role: "member" | "admin" | "viewer"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: [
        "owner",
        "finance_viewer",
        "finance_requester",
        "site_editor",
        "site_messages",
      ],
      email_status: [
        "skipped_quota",
        "suppressed",
        "queued",
        "sending",
        "sent",
        "failed",
        "delivered",
        "bounced",
        "complained",
      ],
      payment_method: ["cash_app", "bank_transfer", "check", "cash", "other"],
      reimbursement_type: ["cafe", "youth"],
      request_status: [
        "draft",
        "submitted",
        "needs_info",
        "approved",
        "paid",
        "rejected",
        "cancelled",
      ],
      user_role: ["member", "admin", "viewer"],
    },
  },
} as const
