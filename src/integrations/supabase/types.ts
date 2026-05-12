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
      activity_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string | null
          changes: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string | null
          changes?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string | null
          changes?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
        }
        Relationships: []
      }
      attendance_logs: {
        Row: {
          created_at: string
          id: string
          is_late: boolean
          is_overtime: boolean
          log_date: string
          notes: string | null
          staff_id: string
          staff_name: string
          time_in: string | null
          time_out: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_late?: boolean
          is_overtime?: boolean
          log_date: string
          notes?: string | null
          staff_id: string
          staff_name: string
          time_in?: string | null
          time_out?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_late?: boolean
          is_overtime?: boolean
          log_date?: string
          notes?: string | null
          staff_id?: string
          staff_name?: string
          time_in?: string | null
          time_out?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      chat_members: {
        Row: {
          id: string
          joined_at: string
          thread_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          thread_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_members_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_threads: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_group: boolean
          last_message_at: string
          name: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_group?: boolean
          last_message_at?: string
          name?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_group?: boolean
          last_message_at?: string
          name?: string | null
        }
        Relationships: []
      }
      client_inquiries: {
        Row: {
          ai_toggle: string | null
          brand: string | null
          client_name: string
          contact_number: string | null
          created_at: string
          device_type: string | null
          email: string | null
          id: string
          initial_payment: number | null
          inquiry_id: string
          issue_description: string | null
          mode_of_transfer: string | null
          model: string | null
          notes: string | null
          part_id: string | null
          pre_order: string | null
          service_id: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          ai_toggle?: string | null
          brand?: string | null
          client_name: string
          contact_number?: string | null
          created_at?: string
          device_type?: string | null
          email?: string | null
          id?: string
          initial_payment?: number | null
          inquiry_id: string
          issue_description?: string | null
          mode_of_transfer?: string | null
          model?: string | null
          notes?: string | null
          part_id?: string | null
          pre_order?: string | null
          service_id?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          ai_toggle?: string | null
          brand?: string | null
          client_name?: string
          contact_number?: string | null
          created_at?: string
          device_type?: string | null
          email?: string | null
          id?: string
          initial_payment?: number | null
          inquiry_id?: string
          issue_description?: string | null
          mode_of_transfer?: string | null
          model?: string | null
          notes?: string | null
          part_id?: string | null
          pre_order?: string | null
          service_id?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          address: string | null
          client_id: string
          contact_number: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          client_id: string
          contact_number?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          client_id?: string
          contact_number?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      closed_dates: {
        Row: {
          closed_date: string
          created_at: string
          created_by: string | null
          id: string
          reason: string | null
        }
        Insert: {
          closed_date: string
          created_at?: string
          created_by?: string | null
          id?: string
          reason?: string | null
        }
        Update: {
          closed_date?: string
          created_at?: string
          created_by?: string | null
          id?: string
          reason?: string | null
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          created_by: string | null
          created_by_name: string | null
          description: string | null
          expense_date: string
          expense_id: string
          fund_id: string | null
          fund_name: string | null
          id: string
          payment_method: string | null
          receipt_path: string | null
          updated_at: string
          vendor: string | null
        }
        Insert: {
          amount?: number
          category?: string | null
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          description?: string | null
          expense_date?: string
          expense_id: string
          fund_id?: string | null
          fund_name?: string | null
          id?: string
          payment_method?: string | null
          receipt_path?: string | null
          updated_at?: string
          vendor?: string | null
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          description?: string | null
          expense_date?: string
          expense_id?: string
          fund_id?: string | null
          fund_name?: string | null
          id?: string
          payment_method?: string | null
          receipt_path?: string | null
          updated_at?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_fund_id_fkey"
            columns: ["fund_id"]
            isOneToOne: false
            referencedRelation: "funds"
            referencedColumns: ["id"]
          },
        ]
      }
      fast_moving_parts: {
        Row: {
          brand: string | null
          category: string | null
          cost_price: number
          created_at: string
          device_model: string | null
          id: string
          notes: string | null
          part_id: string
          part_name: string
          quantity: number
          selling_price: number
          status: string
          updated_at: string
        }
        Insert: {
          brand?: string | null
          category?: string | null
          cost_price?: number
          created_at?: string
          device_model?: string | null
          id?: string
          notes?: string | null
          part_id: string
          part_name: string
          quantity?: number
          selling_price?: number
          status?: string
          updated_at?: string
        }
        Update: {
          brand?: string | null
          category?: string | null
          cost_price?: number
          created_at?: string
          device_model?: string | null
          id?: string
          notes?: string | null
          part_id?: string
          part_name?: string
          quantity?: number
          selling_price?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      funds: {
        Row: {
          balance: number
          created_at: string
          currency: string
          id: string
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          balance?: number
          created_at?: string
          currency?: string
          id?: string
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          balance?: number
          created_at?: string
          currency?: string
          id?: string
          name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      inventory_parts: {
        Row: {
          brand: string | null
          category: string | null
          cost_price: number
          created_at: string
          device_model: string | null
          id: string
          location: string | null
          notes: string | null
          part_id: string
          part_name: string
          part_type: string | null
          quantity: number
          reorder_level: number
          selling_price: number
          status: string
          supplier: string | null
          updated_at: string
        }
        Insert: {
          brand?: string | null
          category?: string | null
          cost_price?: number
          created_at?: string
          device_model?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          part_id: string
          part_name: string
          part_type?: string | null
          quantity?: number
          reorder_level?: number
          selling_price?: number
          status?: string
          supplier?: string | null
          updated_at?: string
        }
        Update: {
          brand?: string | null
          category?: string | null
          cost_price?: number
          created_at?: string
          device_model?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          part_id?: string
          part_name?: string
          part_type?: string | null
          quantity?: number
          reorder_level?: number
          selling_price?: number
          status?: string
          supplier?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          attachment_kind: string | null
          attachment_path: string | null
          body: string | null
          created_at: string
          id: string
          reply_to: string | null
          sender_id: string
          sender_name: string | null
          thread_id: string
        }
        Insert: {
          attachment_kind?: string | null
          attachment_path?: string | null
          body?: string | null
          created_at?: string
          id?: string
          reply_to?: string | null
          sender_id: string
          sender_name?: string | null
          thread_id: string
        }
        Update: {
          attachment_kind?: string | null
          attachment_path?: string | null
          body?: string | null
          created_at?: string
          id?: string
          reply_to?: string | null
          sender_id?: string
          sender_name?: string | null
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          category: string
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          message: string
          read_at: string | null
          recipient_id: string | null
          recipient_name: string | null
          service_id: string | null
          thread_id: string | null
          title: string
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message: string
          read_at?: string | null
          recipient_id?: string | null
          recipient_name?: string | null
          service_id?: string | null
          thread_id?: string | null
          title: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string
          read_at?: string | null
          recipient_id?: string | null
          recipient_name?: string | null
          service_id?: string | null
          thread_id?: string | null
          title?: string
        }
        Relationships: []
      }
      part_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          notes: string | null
          part_id: string | null
          performed_by: string | null
          performed_by_name: string | null
          quantity: number | null
          service_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          notes?: string | null
          part_id?: string | null
          performed_by?: string | null
          performed_by_name?: string | null
          quantity?: number | null
          service_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          notes?: string | null
          part_id?: string | null
          performed_by?: string | null
          performed_by_name?: string | null
          quantity?: number | null
          service_id?: string | null
        }
        Relationships: []
      }
      part_requests: {
        Row: {
          brand: string | null
          cancelled_at: string | null
          cancelled_reason: string | null
          created_at: string
          device_model: string | null
          id: string
          inquiry_id: string | null
          notes: string | null
          part_id: string | null
          part_name: string | null
          quantity: number
          request_id: string
          requested_by: string | null
          requested_by_name: string | null
          service_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          brand?: string | null
          cancelled_at?: string | null
          cancelled_reason?: string | null
          created_at?: string
          device_model?: string | null
          id?: string
          inquiry_id?: string | null
          notes?: string | null
          part_id?: string | null
          part_name?: string | null
          quantity?: number
          request_id: string
          requested_by?: string | null
          requested_by_name?: string | null
          service_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          brand?: string | null
          cancelled_at?: string | null
          cancelled_reason?: string | null
          created_at?: string
          device_model?: string | null
          id?: string
          inquiry_id?: string | null
          notes?: string | null
          part_id?: string | null
          part_name?: string | null
          quantity?: number
          request_id?: string
          requested_by?: string | null
          requested_by_name?: string | null
          service_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          department: string | null
          id: string
          name: string
          salary: number
          salary_type: string
          staff_id: string | null
          status: string
          updated_at: string
          username: string | null
        }
        Insert: {
          created_at?: string
          department?: string | null
          id: string
          name?: string
          salary?: number
          salary_type?: string
          staff_id?: string | null
          status?: string
          updated_at?: string
          username?: string | null
        }
        Update: {
          created_at?: string
          department?: string | null
          id?: string
          name?: string
          salary?: number
          salary_type?: string
          staff_id?: string | null
          status?: string
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      read_receipts: {
        Row: {
          id: string
          message_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          id?: string
          message_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          id?: string
          message_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "read_receipts_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_disbursements: {
        Row: {
          contribution_pagibig: number
          contribution_philhealth: number
          contribution_sss: number
          created_at: string
          daily_rate: number
          days_present: number
          disbursed_at: string | null
          disbursed_by: string | null
          gross_pay: number
          id: string
          monthly_salary: number
          net_pay: number
          notes: string | null
          other_deductions: number
          period_end: string
          period_label: string
          period_start: string
          staff_id: string
          staff_name: string
          status: string
          total_deductions: number
          updated_at: string
          workdays_in_period: number
        }
        Insert: {
          contribution_pagibig?: number
          contribution_philhealth?: number
          contribution_sss?: number
          created_at?: string
          daily_rate?: number
          days_present?: number
          disbursed_at?: string | null
          disbursed_by?: string | null
          gross_pay?: number
          id?: string
          monthly_salary?: number
          net_pay?: number
          notes?: string | null
          other_deductions?: number
          period_end: string
          period_label: string
          period_start: string
          staff_id: string
          staff_name: string
          status?: string
          total_deductions?: number
          updated_at?: string
          workdays_in_period?: number
        }
        Update: {
          contribution_pagibig?: number
          contribution_philhealth?: number
          contribution_sss?: number
          created_at?: string
          daily_rate?: number
          days_present?: number
          disbursed_at?: string | null
          disbursed_by?: string | null
          gross_pay?: number
          id?: string
          monthly_salary?: number
          net_pay?: number
          notes?: string | null
          other_deductions?: number
          period_end?: string
          period_label?: string
          period_start?: string
          staff_id?: string
          staff_name?: string
          status?: string
          total_deductions?: number
          updated_at?: string
          workdays_in_period?: number
        }
        Relationships: [
          {
            foreignKeyName: "salary_disbursements_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      service_breakdowns: {
        Row: {
          cost: number
          created_at: string
          created_by: string | null
          id: string
          service_id: string
          service_name: string
          technician_id: string | null
          technician_name: string
          updated_at: string
        }
        Insert: {
          cost?: number
          created_at?: string
          created_by?: string | null
          id?: string
          service_id: string
          service_name?: string
          technician_id?: string | null
          technician_name?: string
          updated_at?: string
        }
        Update: {
          cost?: number
          created_at?: string
          created_by?: string | null
          id?: string
          service_id?: string
          service_name?: string
          technician_id?: string | null
          technician_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      service_files: {
        Row: {
          bucket: string
          filename: string | null
          id: string
          kind: Database["public"]["Enums"]["service_file_kind"]
          mime_type: string | null
          service_id: string
          size_bytes: number | null
          storage_path: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          bucket: string
          filename?: string | null
          id?: string
          kind: Database["public"]["Enums"]["service_file_kind"]
          mime_type?: string | null
          service_id: string
          size_bytes?: number | null
          storage_path: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          bucket?: string
          filename?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["service_file_kind"]
          mime_type?: string | null
          service_id?: string
          size_bytes?: number | null
          storage_path?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_files_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["service_id"]
          },
        ]
      }
      services: {
        Row: {
          address: string | null
          admin_reps: string[]
          ai_report: string | null
          ai_toggle: string | null
          brand: string | null
          client_id: string | null
          client_name: string
          contact_number: string | null
          created_at: string
          date_completed: string | null
          date_received: string
          device_report_folder_url: string | null
          device_type: string | null
          diagnosis: string | null
          drive_folder_url: string | null
          email: string | null
          estimated_completion: string | null
          id: string
          initial_payment: number
          internal_admin_notes: string | null
          internal_technician_notes: string | null
          issue_description: string | null
          labor_cost: number
          last_updated: string
          mode_of_transfer: string | null
          model: string | null
          part_id: string | null
          parts_used: string[]
          payment_status: string | null
          pre_order: string | null
          priority: string | null
          receiving_staff: string | null
          remarks: string | null
          serial_number: string | null
          service: string | null
          service_cost: number
          service_id: string
          status: Database["public"]["Enums"]["service_status"]
          target_date: string | null
          technician_departments: string[]
          technicians: string[]
          total_cost: number
        }
        Insert: {
          address?: string | null
          admin_reps?: string[]
          ai_report?: string | null
          ai_toggle?: string | null
          brand?: string | null
          client_id?: string | null
          client_name: string
          contact_number?: string | null
          created_at?: string
          date_completed?: string | null
          date_received?: string
          device_report_folder_url?: string | null
          device_type?: string | null
          diagnosis?: string | null
          drive_folder_url?: string | null
          email?: string | null
          estimated_completion?: string | null
          id?: string
          initial_payment?: number
          internal_admin_notes?: string | null
          internal_technician_notes?: string | null
          issue_description?: string | null
          labor_cost?: number
          last_updated?: string
          mode_of_transfer?: string | null
          model?: string | null
          part_id?: string | null
          parts_used?: string[]
          payment_status?: string | null
          pre_order?: string | null
          priority?: string | null
          receiving_staff?: string | null
          remarks?: string | null
          serial_number?: string | null
          service?: string | null
          service_cost?: number
          service_id: string
          status?: Database["public"]["Enums"]["service_status"]
          target_date?: string | null
          technician_departments?: string[]
          technicians?: string[]
          total_cost?: number
        }
        Update: {
          address?: string | null
          admin_reps?: string[]
          ai_report?: string | null
          ai_toggle?: string | null
          brand?: string | null
          client_id?: string | null
          client_name?: string
          contact_number?: string | null
          created_at?: string
          date_completed?: string | null
          date_received?: string
          device_report_folder_url?: string | null
          device_type?: string | null
          diagnosis?: string | null
          drive_folder_url?: string | null
          email?: string | null
          estimated_completion?: string | null
          id?: string
          initial_payment?: number
          internal_admin_notes?: string | null
          internal_technician_notes?: string | null
          issue_description?: string | null
          labor_cost?: number
          last_updated?: string
          mode_of_transfer?: string | null
          model?: string | null
          part_id?: string | null
          parts_used?: string[]
          payment_status?: string | null
          pre_order?: string | null
          priority?: string | null
          receiving_staff?: string | null
          remarks?: string | null
          serial_number?: string | null
          service?: string | null
          service_cost?: number
          service_id?: string
          status?: Database["public"]["Enums"]["service_status"]
          target_date?: string | null
          technician_departments?: string[]
          technicians?: string[]
          total_cost?: number
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          category: string | null
          client_name: string | null
          created_at: string
          created_by: string | null
          created_by_name: string | null
          description: string | null
          fund_id: string | null
          fund_name: string | null
          id: string
          payment_method: string | null
          service_id: string | null
          status: string
          transaction_date: string
          transaction_id: string
          type: string
          updated_at: string
        }
        Insert: {
          amount?: number
          category?: string | null
          client_name?: string | null
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          description?: string | null
          fund_id?: string | null
          fund_name?: string | null
          id?: string
          payment_method?: string | null
          service_id?: string | null
          status?: string
          transaction_date?: string
          transaction_id: string
          type: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string | null
          client_name?: string | null
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          description?: string | null
          fund_id?: string | null
          fund_name?: string | null
          id?: string
          payment_method?: string | null
          service_id?: string | null
          status?: string
          transaction_date?: string
          transaction_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_fund_id_fkey"
            columns: ["fund_id"]
            isOneToOne: false
            referencedRelation: "funds"
            referencedColumns: ["id"]
          },
        ]
      }
      typing_indicators: {
        Row: {
          thread_id: string
          updated_at: string
          user_id: string
          user_name: string | null
        }
        Insert: {
          thread_id: string
          updated_at?: string
          user_id: string
          user_name?: string | null
        }
        Update: {
          thread_id?: string
          updated_at?: string
          user_id?: string
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "typing_indicators_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_service_id: { Args: never; Returns: string }
      get_my_name: { Args: never; Returns: string }
      get_staff_directory: {
        Args: never
        Returns: {
          department: string
          id: string
          name: string
          staff_id: string
          status: string
          username: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_management: { Args: { _user_id: string }; Returns: boolean }
      is_thread_member: {
        Args: { _thread_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "technician" | "management"
      service_file_kind:
        | "intake"
        | "quotation"
        | "signature"
        | "annotation"
        | "device_report"
      service_status:
        | "Pending Diagnosis"
        | "Confirmed Diagnosis"
        | "Waiting to Proceed"
        | "Proceed Repair"
        | "Ongoing Service"
        | "Done Repair - Under Observation"
        | "Done Repair - For Release"
        | "Done Repair - Advise Client"
        | "Completed"
        | "Backjob"
        | "RTO"
        | "On Hold"
        | "Cancelled"
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
      app_role: ["admin", "technician", "management"],
      service_file_kind: [
        "intake",
        "quotation",
        "signature",
        "annotation",
        "device_report",
      ],
      service_status: [
        "Pending Diagnosis",
        "Confirmed Diagnosis",
        "Waiting to Proceed",
        "Proceed Repair",
        "Ongoing Service",
        "Done Repair - Under Observation",
        "Done Repair - For Release",
        "Done Repair - Advise Client",
        "Completed",
        "Backjob",
        "RTO",
        "On Hold",
        "Cancelled",
      ],
    },
  },
} as const
