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
      ai_chat_messages: {
        Row: {
          company_id: string
          content: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          company_id: string
          content: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          company_id?: string
          content?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_credit_packages: {
        Row: {
          amount: number
          created_at: string
          id: string
          is_active: boolean
          is_best: boolean
          label: string
          size: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          is_active?: boolean
          is_best?: boolean
          label?: string
          size: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          is_active?: boolean
          is_best?: boolean
          label?: string
          size?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      ai_credit_purchases: {
        Row: {
          amount: number
          company_id: string
          created_at: string
          id: string
          note: string | null
          package_size: number
          receipt_path: string | null
          rejection_reason: string | null
          requested_by: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          amount: number
          company_id: string
          created_at?: string
          id?: string
          note?: string | null
          package_size: number
          receipt_path?: string | null
          rejection_reason?: string | null
          requested_by: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string
          id?: string
          note?: string | null
          package_size?: number
          receipt_path?: string | null
          rejection_reason?: string | null
          requested_by?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_credit_purchases_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_credits: {
        Row: {
          company_id: string
          free_limit: number
          free_used: number
          paid_balance: number
          scan_free_limit: number
          scan_free_used: number
          scan_paid_balance: number
          tour_free_used: number
          tour_paid_balance: number
          updated_at: string
        }
        Insert: {
          company_id: string
          free_limit?: number
          free_used?: number
          paid_balance?: number
          scan_free_limit?: number
          scan_free_used?: number
          scan_paid_balance?: number
          tour_free_used?: number
          tour_paid_balance?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          free_limit?: number
          free_used?: number
          paid_balance?: number
          scan_free_limit?: number
          scan_free_used?: number
          scan_paid_balance?: number
          tour_free_used?: number
          tour_paid_balance?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_credits_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      apartment_tour_assignments: {
        Row: {
          apartment_id: string
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          price_paid: number
          source: string
          template_id: string
        }
        Insert: {
          apartment_id: string
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          price_paid?: number
          source: string
          template_id: string
        }
        Update: {
          apartment_id?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          price_paid?: number
          source?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "apartment_tour_assignments_apartment_id_fkey"
            columns: ["apartment_id"]
            isOneToOne: false
            referencedRelation: "apartments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apartment_tour_assignments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      apartments: {
        Row: {
          apartment_number: string
          area: number
          created_at: string
          floor_id: string
          historical_contract_date: string | null
          historical_owner: string | null
          hold_customer_id: string | null
          hold_note: string | null
          hold_until: string | null
          id: string
          is_historical: boolean
          marketplace_listing_id: string | null
          marketplace_synced_at: string | null
          plan_image_path: string | null
          price: number
          price_per_sqm: number
          project_id: string
          rooms: number | null
          status: Database["public"]["Enums"]["apartment_status"]
          tour_assigned_at: string | null
          tour_media_paths: string[]
          tour_template_id: string | null
          tour_url: string | null
          updated_at: string
        }
        Insert: {
          apartment_number: string
          area?: number
          created_at?: string
          floor_id: string
          historical_contract_date?: string | null
          historical_owner?: string | null
          hold_customer_id?: string | null
          hold_note?: string | null
          hold_until?: string | null
          id?: string
          is_historical?: boolean
          marketplace_listing_id?: string | null
          marketplace_synced_at?: string | null
          plan_image_path?: string | null
          price?: number
          price_per_sqm?: number
          project_id: string
          rooms?: number | null
          status?: Database["public"]["Enums"]["apartment_status"]
          tour_assigned_at?: string | null
          tour_media_paths?: string[]
          tour_template_id?: string | null
          tour_url?: string | null
          updated_at?: string
        }
        Update: {
          apartment_number?: string
          area?: number
          created_at?: string
          floor_id?: string
          historical_contract_date?: string | null
          historical_owner?: string | null
          hold_customer_id?: string | null
          hold_note?: string | null
          hold_until?: string | null
          id?: string
          is_historical?: boolean
          marketplace_listing_id?: string | null
          marketplace_synced_at?: string | null
          plan_image_path?: string | null
          price?: number
          price_per_sqm?: number
          project_id?: string
          rooms?: number | null
          status?: Database["public"]["Enums"]["apartment_status"]
          tour_assigned_at?: string | null
          tour_media_paths?: string[]
          tour_template_id?: string | null
          tour_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "apartments_floor_id_fkey"
            columns: ["floor_id"]
            isOneToOne: false
            referencedRelation: "floors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apartments_hold_customer_id_fkey"
            columns: ["hold_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apartments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apartments_tour_template_id_fkey"
            columns: ["tour_template_id"]
            isOneToOne: false
            referencedRelation: "tour_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          date: string
          face_confidence: number | null
          face_verified: boolean
          hours: number | null
          id: string
          note: string | null
          project_id: string | null
          status: string
          updated_at: string
          verification_photo_path: string | null
          worker_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          date: string
          face_confidence?: number | null
          face_verified?: boolean
          hours?: number | null
          id?: string
          note?: string | null
          project_id?: string | null
          status?: string
          updated_at?: string
          verification_photo_path?: string | null
          worker_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          date?: string
          face_confidence?: number | null
          face_verified?: boolean
          hours?: number | null
          id?: string
          note?: string | null
          project_id?: string | null
          status?: string
          updated_at?: string
          verification_photo_path?: string | null
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      barter_deals: {
        Row: {
          apartment_id: string | null
          asset_description: string | null
          asset_name: string | null
          asset_type: string
          brand_model: string | null
          cash_paid: number
          client_name: string
          client_phone: string | null
          company_id: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          estimated_value: number
          id: string
          note: string | null
          ownership_document: string | null
          photo_url: string | null
          project_id: string
          property_value: number
          remaining: number | null
          sale_id: string | null
          state_number: string | null
          status: string
          updated_at: string
        }
        Insert: {
          apartment_id?: string | null
          asset_description?: string | null
          asset_name?: string | null
          asset_type?: string
          brand_model?: string | null
          cash_paid?: number
          client_name: string
          client_phone?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          estimated_value?: number
          id?: string
          note?: string | null
          ownership_document?: string | null
          photo_url?: string | null
          project_id: string
          property_value?: number
          remaining?: number | null
          sale_id?: string | null
          state_number?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          apartment_id?: string | null
          asset_description?: string | null
          asset_name?: string | null
          asset_type?: string
          brand_model?: string | null
          cash_paid?: number
          client_name?: string
          client_phone?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          estimated_value?: number
          id?: string
          note?: string | null
          ownership_document?: string | null
          photo_url?: string | null
          project_id?: string
          property_value?: number
          remaining?: number | null
          sale_id?: string | null
          state_number?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "barter_deals_apartment_id_fkey"
            columns: ["apartment_id"]
            isOneToOne: false
            referencedRelation: "apartments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "barter_deals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "barter_deals_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "barter_deals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "barter_deals_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      car_damages: {
        Row: {
          amount: number
          company_id: string
          created_at: string
          created_by: string | null
          damage_date: string
          id: string
          notes: string | null
          project_id: string
          updated_at: string
          vehicle: string
        }
        Insert: {
          amount: number
          company_id: string
          created_at?: string
          created_by?: string | null
          damage_date?: string
          id?: string
          notes?: string | null
          project_id: string
          updated_at?: string
          vehicle: string
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string
          created_by?: string | null
          damage_date?: string
          id?: string
          notes?: string | null
          project_id?: string
          updated_at?: string
          vehicle?: string
        }
        Relationships: [
          {
            foreignKeyName: "car_damages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "car_damages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_operations: {
        Row: {
          amount: number
          company_id: string
          counterparty: string | null
          created_at: string
          created_by: string | null
          currency: string
          direction: string
          id: string
          note: string | null
          operation_date: string
          register_id: string
          shift_id: string | null
          source: string
          source_id: string | null
        }
        Insert: {
          amount: number
          company_id: string
          counterparty?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          direction: string
          id?: string
          note?: string | null
          operation_date?: string
          register_id: string
          shift_id?: string | null
          source: string
          source_id?: string | null
        }
        Update: {
          amount?: number
          company_id?: string
          counterparty?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          direction?: string
          id?: string
          note?: string | null
          operation_date?: string
          register_id?: string
          shift_id?: string | null
          source?: string
          source_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_operations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_operations_register_id_fkey"
            columns: ["register_id"]
            isOneToOne: false
            referencedRelation: "cash_registers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_operations_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "cash_shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_registers: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          currency: string
          id: string
          is_active: boolean
          name: string
          project_id: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          is_active?: boolean
          name: string
          project_id?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          is_active?: boolean
          name?: string
          project_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_registers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_registers_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_shifts: {
        Row: {
          cashier_user_id: string
          closed_at: string | null
          closed_balance_declared: number | null
          closed_balance_system: number | null
          company_id: string
          created_at: string
          diff: number | null
          id: string
          note: string | null
          opened_at: string
          opened_balance: number
          register_id: string
          status: string
          updated_at: string
        }
        Insert: {
          cashier_user_id: string
          closed_at?: string | null
          closed_balance_declared?: number | null
          closed_balance_system?: number | null
          company_id: string
          created_at?: string
          diff?: number | null
          id?: string
          note?: string | null
          opened_at?: string
          opened_balance?: number
          register_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          cashier_user_id?: string
          closed_at?: string | null
          closed_balance_declared?: number | null
          closed_balance_system?: number | null
          company_id?: string
          created_at?: string
          diff?: number | null
          id?: string
          note?: string | null
          opened_at?: string
          opened_balance?: number
          register_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_shifts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_shifts_register_id_fkey"
            columns: ["register_id"]
            isOneToOne: false
            referencedRelation: "cash_registers"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string
          demo_expires_at: string | null
          enabled_modules: string[]
          free_tours_used: number
          id: string
          is_demo: boolean
          kiosk_enabled: boolean
          material_variance_threshold: number
          max_blocks: number
          max_projects: number
          max_staff: number
          name: string
          owner_user_id: string
          phone: string | null
          receipt_address: string | null
          receipt_bg: string | null
          receipt_inn: string | null
          receipt_signer: string | null
          receipt_stamp: string | null
          show_tours_public: boolean
          status: Database["public"]["Enums"]["company_status"]
          subscription_expires_at: string | null
          subscription_started_at: string | null
          subscription_tariff_id: string | null
          updated_at: string
          warehouse_manual_docs_allowed: boolean
        }
        Insert: {
          created_at?: string
          demo_expires_at?: string | null
          enabled_modules?: string[]
          free_tours_used?: number
          id?: string
          is_demo?: boolean
          kiosk_enabled?: boolean
          material_variance_threshold?: number
          max_blocks?: number
          max_projects?: number
          max_staff?: number
          name: string
          owner_user_id: string
          phone?: string | null
          receipt_address?: string | null
          receipt_bg?: string | null
          receipt_inn?: string | null
          receipt_signer?: string | null
          receipt_stamp?: string | null
          show_tours_public?: boolean
          status?: Database["public"]["Enums"]["company_status"]
          subscription_expires_at?: string | null
          subscription_started_at?: string | null
          subscription_tariff_id?: string | null
          updated_at?: string
          warehouse_manual_docs_allowed?: boolean
        }
        Update: {
          created_at?: string
          demo_expires_at?: string | null
          enabled_modules?: string[]
          free_tours_used?: number
          id?: string
          is_demo?: boolean
          kiosk_enabled?: boolean
          material_variance_threshold?: number
          max_blocks?: number
          max_projects?: number
          max_staff?: number
          name?: string
          owner_user_id?: string
          phone?: string | null
          receipt_address?: string | null
          receipt_bg?: string | null
          receipt_inn?: string | null
          receipt_signer?: string | null
          receipt_stamp?: string | null
          show_tours_public?: boolean
          status?: Database["public"]["Enums"]["company_status"]
          subscription_expires_at?: string | null
          subscription_started_at?: string | null
          subscription_tariff_id?: string | null
          updated_at?: string
          warehouse_manual_docs_allowed?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "companies_subscription_tariff_id_fkey"
            columns: ["subscription_tariff_id"]
            isOneToOne: false
            referencedRelation: "tariffs"
            referencedColumns: ["id"]
          },
        ]
      }
      company_change_requests: {
        Row: {
          company_id: string
          created_at: string
          created_by: string
          id: string
          reject_reason: string | null
          requested_changes: Json
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string
          id?: string
          reject_reason?: string | null
          requested_changes: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string
          id?: string
          reject_reason?: string | null
          requested_changes?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_change_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_directors: {
        Row: {
          company_id: string
          created_at: string
          email: string
          fullname: string
          id: string
          is_active: boolean
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          email: string
          fullname: string
          id?: string
          is_active?: boolean
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          email?: string
          fullname?: string
          id?: string
          is_active?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_directors_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_kiosk_access: {
        Row: {
          company_id: string
          created_at: string
          granted_by: string | null
          id: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          granted_by?: string | null
          id?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          granted_by?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_kiosk_access_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_kiosk_secrets: {
        Row: {
          company_id: string
          created_at: string
          kiosk_pin_hash: string | null
          kiosk_token: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          kiosk_pin_hash?: string | null
          kiosk_token?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          kiosk_pin_hash?: string | null
          kiosk_token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_kiosk_secrets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_requests: {
        Row: {
          company_name: string
          created_at: string
          email: string
          fullname: string
          id: string
          phone: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["request_status"]
          user_id: string
        }
        Insert: {
          company_name: string
          created_at?: string
          email: string
          fullname: string
          id?: string
          phone?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          user_id: string
        }
        Update: {
          company_name?: string
          created_at?: string
          email?: string
          fullname?: string
          id?: string
          phone?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          user_id?: string
        }
        Relationships: []
      }
      company_sms_settings: {
        Row: {
          company_id: string
          enabled: boolean
          hash_secret: string | null
          id: string
          login: string | null
          overdue_template: string | null
          paid_template: string | null
          penalty_percent: number
          penalty_period: string
          project_id: string | null
          provider: string
          reminder_template: string | null
          sender: string | null
          test_mode: boolean
          token: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          company_id: string
          enabled?: boolean
          hash_secret?: string | null
          id?: string
          login?: string | null
          overdue_template?: string | null
          paid_template?: string | null
          penalty_percent?: number
          penalty_period?: string
          project_id?: string | null
          provider?: string
          reminder_template?: string | null
          sender?: string | null
          test_mode?: boolean
          token?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          company_id?: string
          enabled?: boolean
          hash_secret?: string | null
          id?: string
          login?: string | null
          overdue_template?: string | null
          paid_template?: string | null
          penalty_percent?: number
          penalty_period?: string
          project_id?: string | null
          provider?: string
          reminder_template?: string | null
          sender?: string | null
          test_mode?: boolean
          token?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_sms_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_sms_settings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      construction_photos: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          photo_path: string
          project_id: string
          stage_id: string | null
          taken_at: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          photo_path: string
          project_id: string
          stage_id?: string | null
          taken_at?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          photo_path?: string
          project_id?: string
          stage_id?: string | null
          taken_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "construction_photos_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "construction_photos_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "project_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_documents: {
        Row: {
          company_id: string
          contract_date: string | null
          contract_number: string | null
          created_at: string
          created_by: string | null
          data: Json
          id: string
          kind: string
          sale_id: string | null
        }
        Insert: {
          company_id: string
          contract_date?: string | null
          contract_number?: string | null
          created_at?: string
          created_by?: string | null
          data?: Json
          id?: string
          kind: string
          sale_id?: string | null
        }
        Update: {
          company_id?: string
          contract_date?: string | null
          contract_number?: string | null
          created_at?: string
          created_by?: string | null
          data?: Json
          id?: string
          kind?: string
          sale_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_documents_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_templates: {
        Row: {
          bank_details: string | null
          body_text: string | null
          company_id: string
          contract_title: string
          created_at: string
          director_name: string | null
          director_position: string | null
          docx_full_path: string | null
          docx_installment_path: string | null
          docx_shop_full_path: string | null
          docx_shop_installment_path: string | null
          footer_text: string | null
          id: string
          inn: string | null
          intro_text: string | null
          legal_address: string | null
          number_prefix: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          bank_details?: string | null
          body_text?: string | null
          company_id: string
          contract_title?: string
          created_at?: string
          director_name?: string | null
          director_position?: string | null
          docx_full_path?: string | null
          docx_installment_path?: string | null
          docx_shop_full_path?: string | null
          docx_shop_installment_path?: string | null
          footer_text?: string | null
          id?: string
          inn?: string | null
          intro_text?: string | null
          legal_address?: string | null
          number_prefix?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          bank_details?: string | null
          body_text?: string | null
          company_id?: string
          contract_title?: string
          created_at?: string
          director_name?: string | null
          director_position?: string | null
          docx_full_path?: string | null
          docx_installment_path?: string | null
          docx_shop_full_path?: string | null
          docx_shop_installment_path?: string | null
          footer_text?: string | null
          id?: string
          inn?: string | null
          intro_text?: string | null
          legal_address?: string | null
          number_prefix?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_documents: {
        Row: {
          company_id: string | null
          created_at: string
          customer_id: string
          file_name: string
          file_path: string
          file_type: string | null
          id: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          customer_id: string
          file_name: string
          file_path: string
          file_type?: string | null
          id?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          customer_id?: string
          file_name?: string
          file_path?: string
          file_type?: string | null
          id?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_documents_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_interactions: {
        Row: {
          body: string | null
          company_id: string
          created_at: string
          created_by: string | null
          customer_id: string
          direction: string | null
          id: string
          interaction_at: string
          kind: string
          next_action_at: string | null
          outcome: string | null
          subject: string | null
        }
        Insert: {
          body?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          customer_id: string
          direction?: string | null
          id?: string
          interaction_at?: string
          kind?: string
          next_action_at?: string | null
          outcome?: string | null
          subject?: string | null
        }
        Update: {
          body?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string
          direction?: string | null
          id?: string
          interaction_at?: string
          kind?: string
          next_action_at?: string | null
          outcome?: string | null
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_interactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_interactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          assigned_manager_id: string | null
          birth_date: string | null
          company_id: string | null
          created_at: string
          created_by: string | null
          crm_fields: Json
          first_name: string | null
          fullname: string
          funnel_stage: string | null
          gender: string | null
          id: string
          inn: string | null
          issuing_authority: string | null
          last_name: string | null
          middle_name: string | null
          nationality: string | null
          notes: string | null
          passport: string | null
          passport_back_path: string | null
          passport_expiry_date: string | null
          passport_front_path: string | null
          passport_issued_by: string | null
          passport_issued_date: string | null
          passport_number: string | null
          passport_series: string | null
          personal_id: string | null
          phone: string | null
          source: string | null
          status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          assigned_manager_id?: string | null
          birth_date?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          crm_fields?: Json
          first_name?: string | null
          fullname: string
          funnel_stage?: string | null
          gender?: string | null
          id?: string
          inn?: string | null
          issuing_authority?: string | null
          last_name?: string | null
          middle_name?: string | null
          nationality?: string | null
          notes?: string | null
          passport?: string | null
          passport_back_path?: string | null
          passport_expiry_date?: string | null
          passport_front_path?: string | null
          passport_issued_by?: string | null
          passport_issued_date?: string | null
          passport_number?: string | null
          passport_series?: string | null
          personal_id?: string | null
          phone?: string | null
          source?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          assigned_manager_id?: string | null
          birth_date?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          crm_fields?: Json
          first_name?: string | null
          fullname?: string
          funnel_stage?: string | null
          gender?: string | null
          id?: string
          inn?: string | null
          issuing_authority?: string | null
          last_name?: string | null
          middle_name?: string | null
          nationality?: string | null
          notes?: string | null
          passport?: string | null
          passport_back_path?: string | null
          passport_expiry_date?: string | null
          passport_front_path?: string | null
          passport_issued_by?: string | null
          passport_issued_date?: string | null
          passport_number?: string | null
          passport_series?: string | null
          personal_id?: string | null
          phone?: string | null
          source?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_assigned_manager_id_fkey"
            columns: ["assigned_manager_id"]
            isOneToOne: false
            referencedRelation: "sales_team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      deleted_records: {
        Row: {
          company_id: string | null
          data: Json
          deleted_at: string
          deleted_by: string | null
          id: string
          record_id: string | null
          table_name: string
        }
        Insert: {
          company_id?: string | null
          data: Json
          deleted_at?: string
          deleted_by?: string | null
          id?: string
          record_id?: string | null
          table_name: string
        }
        Update: {
          company_id?: string | null
          data?: Json
          deleted_at?: string
          deleted_by?: string | null
          id?: string
          record_id?: string | null
          table_name?: string
        }
        Relationships: []
      }
      demo_feedback: {
        Row: {
          admin_reply: string | null
          company_id: string | null
          created_at: string
          id: string
          is_resolved: boolean
          message: string
          user_id: string
        }
        Insert: {
          admin_reply?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          is_resolved?: boolean
          message: string
          user_id: string
        }
        Update: {
          admin_reply?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          is_resolved?: boolean
          message?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "demo_feedback_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          fuel_per_hour: number | null
          id: string
          is_active: boolean
          kind: string
          name: string
          note: string | null
          ownership: string
          plate_number: string | null
          rate_per_day: number | null
          rate_per_hour: number | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          fuel_per_hour?: number | null
          id?: string
          is_active?: boolean
          kind?: string
          name: string
          note?: string | null
          ownership?: string
          plate_number?: string | null
          rate_per_day?: number | null
          rate_per_hour?: number | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          fuel_per_hour?: number | null
          id?: string
          is_active?: boolean
          kind?: string
          name?: string
          note?: string | null
          ownership?: string
          plate_number?: string | null
          rate_per_day?: number | null
          rate_per_hour?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_maintenance: {
        Row: {
          cost: number | null
          created_at: string
          created_by: string | null
          description: string
          equipment_id: string
          id: string
          maintenance_date: string
          note: string | null
          updated_at: string
        }
        Insert: {
          cost?: number | null
          created_at?: string
          created_by?: string | null
          description: string
          equipment_id: string
          id?: string
          maintenance_date?: string
          note?: string | null
          updated_at?: string
        }
        Update: {
          cost?: number | null
          created_at?: string
          created_by?: string | null
          description?: string
          equipment_id?: string
          id?: string
          maintenance_date?: string
          note?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_maintenance_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_usage: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          equipment_id: string
          expense_id: string | null
          fuel_liters: number | null
          hours: number | null
          id: string
          note: string | null
          operator_name: string | null
          project_id: string
          updated_at: string
          usage_date: string
        }
        Insert: {
          amount?: number
          created_at?: string
          created_by?: string | null
          equipment_id: string
          expense_id?: string | null
          fuel_liters?: number | null
          hours?: number | null
          id?: string
          note?: string | null
          operator_name?: string | null
          project_id: string
          updated_at?: string
          usage_date?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          equipment_id?: string
          expense_id?: string | null
          fuel_liters?: number | null
          hours?: number | null
          id?: string
          note?: string | null
          operator_name?: string | null
          project_id?: string
          updated_at?: string
          usage_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_usage_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_usage_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_usage_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      estimate_documents: {
        Row: {
          created_at: string
          doc_type: string
          estimate_id: string
          file_name: string
          file_path: string
          id: string
          project_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          doc_type?: string
          estimate_id: string
          file_name: string
          file_path: string
          id?: string
          project_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          doc_type?: string
          estimate_id?: string
          file_name?: string
          file_path?: string
          id?: string
          project_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "estimate_documents_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      estimate_items: {
        Row: {
          created_at: string
          estimate_id: string
          id: string
          kind: string
          name: string
          project_id: string
          quantity: number
          section: string | null
          sort_order: number
          total: number
          unit: string | null
          unit_price: number
        }
        Insert: {
          created_at?: string
          estimate_id: string
          id?: string
          kind?: string
          name: string
          project_id: string
          quantity?: number
          section?: string | null
          sort_order?: number
          total?: number
          unit?: string | null
          unit_price?: number
        }
        Update: {
          created_at?: string
          estimate_id?: string
          id?: string
          kind?: string
          name?: string
          project_id?: string
          quantity?: number
          section?: string | null
          sort_order?: number
          total?: number
          unit?: string | null
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
          {
            foreignKeyName: "estimate_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      estimates: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          customer: string | null
          id: string
          is_current: boolean
          name: string
          note: string | null
          parent_estimate_id: string | null
          project_id: string
          responsible: string | null
          root_id: string | null
          status: string
          total: number
          updated_at: string
          version: number
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          customer?: string | null
          id?: string
          is_current?: boolean
          name: string
          note?: string | null
          parent_estimate_id?: string | null
          project_id: string
          responsible?: string | null
          root_id?: string | null
          status?: string
          total?: number
          updated_at?: string
          version?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          customer?: string | null
          id?: string
          is_current?: boolean
          name?: string
          note?: string | null
          parent_estimate_id?: string | null
          project_id?: string
          responsible?: string | null
          root_id?: string | null
          status?: string
          total?: number
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "estimates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_rates: {
        Row: {
          created_at: string
          date: string
          source: string
          usd_rate: number
        }
        Insert: {
          created_at?: string
          date: string
          source?: string
          usd_rate: number
        }
        Update: {
          created_at?: string
          date?: string
          source?: string
          usd_rate?: number
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          employee_name: string | null
          expense_date: string
          floor_id: string | null
          funding_source: string | null
          id: string
          invoice_file: string | null
          project_id: string | null
          worker_id: string | null
        }
        Insert: {
          amount: number
          category?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          employee_name?: string | null
          expense_date?: string
          floor_id?: string | null
          funding_source?: string | null
          id?: string
          invoice_file?: string | null
          project_id?: string | null
          worker_id?: string | null
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          employee_name?: string | null
          expense_date?: string
          floor_id?: string | null
          funding_source?: string | null
          id?: string
          invoice_file?: string | null
          project_id?: string | null
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_floor_id_fkey"
            columns: ["floor_id"]
            isOneToOne: false
            referencedRelation: "floors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      floors: {
        Row: {
          created_at: string
          description: string | null
          floor_number: number
          id: string
          project_id: string
          status: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          floor_number: number
          id?: string
          project_id: string
          status?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          floor_number?: number
          id?: string
          project_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "floors_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      funding_requests: {
        Row: {
          amount: number
          approver_id: string | null
          approver_ids: string[]
          category: string
          cleared_by: string[]
          company_id: string
          created_at: string
          currency: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          expense_id: string | null
          floor_id: string | null
          id: string
          note: string | null
          project_id: string
          requested_by: string
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          approver_id?: string | null
          approver_ids?: string[]
          category: string
          cleared_by?: string[]
          company_id: string
          created_at?: string
          currency?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          expense_id?: string | null
          floor_id?: string | null
          id?: string
          note?: string | null
          project_id: string
          requested_by: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          approver_id?: string | null
          approver_ids?: string[]
          category?: string
          cleared_by?: string[]
          company_id?: string
          created_at?: string
          currency?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          expense_id?: string | null
          floor_id?: string | null
          id?: string
          note?: string | null
          project_id?: string
          requested_by?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "funding_requests_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funding_requests_floor_id_fkey"
            columns: ["floor_id"]
            isOneToOne: false
            referencedRelation: "floors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funding_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      hidden_work_acts: {
        Row: {
          act_date: string
          act_number: string
          company_id: string
          contractor_signature: string | null
          created_at: string
          created_by: string | null
          customer_signature: string | null
          file_path: string | null
          id: string
          inspector_name: string | null
          location: string | null
          materials_used: string | null
          note: string | null
          project_id: string
          updated_at: string
          work_description: string
        }
        Insert: {
          act_date?: string
          act_number: string
          company_id: string
          contractor_signature?: string | null
          created_at?: string
          created_by?: string | null
          customer_signature?: string | null
          file_path?: string | null
          id?: string
          inspector_name?: string | null
          location?: string | null
          materials_used?: string | null
          note?: string | null
          project_id: string
          updated_at?: string
          work_description: string
        }
        Update: {
          act_date?: string
          act_number?: string
          company_id?: string
          contractor_signature?: string | null
          created_at?: string
          created_by?: string | null
          customer_signature?: string | null
          file_path?: string | null
          id?: string
          inspector_name?: string | null
          location?: string | null
          materials_used?: string | null
          note?: string | null
          project_id?: string
          updated_at?: string
          work_description?: string
        }
        Relationships: [
          {
            foreignKeyName: "hidden_work_acts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hidden_work_acts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      material_acceptance_acts: {
        Row: {
          act_date: string
          actual_qty: number
          company_id: string
          created_at: string
          created_by: string | null
          estimate_item_id: string | null
          id: string
          inspector: string | null
          loss_amount: number | null
          material_name: string
          mixer_count: number | null
          mixer_volume: number | null
          note: string | null
          ordered_qty: number
          photo_paths: string[]
          project_id: string | null
          supplier: string | null
          unit: string | null
          unit_price: number
          updated_at: string
          variance: number | null
          variance_pct: number | null
        }
        Insert: {
          act_date?: string
          actual_qty?: number
          company_id: string
          created_at?: string
          created_by?: string | null
          estimate_item_id?: string | null
          id?: string
          inspector?: string | null
          loss_amount?: number | null
          material_name: string
          mixer_count?: number | null
          mixer_volume?: number | null
          note?: string | null
          ordered_qty?: number
          photo_paths?: string[]
          project_id?: string | null
          supplier?: string | null
          unit?: string | null
          unit_price?: number
          updated_at?: string
          variance?: number | null
          variance_pct?: number | null
        }
        Update: {
          act_date?: string
          actual_qty?: number
          company_id?: string
          created_at?: string
          created_by?: string | null
          estimate_item_id?: string | null
          id?: string
          inspector?: string | null
          loss_amount?: number | null
          material_name?: string
          mixer_count?: number | null
          mixer_volume?: number | null
          note?: string | null
          ordered_qty?: number
          photo_paths?: string[]
          project_id?: string | null
          supplier?: string | null
          unit?: string | null
          unit_price?: number
          updated_at?: string
          variance?: number | null
          variance_pct?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "material_acceptance_acts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_acceptance_acts_estimate_item_id_fkey"
            columns: ["estimate_item_id"]
            isOneToOne: false
            referencedRelation: "estimate_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_acceptance_acts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      material_movements: {
        Row: {
          created_at: string
          created_by: string | null
          expense_id: string | null
          id: string
          material_id: string
          movement_date: string
          note: string | null
          project_id: string
          quantity: number
          total: number
          type: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expense_id?: string | null
          id?: string
          material_id: string
          movement_date?: string
          note?: string | null
          project_id: string
          quantity: number
          total?: number
          type: string
          unit_price?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expense_id?: string | null
          id?: string
          material_id?: string
          movement_date?: string
          note?: string | null
          project_id?: string
          quantity?: number
          total?: number
          type?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "material_movements_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_movements_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_movements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      materials: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          project_id: string
          quantity: number
          unit: string
          unit_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          project_id: string
          quantity?: number
          unit?: string
          unit_price?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          project_id?: string
          quantity?: number
          unit?: string
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "materials_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_reads: {
        Row: {
          notification_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          notification_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          notification_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_reads_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          contact_phone: string | null
          created_at: string
          created_by: string | null
          id: string
          media_items: Json
          media_type: string | null
          media_url: string | null
          title: string
        }
        Insert: {
          body?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          media_items?: Json
          media_type?: string | null
          media_url?: string | null
          title: string
        }
        Update: {
          body?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          media_items?: Json
          media_type?: string | null
          media_url?: string | null
          title?: string
        }
        Relationships: []
      }
      partner_distributions: {
        Row: {
          amount: number
          company_id: string
          created_at: string
          director_user_id: string
          id: string
          payment_id: string
          payout_id: string | null
          percent: number
          project_id: string
          sale_id: string
          status: string
        }
        Insert: {
          amount: number
          company_id: string
          created_at?: string
          director_user_id: string
          id?: string
          payment_id: string
          payout_id?: string | null
          percent: number
          project_id: string
          sale_id: string
          status?: string
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string
          director_user_id?: string
          id?: string
          payment_id?: string
          payout_id?: string | null
          percent?: number
          project_id?: string
          sale_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_distributions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_distributions_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_distributions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_distributions_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_payouts: {
        Row: {
          amount: number
          company_id: string
          created_at: string
          created_by: string | null
          director_user_id: string
          expense_id: string | null
          id: string
          note: string | null
          paid_date: string
          project_id: string
        }
        Insert: {
          amount: number
          company_id: string
          created_at?: string
          created_by?: string | null
          director_user_id: string
          expense_id?: string | null
          id?: string
          note?: string | null
          paid_date?: string
          project_id: string
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string
          created_by?: string | null
          director_user_id?: string
          expense_id?: string | null
          id?: string
          note?: string | null
          paid_date?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_payouts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_payouts_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_payouts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_shares: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          director_user_id: string
          id: string
          note: string | null
          percent: number
          project_id: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          director_user_id: string
          id?: string
          note?: string | null
          percent: number
          project_id: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          director_user_id?: string
          id?: string
          note?: string | null
          percent?: number
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_shares_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_shares_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      payable_payments: {
        Row: {
          amount: number
          comment: string | null
          created_at: string
          created_by: string | null
          document_file: string | null
          id: string
          method: string | null
          payable_id: string
          payment_date: string
        }
        Insert: {
          amount: number
          comment?: string | null
          created_at?: string
          created_by?: string | null
          document_file?: string | null
          id?: string
          method?: string | null
          payable_id: string
          payment_date?: string
        }
        Update: {
          amount?: number
          comment?: string | null
          created_at?: string
          created_by?: string | null
          document_file?: string | null
          id?: string
          method?: string | null
          payable_id?: string
          payment_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "payable_payments_payable_id_fkey"
            columns: ["payable_id"]
            isOneToOne: false
            referencedRelation: "payables"
            referencedColumns: ["id"]
          },
        ]
      }
      payables: {
        Row: {
          archived: boolean
          category: string
          company_id: string
          counterparty: string
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          document_file: string | null
          due_date: string
          id: string
          paid_amount: number
          project_id: string | null
          status: string
          supplier_id: string | null
          total_amount: number
          updated_at: string
        }
        Insert: {
          archived?: boolean
          category: string
          company_id: string
          counterparty: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          document_file?: string | null
          due_date: string
          id?: string
          paid_amount?: number
          project_id?: string | null
          status?: string
          supplier_id?: string | null
          total_amount: number
          updated_at?: string
        }
        Update: {
          archived?: boolean
          category?: string
          company_id?: string
          counterparty?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          document_file?: string | null
          due_date?: string
          id?: string
          paid_amount?: number
          project_id?: string | null
          status?: string
          supplier_id?: string | null
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payables_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payables_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payables_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          card_number: string
          created_at: string
          holder_name: string | null
          id: string
          is_active: boolean
          label: string
          note: string | null
          provider: string
          updated_at: string
        }
        Insert: {
          card_number: string
          created_at?: string
          holder_name?: string | null
          id?: string
          is_active?: boolean
          label: string
          note?: string | null
          provider: string
          updated_at?: string
        }
        Update: {
          card_number?: string
          created_at?: string
          holder_name?: string | null
          id?: string
          is_active?: boolean
          label?: string
          note?: string | null
          provider?: string
          updated_at?: string
        }
        Relationships: []
      }
      payment_schedule: {
        Row: {
          amount: number
          created_at: string
          due_date: string
          id: string
          paid_amount: number
          sale_id: string
          status: string
        }
        Insert: {
          amount: number
          created_at?: string
          due_date: string
          id?: string
          paid_amount?: number
          sale_id: string
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          due_date?: string
          id?: string
          paid_amount?: number
          sale_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_schedule_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          check_number: number | null
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          created_by: string | null
          currency: string
          id: string
          note: string | null
          payment_date: string
          payment_method: string
          receipt_file: string | null
          sale_id: string
          status: string
        }
        Insert: {
          amount: number
          check_number?: number | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          note?: string | null
          payment_date?: string
          payment_method?: string
          receipt_file?: string | null
          sale_id: string
          status?: string
        }
        Update: {
          amount?: number
          check_number?: number | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          note?: string | null
          payment_date?: string
          payment_method?: string
          receipt_file?: string | null
          sale_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      permits: {
        Row: {
          authority: string | null
          company_id: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          file_path: string | null
          id: string
          issued_date: string | null
          name: string
          note: string | null
          permit_number: string | null
          project_id: string | null
          reminder_days: number | null
          updated_at: string
        }
        Insert: {
          authority?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          file_path?: string | null
          id?: string
          issued_date?: string | null
          name: string
          note?: string | null
          permit_number?: string | null
          project_id?: string | null
          reminder_days?: number | null
          updated_at?: string
        }
        Update: {
          authority?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          file_path?: string | null
          id?: string
          issued_date?: string | null
          name?: string
          note?: string | null
          permit_number?: string | null
          project_id?: string | null
          reminder_days?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "permits_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permits_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      profiles: {
        Row: {
          company_id: string | null
          created_at: string
          denied_pages: string[]
          department: string | null
          extra_pages: string[]
          fullname: string
          id: string
          phone: string | null
          pin_hash: string | null
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          denied_pages?: string[]
          department?: string | null
          extra_pages?: string[]
          fullname?: string
          id: string
          phone?: string | null
          pin_hash?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          denied_pages?: string[]
          department?: string | null
          extra_pages?: string[]
          fullname?: string
          id?: string
          phone?: string | null
          pin_hash?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      project_budgets: {
        Row: {
          category: string
          company_id: string
          created_at: string
          created_by: string | null
          floor_id: string | null
          id: string
          note: string | null
          planned_amount: number
          project_id: string
          quantity: number | null
          unit: string | null
          unit_price: number | null
          updated_at: string
        }
        Insert: {
          category: string
          company_id: string
          created_at?: string
          created_by?: string | null
          floor_id?: string | null
          id?: string
          note?: string | null
          planned_amount?: number
          project_id: string
          quantity?: number | null
          unit?: string | null
          unit_price?: number | null
          updated_at?: string
        }
        Update: {
          category?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          floor_id?: string | null
          id?: string
          note?: string | null
          planned_amount?: number
          project_id?: string
          quantity?: number | null
          unit?: string | null
          unit_price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_budgets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_budgets_floor_id_fkey"
            columns: ["floor_id"]
            isOneToOne: false
            referencedRelation: "floors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_budgets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_staff: {
        Row: {
          created_at: string
          id: string
          project_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_staff_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_stages: {
        Row: {
          alert_days: number | null
          assignee_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          deadline: string | null
          depends_on: string | null
          description: string | null
          end_date: string | null
          id: string
          name: string
          progress: number
          project_id: string
          sort_order: number
          start_date: string | null
          status: string
          updated_at: string
          weight: number
        }
        Insert: {
          alert_days?: number | null
          assignee_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          depends_on?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          name: string
          progress?: number
          project_id: string
          sort_order?: number
          start_date?: string | null
          status?: string
          updated_at?: string
          weight?: number
        }
        Update: {
          alert_days?: number | null
          assignee_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          depends_on?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          name?: string
          progress?: number
          project_id?: string
          sort_order?: number
          start_date?: string | null
          status?: string
          updated_at?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_stages_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_stages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_stages_depends_on_fkey"
            columns: ["depends_on"]
            isOneToOne: false
            referencedRelation: "project_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_stages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          company_id: string | null
          cost_currency: string
          cost_per_sqm: number | null
          cover_url: string | null
          created_at: string
          description: string | null
          id: string
          location: string | null
          model_3d_path: string | null
          name: string
          parent_id: string | null
          public_showcase: boolean
          show_prices: boolean
          status: Database["public"]["Enums"]["project_status"]
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          cost_currency?: string
          cost_per_sqm?: number | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          location?: string | null
          model_3d_path?: string | null
          name: string
          parent_id?: string | null
          public_showcase?: boolean
          show_prices?: boolean
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          cost_currency?: string
          cost_per_sqm?: number | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          location?: string | null
          model_3d_path?: string | null
          name?: string
          parent_id?: string | null
          public_showcase?: boolean
          show_prices?: boolean
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_checks: {
        Row: {
          check_date: string
          check_name: string
          checklist: Json | null
          created_at: string
          created_by: string | null
          id: string
          inspector: string | null
          issues: string | null
          photo_url: string | null
          project_id: string
          result: string
          stage_id: string | null
          updated_at: string
        }
        Insert: {
          check_date?: string
          check_name: string
          checklist?: Json | null
          created_at?: string
          created_by?: string | null
          id?: string
          inspector?: string | null
          issues?: string | null
          photo_url?: string | null
          project_id: string
          result?: string
          stage_id?: string | null
          updated_at?: string
        }
        Update: {
          check_date?: string
          check_name?: string
          checklist?: Json | null
          created_at?: string
          created_by?: string | null
          id?: string
          inspector?: string | null
          issues?: string | null
          photo_url?: string | null
          project_id?: string
          result?: string
          stage_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quality_checks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_checks_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "project_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      resettlements: {
        Row: {
          additional_area: number
          apartment_id: string | null
          cadastral_number: string | null
          cash_amount: number
          company_id: string | null
          compensation_area: number
          compensation_type: string
          created_at: string
          created_by: string | null
          customer_id: string | null
          discount: number
          expense_id: string | null
          id: string
          land_area: number
          note: string | null
          old_address: string | null
          old_house_area: number
          owner_fullname: string
          ownership_document: string | null
          phone: string | null
          photo_url: string | null
          price_per_m2: number
          project_id: string
          sale_id: string | null
          status: string
          total_payable: number | null
          updated_at: string
        }
        Insert: {
          additional_area?: number
          apartment_id?: string | null
          cadastral_number?: string | null
          cash_amount?: number
          company_id?: string | null
          compensation_area?: number
          compensation_type?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          discount?: number
          expense_id?: string | null
          id?: string
          land_area?: number
          note?: string | null
          old_address?: string | null
          old_house_area?: number
          owner_fullname: string
          ownership_document?: string | null
          phone?: string | null
          photo_url?: string | null
          price_per_m2?: number
          project_id: string
          sale_id?: string | null
          status?: string
          total_payable?: number | null
          updated_at?: string
        }
        Update: {
          additional_area?: number
          apartment_id?: string | null
          cadastral_number?: string | null
          cash_amount?: number
          company_id?: string | null
          compensation_area?: number
          compensation_type?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          discount?: number
          expense_id?: string | null
          id?: string
          land_area?: number
          note?: string | null
          old_address?: string | null
          old_house_area?: number
          owner_fullname?: string
          ownership_document?: string | null
          phone?: string | null
          photo_url?: string | null
          price_per_m2?: number
          project_id?: string
          sale_id?: string | null
          status?: string
          total_payable?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "resettlements_apartment_id_fkey"
            columns: ["apartment_id"]
            isOneToOne: false
            referencedRelation: "apartments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resettlements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resettlements_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resettlements_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resettlements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resettlements_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_accruals: {
        Row: {
          amount: number
          company_id: string
          created_at: string
          id: string
          period: string
          updated_at: string
          worker_id: string
        }
        Insert: {
          amount?: number
          company_id: string
          created_at?: string
          id?: string
          period: string
          updated_at?: string
          worker_id: string
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string
          id?: string
          period?: string
          updated_at?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "salary_accruals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_accruals_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          apartment_id: string
          area_snapshot: number | null
          base_price_per_m2: number | null
          commission_amount: number
          commission_percent: number
          company_id: string | null
          cost_ratio: number | null
          created_at: string
          created_by: string | null
          currency: string
          customer_id: string
          full_price: number
          id: string
          installment_months: number
          paid_amount: number
          partner_shares_snapshot: Json | null
          passport_back_path: string | null
          passport_front_path: string | null
          payment_deadline: string | null
          project_id: string
          remaining_amount: number | null
          sale_number: number | null
          sale_price_per_m2: number | null
          sales_manager_id: string | null
          status: Database["public"]["Enums"]["sale_status"]
          updated_at: string
        }
        Insert: {
          apartment_id: string
          area_snapshot?: number | null
          base_price_per_m2?: number | null
          commission_amount?: number
          commission_percent?: number
          company_id?: string | null
          cost_ratio?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id: string
          full_price: number
          id?: string
          installment_months?: number
          paid_amount?: number
          partner_shares_snapshot?: Json | null
          passport_back_path?: string | null
          passport_front_path?: string | null
          payment_deadline?: string | null
          project_id: string
          remaining_amount?: number | null
          sale_number?: number | null
          sale_price_per_m2?: number | null
          sales_manager_id?: string | null
          status?: Database["public"]["Enums"]["sale_status"]
          updated_at?: string
        }
        Update: {
          apartment_id?: string
          area_snapshot?: number | null
          base_price_per_m2?: number | null
          commission_amount?: number
          commission_percent?: number
          company_id?: string | null
          cost_ratio?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id?: string
          full_price?: number
          id?: string
          installment_months?: number
          paid_amount?: number
          partner_shares_snapshot?: Json | null
          passport_back_path?: string | null
          passport_front_path?: string | null
          payment_deadline?: string | null
          project_id?: string
          remaining_amount?: number | null
          sale_number?: number | null
          sale_price_per_m2?: number | null
          sales_manager_id?: string | null
          status?: Database["public"]["Enums"]["sale_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_apartment_id_fkey"
            columns: ["apartment_id"]
            isOneToOne: false
            referencedRelation: "apartments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_sales_manager_id_fkey"
            columns: ["sales_manager_id"]
            isOneToOne: false
            referencedRelation: "sales_team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_team_members: {
        Row: {
          company_id: string
          created_at: string
          email: string | null
          fullname: string
          id: string
          is_active: boolean
          kind: string
          owner_user_id: string
          percent: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          email?: string | null
          fullname: string
          id?: string
          is_active?: boolean
          kind?: string
          owner_user_id: string
          percent?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          email?: string | null
          fullname?: string
          id?: string
          is_active?: boolean
          kind?: string
          owner_user_id?: string
          percent?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_team_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_team_payouts: {
        Row: {
          amount: number
          company_id: string
          created_at: string
          id: string
          member_id: string
          note: string | null
          owner_user_id: string
          paid_at: string
          updated_at: string
        }
        Insert: {
          amount: number
          company_id: string
          created_at?: string
          id?: string
          member_id: string
          note?: string | null
          owner_user_id: string
          paid_at?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string
          id?: string
          member_id?: string
          note?: string | null
          owner_user_id?: string
          paid_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_team_payouts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_team_payouts_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "sales_team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      scan_credit_packages: {
        Row: {
          amount: number
          created_at: string
          id: string
          is_active: boolean
          is_best: boolean
          label: string
          size: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          is_active?: boolean
          is_best?: boolean
          label?: string
          size: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          is_active?: boolean
          is_best?: boolean
          label?: string
          size?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      scan_credit_purchases: {
        Row: {
          amount: number
          company_id: string
          created_at: string
          id: string
          note: string | null
          package_size: number
          receipt_path: string | null
          rejection_reason: string | null
          requested_by: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          amount: number
          company_id: string
          created_at?: string
          id?: string
          note?: string | null
          package_size: number
          receipt_path?: string | null
          rejection_reason?: string | null
          requested_by: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string
          id?: string
          note?: string | null
          package_size?: number
          receipt_path?: string | null
          rejection_reason?: string | null
          requested_by?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "scan_credit_purchases_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      showcase_companies: {
        Row: {
          company_name: string
          created_at: string
          id: string
          is_active: boolean
          logo_path: string | null
          logo_url: string | null
          phone: string | null
          sort_order: number
          updated_at: string
          website: string | null
        }
        Insert: {
          company_name: string
          created_at?: string
          id?: string
          is_active?: boolean
          logo_path?: string | null
          logo_url?: string | null
          phone?: string | null
          sort_order?: number
          updated_at?: string
          website?: string | null
        }
        Update: {
          company_name?: string
          created_at?: string
          id?: string
          is_active?: boolean
          logo_path?: string | null
          logo_url?: string | null
          phone?: string | null
          sort_order?: number
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      site_incidents: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          id: string
          incident_date: string
          incident_type: string
          latitude: number | null
          longitude: number | null
          photo_url: string | null
          project_id: string
          reported_by: string | null
          resolution: string | null
          resolved: boolean
          severity: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          incident_date?: string
          incident_type?: string
          latitude?: number | null
          longitude?: number | null
          photo_url?: string | null
          project_id: string
          reported_by?: string | null
          resolution?: string | null
          resolved?: boolean
          severity?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          incident_date?: string
          incident_type?: string
          latitude?: number | null
          longitude?: number | null
          photo_url?: string | null
          project_id?: string
          reported_by?: string | null
          resolution?: string | null
          resolved?: boolean
          severity?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_incidents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      site_plan_requests: {
        Row: {
          business_type: string
          company_name: string
          created_at: string
          email: string
          full_name: string
          id: string
          job_title: string
          locale: string
          phone: string
          plan_code: string
          status: string
          updated_at: string
        }
        Insert: {
          business_type: string
          company_name: string
          created_at?: string
          email: string
          full_name: string
          id?: string
          job_title: string
          locale?: string
          phone: string
          plan_code: string
          status?: string
          updated_at?: string
        }
        Update: {
          business_type?: string
          company_name?: string
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          job_title?: string
          locale?: string
          phone?: string
          plan_code?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      sms_logs: {
        Row: {
          company_id: string
          created_at: string
          customer_phone: string | null
          due_date: string | null
          error: string | null
          id: string
          message: string | null
          reminder_key: string | null
          schedule_id: string | null
          stage: string | null
          status: string
        }
        Insert: {
          company_id: string
          created_at?: string
          customer_phone?: string | null
          due_date?: string | null
          error?: string | null
          id?: string
          message?: string | null
          reminder_key?: string | null
          schedule_id?: string | null
          stage?: string | null
          status?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          customer_phone?: string | null
          due_date?: string | null
          error?: string | null
          id?: string
          message?: string | null
          reminder_key?: string | null
          schedule_id?: string | null
          stage?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_logs_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "payment_schedule"
            referencedColumns: ["id"]
          },
        ]
      }
      stage_tasks: {
        Row: {
          assignee_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string | null
          id: string
          name: string
          progress: number
          project_id: string
          sort_order: number
          stage_id: string
          start_date: string | null
          updated_at: string
          weight: number
        }
        Insert: {
          assignee_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          name: string
          progress?: number
          project_id: string
          sort_order?: number
          stage_id: string
          start_date?: string | null
          updated_at?: string
          weight?: number
        }
        Update: {
          assignee_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          name?: string
          progress?: number
          project_id?: string
          sort_order?: number
          stage_id?: string
          start_date?: string | null
          updated_at?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "stage_tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stage_tasks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stage_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stage_tasks_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "project_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      stage_updates: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          photo_path: string | null
          progress: number
          project_id: string
          stage_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          photo_path?: string | null
          progress: number
          project_id: string
          stage_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          photo_path?: string | null
          progress?: number
          project_id?: string
          stage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stage_updates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stage_updates_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "project_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_publications: {
        Row: {
          channels: Json
          company_id: string
          created_at: string
          id: string
          project_id: string
          public_token: string
          published_at: string
          updated_at: string
        }
        Insert: {
          channels?: Json
          company_id: string
          created_at?: string
          id?: string
          project_id: string
          public_token?: string
          published_at?: string
          updated_at?: string
        }
        Update: {
          channels?: Json
          company_id?: string
          created_at?: string
          id?: string
          project_id?: string
          public_token?: string
          published_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_publications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "studio_publications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      subcontract_acts: {
        Row: {
          act_number: string | null
          act_type: string
          amount: number
          created_at: string
          created_by: string | null
          done_qty: number
          file_url: string | null
          id: string
          note: string | null
          signed_date: string
          updated_at: string
          work_id: string
        }
        Insert: {
          act_number?: string | null
          act_type?: string
          amount?: number
          created_at?: string
          created_by?: string | null
          done_qty?: number
          file_url?: string | null
          id?: string
          note?: string | null
          signed_date?: string
          updated_at?: string
          work_id: string
        }
        Update: {
          act_number?: string | null
          act_type?: string
          amount?: number
          created_at?: string
          created_by?: string | null
          done_qty?: number
          file_url?: string | null
          id?: string
          note?: string | null
          signed_date?: string
          updated_at?: string
          work_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subcontract_acts_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "subcontract_works"
            referencedColumns: ["id"]
          },
        ]
      }
      subcontract_payments: {
        Row: {
          act_id: string | null
          amount: number
          created_at: string
          created_by: string | null
          expense_id: string | null
          id: string
          method: string | null
          note: string | null
          paid_date: string
          updated_at: string
          work_id: string
        }
        Insert: {
          act_id?: string | null
          amount: number
          created_at?: string
          created_by?: string | null
          expense_id?: string | null
          id?: string
          method?: string | null
          note?: string | null
          paid_date?: string
          updated_at?: string
          work_id: string
        }
        Update: {
          act_id?: string | null
          amount?: number
          created_at?: string
          created_by?: string | null
          expense_id?: string | null
          id?: string
          method?: string | null
          note?: string | null
          paid_date?: string
          updated_at?: string
          work_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subcontract_payments_act_id_fkey"
            columns: ["act_id"]
            isOneToOne: false
            referencedRelation: "subcontract_acts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subcontract_payments_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subcontract_payments_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "subcontract_works"
            referencedColumns: ["id"]
          },
        ]
      }
      subcontract_works: {
        Row: {
          company_id: string
          contract_amount: number | null
          created_at: string
          created_by: string | null
          done_qty: number
          end_date: string | null
          id: string
          note: string | null
          planned_qty: number
          project_id: string
          start_date: string | null
          status: string
          subcontractor_id: string
          unit: string
          unit_price: number
          updated_at: string
          work_name: string
        }
        Insert: {
          company_id: string
          contract_amount?: number | null
          created_at?: string
          created_by?: string | null
          done_qty?: number
          end_date?: string | null
          id?: string
          note?: string | null
          planned_qty?: number
          project_id: string
          start_date?: string | null
          status?: string
          subcontractor_id: string
          unit?: string
          unit_price?: number
          updated_at?: string
          work_name: string
        }
        Update: {
          company_id?: string
          contract_amount?: number | null
          created_at?: string
          created_by?: string | null
          done_qty?: number
          end_date?: string | null
          id?: string
          note?: string | null
          planned_qty?: number
          project_id?: string
          start_date?: string | null
          status?: string
          subcontractor_id?: string
          unit?: string
          unit_price?: number
          updated_at?: string
          work_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "subcontract_works_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subcontract_works_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subcontract_works_subcontractor_id_fkey"
            columns: ["subcontractor_id"]
            isOneToOne: false
            referencedRelation: "subcontractors"
            referencedColumns: ["id"]
          },
        ]
      }
      subcontractors: {
        Row: {
          brigade_name: string
          company_id: string
          created_at: string
          created_by: string | null
          foreman_name: string | null
          id: string
          inn: string | null
          is_active: boolean
          note: string | null
          phone: string | null
          specialty: string
          updated_at: string
        }
        Insert: {
          brigade_name: string
          company_id: string
          created_at?: string
          created_by?: string | null
          foreman_name?: string | null
          id?: string
          inn?: string | null
          is_active?: boolean
          note?: string | null
          phone?: string | null
          specialty?: string
          updated_at?: string
        }
        Update: {
          brigade_name?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          foreman_name?: string | null
          id?: string
          inn?: string | null
          is_active?: boolean
          note?: string | null
          phone?: string | null
          specialty?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subcontractors_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_payments: {
        Row: {
          activated_until: string | null
          amount: number
          company_id: string
          created_at: string
          created_by: string
          currency: string
          id: string
          payment_method_id: string | null
          receipt_url: string
          reject_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          tariff_id: string | null
          updated_at: string
        }
        Insert: {
          activated_until?: string | null
          amount: number
          company_id: string
          created_at?: string
          created_by?: string
          currency?: string
          id?: string
          payment_method_id?: string | null
          receipt_url: string
          reject_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          tariff_id?: string | null
          updated_at?: string
        }
        Update: {
          activated_until?: string | null
          amount?: number
          company_id?: string
          created_at?: string
          created_by?: string
          currency?: string
          id?: string
          payment_method_id?: string | null
          receipt_url?: string
          reject_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          tariff_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_payments_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_payments_tariff_id_fkey"
            columns: ["tariff_id"]
            isOneToOne: false
            referencedRelation: "tariffs"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          archived: boolean
          company_id: string
          contact_person: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          note: string | null
          patent_number: string | null
          patent_photo_path: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          archived?: boolean
          company_id: string
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          note?: string | null
          patent_number?: string | null
          patent_photo_path?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          archived?: boolean
          company_id?: string
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          note?: string | null
          patent_number?: string | null
          patent_photo_path?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      supply_alerts: {
        Row: {
          company_id: string
          created_at: string
          id: string
          item_id: string | null
          item_name: string
          quantity: number
          resolved: boolean
          sms_status: string | null
          threshold: number
          unit: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          item_id?: string | null
          item_name: string
          quantity?: number
          resolved?: boolean
          sms_status?: string | null
          threshold?: number
          unit?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          item_id?: string | null
          item_name?: string
          quantity?: number
          resolved?: boolean
          sms_status?: string | null
          threshold?: number
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supply_alerts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supply_alerts_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "warehouse_items"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          admin_reply: string | null
          company_id: string | null
          created_at: string
          id: string
          message: string
          screenshot_url: string | null
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_reply?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          message: string
          screenshot_url?: string | null
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_reply?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          message?: string
          screenshot_url?: string | null
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      tariffs: {
        Row: {
          billing_period: string
          created_at: string
          currency: string
          description: string | null
          duration_days: number | null
          features: string[]
          id: string
          is_active: boolean
          max_blocks: number | null
          max_projects: number | null
          max_staff: number | null
          name: string
          price: number
          support_days: number | null
          updated_at: string
        }
        Insert: {
          billing_period?: string
          created_at?: string
          currency?: string
          description?: string | null
          duration_days?: number | null
          features?: string[]
          id?: string
          is_active?: boolean
          max_blocks?: number | null
          max_projects?: number | null
          max_staff?: number | null
          name: string
          price?: number
          support_days?: number | null
          updated_at?: string
        }
        Update: {
          billing_period?: string
          created_at?: string
          currency?: string
          description?: string | null
          duration_days?: number | null
          features?: string[]
          id?: string
          is_active?: boolean
          max_blocks?: number | null
          max_projects?: number | null
          max_staff?: number | null
          name?: string
          price?: number
          support_days?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      tax_reports: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          data: Json | null
          expenses: number | null
          file_path: string | null
          id: string
          note: string | null
          period_end: string
          period_start: string
          profit: number | null
          report_type: string
          revenue: number | null
          status: string | null
          submitted_at: string | null
          tax_amount: number | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          data?: Json | null
          expenses?: number | null
          file_path?: string | null
          id?: string
          note?: string | null
          period_end: string
          period_start: string
          profit?: number | null
          report_type: string
          revenue?: number | null
          status?: string | null
          submitted_at?: string | null
          tax_amount?: number | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          data?: Json | null
          expenses?: number | null
          file_path?: string | null
          id?: string
          note?: string | null
          period_end?: string
          period_start?: string
          profit?: number | null
          report_type?: string
          revenue?: number | null
          status?: string | null
          submitted_at?: string | null
          tax_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_reports_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      tour_templates: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          label: string
          panorama_url: string | null
          preview_url: string | null
          rooms_count: number
          sort_order: number
          style: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          panorama_url?: string | null
          preview_url?: string | null
          rooms_count: number
          sort_order?: number
          style?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          panorama_url?: string | null
          preview_url?: string | null
          rooms_count?: number
          sort_order?: number
          style?: string
          updated_at?: string
        }
        Relationships: []
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
      warehouse_issues: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          issue_date: string
          item_id: string | null
          name: string
          project_id: string
          quantity: number
          total: number
          unit: string
          unit_price: number | null
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          issue_date?: string
          item_id?: string | null
          name: string
          project_id: string
          quantity: number
          total?: number
          unit?: string
          unit_price?: number | null
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          issue_date?: string
          item_id?: string | null
          name?: string
          project_id?: string
          quantity?: number
          total?: number
          unit?: string
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_issues_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_issues_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "warehouse_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_issues_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouse_items: {
        Row: {
          company_id: string
          created_at: string
          id: string
          min_quantity: number
          name: string
          quantity: number
          unit: string
          unit_price: number
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          min_quantity?: number
          name: string
          quantity?: number
          unit?: string
          unit_price?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          min_quantity?: number
          name?: string
          quantity?: number
          unit?: string
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouse_receipts: {
        Row: {
          check_number: string | null
          check_photo_path: string | null
          company_id: string
          created_at: string
          created_by: string | null
          docs_source: string
          id: string
          item_id: string | null
          name: string
          patent_photo_path: string | null
          payment_status: string
          quantity: number
          receipt_date: string
          supplier_fio: string | null
          supplier_id: string | null
          total: number | null
          unit: string
          unit_price: number
        }
        Insert: {
          check_number?: string | null
          check_photo_path?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          docs_source?: string
          id?: string
          item_id?: string | null
          name: string
          patent_photo_path?: string | null
          payment_status?: string
          quantity: number
          receipt_date?: string
          supplier_fio?: string | null
          supplier_id?: string | null
          total?: number | null
          unit?: string
          unit_price?: number
        }
        Update: {
          check_number?: string | null
          check_photo_path?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          docs_source?: string
          id?: string
          item_id?: string | null
          name?: string
          patent_photo_path?: string | null
          payment_status?: string
          quantity?: number
          receipt_date?: string
          supplier_fio?: string | null
          supplier_id?: string | null
          total?: number | null
          unit?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_receipts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_receipts_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "warehouse_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_receipts_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_accounts: {
        Row: {
          company_id: string
          created_at: string
          enabled: boolean
          id: string
          label: string | null
          phone: string | null
          profile_id: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          enabled?: boolean
          id?: string
          label?: string | null
          phone?: string | null
          profile_id: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          enabled?: boolean
          id?: string
          label?: string | null
          phone?: string | null
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_chats: {
        Row: {
          avatar_url: string | null
          chat_id: string
          company_id: string
          created_at: string
          customer_id: string | null
          display_name: string | null
          id: string
          last_direction: string | null
          last_message_at: string | null
          last_message_text: string | null
          phone: string
          profile_id: string | null
          unread_count: number
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          chat_id: string
          company_id: string
          created_at?: string
          customer_id?: string | null
          display_name?: string | null
          id?: string
          last_direction?: string | null
          last_message_at?: string | null
          last_message_text?: string | null
          phone: string
          profile_id?: string | null
          unread_count?: number
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          chat_id?: string
          company_id?: string
          created_at?: string
          customer_id?: string | null
          display_name?: string | null
          id?: string
          last_direction?: string | null
          last_message_at?: string | null
          last_message_text?: string | null
          phone?: string
          profile_id?: string | null
          unread_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_chats_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_chats_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          body: string | null
          chat_id: string
          company_id: string
          created_at: string
          created_by: string | null
          customer_id: string | null
          direction: string
          error_text: string | null
          id: string
          media_meta: Json | null
          media_url: string | null
          message_type: string
          raw: Json | null
          sent_at: string
          status: string
          updated_at: string
          wappi_message_id: string | null
        }
        Insert: {
          body?: string | null
          chat_id: string
          company_id: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          direction: string
          error_text?: string | null
          id?: string
          media_meta?: Json | null
          media_url?: string | null
          message_type?: string
          raw?: Json | null
          sent_at?: string
          status?: string
          updated_at?: string
          wappi_message_id?: string | null
        }
        Update: {
          body?: string | null
          chat_id?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          direction?: string
          error_text?: string | null
          id?: string
          media_meta?: Json | null
          media_url?: string | null
          message_type?: string
          raw?: Json | null
          sent_at?: string
          status?: string
          updated_at?: string
          wappi_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_webhook_logs: {
        Row: {
          company_id: string | null
          created_at: string
          detail: Json | null
          event: string | null
          id: string
          level: string
          message: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          detail?: Json | null
          event?: string | null
          id?: string
          level?: string
          message?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          detail?: Json | null
          event?: string | null
          id?: string
          level?: string
          message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_webhook_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_payments: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          days_worked: number
          expense_id: string | null
          id: string
          note: string | null
          paid_amount: number
          period_from: string
          period_to: string
          project_id: string | null
          status: string
          total_amount: number
          updated_at: string
          worker_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          days_worked?: number
          expense_id?: string | null
          id?: string
          note?: string | null
          paid_amount?: number
          period_from: string
          period_to: string
          project_id?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
          worker_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          days_worked?: number
          expense_id?: string | null
          id?: string
          note?: string | null
          paid_amount?: number
          period_from?: string
          period_to?: string
          project_id?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "worker_payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_payments_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_payments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_payments_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      workers: {
        Row: {
          block_id: string | null
          company_id: string
          cost_center: string
          created_at: string
          daily_rate: number
          face_enrolled_at: string | null
          face_photo_path: string | null
          face_required: boolean
          fullname: string
          id: string
          is_active: boolean
          monthly_salary: number
          passport_number: string | null
          phone: string | null
          position: string | null
          project_id: string | null
          salary_start_date: string | null
          updated_at: string
        }
        Insert: {
          block_id?: string | null
          company_id: string
          cost_center?: string
          created_at?: string
          daily_rate?: number
          face_enrolled_at?: string | null
          face_photo_path?: string | null
          face_required?: boolean
          fullname: string
          id?: string
          is_active?: boolean
          monthly_salary?: number
          passport_number?: string | null
          phone?: string | null
          position?: string | null
          project_id?: string | null
          salary_start_date?: string | null
          updated_at?: string
        }
        Update: {
          block_id?: string | null
          company_id?: string
          cost_center?: string
          created_at?: string
          daily_rate?: number
          face_enrolled_at?: string | null
          face_photo_path?: string | null
          face_required?: boolean
          fullname?: string
          id?: string
          is_active?: boolean
          monthly_salary?: number
          passport_number?: string | null
          phone?: string | null
          position?: string | null
          project_id?: string | null
          salary_start_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workers_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workers_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      showcase_companies_public: {
        Row: {
          company_name: string | null
          id: string | null
          logo_url: string | null
          sort_order: number | null
          website: string | null
        }
        Insert: {
          company_name?: string | null
          id?: string | null
          logo_url?: string | null
          sort_order?: number | null
          website?: string | null
        }
        Update: {
          company_name?: string | null
          id?: string | null
          logo_url?: string | null
          sort_order?: number | null
          website?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accrue_worker_salaries: { Args: { _company_id: string }; Returns: number }
      admin_delete_company: {
        Args: { _company_id: string }
        Returns: undefined
      }
      assign_tour_template: {
        Args: { _apartment_id: string; _template_id: string }
        Returns: Json
      }
      cash_current_shift: { Args: { _register_id: string }; Returns: string }
      cash_pick_register: {
        Args: { _company_id: string; _currency: string; _project_id: string }
        Returns: string
      }
      cash_register_balance: { Args: { _register_id: string }; Returns: number }
      cash_shift_close: {
        Args: { _declared_balance: number; _note?: string; _shift_id: string }
        Returns: Json
      }
      cash_shift_open: {
        Args: { _note?: string; _opened_balance: number; _register_id: string }
        Returns: string
      }
      cash_transfer: {
        Args: {
          _amount: number
          _from_register: string
          _note?: string
          _to_register: string
        }
        Returns: undefined
      }
      cleanup_expired_demo_accounts: { Args: never; Returns: number }
      company_subscription_active: {
        Args: { _company_id: string }
        Returns: boolean
      }
      consume_ai_credit: { Args: { _company_id: string }; Returns: Json }
      consume_scan_credit: {
        Args: { _company_id: string }
        Returns: {
          paid_balance: number
          scan_free_limit: number
          scan_free_used: number
        }[]
      }
      create_estimate_version: {
        Args: { _estimate_id: string }
        Returns: string
      }
      current_usd_rate: { Args: never; Returns: number }
      dashboard_company_stats: {
        Args: {
          _from_date?: string
          _project_ids?: string[]
          _to_date?: string
        }
        Returns: Json
      }
      distribute_unassigned_leads: {
        Args: { _company_id: string }
        Returns: number
      }
      export_backup_rows: {
        Args: { _company_id?: string; _since?: string; _table: string }
        Returns: Json
      }
      export_storage_objects: {
        Args: { _limit?: number; _offset?: number }
        Returns: {
          bucket_id: string
          object_name: string
        }[]
      }
      export_table_list: {
        Args: never
        Returns: {
          row_count: number
          schema_name: string
          table_name: string
        }[]
      }
      export_table_sql: {
        Args: {
          _limit?: number
          _offset?: number
          _schema: string
          _table: string
        }
        Returns: string
      }
      funnel_recent_messages: {
        Args: { _company_id: string; _limit?: number }
        Returns: {
          body: string
          chat_id: string
          customer_id: string
          direction: string
          id: string
          media_url: string
          message_type: string
          sent_at: string
          status: string
        }[]
      }
      get_ai_credits: {
        Args: never
        Returns: {
          free_limit: number
          free_used: number
          paid_balance: number
        }[]
      }
      get_tour_credits: {
        Args: never
        Returns: {
          free_limit: number
          free_used: number
          paid_balance: number
        }[]
      }
      has_kiosk_access: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_demo_enabled: { Args: never; Returns: boolean }
      is_director: { Args: { _user_id: string }; Returns: boolean }
      is_platform_admin: { Args: { _user_id: string }; Returns: boolean }
      list_active_payment_methods: {
        Args: never
        Returns: {
          card_number: string
          holder_name: string
          id: string
          label: string
          note: string
          provider: string
        }[]
      }
      next_lead_manager: { Args: { _company_id: string }; Returns: string }
      notification_view_counts: {
        Args: never
        Returns: {
          notification_id: string
          viewers: number
        }[]
      }
      recalc_payable: { Args: { _payable_id: string }; Returns: undefined }
      recompute_project_distributions: {
        Args: { _project_id: string }
        Returns: Json
      }
      release_expired_holds: { Args: never; Returns: number }
      remove_apartment_tour: {
        Args: { _apartment_id: string }
        Returns: undefined
      }
      restore_backup_rows: {
        Args: { _company_id?: string; _rows: Json; _table: string }
        Returns: number
      }
      restore_deleted_record: { Args: { _id: string }; Returns: undefined }
      sync_sale_payments: { Args: { _sale_id: string }; Returns: undefined }
      user_can_access_project: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      user_company_id: { Args: { _user_id: string }; Returns: string }
      user_is_project_partner: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      verify_integration_secret: {
        Args: { _key: string; _value: string }
        Returns: boolean
      }
      worker_salary_summary: {
        Args: { _company_id: string }
        Returns: {
          accrued: number
          balance: number
          paid: number
          worker_id: string
        }[]
      }
    }
    Enums: {
      apartment_status:
        | "empty"
        | "reserved"
        | "sold"
        | "installment"
        | "unavailable"
      app_role:
        | "owner"
        | "manager"
        | "accountant"
        | "warehouse"
        | "director"
        | "sales"
        | "legal"
        | "hr"
      company_status: "active" | "suspended"
      project_status: "planning" | "in_progress" | "completed" | "paused"
      request_status: "pending" | "approved" | "rejected"
      sale_status: "active" | "completed" | "cancelled"
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
  public: {
    Enums: {
      apartment_status: [
        "empty",
        "reserved",
        "sold",
        "installment",
        "unavailable",
      ],
      app_role: [
        "owner",
        "manager",
        "accountant",
        "warehouse",
        "director",
        "sales",
        "legal",
        "hr",
      ],
      company_status: ["active", "suspended"],
      project_status: ["planning", "in_progress", "completed", "paused"],
      request_status: ["pending", "approved", "rejected"],
      sale_status: ["active", "completed", "cancelled"],
    },
  },
} as const
