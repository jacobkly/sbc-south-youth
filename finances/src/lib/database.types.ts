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
            foreignKeyName: "receipts_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "reimbursement_requests"
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
          description: string
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
          status: Database["public"]["Enums"]["request_status"]
          submitted_at: string | null
          type: Database["public"]["Enums"]["reimbursement_type"]
          updated_at: string
          vendor: string
        }
        Insert: {
          admin_note?: string | null
          amount_cents: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string
          description: string
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
          status?: Database["public"]["Enums"]["request_status"]
          submitted_at?: string | null
          type: Database["public"]["Enums"]["reimbursement_type"]
          updated_at?: string
          vendor: string
        }
        Update: {
          admin_note?: string | null
          amount_cents?: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string
          description?: string
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
          status?: Database["public"]["Enums"]["request_status"]
          submitted_at?: string | null
          type?: Database["public"]["Enums"]["reimbursement_type"]
          updated_at?: string
          vendor?: string
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
        ]
      }
      users: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_request: {
        Args: { p_external_approver?: string; p_request_id: string }
        Returns: undefined
      }
      cancel_request: { Args: { p_request_id: string }; Returns: undefined }
      current_app_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      current_payee_id: { Args: never; Returns: string }
      link_payee: {
        Args: { p_payee_id: string; p_user_id: string }
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
      record_as_paid: {
        Args: {
          p_external_approver?: string
          p_method: Database["public"]["Enums"]["payment_method"]
          p_paid_at: string
          p_reference: string | null
          p_request_id: string
        }
        Returns: undefined
      }
      reject_request: {
        Args: { p_note: string; p_request_id: string }
        Returns: undefined
      }
      request_info: {
        Args: { p_note: string; p_request_id: string }
        Returns: undefined
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
      storage_usage: { Args: never; Returns: number }
      submit_request: { Args: { p_request_id: string }; Returns: undefined }
      unapprove_request: {
        Args: { p_note: string; p_request_id: string }
        Returns: undefined
      }
      unlink_payee: { Args: { p_payee_id: string }; Returns: undefined }
      unmark_paid: {
        Args: { p_note: string; p_request_id: string }
        Returns: undefined
      }
    }
    Enums: {
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

export const Constants = {
  public: {
    Enums: {
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
