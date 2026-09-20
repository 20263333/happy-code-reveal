DO $$ BEGIN CREATE TYPE public.apartment_status AS ENUM ('empty','reserved','sold','installment','unavailable'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.app_role AS ENUM ('owner','manager','accountant','warehouse','director','sales','legal','hr'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.company_status AS ENUM ('active','suspended'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.project_status AS ENUM ('planning','in_progress','completed','paused'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.request_status AS ENUM ('pending','approved','rejected'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.sale_status AS ENUM ('active','completed','cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE TABLE IF NOT EXISTS public.ai_chat_messages();
CREATE TABLE IF NOT EXISTS public.ai_credit_packages();
CREATE TABLE IF NOT EXISTS public.ai_credit_purchases();
CREATE TABLE IF NOT EXISTS public.ai_credits();
CREATE TABLE IF NOT EXISTS public.apartment_tour_assignments();
CREATE TABLE IF NOT EXISTS public.apartments();
CREATE TABLE IF NOT EXISTS public.attendance();
CREATE TABLE IF NOT EXISTS public.barter_deals();
CREATE TABLE IF NOT EXISTS public.car_damages();
CREATE TABLE IF NOT EXISTS public.cash_operations();
CREATE TABLE IF NOT EXISTS public.cash_registers();
CREATE TABLE IF NOT EXISTS public.cash_shifts();
CREATE TABLE IF NOT EXISTS public.companies();
CREATE TABLE IF NOT EXISTS public.company_change_requests();
CREATE TABLE IF NOT EXISTS public.company_directors();
CREATE TABLE IF NOT EXISTS public.company_kiosk_access();
CREATE TABLE IF NOT EXISTS public.company_kiosk_secrets();
CREATE TABLE IF NOT EXISTS public.company_requests();
CREATE TABLE IF NOT EXISTS public.company_sms_settings();
CREATE TABLE IF NOT EXISTS public.construction_photos();
CREATE TABLE IF NOT EXISTS public.contract_documents();
CREATE TABLE IF NOT EXISTS public.contract_templates();
CREATE TABLE IF NOT EXISTS public.customer_documents();
CREATE TABLE IF NOT EXISTS public.customer_interactions();
CREATE TABLE IF NOT EXISTS public.customers();
CREATE TABLE IF NOT EXISTS public.deleted_records();
CREATE TABLE IF NOT EXISTS public.demo_feedback();
CREATE TABLE IF NOT EXISTS public.equipment();
CREATE TABLE IF NOT EXISTS public.equipment_maintenance();
CREATE TABLE IF NOT EXISTS public.equipment_usage();
CREATE TABLE IF NOT EXISTS public.estimate_documents();
CREATE TABLE IF NOT EXISTS public.estimate_items();
CREATE TABLE IF NOT EXISTS public.estimates();
CREATE TABLE IF NOT EXISTS public.exchange_rates();
CREATE TABLE IF NOT EXISTS public.expenses();
CREATE TABLE IF NOT EXISTS public.floors();
CREATE TABLE IF NOT EXISTS public.funding_requests();
CREATE TABLE IF NOT EXISTS public.hidden_work_acts();
CREATE TABLE IF NOT EXISTS public.material_acceptance_acts();
CREATE TABLE IF NOT EXISTS public.material_movements();
CREATE TABLE IF NOT EXISTS public.materials();
CREATE TABLE IF NOT EXISTS public.notification_reads();
CREATE TABLE IF NOT EXISTS public.notifications();
CREATE TABLE IF NOT EXISTS public.partner_distributions();
CREATE TABLE IF NOT EXISTS public.partner_payouts();
CREATE TABLE IF NOT EXISTS public.partner_shares();
CREATE TABLE IF NOT EXISTS public.payable_payments();
CREATE TABLE IF NOT EXISTS public.payables();
CREATE TABLE IF NOT EXISTS public.payment_methods();
CREATE TABLE IF NOT EXISTS public.payment_schedule();
CREATE TABLE IF NOT EXISTS public.payments();
CREATE TABLE IF NOT EXISTS public.permits();
CREATE TABLE IF NOT EXISTS public.platform_admins();
CREATE TABLE IF NOT EXISTS public.platform_settings();
CREATE TABLE IF NOT EXISTS public.profiles();
CREATE TABLE IF NOT EXISTS public.project_budgets();
CREATE TABLE IF NOT EXISTS public.project_staff();
CREATE TABLE IF NOT EXISTS public.project_stages();
CREATE TABLE IF NOT EXISTS public.projects();
CREATE TABLE IF NOT EXISTS public.quality_checks();
CREATE TABLE IF NOT EXISTS public.resettlements();
CREATE TABLE IF NOT EXISTS public.salary_accruals();
CREATE TABLE IF NOT EXISTS public.sales();
CREATE TABLE IF NOT EXISTS public.sales_team_members();
CREATE TABLE IF NOT EXISTS public.sales_team_payouts();
CREATE TABLE IF NOT EXISTS public.scan_credit_packages();
CREATE TABLE IF NOT EXISTS public.scan_credit_purchases();
CREATE TABLE IF NOT EXISTS public.showcase_companies();
CREATE TABLE IF NOT EXISTS public.site_incidents();
CREATE TABLE IF NOT EXISTS public.sms_logs();
CREATE TABLE IF NOT EXISTS public.stage_tasks();
CREATE TABLE IF NOT EXISTS public.stage_updates();
CREATE TABLE IF NOT EXISTS public.studio_publications();
CREATE TABLE IF NOT EXISTS public.subcontract_acts();
CREATE TABLE IF NOT EXISTS public.subcontract_payments();
CREATE TABLE IF NOT EXISTS public.subcontract_works();
CREATE TABLE IF NOT EXISTS public.subcontractors();
CREATE TABLE IF NOT EXISTS public.subscription_payments();
CREATE TABLE IF NOT EXISTS public.suppliers();
CREATE TABLE IF NOT EXISTS public.supply_alerts();
CREATE TABLE IF NOT EXISTS public.support_tickets();
CREATE TABLE IF NOT EXISTS public.tariffs();
CREATE TABLE IF NOT EXISTS public.tax_reports();
CREATE TABLE IF NOT EXISTS public.tour_templates();
CREATE TABLE IF NOT EXISTS public.user_roles();
CREATE TABLE IF NOT EXISTS public.warehouse_issues();
CREATE TABLE IF NOT EXISTS public.warehouse_items();
CREATE TABLE IF NOT EXISTS public.warehouse_receipts();
CREATE TABLE IF NOT EXISTS public.whatsapp_accounts();
CREATE TABLE IF NOT EXISTS public.whatsapp_chats();
CREATE TABLE IF NOT EXISTS public.whatsapp_messages();
CREATE TABLE IF NOT EXISTS public.whatsapp_webhook_logs();
CREATE TABLE IF NOT EXISTS public.worker_payments();
CREATE TABLE IF NOT EXISTS public.workers();
ALTER TABLE public.ai_chat_messages ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.ai_chat_messages ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.ai_chat_messages ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.ai_chat_messages ADD COLUMN IF NOT EXISTS role text;
ALTER TABLE public.ai_chat_messages ADD COLUMN IF NOT EXISTS content text;
ALTER TABLE public.ai_chat_messages ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.ai_credit_packages ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.ai_credit_packages ADD COLUMN IF NOT EXISTS size integer;
ALTER TABLE public.ai_credit_packages ADD COLUMN IF NOT EXISTS amount numeric;
ALTER TABLE public.ai_credit_packages ADD COLUMN IF NOT EXISTS label text DEFAULT ''::text;
ALTER TABLE public.ai_credit_packages ADD COLUMN IF NOT EXISTS is_best boolean DEFAULT false;
ALTER TABLE public.ai_credit_packages ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE public.ai_credit_packages ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;
ALTER TABLE public.ai_credit_packages ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.ai_credit_packages ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.ai_credit_purchases ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.ai_credit_purchases ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.ai_credit_purchases ADD COLUMN IF NOT EXISTS requested_by uuid;
ALTER TABLE public.ai_credit_purchases ADD COLUMN IF NOT EXISTS package_size integer;
ALTER TABLE public.ai_credit_purchases ADD COLUMN IF NOT EXISTS amount numeric;
ALTER TABLE public.ai_credit_purchases ADD COLUMN IF NOT EXISTS receipt_path text;
ALTER TABLE public.ai_credit_purchases ADD COLUMN IF NOT EXISTS note text;
ALTER TABLE public.ai_credit_purchases ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending'::text;
ALTER TABLE public.ai_credit_purchases ADD COLUMN IF NOT EXISTS reviewed_by uuid;
ALTER TABLE public.ai_credit_purchases ADD COLUMN IF NOT EXISTS reviewed_at timestamp with time zone;
ALTER TABLE public.ai_credit_purchases ADD COLUMN IF NOT EXISTS rejection_reason text;
ALTER TABLE public.ai_credit_purchases ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.ai_credits ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.ai_credits ADD COLUMN IF NOT EXISTS free_limit integer DEFAULT 5;
ALTER TABLE public.ai_credits ADD COLUMN IF NOT EXISTS free_used integer DEFAULT 0;
ALTER TABLE public.ai_credits ADD COLUMN IF NOT EXISTS paid_balance integer DEFAULT 0;
ALTER TABLE public.ai_credits ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.ai_credits ADD COLUMN IF NOT EXISTS tour_free_used integer DEFAULT 0;
ALTER TABLE public.ai_credits ADD COLUMN IF NOT EXISTS tour_paid_balance integer DEFAULT 0;
ALTER TABLE public.ai_credits ADD COLUMN IF NOT EXISTS scan_free_limit integer DEFAULT 50;
ALTER TABLE public.ai_credits ADD COLUMN IF NOT EXISTS scan_free_used integer DEFAULT 0;
ALTER TABLE public.ai_credits ADD COLUMN IF NOT EXISTS scan_paid_balance integer DEFAULT 0;
ALTER TABLE public.apartment_tour_assignments ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.apartment_tour_assignments ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.apartment_tour_assignments ADD COLUMN IF NOT EXISTS apartment_id uuid;
ALTER TABLE public.apartment_tour_assignments ADD COLUMN IF NOT EXISTS template_id uuid;
ALTER TABLE public.apartment_tour_assignments ADD COLUMN IF NOT EXISTS price_paid integer DEFAULT 0;
ALTER TABLE public.apartment_tour_assignments ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE public.apartment_tour_assignments ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.apartment_tour_assignments ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.apartments ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.apartments ADD COLUMN IF NOT EXISTS project_id uuid;
ALTER TABLE public.apartments ADD COLUMN IF NOT EXISTS floor_id uuid;
ALTER TABLE public.apartments ADD COLUMN IF NOT EXISTS apartment_number text;
ALTER TABLE public.apartments ADD COLUMN IF NOT EXISTS area numeric DEFAULT 0;
ALTER TABLE public.apartments ADD COLUMN IF NOT EXISTS price numeric DEFAULT 0;
ALTER TABLE public.apartments ADD COLUMN IF NOT EXISTS status public.apartment_status DEFAULT 'empty'::apartment_status;
ALTER TABLE public.apartments ADD COLUMN IF NOT EXISTS rooms integer;
ALTER TABLE public.apartments ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.apartments ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.apartments ADD COLUMN IF NOT EXISTS price_per_sqm numeric DEFAULT 0;
ALTER TABLE public.apartments ADD COLUMN IF NOT EXISTS plan_image_path text;
ALTER TABLE public.apartments ADD COLUMN IF NOT EXISTS tour_media_paths text[] DEFAULT '{}'::text[];
ALTER TABLE public.apartments ADD COLUMN IF NOT EXISTS tour_url text;
ALTER TABLE public.apartments ADD COLUMN IF NOT EXISTS hold_until timestamp with time zone;
ALTER TABLE public.apartments ADD COLUMN IF NOT EXISTS hold_customer_id uuid;
ALTER TABLE public.apartments ADD COLUMN IF NOT EXISTS hold_note text;
ALTER TABLE public.apartments ADD COLUMN IF NOT EXISTS tour_template_id uuid;
ALTER TABLE public.apartments ADD COLUMN IF NOT EXISTS tour_assigned_at timestamp with time zone;
ALTER TABLE public.apartments ADD COLUMN IF NOT EXISTS marketplace_listing_id text;
ALTER TABLE public.apartments ADD COLUMN IF NOT EXISTS marketplace_synced_at timestamp with time zone;
ALTER TABLE public.apartments ADD COLUMN IF NOT EXISTS is_historical boolean DEFAULT false;
ALTER TABLE public.apartments ADD COLUMN IF NOT EXISTS historical_owner text;
ALTER TABLE public.apartments ADD COLUMN IF NOT EXISTS historical_contract_date date;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS worker_id uuid;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS project_id uuid;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS date date;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS status text DEFAULT 'full'::text;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS hours numeric;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS note text;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS face_verified boolean DEFAULT false;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS verification_photo_path text;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS face_confidence numeric;
ALTER TABLE public.barter_deals ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.barter_deals ADD COLUMN IF NOT EXISTS project_id uuid;
ALTER TABLE public.barter_deals ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.barter_deals ADD COLUMN IF NOT EXISTS sale_id uuid;
ALTER TABLE public.barter_deals ADD COLUMN IF NOT EXISTS client_name text;
ALTER TABLE public.barter_deals ADD COLUMN IF NOT EXISTS client_phone text;
ALTER TABLE public.barter_deals ADD COLUMN IF NOT EXISTS property_value numeric DEFAULT 0;
ALTER TABLE public.barter_deals ADD COLUMN IF NOT EXISTS asset_type text DEFAULT 'car'::text;
ALTER TABLE public.barter_deals ADD COLUMN IF NOT EXISTS asset_name text;
ALTER TABLE public.barter_deals ADD COLUMN IF NOT EXISTS brand_model text;
ALTER TABLE public.barter_deals ADD COLUMN IF NOT EXISTS state_number text;
ALTER TABLE public.barter_deals ADD COLUMN IF NOT EXISTS estimated_value numeric DEFAULT 0;
ALTER TABLE public.barter_deals ADD COLUMN IF NOT EXISTS asset_description text;
ALTER TABLE public.barter_deals ADD COLUMN IF NOT EXISTS ownership_document text;
ALTER TABLE public.barter_deals ADD COLUMN IF NOT EXISTS photo_url text;
ALTER TABLE public.barter_deals ADD COLUMN IF NOT EXISTS cash_paid numeric DEFAULT 0;
ALTER TABLE public.barter_deals ADD COLUMN IF NOT EXISTS status text DEFAULT 'valuation'::text;
ALTER TABLE public.barter_deals ADD COLUMN IF NOT EXISTS note text;
ALTER TABLE public.barter_deals ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.barter_deals ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.barter_deals ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.barter_deals ADD COLUMN IF NOT EXISTS apartment_id uuid;
ALTER TABLE public.barter_deals ADD COLUMN IF NOT EXISTS customer_id uuid;
ALTER TABLE public.car_damages ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.car_damages ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.car_damages ADD COLUMN IF NOT EXISTS project_id uuid;
ALTER TABLE public.car_damages ADD COLUMN IF NOT EXISTS damage_date date DEFAULT CURRENT_DATE;
ALTER TABLE public.car_damages ADD COLUMN IF NOT EXISTS vehicle text;
ALTER TABLE public.car_damages ADD COLUMN IF NOT EXISTS amount numeric;
ALTER TABLE public.car_damages ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.car_damages ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.car_damages ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.car_damages ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.cash_operations ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.cash_operations ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.cash_operations ADD COLUMN IF NOT EXISTS register_id uuid;
ALTER TABLE public.cash_operations ADD COLUMN IF NOT EXISTS shift_id uuid;
ALTER TABLE public.cash_operations ADD COLUMN IF NOT EXISTS direction text;
ALTER TABLE public.cash_operations ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE public.cash_operations ADD COLUMN IF NOT EXISTS source_id uuid;
ALTER TABLE public.cash_operations ADD COLUMN IF NOT EXISTS amount numeric;
ALTER TABLE public.cash_operations ADD COLUMN IF NOT EXISTS currency text DEFAULT 'TJS'::text;
ALTER TABLE public.cash_operations ADD COLUMN IF NOT EXISTS operation_date date DEFAULT CURRENT_DATE;
ALTER TABLE public.cash_operations ADD COLUMN IF NOT EXISTS counterparty text;
ALTER TABLE public.cash_operations ADD COLUMN IF NOT EXISTS note text;
ALTER TABLE public.cash_operations ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.cash_operations ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.cash_registers ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.cash_registers ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.cash_registers ADD COLUMN IF NOT EXISTS project_id uuid;
ALTER TABLE public.cash_registers ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.cash_registers ADD COLUMN IF NOT EXISTS currency text DEFAULT 'TJS'::text;
ALTER TABLE public.cash_registers ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE public.cash_registers ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.cash_registers ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.cash_registers ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.cash_shifts ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.cash_shifts ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.cash_shifts ADD COLUMN IF NOT EXISTS register_id uuid;
ALTER TABLE public.cash_shifts ADD COLUMN IF NOT EXISTS cashier_user_id uuid;
ALTER TABLE public.cash_shifts ADD COLUMN IF NOT EXISTS opened_at timestamp with time zone DEFAULT now();
ALTER TABLE public.cash_shifts ADD COLUMN IF NOT EXISTS opened_balance numeric DEFAULT 0;
ALTER TABLE public.cash_shifts ADD COLUMN IF NOT EXISTS closed_at timestamp with time zone;
ALTER TABLE public.cash_shifts ADD COLUMN IF NOT EXISTS closed_balance_declared numeric;
ALTER TABLE public.cash_shifts ADD COLUMN IF NOT EXISTS closed_balance_system numeric;
ALTER TABLE public.cash_shifts ADD COLUMN IF NOT EXISTS diff numeric;
ALTER TABLE public.cash_shifts ADD COLUMN IF NOT EXISTS status text DEFAULT 'open'::text;
ALTER TABLE public.cash_shifts ADD COLUMN IF NOT EXISTS note text;
ALTER TABLE public.cash_shifts ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.cash_shifts ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS owner_user_id uuid;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS status public.company_status DEFAULT 'active'::company_status;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS subscription_tariff_id uuid;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS subscription_expires_at timestamp with time zone;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS max_staff integer DEFAULT 1;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS max_projects integer DEFAULT 1;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS subscription_started_at timestamp with time zone;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS enabled_modules text[] DEFAULT ARRAY['dashboard'::text, 'projects'::text, 'customers'::text, 'payments'::text, 'expenses'::text, 'payables'::text, 'reports'::text, 'staff'::text, 'billing'::text, 'settings'::text];
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS max_blocks integer DEFAULT 1;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS is_demo boolean DEFAULT false;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS demo_expires_at timestamp with time zone;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS kiosk_enabled boolean DEFAULT false;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS receipt_bg text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS receipt_stamp text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS receipt_inn text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS receipt_address text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS receipt_signer text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS show_tours_public boolean DEFAULT false;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS free_tours_used integer DEFAULT 0;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS warehouse_manual_docs_allowed boolean DEFAULT false;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS material_variance_threshold numeric DEFAULT 2;
ALTER TABLE public.company_change_requests ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.company_change_requests ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.company_change_requests ADD COLUMN IF NOT EXISTS requested_changes jsonb;
ALTER TABLE public.company_change_requests ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending'::text;
ALTER TABLE public.company_change_requests ADD COLUMN IF NOT EXISTS reject_reason text;
ALTER TABLE public.company_change_requests ADD COLUMN IF NOT EXISTS reviewed_by uuid;
ALTER TABLE public.company_change_requests ADD COLUMN IF NOT EXISTS reviewed_at timestamp with time zone;
ALTER TABLE public.company_change_requests ADD COLUMN IF NOT EXISTS created_by uuid DEFAULT auth.uid();
ALTER TABLE public.company_change_requests ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.company_change_requests ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.company_directors ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.company_directors ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.company_directors ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.company_directors ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.company_directors ADD COLUMN IF NOT EXISTS fullname text;
ALTER TABLE public.company_directors ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE public.company_directors ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.company_kiosk_access ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.company_kiosk_access ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.company_kiosk_access ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.company_kiosk_access ADD COLUMN IF NOT EXISTS granted_by uuid;
ALTER TABLE public.company_kiosk_access ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.company_kiosk_secrets ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.company_kiosk_secrets ADD COLUMN IF NOT EXISTS kiosk_pin_hash text;
ALTER TABLE public.company_kiosk_secrets ADD COLUMN IF NOT EXISTS kiosk_token uuid DEFAULT gen_random_uuid();
ALTER TABLE public.company_kiosk_secrets ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.company_kiosk_secrets ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.company_requests ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.company_requests ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.company_requests ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.company_requests ADD COLUMN IF NOT EXISTS company_name text;
ALTER TABLE public.company_requests ADD COLUMN IF NOT EXISTS fullname text;
ALTER TABLE public.company_requests ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.company_requests ADD COLUMN IF NOT EXISTS status public.request_status DEFAULT 'pending'::request_status;
ALTER TABLE public.company_requests ADD COLUMN IF NOT EXISTS rejection_reason text;
ALTER TABLE public.company_requests ADD COLUMN IF NOT EXISTS reviewed_by uuid;
ALTER TABLE public.company_requests ADD COLUMN IF NOT EXISTS reviewed_at timestamp with time zone;
ALTER TABLE public.company_requests ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.company_sms_settings ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.company_sms_settings ADD COLUMN IF NOT EXISTS provider text DEFAULT 'osonsms'::text;
ALTER TABLE public.company_sms_settings ADD COLUMN IF NOT EXISTS login text;
ALTER TABLE public.company_sms_settings ADD COLUMN IF NOT EXISTS token text;
ALTER TABLE public.company_sms_settings ADD COLUMN IF NOT EXISTS sender text;
ALTER TABLE public.company_sms_settings ADD COLUMN IF NOT EXISTS hash_secret text;
ALTER TABLE public.company_sms_settings ADD COLUMN IF NOT EXISTS enabled boolean DEFAULT false;
ALTER TABLE public.company_sms_settings ADD COLUMN IF NOT EXISTS test_mode boolean DEFAULT true;
ALTER TABLE public.company_sms_settings ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.company_sms_settings ADD COLUMN IF NOT EXISTS updated_by uuid;
ALTER TABLE public.company_sms_settings ADD COLUMN IF NOT EXISTS reminder_template text DEFAULT 'Муштарии мӯҳтарам {name}! Ёдоварӣ: то {date} мӯҳлати навбатии пардохти Шумо — {amount}. Лутфан саривақт пардохт намоед. Бо эҳтиром, ширкати сохтмонӣ.'::text;
ALTER TABLE public.company_sms_settings ADD COLUMN IF NOT EXISTS overdue_template text DEFAULT 'Муштарии мӯҳтарам {name}! Мӯҳлати пардохти Шумо ({amount}) аз {date} гузаштааст. Лутфан ҳарчи зудтар пардохт намоед. Бо эҳтиром, ширкати сохтмонӣ.'::text;
ALTER TABLE public.company_sms_settings ADD COLUMN IF NOT EXISTS penalty_percent numeric DEFAULT 0;
ALTER TABLE public.company_sms_settings ADD COLUMN IF NOT EXISTS penalty_period text DEFAULT 'daily'::text;
ALTER TABLE public.company_sms_settings ADD COLUMN IF NOT EXISTS paid_template text;
ALTER TABLE public.company_sms_settings ADD COLUMN IF NOT EXISTS project_id uuid;
ALTER TABLE public.company_sms_settings ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.construction_photos ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.construction_photos ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.construction_photos ADD COLUMN IF NOT EXISTS project_id uuid;
ALTER TABLE public.construction_photos ADD COLUMN IF NOT EXISTS photo_path text;
ALTER TABLE public.construction_photos ADD COLUMN IF NOT EXISTS note text;
ALTER TABLE public.construction_photos ADD COLUMN IF NOT EXISTS taken_at timestamp with time zone DEFAULT now();
ALTER TABLE public.construction_photos ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.construction_photos ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.construction_photos ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.construction_photos ADD COLUMN IF NOT EXISTS stage_id uuid;
ALTER TABLE public.contract_documents ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.contract_documents ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.contract_documents ADD COLUMN IF NOT EXISTS sale_id uuid;
ALTER TABLE public.contract_documents ADD COLUMN IF NOT EXISTS kind text;
ALTER TABLE public.contract_documents ADD COLUMN IF NOT EXISTS contract_number text;
ALTER TABLE public.contract_documents ADD COLUMN IF NOT EXISTS contract_date date;
ALTER TABLE public.contract_documents ADD COLUMN IF NOT EXISTS data jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.contract_documents ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.contract_documents ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.contract_templates ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.contract_templates ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.contract_templates ADD COLUMN IF NOT EXISTS contract_title text DEFAULT 'ДОГОВОР купли-продажи'::text;
ALTER TABLE public.contract_templates ADD COLUMN IF NOT EXISTS number_prefix text;
ALTER TABLE public.contract_templates ADD COLUMN IF NOT EXISTS director_name text;
ALTER TABLE public.contract_templates ADD COLUMN IF NOT EXISTS director_position text DEFAULT 'Директор'::text;
ALTER TABLE public.contract_templates ADD COLUMN IF NOT EXISTS inn text;
ALTER TABLE public.contract_templates ADD COLUMN IF NOT EXISTS legal_address text;
ALTER TABLE public.contract_templates ADD COLUMN IF NOT EXISTS bank_details text;
ALTER TABLE public.contract_templates ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.contract_templates ADD COLUMN IF NOT EXISTS intro_text text;
ALTER TABLE public.contract_templates ADD COLUMN IF NOT EXISTS body_text text;
ALTER TABLE public.contract_templates ADD COLUMN IF NOT EXISTS footer_text text;
ALTER TABLE public.contract_templates ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.contract_templates ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.contract_templates ADD COLUMN IF NOT EXISTS docx_full_path text;
ALTER TABLE public.contract_templates ADD COLUMN IF NOT EXISTS docx_installment_path text;
ALTER TABLE public.contract_templates ADD COLUMN IF NOT EXISTS docx_shop_full_path text;
ALTER TABLE public.contract_templates ADD COLUMN IF NOT EXISTS docx_shop_installment_path text;
ALTER TABLE public.customer_documents ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.customer_documents ADD COLUMN IF NOT EXISTS customer_id uuid;
ALTER TABLE public.customer_documents ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.customer_documents ADD COLUMN IF NOT EXISTS file_path text;
ALTER TABLE public.customer_documents ADD COLUMN IF NOT EXISTS file_name text;
ALTER TABLE public.customer_documents ADD COLUMN IF NOT EXISTS file_type text;
ALTER TABLE public.customer_documents ADD COLUMN IF NOT EXISTS uploaded_by uuid;
ALTER TABLE public.customer_documents ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.customer_documents ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.customer_interactions ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.customer_interactions ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.customer_interactions ADD COLUMN IF NOT EXISTS customer_id uuid;
ALTER TABLE public.customer_interactions ADD COLUMN IF NOT EXISTS kind text DEFAULT 'call'::text;
ALTER TABLE public.customer_interactions ADD COLUMN IF NOT EXISTS direction text DEFAULT 'out'::text;
ALTER TABLE public.customer_interactions ADD COLUMN IF NOT EXISTS subject text;
ALTER TABLE public.customer_interactions ADD COLUMN IF NOT EXISTS body text;
ALTER TABLE public.customer_interactions ADD COLUMN IF NOT EXISTS outcome text;
ALTER TABLE public.customer_interactions ADD COLUMN IF NOT EXISTS next_action_at timestamp with time zone;
ALTER TABLE public.customer_interactions ADD COLUMN IF NOT EXISTS interaction_at timestamp with time zone DEFAULT now();
ALTER TABLE public.customer_interactions ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.customer_interactions ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS fullname text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS passport text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS status text DEFAULT 'new'::text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS birth_date date;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS passport_series text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS passport_number text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS passport_issued_by text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS passport_issued_date date;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS passport_front_path text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS passport_back_path text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS funnel_stage text DEFAULT 'lead'::text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS inn text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS passport_expiry_date date;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS first_name text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS last_name text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS middle_name text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS gender text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS nationality text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS personal_id text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS issuing_authority text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS crm_fields jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS assigned_manager_id uuid;
ALTER TABLE public.deleted_records ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.deleted_records ADD COLUMN IF NOT EXISTS table_name text;
ALTER TABLE public.deleted_records ADD COLUMN IF NOT EXISTS record_id uuid;
ALTER TABLE public.deleted_records ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.deleted_records ADD COLUMN IF NOT EXISTS data jsonb;
ALTER TABLE public.deleted_records ADD COLUMN IF NOT EXISTS deleted_by uuid;
ALTER TABLE public.deleted_records ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone DEFAULT now();
ALTER TABLE public.demo_feedback ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.demo_feedback ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.demo_feedback ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.demo_feedback ADD COLUMN IF NOT EXISTS message text;
ALTER TABLE public.demo_feedback ADD COLUMN IF NOT EXISTS is_resolved boolean DEFAULT false;
ALTER TABLE public.demo_feedback ADD COLUMN IF NOT EXISTS admin_reply text;
ALTER TABLE public.demo_feedback ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.equipment ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.equipment ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.equipment ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.equipment ADD COLUMN IF NOT EXISTS kind text DEFAULT 'other'::text;
ALTER TABLE public.equipment ADD COLUMN IF NOT EXISTS plate_number text;
ALTER TABLE public.equipment ADD COLUMN IF NOT EXISTS ownership text DEFAULT 'own'::text;
ALTER TABLE public.equipment ADD COLUMN IF NOT EXISTS rate_per_hour numeric DEFAULT 0;
ALTER TABLE public.equipment ADD COLUMN IF NOT EXISTS rate_per_day numeric DEFAULT 0;
ALTER TABLE public.equipment ADD COLUMN IF NOT EXISTS fuel_per_hour numeric DEFAULT 0;
ALTER TABLE public.equipment ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE public.equipment ADD COLUMN IF NOT EXISTS note text;
ALTER TABLE public.equipment ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.equipment ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.equipment ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.equipment_maintenance ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.equipment_maintenance ADD COLUMN IF NOT EXISTS equipment_id uuid;
ALTER TABLE public.equipment_maintenance ADD COLUMN IF NOT EXISTS maintenance_date date DEFAULT CURRENT_DATE;
ALTER TABLE public.equipment_maintenance ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.equipment_maintenance ADD COLUMN IF NOT EXISTS cost numeric DEFAULT 0;
ALTER TABLE public.equipment_maintenance ADD COLUMN IF NOT EXISTS note text;
ALTER TABLE public.equipment_maintenance ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.equipment_maintenance ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.equipment_maintenance ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.equipment_usage ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.equipment_usage ADD COLUMN IF NOT EXISTS equipment_id uuid;
ALTER TABLE public.equipment_usage ADD COLUMN IF NOT EXISTS project_id uuid;
ALTER TABLE public.equipment_usage ADD COLUMN IF NOT EXISTS usage_date date DEFAULT CURRENT_DATE;
ALTER TABLE public.equipment_usage ADD COLUMN IF NOT EXISTS hours numeric DEFAULT 0;
ALTER TABLE public.equipment_usage ADD COLUMN IF NOT EXISTS fuel_liters numeric DEFAULT 0;
ALTER TABLE public.equipment_usage ADD COLUMN IF NOT EXISTS operator_name text;
ALTER TABLE public.equipment_usage ADD COLUMN IF NOT EXISTS amount numeric DEFAULT 0;
ALTER TABLE public.equipment_usage ADD COLUMN IF NOT EXISTS note text;
ALTER TABLE public.equipment_usage ADD COLUMN IF NOT EXISTS expense_id uuid;
ALTER TABLE public.equipment_usage ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.equipment_usage ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.equipment_usage ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.estimate_documents ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.estimate_documents ADD COLUMN IF NOT EXISTS estimate_id uuid;
ALTER TABLE public.estimate_documents ADD COLUMN IF NOT EXISTS project_id uuid;
ALTER TABLE public.estimate_documents ADD COLUMN IF NOT EXISTS file_path text;
ALTER TABLE public.estimate_documents ADD COLUMN IF NOT EXISTS file_name text;
ALTER TABLE public.estimate_documents ADD COLUMN IF NOT EXISTS doc_type text DEFAULT 'other'::text;
ALTER TABLE public.estimate_documents ADD COLUMN IF NOT EXISTS uploaded_by uuid;
ALTER TABLE public.estimate_documents ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.estimate_items ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.estimate_items ADD COLUMN IF NOT EXISTS estimate_id uuid;
ALTER TABLE public.estimate_items ADD COLUMN IF NOT EXISTS project_id uuid;
ALTER TABLE public.estimate_items ADD COLUMN IF NOT EXISTS kind text DEFAULT 'material'::text;
ALTER TABLE public.estimate_items ADD COLUMN IF NOT EXISTS section text;
ALTER TABLE public.estimate_items ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.estimate_items ADD COLUMN IF NOT EXISTS unit text;
ALTER TABLE public.estimate_items ADD COLUMN IF NOT EXISTS quantity numeric DEFAULT 0;
ALTER TABLE public.estimate_items ADD COLUMN IF NOT EXISTS unit_price numeric DEFAULT 0;
ALTER TABLE public.estimate_items ADD COLUMN IF NOT EXISTS total numeric DEFAULT 0;
ALTER TABLE public.estimate_items ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;
ALTER TABLE public.estimate_items ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.estimates ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.estimates ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.estimates ADD COLUMN IF NOT EXISTS project_id uuid;
ALTER TABLE public.estimates ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.estimates ADD COLUMN IF NOT EXISTS customer text;
ALTER TABLE public.estimates ADD COLUMN IF NOT EXISTS responsible text;
ALTER TABLE public.estimates ADD COLUMN IF NOT EXISTS status text DEFAULT 'draft'::text;
ALTER TABLE public.estimates ADD COLUMN IF NOT EXISTS version integer DEFAULT 1;
ALTER TABLE public.estimates ADD COLUMN IF NOT EXISTS root_id uuid;
ALTER TABLE public.estimates ADD COLUMN IF NOT EXISTS parent_estimate_id uuid;
ALTER TABLE public.estimates ADD COLUMN IF NOT EXISTS is_current boolean DEFAULT true;
ALTER TABLE public.estimates ADD COLUMN IF NOT EXISTS total numeric DEFAULT 0;
ALTER TABLE public.estimates ADD COLUMN IF NOT EXISTS note text;
ALTER TABLE public.estimates ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.estimates ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.estimates ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.exchange_rates ADD COLUMN IF NOT EXISTS date date;
ALTER TABLE public.exchange_rates ADD COLUMN IF NOT EXISTS usd_rate numeric;
ALTER TABLE public.exchange_rates ADD COLUMN IF NOT EXISTS source text DEFAULT 'nbt.tj'::text;
ALTER TABLE public.exchange_rates ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS project_id uuid;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS amount numeric;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS category text DEFAULT 'other'::text;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS invoice_file text;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS expense_date date DEFAULT CURRENT_DATE;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS currency text DEFAULT 'TJS'::text;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS employee_name text;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS worker_id uuid;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS floor_id uuid;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS funding_source text;
ALTER TABLE public.floors ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.floors ADD COLUMN IF NOT EXISTS project_id uuid;
ALTER TABLE public.floors ADD COLUMN IF NOT EXISTS floor_number integer;
ALTER TABLE public.floors ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.floors ADD COLUMN IF NOT EXISTS status text DEFAULT 'in_progress'::text;
ALTER TABLE public.floors ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.funding_requests ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.funding_requests ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.funding_requests ADD COLUMN IF NOT EXISTS project_id uuid;
ALTER TABLE public.funding_requests ADD COLUMN IF NOT EXISTS floor_id uuid;
ALTER TABLE public.funding_requests ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE public.funding_requests ADD COLUMN IF NOT EXISTS amount numeric;
ALTER TABLE public.funding_requests ADD COLUMN IF NOT EXISTS currency text DEFAULT 'TJS'::text;
ALTER TABLE public.funding_requests ADD COLUMN IF NOT EXISTS note text;
ALTER TABLE public.funding_requests ADD COLUMN IF NOT EXISTS requested_by uuid;
ALTER TABLE public.funding_requests ADD COLUMN IF NOT EXISTS approver_id uuid;
ALTER TABLE public.funding_requests ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending'::text;
ALTER TABLE public.funding_requests ADD COLUMN IF NOT EXISTS decision_note text;
ALTER TABLE public.funding_requests ADD COLUMN IF NOT EXISTS decided_at timestamp with time zone;
ALTER TABLE public.funding_requests ADD COLUMN IF NOT EXISTS decided_by uuid;
ALTER TABLE public.funding_requests ADD COLUMN IF NOT EXISTS expense_id uuid;
ALTER TABLE public.funding_requests ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.funding_requests ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.funding_requests ADD COLUMN IF NOT EXISTS approver_ids uuid[] DEFAULT '{}'::uuid[];
ALTER TABLE public.funding_requests ADD COLUMN IF NOT EXISTS cleared_by uuid[] DEFAULT '{}'::uuid[];
ALTER TABLE public.hidden_work_acts ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.hidden_work_acts ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.hidden_work_acts ADD COLUMN IF NOT EXISTS project_id uuid;
ALTER TABLE public.hidden_work_acts ADD COLUMN IF NOT EXISTS act_number text;
ALTER TABLE public.hidden_work_acts ADD COLUMN IF NOT EXISTS work_description text;
ALTER TABLE public.hidden_work_acts ADD COLUMN IF NOT EXISTS location text;
ALTER TABLE public.hidden_work_acts ADD COLUMN IF NOT EXISTS materials_used text;
ALTER TABLE public.hidden_work_acts ADD COLUMN IF NOT EXISTS act_date date DEFAULT CURRENT_DATE;
ALTER TABLE public.hidden_work_acts ADD COLUMN IF NOT EXISTS contractor_signature text;
ALTER TABLE public.hidden_work_acts ADD COLUMN IF NOT EXISTS customer_signature text;
ALTER TABLE public.hidden_work_acts ADD COLUMN IF NOT EXISTS inspector_name text;
ALTER TABLE public.hidden_work_acts ADD COLUMN IF NOT EXISTS file_path text;
ALTER TABLE public.hidden_work_acts ADD COLUMN IF NOT EXISTS note text;
ALTER TABLE public.hidden_work_acts ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.hidden_work_acts ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.hidden_work_acts ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.material_acceptance_acts ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.material_acceptance_acts ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.material_acceptance_acts ADD COLUMN IF NOT EXISTS project_id uuid;
ALTER TABLE public.material_acceptance_acts ADD COLUMN IF NOT EXISTS estimate_item_id uuid;
ALTER TABLE public.material_acceptance_acts ADD COLUMN IF NOT EXISTS material_name text;
ALTER TABLE public.material_acceptance_acts ADD COLUMN IF NOT EXISTS unit text;
ALTER TABLE public.material_acceptance_acts ADD COLUMN IF NOT EXISTS ordered_qty numeric DEFAULT 0;
ALTER TABLE public.material_acceptance_acts ADD COLUMN IF NOT EXISTS actual_qty numeric DEFAULT 0;
ALTER TABLE public.material_acceptance_acts ADD COLUMN IF NOT EXISTS mixer_count integer;
ALTER TABLE public.material_acceptance_acts ADD COLUMN IF NOT EXISTS mixer_volume numeric;
ALTER TABLE public.material_acceptance_acts ADD COLUMN IF NOT EXISTS unit_price numeric DEFAULT 0;
ALTER TABLE public.material_acceptance_acts ADD COLUMN IF NOT EXISTS supplier text;
ALTER TABLE public.material_acceptance_acts ADD COLUMN IF NOT EXISTS act_date date DEFAULT CURRENT_DATE;
ALTER TABLE public.material_acceptance_acts ADD COLUMN IF NOT EXISTS inspector text;
ALTER TABLE public.material_acceptance_acts ADD COLUMN IF NOT EXISTS photo_paths text[] DEFAULT '{}'::text[];
ALTER TABLE public.material_acceptance_acts ADD COLUMN IF NOT EXISTS note text;
ALTER TABLE public.material_acceptance_acts ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.material_acceptance_acts ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.material_acceptance_acts ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.material_movements ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.material_movements ADD COLUMN IF NOT EXISTS material_id uuid;
ALTER TABLE public.material_movements ADD COLUMN IF NOT EXISTS project_id uuid;
ALTER TABLE public.material_movements ADD COLUMN IF NOT EXISTS type text;
ALTER TABLE public.material_movements ADD COLUMN IF NOT EXISTS quantity numeric;
ALTER TABLE public.material_movements ADD COLUMN IF NOT EXISTS unit_price numeric DEFAULT 0;
ALTER TABLE public.material_movements ADD COLUMN IF NOT EXISTS total numeric DEFAULT 0;
ALTER TABLE public.material_movements ADD COLUMN IF NOT EXISTS note text;
ALTER TABLE public.material_movements ADD COLUMN IF NOT EXISTS expense_id uuid;
ALTER TABLE public.material_movements ADD COLUMN IF NOT EXISTS movement_date date DEFAULT CURRENT_DATE;
ALTER TABLE public.material_movements ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.material_movements ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS project_id uuid;
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS unit text DEFAULT 'dona'::text;
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS quantity numeric DEFAULT 0;
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS unit_price numeric DEFAULT 0;
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.notification_reads ADD COLUMN IF NOT EXISTS notification_id uuid;
ALTER TABLE public.notification_reads ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.notification_reads ADD COLUMN IF NOT EXISTS read_at timestamp with time zone DEFAULT now();
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS body text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS media_url text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS media_type text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS media_items jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS contact_phone text;
ALTER TABLE public.partner_distributions ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.partner_distributions ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.partner_distributions ADD COLUMN IF NOT EXISTS project_id uuid;
ALTER TABLE public.partner_distributions ADD COLUMN IF NOT EXISTS payment_id uuid;
ALTER TABLE public.partner_distributions ADD COLUMN IF NOT EXISTS sale_id uuid;
ALTER TABLE public.partner_distributions ADD COLUMN IF NOT EXISTS director_user_id uuid;
ALTER TABLE public.partner_distributions ADD COLUMN IF NOT EXISTS percent numeric;
ALTER TABLE public.partner_distributions ADD COLUMN IF NOT EXISTS amount numeric;
ALTER TABLE public.partner_distributions ADD COLUMN IF NOT EXISTS status text DEFAULT 'accrued'::text;
ALTER TABLE public.partner_distributions ADD COLUMN IF NOT EXISTS payout_id uuid;
ALTER TABLE public.partner_distributions ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.partner_payouts ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.partner_payouts ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.partner_payouts ADD COLUMN IF NOT EXISTS project_id uuid;
ALTER TABLE public.partner_payouts ADD COLUMN IF NOT EXISTS director_user_id uuid;
ALTER TABLE public.partner_payouts ADD COLUMN IF NOT EXISTS amount numeric;
ALTER TABLE public.partner_payouts ADD COLUMN IF NOT EXISTS paid_date date DEFAULT CURRENT_DATE;
ALTER TABLE public.partner_payouts ADD COLUMN IF NOT EXISTS note text;
ALTER TABLE public.partner_payouts ADD COLUMN IF NOT EXISTS expense_id uuid;
ALTER TABLE public.partner_payouts ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.partner_payouts ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.partner_shares ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.partner_shares ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.partner_shares ADD COLUMN IF NOT EXISTS project_id uuid;
ALTER TABLE public.partner_shares ADD COLUMN IF NOT EXISTS director_user_id uuid;
ALTER TABLE public.partner_shares ADD COLUMN IF NOT EXISTS percent numeric;
ALTER TABLE public.partner_shares ADD COLUMN IF NOT EXISTS note text;
ALTER TABLE public.partner_shares ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.partner_shares ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.partner_shares ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.payable_payments ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.payable_payments ADD COLUMN IF NOT EXISTS payable_id uuid;
ALTER TABLE public.payable_payments ADD COLUMN IF NOT EXISTS amount numeric;
ALTER TABLE public.payable_payments ADD COLUMN IF NOT EXISTS method text;
ALTER TABLE public.payable_payments ADD COLUMN IF NOT EXISTS payment_date date DEFAULT CURRENT_DATE;
ALTER TABLE public.payable_payments ADD COLUMN IF NOT EXISTS comment text;
ALTER TABLE public.payable_payments ADD COLUMN IF NOT EXISTS document_file text;
ALTER TABLE public.payable_payments ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.payable_payments ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.payables ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.payables ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.payables ADD COLUMN IF NOT EXISTS project_id uuid;
ALTER TABLE public.payables ADD COLUMN IF NOT EXISTS counterparty text;
ALTER TABLE public.payables ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE public.payables ADD COLUMN IF NOT EXISTS total_amount numeric;
ALTER TABLE public.payables ADD COLUMN IF NOT EXISTS paid_amount numeric DEFAULT 0;
ALTER TABLE public.payables ADD COLUMN IF NOT EXISTS due_date date;
ALTER TABLE public.payables ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.payables ADD COLUMN IF NOT EXISTS document_file text;
ALTER TABLE public.payables ADD COLUMN IF NOT EXISTS currency text DEFAULT 'TJS'::text;
ALTER TABLE public.payables ADD COLUMN IF NOT EXISTS status text DEFAULT 'new'::text;
ALTER TABLE public.payables ADD COLUMN IF NOT EXISTS archived boolean DEFAULT false;
ALTER TABLE public.payables ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.payables ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.payables ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.payables ADD COLUMN IF NOT EXISTS supplier_id uuid;
ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS provider text;
ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS label text;
ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS card_number text;
ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS holder_name text;
ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS note text;
ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.payment_schedule ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.payment_schedule ADD COLUMN IF NOT EXISTS sale_id uuid;
ALTER TABLE public.payment_schedule ADD COLUMN IF NOT EXISTS due_date date;
ALTER TABLE public.payment_schedule ADD COLUMN IF NOT EXISTS amount numeric;
ALTER TABLE public.payment_schedule ADD COLUMN IF NOT EXISTS paid_amount numeric DEFAULT 0;
ALTER TABLE public.payment_schedule ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending'::text;
ALTER TABLE public.payment_schedule ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS sale_id uuid;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS amount numeric;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS payment_date date DEFAULT CURRENT_DATE;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS note text;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'cash'::text;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS receipt_file text;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS currency text DEFAULT 'TJS'::text;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS status text DEFAULT 'confirmed'::text;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS confirmed_by uuid;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS confirmed_at timestamp with time zone;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS check_number integer;
ALTER TABLE public.permits ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.permits ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.permits ADD COLUMN IF NOT EXISTS project_id uuid;
ALTER TABLE public.permits ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.permits ADD COLUMN IF NOT EXISTS permit_number text;
ALTER TABLE public.permits ADD COLUMN IF NOT EXISTS authority text;
ALTER TABLE public.permits ADD COLUMN IF NOT EXISTS issued_date date;
ALTER TABLE public.permits ADD COLUMN IF NOT EXISTS expires_at date;
ALTER TABLE public.permits ADD COLUMN IF NOT EXISTS reminder_days integer DEFAULT 30;
ALTER TABLE public.permits ADD COLUMN IF NOT EXISTS file_path text;
ALTER TABLE public.permits ADD COLUMN IF NOT EXISTS note text;
ALTER TABLE public.permits ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.permits ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.permits ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.platform_admins ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.platform_admins ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS key text;
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS value jsonb;
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
-- upsert(onConflict: "key") requires a unique key
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'platform_settings_key_key' AND conrelid = 'public.platform_settings'::regclass
  ) THEN
    -- remove duplicate keys before adding the unique constraint
    DELETE FROM public.platform_settings a
    USING public.platform_settings b
    WHERE a.key = b.key AND a.ctid < b.ctid;
    ALTER TABLE public.platform_settings ADD CONSTRAINT platform_settings_key_key UNIQUE (key);
  END IF;
END $$;
GRANT ALL ON public.platform_settings TO service_role;
GRANT SELECT ON public.platform_settings TO authenticated;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS fullname text DEFAULT ''::text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS department text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS extra_pages text[] DEFAULT '{}'::text[];
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS denied_pages text[] DEFAULT '{}'::text[];
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pin_hash text;
ALTER TABLE public.project_budgets ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.project_budgets ADD COLUMN IF NOT EXISTS project_id uuid;
ALTER TABLE public.project_budgets ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.project_budgets ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE public.project_budgets ADD COLUMN IF NOT EXISTS planned_amount numeric DEFAULT 0;
ALTER TABLE public.project_budgets ADD COLUMN IF NOT EXISTS note text;
ALTER TABLE public.project_budgets ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.project_budgets ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.project_budgets ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.project_budgets ADD COLUMN IF NOT EXISTS floor_id uuid;
ALTER TABLE public.project_budgets ADD COLUMN IF NOT EXISTS quantity numeric;
ALTER TABLE public.project_budgets ADD COLUMN IF NOT EXISTS unit text;
ALTER TABLE public.project_budgets ADD COLUMN IF NOT EXISTS unit_price numeric;
ALTER TABLE public.project_staff ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.project_staff ADD COLUMN IF NOT EXISTS project_id uuid;
ALTER TABLE public.project_staff ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.project_staff ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.project_stages ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.project_stages ADD COLUMN IF NOT EXISTS project_id uuid;
ALTER TABLE public.project_stages ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.project_stages ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.project_stages ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.project_stages ADD COLUMN IF NOT EXISTS start_date date;
ALTER TABLE public.project_stages ADD COLUMN IF NOT EXISTS end_date date;
ALTER TABLE public.project_stages ADD COLUMN IF NOT EXISTS progress integer DEFAULT 0;
ALTER TABLE public.project_stages ADD COLUMN IF NOT EXISTS status text DEFAULT 'planned'::text;
ALTER TABLE public.project_stages ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;
ALTER TABLE public.project_stages ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.project_stages ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.project_stages ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.project_stages ADD COLUMN IF NOT EXISTS depends_on uuid;
ALTER TABLE public.project_stages ADD COLUMN IF NOT EXISTS deadline date;
ALTER TABLE public.project_stages ADD COLUMN IF NOT EXISTS alert_days integer DEFAULT 3;
ALTER TABLE public.project_stages ADD COLUMN IF NOT EXISTS weight numeric DEFAULT 1;
ALTER TABLE public.project_stages ADD COLUMN IF NOT EXISTS assignee_id uuid;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS location text;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS status public.project_status DEFAULT 'in_progress'::project_status;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS cover_url text;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS public_showcase boolean DEFAULT false;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS show_prices boolean DEFAULT false;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS parent_id uuid;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS model_3d_path text;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS cost_per_sqm numeric;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS cost_currency text DEFAULT 'USD'::text;
ALTER TABLE public.quality_checks ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.quality_checks ADD COLUMN IF NOT EXISTS project_id uuid;
ALTER TABLE public.quality_checks ADD COLUMN IF NOT EXISTS stage_id uuid;
ALTER TABLE public.quality_checks ADD COLUMN IF NOT EXISTS check_name text;
ALTER TABLE public.quality_checks ADD COLUMN IF NOT EXISTS checklist jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.quality_checks ADD COLUMN IF NOT EXISTS result text DEFAULT 'pending'::text;
ALTER TABLE public.quality_checks ADD COLUMN IF NOT EXISTS inspector text;
ALTER TABLE public.quality_checks ADD COLUMN IF NOT EXISTS check_date date DEFAULT CURRENT_DATE;
ALTER TABLE public.quality_checks ADD COLUMN IF NOT EXISTS issues text;
ALTER TABLE public.quality_checks ADD COLUMN IF NOT EXISTS photo_url text;
ALTER TABLE public.quality_checks ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.quality_checks ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.quality_checks ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.resettlements ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.resettlements ADD COLUMN IF NOT EXISTS project_id uuid;
ALTER TABLE public.resettlements ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.resettlements ADD COLUMN IF NOT EXISTS owner_fullname text;
ALTER TABLE public.resettlements ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.resettlements ADD COLUMN IF NOT EXISTS old_address text;
ALTER TABLE public.resettlements ADD COLUMN IF NOT EXISTS cadastral_number text;
ALTER TABLE public.resettlements ADD COLUMN IF NOT EXISTS ownership_document text;
ALTER TABLE public.resettlements ADD COLUMN IF NOT EXISTS photo_url text;
ALTER TABLE public.resettlements ADD COLUMN IF NOT EXISTS old_house_area numeric DEFAULT 0;
ALTER TABLE public.resettlements ADD COLUMN IF NOT EXISTS land_area numeric DEFAULT 0;
ALTER TABLE public.resettlements ADD COLUMN IF NOT EXISTS compensation_area numeric DEFAULT 0;
ALTER TABLE public.resettlements ADD COLUMN IF NOT EXISTS additional_area numeric DEFAULT 0;
ALTER TABLE public.resettlements ADD COLUMN IF NOT EXISTS price_per_m2 numeric DEFAULT 0;
ALTER TABLE public.resettlements ADD COLUMN IF NOT EXISTS discount numeric DEFAULT 0;
ALTER TABLE public.resettlements ADD COLUMN IF NOT EXISTS status text DEFAULT 'negotiation'::text;
ALTER TABLE public.resettlements ADD COLUMN IF NOT EXISTS note text;
ALTER TABLE public.resettlements ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.resettlements ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.resettlements ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.resettlements ADD COLUMN IF NOT EXISTS apartment_id uuid;
ALTER TABLE public.resettlements ADD COLUMN IF NOT EXISTS customer_id uuid;
ALTER TABLE public.resettlements ADD COLUMN IF NOT EXISTS sale_id uuid;
ALTER TABLE public.resettlements ADD COLUMN IF NOT EXISTS compensation_type text DEFAULT 'apartment'::text;
ALTER TABLE public.resettlements ADD COLUMN IF NOT EXISTS cash_amount numeric DEFAULT 0;
ALTER TABLE public.resettlements ADD COLUMN IF NOT EXISTS expense_id uuid;
ALTER TABLE public.salary_accruals ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.salary_accruals ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.salary_accruals ADD COLUMN IF NOT EXISTS worker_id uuid;
ALTER TABLE public.salary_accruals ADD COLUMN IF NOT EXISTS period date;
ALTER TABLE public.salary_accruals ADD COLUMN IF NOT EXISTS amount numeric DEFAULT 0;
ALTER TABLE public.salary_accruals ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.salary_accruals ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS customer_id uuid;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS apartment_id uuid;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS project_id uuid;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS full_price numeric;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS paid_amount numeric DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS payment_deadline date;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS status public.sale_status DEFAULT 'active'::sale_status;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS currency text DEFAULT 'TJS'::text;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS installment_months integer DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS passport_front_path text;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS passport_back_path text;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS sale_number integer;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS cost_ratio numeric;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS partner_shares_snapshot jsonb;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS area_snapshot numeric;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS base_price_per_m2 numeric;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS sale_price_per_m2 numeric;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS sales_manager_id uuid;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS commission_percent numeric DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS commission_amount numeric DEFAULT 0;
ALTER TABLE public.sales_team_members ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.sales_team_members ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.sales_team_members ADD COLUMN IF NOT EXISTS owner_user_id uuid;
ALTER TABLE public.sales_team_members ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.sales_team_members ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.sales_team_members ADD COLUMN IF NOT EXISTS fullname text;
ALTER TABLE public.sales_team_members ADD COLUMN IF NOT EXISTS kind text DEFAULT 'manager'::text;
ALTER TABLE public.sales_team_members ADD COLUMN IF NOT EXISTS percent numeric DEFAULT 0;
ALTER TABLE public.sales_team_members ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE public.sales_team_members ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.sales_team_members ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.sales_team_payouts ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.sales_team_payouts ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.sales_team_payouts ADD COLUMN IF NOT EXISTS member_id uuid;
ALTER TABLE public.sales_team_payouts ADD COLUMN IF NOT EXISTS owner_user_id uuid;
ALTER TABLE public.sales_team_payouts ADD COLUMN IF NOT EXISTS amount numeric;
ALTER TABLE public.sales_team_payouts ADD COLUMN IF NOT EXISTS note text;
ALTER TABLE public.sales_team_payouts ADD COLUMN IF NOT EXISTS paid_at timestamp with time zone DEFAULT now();
ALTER TABLE public.sales_team_payouts ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.sales_team_payouts ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.scan_credit_packages ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.scan_credit_packages ADD COLUMN IF NOT EXISTS size integer;
ALTER TABLE public.scan_credit_packages ADD COLUMN IF NOT EXISTS amount numeric;
ALTER TABLE public.scan_credit_packages ADD COLUMN IF NOT EXISTS label text DEFAULT ''::text;
ALTER TABLE public.scan_credit_packages ADD COLUMN IF NOT EXISTS is_best boolean DEFAULT false;
ALTER TABLE public.scan_credit_packages ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE public.scan_credit_packages ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;
ALTER TABLE public.scan_credit_packages ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.scan_credit_packages ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.scan_credit_purchases ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.scan_credit_purchases ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.scan_credit_purchases ADD COLUMN IF NOT EXISTS requested_by uuid;
ALTER TABLE public.scan_credit_purchases ADD COLUMN IF NOT EXISTS package_size integer;
ALTER TABLE public.scan_credit_purchases ADD COLUMN IF NOT EXISTS amount numeric;
ALTER TABLE public.scan_credit_purchases ADD COLUMN IF NOT EXISTS receipt_path text;
ALTER TABLE public.scan_credit_purchases ADD COLUMN IF NOT EXISTS note text;
ALTER TABLE public.scan_credit_purchases ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending'::text;
ALTER TABLE public.scan_credit_purchases ADD COLUMN IF NOT EXISTS reviewed_by uuid;
ALTER TABLE public.scan_credit_purchases ADD COLUMN IF NOT EXISTS reviewed_at timestamp with time zone;
ALTER TABLE public.scan_credit_purchases ADD COLUMN IF NOT EXISTS rejection_reason text;
ALTER TABLE public.scan_credit_purchases ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.showcase_companies ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.showcase_companies ADD COLUMN IF NOT EXISTS company_name text;
ALTER TABLE public.showcase_companies ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE public.showcase_companies ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.showcase_companies ADD COLUMN IF NOT EXISTS website text;
ALTER TABLE public.showcase_companies ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;
ALTER TABLE public.showcase_companies ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE public.showcase_companies ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.showcase_companies ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.showcase_companies ADD COLUMN IF NOT EXISTS logo_path text;
ALTER TABLE public.site_incidents ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.site_incidents ADD COLUMN IF NOT EXISTS project_id uuid;
ALTER TABLE public.site_incidents ADD COLUMN IF NOT EXISTS incident_date date DEFAULT CURRENT_DATE;
ALTER TABLE public.site_incidents ADD COLUMN IF NOT EXISTS incident_type text DEFAULT 'safety'::text;
ALTER TABLE public.site_incidents ADD COLUMN IF NOT EXISTS severity text DEFAULT 'low'::text;
ALTER TABLE public.site_incidents ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.site_incidents ADD COLUMN IF NOT EXISTS latitude numeric;
ALTER TABLE public.site_incidents ADD COLUMN IF NOT EXISTS longitude numeric;
ALTER TABLE public.site_incidents ADD COLUMN IF NOT EXISTS photo_url text;
ALTER TABLE public.site_incidents ADD COLUMN IF NOT EXISTS resolution text;
ALTER TABLE public.site_incidents ADD COLUMN IF NOT EXISTS resolved boolean DEFAULT false;
ALTER TABLE public.site_incidents ADD COLUMN IF NOT EXISTS reported_by text;
ALTER TABLE public.site_incidents ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.site_incidents ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.site_incidents ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.sms_logs ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.sms_logs ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.sms_logs ADD COLUMN IF NOT EXISTS schedule_id uuid;
ALTER TABLE public.sms_logs ADD COLUMN IF NOT EXISTS customer_phone text;
ALTER TABLE public.sms_logs ADD COLUMN IF NOT EXISTS message text;
ALTER TABLE public.sms_logs ADD COLUMN IF NOT EXISTS due_date date;
ALTER TABLE public.sms_logs ADD COLUMN IF NOT EXISTS stage text;
ALTER TABLE public.sms_logs ADD COLUMN IF NOT EXISTS reminder_key text;
ALTER TABLE public.sms_logs ADD COLUMN IF NOT EXISTS status text DEFAULT 'sent'::text;
ALTER TABLE public.sms_logs ADD COLUMN IF NOT EXISTS error text;
ALTER TABLE public.sms_logs ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.stage_tasks ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.stage_tasks ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.stage_tasks ADD COLUMN IF NOT EXISTS project_id uuid;
ALTER TABLE public.stage_tasks ADD COLUMN IF NOT EXISTS stage_id uuid;
ALTER TABLE public.stage_tasks ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.stage_tasks ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.stage_tasks ADD COLUMN IF NOT EXISTS weight numeric DEFAULT 1;
ALTER TABLE public.stage_tasks ADD COLUMN IF NOT EXISTS progress integer DEFAULT 0;
ALTER TABLE public.stage_tasks ADD COLUMN IF NOT EXISTS assignee_id uuid;
ALTER TABLE public.stage_tasks ADD COLUMN IF NOT EXISTS start_date date;
ALTER TABLE public.stage_tasks ADD COLUMN IF NOT EXISTS end_date date;
ALTER TABLE public.stage_tasks ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;
ALTER TABLE public.stage_tasks ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.stage_tasks ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.stage_tasks ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.stage_updates ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.stage_updates ADD COLUMN IF NOT EXISTS stage_id uuid;
ALTER TABLE public.stage_updates ADD COLUMN IF NOT EXISTS project_id uuid;
ALTER TABLE public.stage_updates ADD COLUMN IF NOT EXISTS progress integer;
ALTER TABLE public.stage_updates ADD COLUMN IF NOT EXISTS note text;
ALTER TABLE public.stage_updates ADD COLUMN IF NOT EXISTS photo_path text;
ALTER TABLE public.stage_updates ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.stage_updates ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.studio_publications ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.studio_publications ADD COLUMN IF NOT EXISTS project_id uuid;
ALTER TABLE public.studio_publications ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.studio_publications ADD COLUMN IF NOT EXISTS channels jsonb DEFAULT '{"qr": false, "crm": true, "kiosk": true, "mobile": false, "website": false}'::jsonb;
ALTER TABLE public.studio_publications ADD COLUMN IF NOT EXISTS public_token text DEFAULT encode(extensions.gen_random_bytes(16), 'hex'::text);
ALTER TABLE public.studio_publications ADD COLUMN IF NOT EXISTS published_at timestamp with time zone DEFAULT now();
ALTER TABLE public.studio_publications ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.studio_publications ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.subcontract_acts ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.subcontract_acts ADD COLUMN IF NOT EXISTS work_id uuid;
ALTER TABLE public.subcontract_acts ADD COLUMN IF NOT EXISTS act_number text;
ALTER TABLE public.subcontract_acts ADD COLUMN IF NOT EXISTS act_type text DEFAULT 'ks2'::text;
ALTER TABLE public.subcontract_acts ADD COLUMN IF NOT EXISTS done_qty numeric DEFAULT 0;
ALTER TABLE public.subcontract_acts ADD COLUMN IF NOT EXISTS amount numeric DEFAULT 0;
ALTER TABLE public.subcontract_acts ADD COLUMN IF NOT EXISTS signed_date date DEFAULT CURRENT_DATE;
ALTER TABLE public.subcontract_acts ADD COLUMN IF NOT EXISTS file_url text;
ALTER TABLE public.subcontract_acts ADD COLUMN IF NOT EXISTS note text;
ALTER TABLE public.subcontract_acts ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.subcontract_acts ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.subcontract_acts ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.subcontract_payments ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.subcontract_payments ADD COLUMN IF NOT EXISTS work_id uuid;
ALTER TABLE public.subcontract_payments ADD COLUMN IF NOT EXISTS act_id uuid;
ALTER TABLE public.subcontract_payments ADD COLUMN IF NOT EXISTS amount numeric;
ALTER TABLE public.subcontract_payments ADD COLUMN IF NOT EXISTS paid_date date DEFAULT CURRENT_DATE;
ALTER TABLE public.subcontract_payments ADD COLUMN IF NOT EXISTS method text DEFAULT 'cash'::text;
ALTER TABLE public.subcontract_payments ADD COLUMN IF NOT EXISTS note text;
ALTER TABLE public.subcontract_payments ADD COLUMN IF NOT EXISTS expense_id uuid;
ALTER TABLE public.subcontract_payments ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.subcontract_payments ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.subcontract_payments ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.subcontract_works ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.subcontract_works ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.subcontract_works ADD COLUMN IF NOT EXISTS project_id uuid;
ALTER TABLE public.subcontract_works ADD COLUMN IF NOT EXISTS subcontractor_id uuid;
ALTER TABLE public.subcontract_works ADD COLUMN IF NOT EXISTS work_name text;
ALTER TABLE public.subcontract_works ADD COLUMN IF NOT EXISTS unit text DEFAULT 'm2'::text;
ALTER TABLE public.subcontract_works ADD COLUMN IF NOT EXISTS unit_price numeric DEFAULT 0;
ALTER TABLE public.subcontract_works ADD COLUMN IF NOT EXISTS planned_qty numeric DEFAULT 0;
ALTER TABLE public.subcontract_works ADD COLUMN IF NOT EXISTS done_qty numeric DEFAULT 0;
ALTER TABLE public.subcontract_works ADD COLUMN IF NOT EXISTS start_date date;
ALTER TABLE public.subcontract_works ADD COLUMN IF NOT EXISTS end_date date;
ALTER TABLE public.subcontract_works ADD COLUMN IF NOT EXISTS status text DEFAULT 'active'::text;
ALTER TABLE public.subcontract_works ADD COLUMN IF NOT EXISTS note text;
ALTER TABLE public.subcontract_works ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.subcontract_works ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.subcontract_works ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.subcontractors ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.subcontractors ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.subcontractors ADD COLUMN IF NOT EXISTS brigade_name text;
ALTER TABLE public.subcontractors ADD COLUMN IF NOT EXISTS foreman_name text;
ALTER TABLE public.subcontractors ADD COLUMN IF NOT EXISTS specialty text DEFAULT 'general'::text;
ALTER TABLE public.subcontractors ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.subcontractors ADD COLUMN IF NOT EXISTS inn text;
ALTER TABLE public.subcontractors ADD COLUMN IF NOT EXISTS note text;
ALTER TABLE public.subcontractors ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE public.subcontractors ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.subcontractors ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.subcontractors ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.subscription_payments ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.subscription_payments ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.subscription_payments ADD COLUMN IF NOT EXISTS tariff_id uuid;
ALTER TABLE public.subscription_payments ADD COLUMN IF NOT EXISTS payment_method_id uuid;
ALTER TABLE public.subscription_payments ADD COLUMN IF NOT EXISTS amount numeric;
ALTER TABLE public.subscription_payments ADD COLUMN IF NOT EXISTS currency text DEFAULT 'TJS'::text;
ALTER TABLE public.subscription_payments ADD COLUMN IF NOT EXISTS receipt_url text;
ALTER TABLE public.subscription_payments ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending'::text;
ALTER TABLE public.subscription_payments ADD COLUMN IF NOT EXISTS reject_reason text;
ALTER TABLE public.subscription_payments ADD COLUMN IF NOT EXISTS reviewed_by uuid;
ALTER TABLE public.subscription_payments ADD COLUMN IF NOT EXISTS reviewed_at timestamp with time zone;
ALTER TABLE public.subscription_payments ADD COLUMN IF NOT EXISTS activated_until timestamp with time zone;
ALTER TABLE public.subscription_payments ADD COLUMN IF NOT EXISTS created_by uuid DEFAULT auth.uid();
ALTER TABLE public.subscription_payments ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.subscription_payments ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS contact_person text;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS note text;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS archived boolean DEFAULT false;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS patent_number text;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS patent_photo_path text;
ALTER TABLE public.supply_alerts ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.supply_alerts ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.supply_alerts ADD COLUMN IF NOT EXISTS item_id uuid;
ALTER TABLE public.supply_alerts ADD COLUMN IF NOT EXISTS item_name text;
ALTER TABLE public.supply_alerts ADD COLUMN IF NOT EXISTS quantity numeric DEFAULT 0;
ALTER TABLE public.supply_alerts ADD COLUMN IF NOT EXISTS threshold numeric DEFAULT 10;
ALTER TABLE public.supply_alerts ADD COLUMN IF NOT EXISTS unit text;
ALTER TABLE public.supply_alerts ADD COLUMN IF NOT EXISTS sms_status text;
ALTER TABLE public.supply_alerts ADD COLUMN IF NOT EXISTS resolved boolean DEFAULT false;
ALTER TABLE public.supply_alerts ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.supply_alerts ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS subject text;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS message text;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS screenshot_url text;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS status text DEFAULT 'open'::text;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS admin_reply text;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.tariffs ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.tariffs ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.tariffs ADD COLUMN IF NOT EXISTS duration_days integer;
ALTER TABLE public.tariffs ADD COLUMN IF NOT EXISTS price numeric DEFAULT 0;
ALTER TABLE public.tariffs ADD COLUMN IF NOT EXISTS currency text DEFAULT 'TJS'::text;
ALTER TABLE public.tariffs ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE public.tariffs ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.tariffs ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.tariffs ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.tariffs ADD COLUMN IF NOT EXISTS features text[] DEFAULT '{}'::text[];
ALTER TABLE public.tariffs ADD COLUMN IF NOT EXISTS max_projects integer;
ALTER TABLE public.tariffs ADD COLUMN IF NOT EXISTS max_staff integer;
ALTER TABLE public.tariffs ADD COLUMN IF NOT EXISTS support_days integer;
ALTER TABLE public.tariffs ADD COLUMN IF NOT EXISTS billing_period text DEFAULT 'monthly'::text;
ALTER TABLE public.tariffs ADD COLUMN IF NOT EXISTS max_blocks integer;
ALTER TABLE public.tax_reports ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.tax_reports ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.tax_reports ADD COLUMN IF NOT EXISTS report_type text;
ALTER TABLE public.tax_reports ADD COLUMN IF NOT EXISTS period_start date;
ALTER TABLE public.tax_reports ADD COLUMN IF NOT EXISTS period_end date;
ALTER TABLE public.tax_reports ADD COLUMN IF NOT EXISTS revenue numeric DEFAULT 0;
ALTER TABLE public.tax_reports ADD COLUMN IF NOT EXISTS expenses numeric DEFAULT 0;
ALTER TABLE public.tax_reports ADD COLUMN IF NOT EXISTS profit numeric DEFAULT 0;
ALTER TABLE public.tax_reports ADD COLUMN IF NOT EXISTS tax_amount numeric DEFAULT 0;
ALTER TABLE public.tax_reports ADD COLUMN IF NOT EXISTS status text DEFAULT 'draft'::text;
ALTER TABLE public.tax_reports ADD COLUMN IF NOT EXISTS submitted_at timestamp with time zone;
ALTER TABLE public.tax_reports ADD COLUMN IF NOT EXISTS file_path text;
ALTER TABLE public.tax_reports ADD COLUMN IF NOT EXISTS note text;
ALTER TABLE public.tax_reports ADD COLUMN IF NOT EXISTS data jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.tax_reports ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.tax_reports ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.tax_reports ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.tour_templates ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.tour_templates ADD COLUMN IF NOT EXISTS code text;
ALTER TABLE public.tour_templates ADD COLUMN IF NOT EXISTS rooms_count integer;
ALTER TABLE public.tour_templates ADD COLUMN IF NOT EXISTS style text DEFAULT 'modern'::text;
ALTER TABLE public.tour_templates ADD COLUMN IF NOT EXISTS label text;
ALTER TABLE public.tour_templates ADD COLUMN IF NOT EXISTS panorama_url text;
ALTER TABLE public.tour_templates ADD COLUMN IF NOT EXISTS preview_url text;
ALTER TABLE public.tour_templates ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;
ALTER TABLE public.tour_templates ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE public.tour_templates ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.tour_templates ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS role public.app_role;
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.warehouse_issues ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.warehouse_issues ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.warehouse_issues ADD COLUMN IF NOT EXISTS item_id uuid;
ALTER TABLE public.warehouse_issues ADD COLUMN IF NOT EXISTS project_id uuid;
ALTER TABLE public.warehouse_issues ADD COLUMN IF NOT EXISTS issue_date date DEFAULT CURRENT_DATE;
ALTER TABLE public.warehouse_issues ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.warehouse_issues ADD COLUMN IF NOT EXISTS unit text DEFAULT 'dona'::text;
ALTER TABLE public.warehouse_issues ADD COLUMN IF NOT EXISTS quantity numeric;
ALTER TABLE public.warehouse_issues ADD COLUMN IF NOT EXISTS unit_price numeric;
ALTER TABLE public.warehouse_issues ADD COLUMN IF NOT EXISTS total numeric DEFAULT 0;
ALTER TABLE public.warehouse_issues ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.warehouse_issues ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.warehouse_items ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.warehouse_items ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.warehouse_items ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.warehouse_items ADD COLUMN IF NOT EXISTS unit text DEFAULT 'dona'::text;
ALTER TABLE public.warehouse_items ADD COLUMN IF NOT EXISTS quantity numeric DEFAULT 0;
ALTER TABLE public.warehouse_items ADD COLUMN IF NOT EXISTS unit_price numeric DEFAULT 0;
ALTER TABLE public.warehouse_items ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.warehouse_items ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.warehouse_items ADD COLUMN IF NOT EXISTS min_quantity numeric DEFAULT 10;
ALTER TABLE public.warehouse_receipts ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.warehouse_receipts ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.warehouse_receipts ADD COLUMN IF NOT EXISTS item_id uuid;
ALTER TABLE public.warehouse_receipts ADD COLUMN IF NOT EXISTS receipt_date date DEFAULT CURRENT_DATE;
ALTER TABLE public.warehouse_receipts ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.warehouse_receipts ADD COLUMN IF NOT EXISTS unit text DEFAULT 'dona'::text;
ALTER TABLE public.warehouse_receipts ADD COLUMN IF NOT EXISTS quantity numeric;
ALTER TABLE public.warehouse_receipts ADD COLUMN IF NOT EXISTS unit_price numeric DEFAULT 0;
ALTER TABLE public.warehouse_receipts ADD COLUMN IF NOT EXISTS supplier_id uuid;
ALTER TABLE public.warehouse_receipts ADD COLUMN IF NOT EXISTS supplier_fio text;
ALTER TABLE public.warehouse_receipts ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'cash'::text;
ALTER TABLE public.warehouse_receipts ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.warehouse_receipts ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.warehouse_receipts ADD COLUMN IF NOT EXISTS check_number text;
ALTER TABLE public.warehouse_receipts ADD COLUMN IF NOT EXISTS check_photo_path text;
ALTER TABLE public.warehouse_receipts ADD COLUMN IF NOT EXISTS patent_photo_path text;
ALTER TABLE public.warehouse_receipts ADD COLUMN IF NOT EXISTS docs_source text DEFAULT 'ocr'::text;
ALTER TABLE public.whatsapp_accounts ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.whatsapp_accounts ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.whatsapp_accounts ADD COLUMN IF NOT EXISTS profile_id text;
ALTER TABLE public.whatsapp_accounts ADD COLUMN IF NOT EXISTS label text;
ALTER TABLE public.whatsapp_accounts ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.whatsapp_accounts ADD COLUMN IF NOT EXISTS enabled boolean DEFAULT true;
ALTER TABLE public.whatsapp_accounts ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.whatsapp_accounts ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.whatsapp_chats ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.whatsapp_chats ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.whatsapp_chats ADD COLUMN IF NOT EXISTS profile_id text;
ALTER TABLE public.whatsapp_chats ADD COLUMN IF NOT EXISTS chat_id text;
ALTER TABLE public.whatsapp_chats ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.whatsapp_chats ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE public.whatsapp_chats ADD COLUMN IF NOT EXISTS customer_id uuid;
ALTER TABLE public.whatsapp_chats ADD COLUMN IF NOT EXISTS last_message_text text;
ALTER TABLE public.whatsapp_chats ADD COLUMN IF NOT EXISTS last_message_at timestamp with time zone;
ALTER TABLE public.whatsapp_chats ADD COLUMN IF NOT EXISTS last_direction text;
ALTER TABLE public.whatsapp_chats ADD COLUMN IF NOT EXISTS unread_count integer DEFAULT 0;
ALTER TABLE public.whatsapp_chats ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.whatsapp_chats ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.whatsapp_chats ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS chat_id uuid;
ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS customer_id uuid;
ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS direction text;
ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS body text;
ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS message_type text DEFAULT 'text'::text;
ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS media_url text;
ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS media_meta jsonb;
ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS wappi_message_id text;
ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending'::text;
ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS sent_at timestamp with time zone DEFAULT now();
ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS error_text text;
ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS raw jsonb;
ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.whatsapp_webhook_logs ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.whatsapp_webhook_logs ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.whatsapp_webhook_logs ADD COLUMN IF NOT EXISTS event text;
ALTER TABLE public.whatsapp_webhook_logs ADD COLUMN IF NOT EXISTS level text DEFAULT 'info'::text;
ALTER TABLE public.whatsapp_webhook_logs ADD COLUMN IF NOT EXISTS message text;
ALTER TABLE public.whatsapp_webhook_logs ADD COLUMN IF NOT EXISTS detail jsonb;
ALTER TABLE public.whatsapp_webhook_logs ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.worker_payments ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.worker_payments ADD COLUMN IF NOT EXISTS worker_id uuid;
ALTER TABLE public.worker_payments ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.worker_payments ADD COLUMN IF NOT EXISTS project_id uuid;
ALTER TABLE public.worker_payments ADD COLUMN IF NOT EXISTS period_from date;
ALTER TABLE public.worker_payments ADD COLUMN IF NOT EXISTS period_to date;
ALTER TABLE public.worker_payments ADD COLUMN IF NOT EXISTS days_worked numeric DEFAULT 0;
ALTER TABLE public.worker_payments ADD COLUMN IF NOT EXISTS total_amount numeric DEFAULT 0;
ALTER TABLE public.worker_payments ADD COLUMN IF NOT EXISTS paid_amount numeric DEFAULT 0;
ALTER TABLE public.worker_payments ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending'::text;
ALTER TABLE public.worker_payments ADD COLUMN IF NOT EXISTS note text;
ALTER TABLE public.worker_payments ADD COLUMN IF NOT EXISTS expense_id uuid;
ALTER TABLE public.worker_payments ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.worker_payments ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.worker_payments ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.workers ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.workers ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.workers ADD COLUMN IF NOT EXISTS fullname text;
ALTER TABLE public.workers ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.workers ADD COLUMN IF NOT EXISTS "position" text;
ALTER TABLE public.workers ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.workers ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.workers ADD COLUMN IF NOT EXISTS daily_rate numeric DEFAULT 0;
ALTER TABLE public.workers ADD COLUMN IF NOT EXISTS passport_number text;
ALTER TABLE public.workers ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE public.workers ADD COLUMN IF NOT EXISTS monthly_salary numeric DEFAULT 0;
ALTER TABLE public.workers ADD COLUMN IF NOT EXISTS salary_start_date date;
ALTER TABLE public.workers ADD COLUMN IF NOT EXISTS cost_center text DEFAULT 'project'::text;
ALTER TABLE public.workers ADD COLUMN IF NOT EXISTS project_id uuid;
ALTER TABLE public.workers ADD COLUMN IF NOT EXISTS block_id uuid;
ALTER TABLE public.workers ADD COLUMN IF NOT EXISTS face_photo_path text;
ALTER TABLE public.workers ADD COLUMN IF NOT EXISTS face_enrolled_at timestamp with time zone;
ALTER TABLE public.workers ADD COLUMN IF NOT EXISTS face_required boolean DEFAULT true;
ALTER TABLE public.barter_deals ADD COLUMN IF NOT EXISTS remaining numeric(14,2) GENERATED ALWAYS AS (((property_value - estimated_value) - cash_paid)) STORED;
ALTER TABLE public.material_acceptance_acts ADD COLUMN IF NOT EXISTS variance numeric GENERATED ALWAYS AS ((actual_qty - ordered_qty)) STORED;
ALTER TABLE public.material_acceptance_acts ADD COLUMN IF NOT EXISTS variance_pct numeric GENERATED ALWAYS AS (
CASE
    WHEN (ordered_qty > (0)::numeric) THEN (((actual_qty - ordered_qty) / ordered_qty) * (100)::numeric)
    ELSE (0)::numeric
END) STORED;
ALTER TABLE public.material_acceptance_acts ADD COLUMN IF NOT EXISTS loss_amount numeric GENERATED ALWAYS AS (((ordered_qty - actual_qty) * unit_price)) STORED;
ALTER TABLE public.resettlements ADD COLUMN IF NOT EXISTS total_payable numeric(14,2) GENERATED ALWAYS AS (GREATEST(((additional_area * price_per_m2) - discount), (0)::numeric)) STORED;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS remaining_amount numeric(14,2) GENERATED ALWAYS AS ((full_price - paid_amount)) STORED;
ALTER TABLE public.subcontract_works ADD COLUMN IF NOT EXISTS contract_amount numeric(14,2) GENERATED ALWAYS AS ((planned_qty * unit_price)) STORED;
ALTER TABLE public.warehouse_receipts ADD COLUMN IF NOT EXISTS total numeric GENERATED ALWAYS AS ((quantity * unit_price)) STORED;

-- Super Admin access required by the browser application.  Historical
-- migrations are intentionally not replayed on VPS, so keep this block
-- idempotent and data-preserving.
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

GRANT SELECT ON public.platform_admins TO authenticated;
GRANT ALL ON public.platform_admins TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;

ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION private.is_platform_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins WHERE user_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_platform_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT private.is_platform_admin(_user_id)
$$;

CREATE OR REPLACE FUNCTION private.user_company_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT COALESCE(
    (SELECT company_id FROM public.profiles WHERE id = _user_id),
    (SELECT id FROM public.companies WHERE owner_user_id = _user_id ORDER BY created_at LIMIT 1)
  )
$$;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$ SELECT private.has_role(_user_id, _role) $$;

CREATE OR REPLACE FUNCTION public.user_company_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$ SELECT private.user_company_id(_user_id) $$;

CREATE OR REPLACE FUNCTION public.is_director(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role::text = 'director'
  )
$$;

CREATE OR REPLACE FUNCTION private.user_is_project_partner(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.partner_shares ps
    WHERE ps.director_user_id = _user_id
      AND ps.project_id = _project_id
      AND ps.percent > 0
  )
$$;

CREATE OR REPLACE FUNCTION public.user_is_project_partner(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$ SELECT private.user_is_project_partner(_user_id, _project_id) $$;

CREATE OR REPLACE FUNCTION private.project_in_user_company(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = _project_id AND p.company_id = private.user_company_id(_user_id)
  )
$$;

CREATE OR REPLACE FUNCTION private.is_assigned_sales_manager(_user_id uuid, _member_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.sales_team_members m
    WHERE m.id = _member_id AND m.kind = 'manager' AND m.is_active
      AND (m.user_id = _user_id OR lower(m.email) = lower((SELECT u.email FROM auth.users u WHERE u.id = _user_id)))
  )
$$;

GRANT EXECUTE ON FUNCTION private.is_platform_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_platform_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.user_company_id(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Users see own admin status" ON public.platform_admins;
CREATE POLICY "Users see own admin status"
  ON public.platform_admins
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "View company (self/admin)" ON public.companies;
CREATE POLICY "View company (self/admin)"
  ON public.companies
  FOR SELECT TO authenticated
  USING (
    private.is_platform_admin(auth.uid())
    OR id = private.user_company_id(auth.uid())
    OR owner_user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Admin manages companies" ON public.companies;
CREATE POLICY "Admin manages companies"
  ON public.companies
  FOR ALL TO authenticated
  USING (private.is_platform_admin(auth.uid()))
  WITH CHECK (private.is_platform_admin(auth.uid()));

-- Project access is reused by child tables that only carry project_id or
-- sale_id. Keep it security-definer so RLS checks do not recurse.
CREATE OR REPLACE FUNCTION private.user_can_access_project(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT private.is_platform_admin(_user_id)
    OR EXISTS (
      SELECT 1
      FROM public.projects p
      LEFT JOIN public.companies c ON c.id = p.company_id
      WHERE p.id = _project_id
        AND (
          p.company_id = private.user_company_id(_user_id)
          OR c.owner_user_id = _user_id
          OR EXISTS (
            SELECT 1 FROM public.project_staff ps
            WHERE ps.project_id = p.id AND ps.user_id = _user_id
          )
          OR EXISTS (
            SELECT 1 FROM public.partner_shares sh
            WHERE sh.project_id = p.id AND sh.director_user_id = _user_id
          )
        )
    )
$$;

CREATE OR REPLACE FUNCTION public.user_can_access_project(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$ SELECT private.user_can_access_project(_user_id, _project_id) $$;

CREATE OR REPLACE FUNCTION private.director_can_read_project(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT public.is_director(_user_id)
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = _project_id
        AND p.company_id = private.user_company_id(_user_id)
        AND (
          EXISTS (SELECT 1 FROM public.partner_shares s WHERE s.director_user_id = _user_id AND s.project_id = p.id)
          OR EXISTS (SELECT 1 FROM public.partner_shares s WHERE s.director_user_id = _user_id AND s.project_id = p.parent_id)
          OR EXISTS (
            SELECT 1 FROM public.partner_shares s
            JOIN public.projects child ON child.id = s.project_id
            WHERE s.director_user_id = _user_id AND child.parent_id = p.id
          )
        )
    )
$$;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA private TO authenticated, service_role;

-- The VPS schema is assembled from column metadata, so restore the core keys
-- and relationships needed by nested project, floor, sale and payment reads.
DO $$ BEGIN ALTER TABLE public.companies ADD CONSTRAINT companies_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.profiles ADD CONSTRAINT profiles_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.projects ADD CONSTRAINT projects_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.floors ADD CONSTRAINT floors_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.apartments ADD CONSTRAINT apartments_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.customers ADD CONSTRAINT customers_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.sales ADD CONSTRAINT sales_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.payments ADD CONSTRAINT payments_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.payment_schedule ADD CONSTRAINT payment_schedule_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE public.projects ADD CONSTRAINT projects_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.projects ADD CONSTRAINT projects_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.projects(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.floors ADD CONSTRAINT floors_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.floors ADD CONSTRAINT floors_project_id_floor_number_key UNIQUE (project_id, floor_number); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.apartments ADD CONSTRAINT apartments_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.apartments ADD CONSTRAINT apartments_floor_id_fkey FOREIGN KEY (floor_id) REFERENCES public.floors(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.customers ADD CONSTRAINT customers_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.sales ADD CONSTRAINT sales_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.sales ADD CONSTRAINT sales_apartment_id_fkey FOREIGN KEY (apartment_id) REFERENCES public.apartments(id) ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.sales ADD CONSTRAINT sales_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.payments ADD CONSTRAINT payments_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.payment_schedule ADD CONSTRAINT payment_schedule_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.floors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apartments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_schedule ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_schedule TO authenticated;
GRANT ALL ON public.payment_schedule TO service_role;
ALTER TABLE public.payment_schedule ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read schedule via sale" ON public.payment_schedule;
CREATE POLICY "Read schedule via sale" ON public.payment_schedule FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.sales s
  WHERE s.id = payment_schedule.sale_id
    AND private.user_can_access_project(auth.uid(), s.project_id)
));

DROP POLICY IF EXISTS "Insert schedule via sale" ON public.payment_schedule;
CREATE POLICY "Insert schedule via sale" ON public.payment_schedule FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.sales s
  WHERE s.id = payment_schedule.sale_id
    AND private.user_can_access_project(auth.uid(), s.project_id)
));

-- ---------------------------------------------------------------------------
-- Backstop: tables created by this sync script (or restored without their
-- original grants/policies) are invisible to the app.  For every public table
-- that still has NO policies, grant Data API access, enable RLS and add a
-- company-scoped policy.  Tables that already have policies are left alone.
-- ---------------------------------------------------------------------------
DO $backstop$
DECLARE
  t record;
  has_company boolean;
  has_project boolean;
  has_user boolean;
  expr text;
BEGIN
  FOR t IN
    SELECT c.relname AS tbl
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND NOT EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid)
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t.tbl);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t.tbl);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tbl);

    SELECT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema='public' AND table_name=t.tbl AND column_name='company_id')
      INTO has_company;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema='public' AND table_name=t.tbl AND column_name='project_id')
      INTO has_project;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema='public' AND table_name=t.tbl AND column_name='user_id')
      INTO has_user;

    IF has_company THEN
      expr := 'private.is_platform_admin(auth.uid()) OR company_id = private.user_company_id(auth.uid())';
    ELSIF has_project THEN
      expr := 'private.is_platform_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.projects pr '
              || 'WHERE pr.id = project_id AND pr.company_id = private.user_company_id(auth.uid()))';
    ELSIF has_user THEN
      expr := 'private.is_platform_admin(auth.uid()) OR user_id = auth.uid()';
    ELSE
      expr := 'private.is_platform_admin(auth.uid())';
    END IF;

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (%s) WITH CHECK (%s)',
      'vps_scope_' || t.tbl, t.tbl, expr, expr);

    RAISE NOTICE 'Policy added for public.%', t.tbl;
  END LOOP;
END
$backstop$;

-- ---------------------------------------------------------------------------
-- Unconditional Data API grants: every public table/sequence must be readable
-- by the app roles, even when it already had policies but lost its grants.
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role;

-- Fast dashboard refresh: indexes plus one aggregate request instead of
-- downloading tens of thousands of rows into every browser every 5 seconds.
CREATE INDEX IF NOT EXISTS idx_projects_company_parent ON public.projects (company_id, parent_id);
CREATE INDEX IF NOT EXISTS idx_apartments_project_status ON public.apartments (project_id, status);
CREATE INDEX IF NOT EXISTS idx_sales_company_project_status ON public.sales (company_id, project_id, status);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON public.sales (created_at);
CREATE INDEX IF NOT EXISTS idx_payments_sale_status_date ON public.payments (sale_id, status, payment_date);
CREATE INDEX IF NOT EXISTS idx_expenses_project_date ON public.expenses (project_id, expense_date);
CREATE INDEX IF NOT EXISTS idx_payment_schedule_sale_due ON public.payment_schedule (sale_id, due_date);
CREATE INDEX IF NOT EXISTS idx_partner_distributions_project_director ON public.partner_distributions (project_id, director_user_id);
CREATE INDEX IF NOT EXISTS idx_partner_payouts_project_director ON public.partner_payouts (project_id, director_user_id);

CREATE OR REPLACE FUNCTION public.dashboard_company_stats(
  _project_ids uuid[] DEFAULT NULL,
  _from_date date DEFAULT NULL,
  _to_date date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_company_id uuid;
  v_result jsonb;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  SELECT COALESCE(
    (SELECT p.company_id FROM public.profiles p WHERE p.id = v_user_id),
    (SELECT c.id FROM public.companies c WHERE c.owner_user_id = v_user_id ORDER BY c.created_at LIMIT 1)
  ) INTO v_company_id;

  IF v_company_id IS NULL THEN
    RETURN jsonb_build_object('projects',0,'customers',0,'apartmentsTotal',0,'sold',0,'available',0,'revenue',0,'paymentsSum',0,'expensesSum',0,'totalDebt',0,'warehouse',0,'workers',0,'payingCustomers',0,'payFull',0,'payInst',0);
  END IF;

  WITH scoped_projects AS (
    SELECT p.id FROM public.projects p
    WHERE p.company_id = v_company_id AND (_project_ids IS NULL OR p.id = ANY(_project_ids))
  ), scoped_sales AS (
    SELECT s.id, s.customer_id, s.full_price, s.paid_amount, s.created_at
    FROM public.sales s JOIN scoped_projects sp ON sp.id = s.project_id
    WHERE s.company_id = v_company_id AND s.status <> 'cancelled'
  ), customer_totals AS (
    SELECT customer_id, SUM(COALESCE(full_price,0)) total, SUM(COALESCE(paid_amount,0)) paid
    FROM scoped_sales WHERE customer_id IS NOT NULL GROUP BY customer_id
  )
  SELECT jsonb_build_object(
    'projects',(SELECT COUNT(*) FROM public.projects p WHERE p.company_id=v_company_id AND p.parent_id IS NULL AND (_project_ids IS NULL OR p.id=ANY(_project_ids))),
    'customers',CASE WHEN _project_ids IS NULL THEN (SELECT COUNT(*) FROM public.customers c WHERE c.company_id=v_company_id) ELSE (SELECT COUNT(*) FROM customer_totals) END,
    'apartmentsTotal',(SELECT COUNT(*) FROM public.apartments a JOIN scoped_projects sp ON sp.id=a.project_id),
    'sold',(SELECT COUNT(*) FROM public.apartments a JOIN scoped_projects sp ON sp.id=a.project_id WHERE a.status='sold'),
    'available',(SELECT COUNT(*) FROM public.apartments a JOIN scoped_projects sp ON sp.id=a.project_id WHERE a.status='empty'),
    'revenue',COALESCE((SELECT SUM(COALESCE(s.full_price,0)) FROM scoped_sales s WHERE (_from_date IS NULL OR s.created_at::date>=_from_date) AND (_to_date IS NULL OR s.created_at::date<=_to_date)),0),
    'paymentsSum',COALESCE((SELECT SUM(COALESCE(p.amount,0)) FROM public.payments p JOIN scoped_sales s ON s.id=p.sale_id WHERE p.status='confirmed' AND (_from_date IS NULL OR p.payment_date>=_from_date) AND (_to_date IS NULL OR p.payment_date<=_to_date)),0),
    'expensesSum',COALESCE((SELECT SUM(COALESCE(e.amount,0)) FROM public.expenses e JOIN scoped_projects sp ON sp.id=e.project_id WHERE (_from_date IS NULL OR e.expense_date>=_from_date) AND (_to_date IS NULL OR e.expense_date<=_to_date)),0),
    'totalDebt',COALESCE((SELECT SUM(GREATEST(0,COALESCE(s.full_price,0)-COALESCE(s.paid_amount,0))) FROM scoped_sales s),0),
    'warehouse',(SELECT COUNT(*) FROM public.warehouse_items w WHERE w.company_id=v_company_id),
    'workers',(SELECT COUNT(*) FROM public.workers w WHERE w.company_id=v_company_id),
    'payingCustomers',(SELECT COUNT(*) FROM customer_totals),
    'payFull',(SELECT COUNT(*) FROM customer_totals ct WHERE ct.total>0 AND ct.paid>=ct.total-0.01),
    'payInst',(SELECT COUNT(*) FROM customer_totals ct WHERE ct.total>0 AND ct.paid<ct.total-0.01)
  ) INTO v_result;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.dashboard_company_stats(uuid[], date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dashboard_company_stats(uuid[], date, date) TO authenticated, service_role;

-- Приход: рақами чек ҳоло дастӣ ворид мешавад; патент хориҷ шуд (Sep 2026)
DROP TRIGGER IF EXISTS warehouse_receipts_manual_guard ON public.warehouse_receipts;

-- ── Расрочка: тафовути хурди мудаввар кардан (то 1 сомонӣ) пардохтшуда ҳисоб шавад ──
CREATE OR REPLACE FUNCTION public.sync_sale_payments(_sale_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _sale RECORD;
  _confirmed NUMERIC := 0;
  _paid NUMERIC := 0;
  _schedule_total NUMERIC := 0;
  _schedule_credit NUMERIC := 0;
  _tolerance NUMERIC := 1;
  _sched RECORD;
BEGIN
  IF _sale_id IS NULL THEN RETURN; END IF;

  SELECT id, full_price, apartment_id, status, customer_id INTO _sale
  FROM public.sales WHERE id = _sale_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT COALESCE(SUM(amount), 0) INTO _confirmed
  FROM public.payments WHERE sale_id = _sale_id AND status = 'confirmed';

  _paid := LEAST(GREATEST(_confirmed, 0), _sale.full_price);

  UPDATE public.sales
  SET paid_amount = _paid,
      status = CASE
        WHEN status = 'cancelled' THEN status
        WHEN _paid >= full_price THEN 'completed'::public.sale_status
        ELSE 'active'::public.sale_status END
  WHERE id = _sale_id;

  UPDATE public.apartments
  SET status = CASE WHEN _paid >= _sale.full_price THEN 'sold'::public.apartment_status
                    ELSE 'installment'::public.apartment_status END
  WHERE id = _sale.apartment_id AND _sale.status <> 'cancelled';

  IF _sale.status <> 'cancelled' AND _sale.customer_id IS NOT NULL THEN
    IF _paid >= _sale.full_price AND _sale.full_price > 0 THEN
      UPDATE public.customers SET status = 'active'
        WHERE id = _sale.customer_id AND status <> 'closed';
    ELSIF _paid > 0 THEN
      UPDATE public.customers SET status = 'booking'
        WHERE id = _sale.customer_id AND status = 'new';
    END IF;
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO _schedule_total
  FROM public.payment_schedule WHERE sale_id = _sale_id;

  UPDATE public.payment_schedule SET paid_amount = 0, status = 'pending'
  WHERE sale_id = _sale_id;

  IF _schedule_total <= 0 THEN RETURN; END IF;

  _schedule_credit := GREATEST(_confirmed - GREATEST(_sale.full_price - _schedule_total, 0), 0);

  FOR _sched IN
    SELECT id, amount FROM public.payment_schedule
    WHERE sale_id = _sale_id ORDER BY due_date, created_at, id
  LOOP
    IF _schedule_credit <= 0 THEN EXIT; END IF;
    IF _schedule_credit >= _sched.amount - _tolerance THEN
      UPDATE public.payment_schedule SET paid_amount = _sched.amount, status = 'paid'
      WHERE id = _sched.id;
      _schedule_credit := GREATEST(_schedule_credit - _sched.amount, 0);
    ELSE
      UPDATE public.payment_schedule SET paid_amount = _schedule_credit, status = 'partial'
      WHERE id = _sched.id;
      _schedule_credit := 0;
    END IF;
  END LOOP;
END;
$function$;

UPDATE public.payment_schedule
SET paid_amount = amount, status = 'paid'
WHERE status <> 'paid' AND paid_amount > 0 AND amount - paid_amount <= 1;

-- === Data API grants (тарифҳо ва пардохт) ===
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tariffs TO authenticated;
GRANT ALL ON public.tariffs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_methods TO authenticated;
GRANT ALL ON public.payment_methods TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_payments TO authenticated;
GRANT ALL ON public.subscription_payments TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_change_requests TO authenticated;
GRANT ALL ON public.company_change_requests TO service_role;

-- === Сиёсатҳои дурусти тарифҳо ва реквизитҳо ===
-- Backstop бо хато танҳо ба платформа-админ дастрасӣ дода буд, барои ҳамин
-- соҳиби ширкат тарифҳоро намедид. Инро ислоҳ мекунем.
ALTER TABLE public.tariffs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vps_scope_tariffs ON public.tariffs;
DROP POLICY IF EXISTS "Admin manages tariffs" ON public.tariffs;
CREATE POLICY "Admin manages tariffs" ON public.tariffs FOR ALL TO authenticated
  USING (private.is_platform_admin(auth.uid()))
  WITH CHECK (private.is_platform_admin(auth.uid()));
DROP POLICY IF EXISTS "Read active tariffs (auth)" ON public.tariffs;
CREATE POLICY "Read active tariffs (auth)" ON public.tariffs FOR SELECT TO authenticated
  USING (is_active = true);

ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vps_scope_payment_methods ON public.payment_methods;
DROP POLICY IF EXISTS "Admin manages payment methods" ON public.payment_methods;
CREATE POLICY "Admin manages payment methods" ON public.payment_methods FOR ALL TO authenticated
  USING (private.is_platform_admin(auth.uid()))
  WITH CHECK (private.is_platform_admin(auth.uid()));
DROP POLICY IF EXISTS "Read active payment methods (auth)" ON public.payment_methods;
CREATE POLICY "Read active payment methods (auth)" ON public.payment_methods FOR SELECT TO authenticated
  USING (is_active = true);

-- Ширкат бояд пардохтҳои худро дида тавонад
ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vps_scope_subscription_payments ON public.subscription_payments;
DROP POLICY IF EXISTS "Company reads own subscription payments" ON public.subscription_payments;
CREATE POLICY "Company reads own subscription payments" ON public.subscription_payments FOR SELECT TO authenticated
  USING (private.is_platform_admin(auth.uid()) OR company_id = private.user_company_id(auth.uid()));
DROP POLICY IF EXISTS "Company creates own subscription payments" ON public.subscription_payments;
CREATE POLICY "Company creates own subscription payments" ON public.subscription_payments FOR INSERT TO authenticated
  WITH CHECK (company_id = private.user_company_id(auth.uid()) OR private.is_platform_admin(auth.uid()));
DROP POLICY IF EXISTS "Admin manages subscription payments" ON public.subscription_payments;
CREATE POLICY "Admin manages subscription payments" ON public.subscription_payments FOR ALL TO authenticated
  USING (private.is_platform_admin(auth.uid()))
  WITH CHECK (private.is_platform_admin(auth.uid()));

-- === Storage bucket барои чекҳои обуна ===
INSERT INTO storage.buckets (id, name, public)
VALUES ('subscription-receipts', 'subscription-receipts', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "receipts_insert_own" ON storage.objects;
CREATE POLICY "receipts_insert_own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'subscription-receipts');
DROP POLICY IF EXISTS "receipts_read_own" ON storage.objects;
CREATE POLICY "receipts_read_own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'subscription-receipts');
DROP POLICY IF EXISTS "receipts_update_own" ON storage.objects;
CREATE POLICY "receipts_update_own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'subscription-receipts');
