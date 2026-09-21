-- Ҳамоҳангсозии сиёсатҳои дастрасӣ (RLS) бо базаи асосӣ.
-- Худкор сохта шудааст — дастӣ таҳрир накунед.
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT schemaname, tablename, policyname FROM pg_policies
           WHERE schemaname='public' AND policyname LIKE 'vps\_scope\_%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, p.tablename);
  END LOOP;
END $$;

DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
           WHERE n.nspname='public' AND c.relkind='r'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.relname);
  END LOOP;
END $$;

DROP POLICY IF EXISTS acm_own ON public.ai_chat_messages;
CREATE POLICY acm_own ON public.ai_chat_messages AS PERMISSIVE FOR ALL TO authenticated
  USING ((user_id = auth.uid()))
  WITH CHECK (((user_id = auth.uid()) AND (company_id = private.user_company_id(auth.uid()))));
DROP POLICY IF EXISTS director_read_company ON public.ai_chat_messages;
CREATE POLICY director_read_company ON public.ai_chat_messages AS PERMISSIVE FOR SELECT TO authenticated
  USING ((is_director(auth.uid()) AND (company_id = private.user_company_id(auth.uid()))));
DROP POLICY IF EXISTS director_readonly_delete ON public.ai_chat_messages;
CREATE POLICY director_readonly_delete ON public.ai_chat_messages AS RESTRICTIVE FOR DELETE TO authenticated
  USING ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_insert ON public.ai_chat_messages;
CREATE POLICY director_readonly_insert ON public.ai_chat_messages AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_update ON public.ai_chat_messages;
CREATE POLICY director_readonly_update ON public.ai_chat_messages AS RESTRICTIVE FOR UPDATE TO authenticated
  USING ((NOT is_director(auth.uid())))
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS "auth read active packages" ON public.ai_credit_packages;
CREATE POLICY "auth read active packages" ON public.ai_credit_packages AS PERMISSIVE FOR SELECT TO authenticated
  USING ((is_active OR private.is_platform_admin(auth.uid())));
DROP POLICY IF EXISTS "platform admin manage packages" ON public.ai_credit_packages;
CREATE POLICY "platform admin manage packages" ON public.ai_credit_packages AS PERMISSIVE FOR ALL TO authenticated
  USING (private.is_platform_admin(auth.uid()))
  WITH CHECK (private.is_platform_admin(auth.uid()));
DROP POLICY IF EXISTS acp_insert_owner ON public.ai_credit_purchases;
CREATE POLICY acp_insert_owner ON public.ai_credit_purchases AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((company_id = private.user_company_id(auth.uid())) AND (requested_by = auth.uid()) AND (status = 'pending'::text)));
DROP POLICY IF EXISTS acp_select_own_or_admin ON public.ai_credit_purchases;
CREATE POLICY acp_select_own_or_admin ON public.ai_credit_purchases AS PERMISSIVE FOR SELECT TO authenticated
  USING (((company_id = private.user_company_id(auth.uid())) OR private.is_platform_admin(auth.uid())));
DROP POLICY IF EXISTS director_read_company ON public.ai_credit_purchases;
CREATE POLICY director_read_company ON public.ai_credit_purchases AS PERMISSIVE FOR SELECT TO authenticated
  USING ((is_director(auth.uid()) AND (company_id = private.user_company_id(auth.uid()))));
DROP POLICY IF EXISTS director_readonly_delete ON public.ai_credit_purchases;
CREATE POLICY director_readonly_delete ON public.ai_credit_purchases AS RESTRICTIVE FOR DELETE TO authenticated
  USING ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_insert ON public.ai_credit_purchases;
CREATE POLICY director_readonly_insert ON public.ai_credit_purchases AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_update ON public.ai_credit_purchases;
CREATE POLICY director_readonly_update ON public.ai_credit_purchases AS RESTRICTIVE FOR UPDATE TO authenticated
  USING ((NOT is_director(auth.uid())))
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS ai_credits_read_own_company ON public.ai_credits;
CREATE POLICY ai_credits_read_own_company ON public.ai_credits AS PERMISSIVE FOR SELECT TO authenticated
  USING (((company_id = private.user_company_id(auth.uid())) OR private.is_platform_admin(auth.uid())));
DROP POLICY IF EXISTS director_read_company ON public.ai_credits;
CREATE POLICY director_read_company ON public.ai_credits AS PERMISSIVE FOR SELECT TO authenticated
  USING ((is_director(auth.uid()) AND (company_id = private.user_company_id(auth.uid()))));
DROP POLICY IF EXISTS director_readonly_delete ON public.ai_credits;
CREATE POLICY director_readonly_delete ON public.ai_credits AS RESTRICTIVE FOR DELETE TO authenticated
  USING ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_insert ON public.ai_credits;
CREATE POLICY director_readonly_insert ON public.ai_credits AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_update ON public.ai_credits;
CREATE POLICY director_readonly_update ON public.ai_credits AS RESTRICTIVE FOR UPDATE TO authenticated
  USING ((NOT is_director(auth.uid())))
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS "ata read own" ON public.apartment_tour_assignments;
CREATE POLICY "ata read own" ON public.apartment_tour_assignments AS PERMISSIVE FOR SELECT TO authenticated
  USING ((private.is_platform_admin(auth.uid()) OR (company_id = private.user_company_id(auth.uid()))));
DROP POLICY IF EXISTS "Managers update assigned apartments" ON public.apartments;
CREATE POLICY "Managers update assigned apartments" ON public.apartments AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((private.user_can_access_project(auth.uid(), project_id) AND (private.has_role(auth.uid(), 'owner'::app_role) OR private.has_role(auth.uid(), 'manager'::app_role))))
  WITH CHECK ((private.user_can_access_project(auth.uid(), project_id) AND (private.has_role(auth.uid(), 'owner'::app_role) OR private.has_role(auth.uid(), 'manager'::app_role))));
DROP POLICY IF EXISTS "Owners delete apartments" ON public.apartments;
CREATE POLICY "Owners delete apartments" ON public.apartments AS PERMISSIVE FOR DELETE TO authenticated
  USING ((private.has_role(auth.uid(), 'owner'::app_role) AND private.user_can_access_project(auth.uid(), project_id)));
DROP POLICY IF EXISTS "Project members insert apartments" ON public.apartments;
CREATE POLICY "Project members insert apartments" ON public.apartments AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (private.user_can_access_project(auth.uid(), project_id));
DROP POLICY IF EXISTS "Read apartments via project" ON public.apartments;
CREATE POLICY "Read apartments via project" ON public.apartments AS PERMISSIVE FOR SELECT TO authenticated
  USING (private.user_can_access_project(auth.uid(), project_id));
DROP POLICY IF EXISTS director_read_project ON public.apartments;
CREATE POLICY director_read_project ON public.apartments AS PERMISSIVE FOR SELECT TO authenticated
  USING (private.director_can_read_project(auth.uid(), project_id));
DROP POLICY IF EXISTS director_readonly_delete ON public.apartments;
CREATE POLICY director_readonly_delete ON public.apartments AS RESTRICTIVE FOR DELETE TO authenticated
  USING ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_insert ON public.apartments;
CREATE POLICY director_readonly_insert ON public.apartments AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_update ON public.apartments;
CREATE POLICY director_readonly_update ON public.apartments AS RESTRICTIVE FOR UPDATE TO authenticated
  USING ((NOT is_director(auth.uid())))
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS attendance_select ON public.attendance;
CREATE POLICY attendance_select ON public.attendance AS PERMISSIVE FOR SELECT TO authenticated
  USING ((company_id = user_company_id(auth.uid())));
DROP POLICY IF EXISTS attendance_write ON public.attendance;
CREATE POLICY attendance_write ON public.attendance AS PERMISSIVE FOR ALL TO authenticated
  USING (((company_id = user_company_id(auth.uid())) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'accountant'::app_role))))
  WITH CHECK (((company_id = user_company_id(auth.uid())) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'accountant'::app_role))));
DROP POLICY IF EXISTS director_read_company ON public.attendance;
CREATE POLICY director_read_company ON public.attendance AS PERMISSIVE FOR SELECT TO authenticated
  USING ((is_director(auth.uid()) AND (company_id = private.user_company_id(auth.uid()))));
DROP POLICY IF EXISTS director_read_project ON public.attendance;
CREATE POLICY director_read_project ON public.attendance AS PERMISSIVE FOR SELECT TO authenticated
  USING (private.director_can_read_project(auth.uid(), project_id));
DROP POLICY IF EXISTS director_readonly_delete ON public.attendance;
CREATE POLICY director_readonly_delete ON public.attendance AS RESTRICTIVE FOR DELETE TO authenticated
  USING ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_insert ON public.attendance;
CREATE POLICY director_readonly_insert ON public.attendance AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_update ON public.attendance;
CREATE POLICY director_readonly_update ON public.attendance AS RESTRICTIVE FOR UPDATE TO authenticated
  USING ((NOT is_director(auth.uid())))
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS "Delete barter (project access)" ON public.barter_deals;
CREATE POLICY "Delete barter (project access)" ON public.barter_deals AS PERMISSIVE FOR DELETE TO authenticated
  USING (private.user_can_access_project(auth.uid(), project_id));
DROP POLICY IF EXISTS "Insert barter (project access)" ON public.barter_deals;
CREATE POLICY "Insert barter (project access)" ON public.barter_deals AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (private.user_can_access_project(auth.uid(), project_id));
DROP POLICY IF EXISTS "Read barter via project" ON public.barter_deals;
CREATE POLICY "Read barter via project" ON public.barter_deals AS PERMISSIVE FOR SELECT TO authenticated
  USING (private.user_can_access_project(auth.uid(), project_id));
DROP POLICY IF EXISTS "Update barter (project access)" ON public.barter_deals;
CREATE POLICY "Update barter (project access)" ON public.barter_deals AS PERMISSIVE FOR UPDATE TO authenticated
  USING (private.user_can_access_project(auth.uid(), project_id))
  WITH CHECK (private.user_can_access_project(auth.uid(), project_id));
DROP POLICY IF EXISTS director_read_company ON public.barter_deals;
CREATE POLICY director_read_company ON public.barter_deals AS PERMISSIVE FOR SELECT TO authenticated
  USING ((is_director(auth.uid()) AND (company_id = private.user_company_id(auth.uid()))));
DROP POLICY IF EXISTS director_read_project ON public.barter_deals;
CREATE POLICY director_read_project ON public.barter_deals AS PERMISSIVE FOR SELECT TO authenticated
  USING (private.director_can_read_project(auth.uid(), project_id));
DROP POLICY IF EXISTS director_readonly_delete ON public.barter_deals;
CREATE POLICY director_readonly_delete ON public.barter_deals AS RESTRICTIVE FOR DELETE TO authenticated
  USING ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_insert ON public.barter_deals;
CREATE POLICY director_readonly_insert ON public.barter_deals AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_update ON public.barter_deals;
CREATE POLICY director_readonly_update ON public.barter_deals AS RESTRICTIVE FOR UPDATE TO authenticated
  USING ((NOT is_director(auth.uid())))
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS car_damages_delete_company ON public.car_damages;
CREATE POLICY car_damages_delete_company ON public.car_damages AS PERMISSIVE FOR DELETE TO authenticated
  USING ((company_id = private.user_company_id(auth.uid())));
DROP POLICY IF EXISTS car_damages_insert_company ON public.car_damages;
CREATE POLICY car_damages_insert_company ON public.car_damages AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((company_id = private.user_company_id(auth.uid())));
DROP POLICY IF EXISTS car_damages_select_company ON public.car_damages;
CREATE POLICY car_damages_select_company ON public.car_damages AS PERMISSIVE FOR SELECT TO authenticated
  USING (((company_id = private.user_company_id(auth.uid())) OR user_is_project_partner(auth.uid(), project_id)));
DROP POLICY IF EXISTS car_damages_update_company ON public.car_damages;
CREATE POLICY car_damages_update_company ON public.car_damages AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((company_id = private.user_company_id(auth.uid())))
  WITH CHECK ((company_id = private.user_company_id(auth.uid())));
DROP POLICY IF EXISTS cash_ops_delete_owner ON public.cash_operations;
CREATE POLICY cash_ops_delete_owner ON public.cash_operations AS PERMISSIVE FOR DELETE TO authenticated
  USING ((private.is_platform_admin(auth.uid()) OR (private.has_role(auth.uid(), 'owner'::app_role) AND (private.user_company_id(auth.uid()) = company_id))));
DROP POLICY IF EXISTS cash_ops_insert ON public.cash_operations;
CREATE POLICY cash_ops_insert ON public.cash_operations AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((private.user_company_id(auth.uid()) = company_id) AND (EXISTS ( SELECT 1
   FROM cash_registers r
  WHERE ((r.id = cash_operations.register_id) AND (r.company_id = private.user_company_id(auth.uid())))))));
DROP POLICY IF EXISTS cash_ops_select ON public.cash_operations;
CREATE POLICY cash_ops_select ON public.cash_operations AS PERMISSIVE FOR SELECT TO authenticated
  USING ((private.is_platform_admin(auth.uid()) OR ((private.user_company_id(auth.uid()) = company_id) AND (private.has_role(auth.uid(), 'owner'::app_role) OR private.has_role(auth.uid(), 'accountant'::app_role) OR (created_by = auth.uid()) OR (EXISTS ( SELECT 1
   FROM cash_shifts s
  WHERE ((s.id = cash_operations.shift_id) AND (s.cashier_user_id = auth.uid()))))))));
DROP POLICY IF EXISTS cash_ops_update_owner ON public.cash_operations;
CREATE POLICY cash_ops_update_owner ON public.cash_operations AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((private.is_platform_admin(auth.uid()) OR (private.has_role(auth.uid(), 'owner'::app_role) AND (private.user_company_id(auth.uid()) = company_id))));
DROP POLICY IF EXISTS cash_registers_select ON public.cash_registers;
CREATE POLICY cash_registers_select ON public.cash_registers AS PERMISSIVE FOR SELECT TO authenticated
  USING ((private.is_platform_admin(auth.uid()) OR ((private.user_company_id(auth.uid()) = company_id) AND (private.has_role(auth.uid(), 'owner'::app_role) OR private.has_role(auth.uid(), 'accountant'::app_role) OR ((project_id IS NOT NULL) AND private.user_can_access_project(auth.uid(), project_id))))));
DROP POLICY IF EXISTS cash_registers_write_owner ON public.cash_registers;
CREATE POLICY cash_registers_write_owner ON public.cash_registers AS PERMISSIVE FOR ALL TO authenticated
  USING ((private.is_platform_admin(auth.uid()) OR (private.has_role(auth.uid(), 'owner'::app_role) AND (private.user_company_id(auth.uid()) = company_id))))
  WITH CHECK ((private.is_platform_admin(auth.uid()) OR (private.has_role(auth.uid(), 'owner'::app_role) AND (private.user_company_id(auth.uid()) = company_id))));
DROP POLICY IF EXISTS cash_shifts_delete_owner ON public.cash_shifts;
CREATE POLICY cash_shifts_delete_owner ON public.cash_shifts AS PERMISSIVE FOR DELETE TO authenticated
  USING ((private.is_platform_admin(auth.uid()) OR (private.has_role(auth.uid(), 'owner'::app_role) AND (private.user_company_id(auth.uid()) = company_id))));
DROP POLICY IF EXISTS cash_shifts_insert ON public.cash_shifts;
CREATE POLICY cash_shifts_insert ON public.cash_shifts AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((cashier_user_id = auth.uid()) AND (private.user_company_id(auth.uid()) = company_id) AND (EXISTS ( SELECT 1
   FROM cash_registers r
  WHERE ((r.id = cash_shifts.register_id) AND (r.company_id = private.user_company_id(auth.uid())))))));
DROP POLICY IF EXISTS cash_shifts_select ON public.cash_shifts;
CREATE POLICY cash_shifts_select ON public.cash_shifts AS PERMISSIVE FOR SELECT TO authenticated
  USING ((private.is_platform_admin(auth.uid()) OR ((private.user_company_id(auth.uid()) = company_id) AND (private.has_role(auth.uid(), 'owner'::app_role) OR private.has_role(auth.uid(), 'accountant'::app_role) OR (cashier_user_id = auth.uid())))));
DROP POLICY IF EXISTS cash_shifts_update ON public.cash_shifts;
CREATE POLICY cash_shifts_update ON public.cash_shifts AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((cashier_user_id = auth.uid()) OR private.is_platform_admin(auth.uid()) OR (private.has_role(auth.uid(), 'owner'::app_role) AND (private.user_company_id(auth.uid()) = company_id))));
DROP POLICY IF EXISTS "Admin manages companies" ON public.companies;
CREATE POLICY "Admin manages companies" ON public.companies AS PERMISSIVE FOR ALL TO authenticated
  USING (private.is_platform_admin(auth.uid()))
  WITH CHECK (private.is_platform_admin(auth.uid()));
DROP POLICY IF EXISTS "Owner updates own company" ON public.companies;
CREATE POLICY "Owner updates own company" ON public.companies AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((owner_user_id = auth.uid()))
  WITH CHECK ((owner_user_id = auth.uid()));
DROP POLICY IF EXISTS "View company (self/admin)" ON public.companies;
CREATE POLICY "View company (self/admin)" ON public.companies AS PERMISSIVE FOR SELECT TO authenticated
  USING ((private.is_platform_admin(auth.uid()) OR (id = private.user_company_id(auth.uid()))));
DROP POLICY IF EXISTS director_read_own_company ON public.companies;
CREATE POLICY director_read_own_company ON public.companies AS PERMISSIVE FOR SELECT TO authenticated
  USING ((is_director(auth.uid()) AND (id = private.user_company_id(auth.uid()))));
DROP POLICY IF EXISTS director_readonly_delete ON public.companies;
CREATE POLICY director_readonly_delete ON public.companies AS RESTRICTIVE FOR DELETE TO authenticated
  USING ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_insert ON public.companies;
CREATE POLICY director_readonly_insert ON public.companies AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_update ON public.companies;
CREATE POLICY director_readonly_update ON public.companies AS RESTRICTIVE FOR UPDATE TO authenticated
  USING ((NOT is_director(auth.uid())))
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS "Admin updates change requests" ON public.company_change_requests;
CREATE POLICY "Admin updates change requests" ON public.company_change_requests AS PERMISSIVE FOR UPDATE TO authenticated
  USING (private.is_platform_admin(auth.uid()))
  WITH CHECK (private.is_platform_admin(auth.uid()));
DROP POLICY IF EXISTS "Insert own change request" ON public.company_change_requests;
CREATE POLICY "Insert own change request" ON public.company_change_requests AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((company_id = private.user_company_id(auth.uid())) AND (created_by = auth.uid()) AND private.has_role(auth.uid(), 'owner'::app_role)));
DROP POLICY IF EXISTS "Read own/admin change requests" ON public.company_change_requests;
CREATE POLICY "Read own/admin change requests" ON public.company_change_requests AS PERMISSIVE FOR SELECT TO authenticated
  USING ((private.is_platform_admin(auth.uid()) OR (company_id = private.user_company_id(auth.uid()))));
DROP POLICY IF EXISTS director_read_company ON public.company_change_requests;
CREATE POLICY director_read_company ON public.company_change_requests AS PERMISSIVE FOR SELECT TO authenticated
  USING ((is_director(auth.uid()) AND (company_id = private.user_company_id(auth.uid()))));
DROP POLICY IF EXISTS director_readonly_delete ON public.company_change_requests;
CREATE POLICY director_readonly_delete ON public.company_change_requests AS RESTRICTIVE FOR DELETE TO authenticated
  USING ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_insert ON public.company_change_requests;
CREATE POLICY director_readonly_insert ON public.company_change_requests AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_update ON public.company_change_requests;
CREATE POLICY director_readonly_update ON public.company_change_requests AS RESTRICTIVE FOR UPDATE TO authenticated
  USING ((NOT is_director(auth.uid())))
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS company_directors_owner_select ON public.company_directors;
CREATE POLICY company_directors_owner_select ON public.company_directors AS PERMISSIVE FOR SELECT TO authenticated
  USING ((is_platform_admin(auth.uid()) OR (EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = company_directors.company_id) AND (c.owner_user_id = auth.uid())))) OR (user_id = auth.uid())));
DROP POLICY IF EXISTS "Owners manage kiosk access" ON public.company_kiosk_access;
CREATE POLICY "Owners manage kiosk access" ON public.company_kiosk_access AS PERMISSIVE FOR ALL TO authenticated
  USING ((is_platform_admin(auth.uid()) OR (EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = company_kiosk_access.company_id) AND (c.owner_user_id = auth.uid()))))))
  WITH CHECK ((is_platform_admin(auth.uid()) OR (EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = company_kiosk_access.company_id) AND (c.owner_user_id = auth.uid()))))));
DROP POLICY IF EXISTS "Users see their own kiosk access" ON public.company_kiosk_access;
CREATE POLICY "Users see their own kiosk access" ON public.company_kiosk_access AS PERMISSIVE FOR SELECT TO authenticated
  USING ((user_id = auth.uid()));
DROP POLICY IF EXISTS director_read_company ON public.company_kiosk_access;
CREATE POLICY director_read_company ON public.company_kiosk_access AS PERMISSIVE FOR SELECT TO authenticated
  USING ((is_director(auth.uid()) AND (company_id = private.user_company_id(auth.uid()))));
DROP POLICY IF EXISTS director_readonly_delete ON public.company_kiosk_access;
CREATE POLICY director_readonly_delete ON public.company_kiosk_access AS RESTRICTIVE FOR DELETE TO authenticated
  USING ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_insert ON public.company_kiosk_access;
CREATE POLICY director_readonly_insert ON public.company_kiosk_access AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_update ON public.company_kiosk_access;
CREATE POLICY director_readonly_update ON public.company_kiosk_access AS RESTRICTIVE FOR UPDATE TO authenticated
  USING ((NOT is_director(auth.uid())))
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS kiosk_secrets_owner_admin_delete ON public.company_kiosk_secrets;
CREATE POLICY kiosk_secrets_owner_admin_delete ON public.company_kiosk_secrets AS PERMISSIVE FOR DELETE TO authenticated
  USING ((private.is_platform_admin(auth.uid()) OR (EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = company_kiosk_secrets.company_id) AND (c.owner_user_id = auth.uid()))))));
DROP POLICY IF EXISTS kiosk_secrets_owner_admin_insert ON public.company_kiosk_secrets;
CREATE POLICY kiosk_secrets_owner_admin_insert ON public.company_kiosk_secrets AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((private.is_platform_admin(auth.uid()) OR (EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = company_kiosk_secrets.company_id) AND (c.owner_user_id = auth.uid()))))));
DROP POLICY IF EXISTS kiosk_secrets_owner_admin_select ON public.company_kiosk_secrets;
CREATE POLICY kiosk_secrets_owner_admin_select ON public.company_kiosk_secrets AS PERMISSIVE FOR SELECT TO authenticated
  USING ((private.is_platform_admin(auth.uid()) OR (EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = company_kiosk_secrets.company_id) AND (c.owner_user_id = auth.uid()))))));
DROP POLICY IF EXISTS kiosk_secrets_owner_admin_update ON public.company_kiosk_secrets;
CREATE POLICY kiosk_secrets_owner_admin_update ON public.company_kiosk_secrets AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((private.is_platform_admin(auth.uid()) OR (EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = company_kiosk_secrets.company_id) AND (c.owner_user_id = auth.uid()))))))
  WITH CHECK ((private.is_platform_admin(auth.uid()) OR (EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = company_kiosk_secrets.company_id) AND (c.owner_user_id = auth.uid()))))));
DROP POLICY IF EXISTS "Admin updates requests" ON public.company_requests;
CREATE POLICY "Admin updates requests" ON public.company_requests AS PERMISSIVE FOR UPDATE TO authenticated
  USING (private.is_platform_admin(auth.uid()))
  WITH CHECK (private.is_platform_admin(auth.uid()));
DROP POLICY IF EXISTS "Insert own request" ON public.company_requests;
CREATE POLICY "Insert own request" ON public.company_requests AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Read own request or admin" ON public.company_requests;
CREATE POLICY "Read own request or admin" ON public.company_requests AS PERMISSIVE FOR SELECT TO authenticated
  USING (((user_id = auth.uid()) OR private.is_platform_admin(auth.uid())));
DROP POLICY IF EXISTS "Owner inserts own sms settings" ON public.company_sms_settings;
CREATE POLICY "Owner inserts own sms settings" ON public.company_sms_settings AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((company_id = private.user_company_id(auth.uid())) AND private.has_role(auth.uid(), 'owner'::app_role)));
DROP POLICY IF EXISTS "Owner reads own sms settings" ON public.company_sms_settings;
CREATE POLICY "Owner reads own sms settings" ON public.company_sms_settings AS PERMISSIVE FOR SELECT TO authenticated
  USING (((company_id = private.user_company_id(auth.uid())) AND private.has_role(auth.uid(), 'owner'::app_role)));
DROP POLICY IF EXISTS "Owner updates own sms settings" ON public.company_sms_settings;
CREATE POLICY "Owner updates own sms settings" ON public.company_sms_settings AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((company_id = private.user_company_id(auth.uid())) AND private.has_role(auth.uid(), 'owner'::app_role)))
  WITH CHECK (((company_id = private.user_company_id(auth.uid())) AND private.has_role(auth.uid(), 'owner'::app_role)));
DROP POLICY IF EXISTS director_read_company ON public.company_sms_settings;
CREATE POLICY director_read_company ON public.company_sms_settings AS PERMISSIVE FOR SELECT TO authenticated
  USING ((is_director(auth.uid()) AND (company_id = private.user_company_id(auth.uid()))));
DROP POLICY IF EXISTS director_readonly_delete ON public.company_sms_settings;
CREATE POLICY director_readonly_delete ON public.company_sms_settings AS RESTRICTIVE FOR DELETE TO authenticated
  USING ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_insert ON public.company_sms_settings;
CREATE POLICY director_readonly_insert ON public.company_sms_settings AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_update ON public.company_sms_settings;
CREATE POLICY director_readonly_update ON public.company_sms_settings AS RESTRICTIVE FOR UPDATE TO authenticated
  USING ((NOT is_director(auth.uid())))
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS photos_delete_director ON public.construction_photos;
CREATE POLICY photos_delete_director ON public.construction_photos AS PERMISSIVE FOR DELETE TO authenticated
  USING ((is_platform_admin(auth.uid()) OR is_director(auth.uid()) OR (EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = construction_photos.company_id) AND (c.owner_user_id = auth.uid()))))));
DROP POLICY IF EXISTS photos_insert_company ON public.construction_photos;
CREATE POLICY photos_insert_company ON public.construction_photos AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((company_id = user_company_id(auth.uid())) AND (created_by = auth.uid())));
DROP POLICY IF EXISTS photos_select_company ON public.construction_photos;
CREATE POLICY photos_select_company ON public.construction_photos AS PERMISSIVE FOR SELECT TO authenticated
  USING (((company_id = user_company_id(auth.uid())) OR is_platform_admin(auth.uid())));
DROP POLICY IF EXISTS contract_documents_company_delete ON public.contract_documents;
CREATE POLICY contract_documents_company_delete ON public.contract_documents AS PERMISSIVE FOR DELETE TO authenticated
  USING (company_id = private.user_company_id(auth.uid()));
DROP POLICY IF EXISTS contract_documents_company_read ON public.contract_documents;
CREATE POLICY contract_documents_company_read ON public.contract_documents AS PERMISSIVE FOR SELECT TO authenticated
  USING (company_id = private.user_company_id(auth.uid()));
DROP POLICY IF EXISTS contract_documents_company_update ON public.contract_documents;
CREATE POLICY contract_documents_company_update ON public.contract_documents AS PERMISSIVE FOR UPDATE TO authenticated
  USING (company_id = private.user_company_id(auth.uid()))
  WITH CHECK (company_id = private.user_company_id(auth.uid()));
DROP POLICY IF EXISTS contract_documents_company_write ON public.contract_documents;
CREATE POLICY contract_documents_company_write ON public.contract_documents AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (company_id = private.user_company_id(auth.uid()));
DROP POLICY IF EXISTS "Company members read contract template" ON public.contract_templates;
CREATE POLICY "Company members read contract template" ON public.contract_templates AS PERMISSIVE FOR SELECT TO authenticated
  USING ((company_id = private.user_company_id(auth.uid())));
DROP POLICY IF EXISTS "Owner deletes contract template" ON public.contract_templates;
CREATE POLICY "Owner deletes contract template" ON public.contract_templates AS PERMISSIVE FOR DELETE TO authenticated
  USING (((company_id = private.user_company_id(auth.uid())) AND private.has_role(auth.uid(), 'owner'::app_role)));
DROP POLICY IF EXISTS "Owner inserts contract template" ON public.contract_templates;
CREATE POLICY "Owner inserts contract template" ON public.contract_templates AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((company_id = private.user_company_id(auth.uid())) AND private.has_role(auth.uid(), 'owner'::app_role)));
DROP POLICY IF EXISTS "Owner updates contract template" ON public.contract_templates;
CREATE POLICY "Owner updates contract template" ON public.contract_templates AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((company_id = private.user_company_id(auth.uid())) AND private.has_role(auth.uid(), 'owner'::app_role)))
  WITH CHECK (((company_id = private.user_company_id(auth.uid())) AND private.has_role(auth.uid(), 'owner'::app_role)));
DROP POLICY IF EXISTS director_read_company ON public.contract_templates;
CREATE POLICY director_read_company ON public.contract_templates AS PERMISSIVE FOR SELECT TO authenticated
  USING ((is_director(auth.uid()) AND (company_id = private.user_company_id(auth.uid()))));
DROP POLICY IF EXISTS director_readonly_delete ON public.contract_templates;
CREATE POLICY director_readonly_delete ON public.contract_templates AS RESTRICTIVE FOR DELETE TO authenticated
  USING ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_insert ON public.contract_templates;
CREATE POLICY director_readonly_insert ON public.contract_templates AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_update ON public.contract_templates;
CREATE POLICY director_readonly_update ON public.contract_templates AS RESTRICTIVE FOR UPDATE TO authenticated
  USING ((NOT is_director(auth.uid())))
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS "Insert customer documents in company" ON public.customer_documents;
CREATE POLICY "Insert customer documents in company" ON public.customer_documents AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((uploaded_by = auth.uid()) AND (company_id = private.user_company_id(auth.uid()))));
DROP POLICY IF EXISTS "Only platform admin can delete customer documents" ON public.customer_documents;
CREATE POLICY "Only platform admin can delete customer documents" ON public.customer_documents AS PERMISSIVE FOR DELETE TO authenticated
  USING (private.is_platform_admin(auth.uid()));
DROP POLICY IF EXISTS "Read customer documents in company" ON public.customer_documents;
CREATE POLICY "Read customer documents in company" ON public.customer_documents AS PERMISSIVE FOR SELECT TO authenticated
  USING ((private.is_platform_admin(auth.uid()) OR (company_id = private.user_company_id(auth.uid()))));
DROP POLICY IF EXISTS "Update customer documents in company" ON public.customer_documents;
CREATE POLICY "Update customer documents in company" ON public.customer_documents AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((private.is_platform_admin(auth.uid()) OR ((uploaded_by = auth.uid()) AND (company_id = private.user_company_id(auth.uid())))))
  WITH CHECK ((private.is_platform_admin(auth.uid()) OR ((uploaded_by = auth.uid()) AND (company_id = private.user_company_id(auth.uid())))));
DROP POLICY IF EXISTS director_read_company ON public.customer_documents;
CREATE POLICY director_read_company ON public.customer_documents AS PERMISSIVE FOR SELECT TO authenticated
  USING ((is_director(auth.uid()) AND (company_id = private.user_company_id(auth.uid()))));
DROP POLICY IF EXISTS director_readonly_delete ON public.customer_documents;
CREATE POLICY director_readonly_delete ON public.customer_documents AS RESTRICTIVE FOR DELETE TO authenticated
  USING ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_insert ON public.customer_documents;
CREATE POLICY director_readonly_insert ON public.customer_documents AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_update ON public.customer_documents;
CREATE POLICY director_readonly_update ON public.customer_documents AS RESTRICTIVE FOR UPDATE TO authenticated
  USING ((NOT is_director(auth.uid())))
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS co_read ON public.customer_interactions;
CREATE POLICY co_read ON public.customer_interactions AS PERMISSIVE FOR SELECT TO authenticated
  USING (((company_id = user_company_id(auth.uid())) OR is_platform_admin(auth.uid())));
DROP POLICY IF EXISTS co_write ON public.customer_interactions;
CREATE POLICY co_write ON public.customer_interactions AS PERMISSIVE FOR ALL TO authenticated
  USING ((company_id = user_company_id(auth.uid())))
  WITH CHECK ((company_id = user_company_id(auth.uid())));
DROP POLICY IF EXISTS director_read_company ON public.customer_interactions;
CREATE POLICY director_read_company ON public.customer_interactions AS PERMISSIVE FOR SELECT TO authenticated
  USING ((is_director(auth.uid()) AND (company_id = private.user_company_id(auth.uid()))));
DROP POLICY IF EXISTS director_readonly_delete ON public.customer_interactions;
CREATE POLICY director_readonly_delete ON public.customer_interactions AS RESTRICTIVE FOR DELETE TO authenticated
  USING ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_insert ON public.customer_interactions;
CREATE POLICY director_readonly_insert ON public.customer_interactions AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_update ON public.customer_interactions;
CREATE POLICY director_readonly_update ON public.customer_interactions AS RESTRICTIVE FOR UPDATE TO authenticated
  USING ((NOT is_director(auth.uid())))
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS "Delete customers (owner)" ON public.customers;
CREATE POLICY "Delete customers (owner)" ON public.customers AS PERMISSIVE FOR DELETE TO authenticated
  USING (((company_id = private.user_company_id(auth.uid())) AND private.has_role(auth.uid(), 'owner'::app_role)));
DROP POLICY IF EXISTS "Insert customers in company" ON public.customers;
CREATE POLICY "Insert customers in company" ON public.customers AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((created_by = auth.uid()) AND (company_id = private.user_company_id(auth.uid()))));
DROP POLICY IF EXISTS "Managers read their assigned leads" ON public.customers;
CREATE POLICY "Managers read their assigned leads" ON public.customers AS PERMISSIVE FOR SELECT TO authenticated
  USING (((assigned_manager_id IS NOT NULL) AND (company_id = private.user_company_id(auth.uid())) AND private.is_assigned_sales_manager(auth.uid(), assigned_manager_id)));
DROP POLICY IF EXISTS "Managers update their assigned leads" ON public.customers;
CREATE POLICY "Managers update their assigned leads" ON public.customers AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((assigned_manager_id IS NOT NULL) AND (company_id = private.user_company_id(auth.uid())) AND private.is_assigned_sales_manager(auth.uid(), assigned_manager_id)))
  WITH CHECK ((company_id = private.user_company_id(auth.uid())));
DROP POLICY IF EXISTS "Read customers scoped" ON public.customers;
CREATE POLICY "Read customers scoped" ON public.customers AS PERMISSIVE FOR SELECT TO authenticated
  USING ((private.is_platform_admin(auth.uid()) OR ((company_id = private.user_company_id(auth.uid())) AND (private.has_role(auth.uid(), 'owner'::app_role) OR private.has_role(auth.uid(), 'accountant'::app_role) OR (created_by = auth.uid()) OR (EXISTS ( SELECT 1
   FROM (sales s
     JOIN project_staff ps ON ((ps.project_id = s.project_id)))
  WHERE ((s.customer_id = customers.id) AND (ps.user_id = auth.uid()))))))));
DROP POLICY IF EXISTS "Update customers in company" ON public.customers;
CREATE POLICY "Update customers in company" ON public.customers AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((company_id = private.user_company_id(auth.uid())) AND (private.has_role(auth.uid(), 'owner'::app_role) OR private.has_role(auth.uid(), 'accountant'::app_role) OR (created_by = auth.uid()))))
  WITH CHECK (((company_id = private.user_company_id(auth.uid())) AND (private.has_role(auth.uid(), 'owner'::app_role) OR private.has_role(auth.uid(), 'accountant'::app_role) OR (created_by = auth.uid()))));
DROP POLICY IF EXISTS director_read_company ON public.customers;
CREATE POLICY director_read_company ON public.customers AS PERMISSIVE FOR SELECT TO authenticated
  USING ((is_director(auth.uid()) AND (company_id = private.user_company_id(auth.uid()))));
DROP POLICY IF EXISTS director_readonly_delete ON public.customers;
CREATE POLICY director_readonly_delete ON public.customers AS RESTRICTIVE FOR DELETE TO authenticated
  USING ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_insert ON public.customers;
CREATE POLICY director_readonly_insert ON public.customers AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_update ON public.customers;
CREATE POLICY director_readonly_update ON public.customers AS RESTRICTIVE FOR UPDATE TO authenticated
  USING ((NOT is_director(auth.uid())))
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS "Owners read own company trash" ON public.deleted_records;
CREATE POLICY "Owners read own company trash" ON public.deleted_records AS PERMISSIVE FOR SELECT TO authenticated
  USING ((private.has_role(auth.uid(), 'owner'::app_role) AND (company_id = private.user_company_id(auth.uid()))));
DROP POLICY IF EXISTS "Platform admins delete trash" ON public.deleted_records;
CREATE POLICY "Platform admins delete trash" ON public.deleted_records AS PERMISSIVE FOR DELETE TO authenticated
  USING (private.is_platform_admin(auth.uid()));
DROP POLICY IF EXISTS "Platform admins read trash" ON public.deleted_records;
CREATE POLICY "Platform admins read trash" ON public.deleted_records AS PERMISSIVE FOR SELECT TO authenticated
  USING (private.is_platform_admin(auth.uid()));
DROP POLICY IF EXISTS "admin can delete feedback" ON public.demo_feedback;
CREATE POLICY "admin can delete feedback" ON public.demo_feedback AS PERMISSIVE FOR DELETE TO authenticated
  USING (private.is_platform_admin(auth.uid()));
DROP POLICY IF EXISTS "admin can update feedback" ON public.demo_feedback;
CREATE POLICY "admin can update feedback" ON public.demo_feedback AS PERMISSIVE FOR UPDATE TO authenticated
  USING (private.is_platform_admin(auth.uid()))
  WITH CHECK (private.is_platform_admin(auth.uid()));
DROP POLICY IF EXISTS director_read_company ON public.demo_feedback;
CREATE POLICY director_read_company ON public.demo_feedback AS PERMISSIVE FOR SELECT TO authenticated
  USING ((is_director(auth.uid()) AND (company_id = private.user_company_id(auth.uid()))));
DROP POLICY IF EXISTS director_readonly_delete ON public.demo_feedback;
CREATE POLICY director_readonly_delete ON public.demo_feedback AS RESTRICTIVE FOR DELETE TO authenticated
  USING ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_insert ON public.demo_feedback;
CREATE POLICY director_readonly_insert ON public.demo_feedback AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_update ON public.demo_feedback;
CREATE POLICY director_readonly_update ON public.demo_feedback AS RESTRICTIVE FOR UPDATE TO authenticated
  USING ((NOT is_director(auth.uid())))
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS "user can insert own feedback" ON public.demo_feedback;
CREATE POLICY "user can insert own feedback" ON public.demo_feedback AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((user_id = auth.uid()));
DROP POLICY IF EXISTS "user can view own feedback" ON public.demo_feedback;
CREATE POLICY "user can view own feedback" ON public.demo_feedback AS PERMISSIVE FOR SELECT TO authenticated
  USING (((user_id = auth.uid()) OR private.is_platform_admin(auth.uid())));
DROP POLICY IF EXISTS director_read_company ON public.equipment;
CREATE POLICY director_read_company ON public.equipment AS PERMISSIVE FOR SELECT TO authenticated
  USING ((is_director(auth.uid()) AND (company_id = private.user_company_id(auth.uid()))));
DROP POLICY IF EXISTS director_readonly_delete ON public.equipment;
CREATE POLICY director_readonly_delete ON public.equipment AS RESTRICTIVE FOR DELETE TO authenticated
  USING ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_insert ON public.equipment;
CREATE POLICY director_readonly_insert ON public.equipment AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_update ON public.equipment;
CREATE POLICY director_readonly_update ON public.equipment AS RESTRICTIVE FOR UPDATE TO authenticated
  USING ((NOT is_director(auth.uid())))
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS equipment_company ON public.equipment;
CREATE POLICY equipment_company ON public.equipment AS PERMISSIVE FOR ALL TO authenticated
  USING ((company_id = user_company_id(auth.uid())))
  WITH CHECK ((company_id = user_company_id(auth.uid())));
DROP POLICY IF EXISTS director_read_equipment_maintenance ON public.equipment_maintenance;
CREATE POLICY director_read_equipment_maintenance ON public.equipment_maintenance AS PERMISSIVE FOR SELECT TO authenticated
  USING ((is_director(auth.uid()) AND (EXISTS ( SELECT 1
   FROM equipment e
  WHERE ((e.id = equipment_maintenance.equipment_id) AND (e.company_id = private.user_company_id(auth.uid())))))));
DROP POLICY IF EXISTS director_readonly_delete ON public.equipment_maintenance;
CREATE POLICY director_readonly_delete ON public.equipment_maintenance AS RESTRICTIVE FOR DELETE TO authenticated
  USING ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_insert ON public.equipment_maintenance;
CREATE POLICY director_readonly_insert ON public.equipment_maintenance AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_update ON public.equipment_maintenance;
CREATE POLICY director_readonly_update ON public.equipment_maintenance AS RESTRICTIVE FOR UPDATE TO authenticated
  USING ((NOT is_director(auth.uid())))
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS equipment_maintenance_company ON public.equipment_maintenance;
CREATE POLICY equipment_maintenance_company ON public.equipment_maintenance AS PERMISSIVE FOR ALL TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM equipment e
  WHERE ((e.id = equipment_maintenance.equipment_id) AND (e.company_id = user_company_id(auth.uid()))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM equipment e
  WHERE ((e.id = equipment_maintenance.equipment_id) AND (e.company_id = user_company_id(auth.uid()))))));
DROP POLICY IF EXISTS equipment_maintenance_company_select ON public.equipment_maintenance;
CREATE POLICY equipment_maintenance_company_select ON public.equipment_maintenance AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM equipment e
  WHERE ((e.id = equipment_maintenance.equipment_id) AND (e.company_id = user_company_id(auth.uid()))))));
DROP POLICY IF EXISTS director_read_project ON public.equipment_usage;
CREATE POLICY director_read_project ON public.equipment_usage AS PERMISSIVE FOR SELECT TO authenticated
  USING (private.director_can_read_project(auth.uid(), project_id));
DROP POLICY IF EXISTS director_readonly_delete ON public.equipment_usage;
CREATE POLICY director_readonly_delete ON public.equipment_usage AS RESTRICTIVE FOR DELETE TO authenticated
  USING ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_insert ON public.equipment_usage;
CREATE POLICY director_readonly_insert ON public.equipment_usage AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_update ON public.equipment_usage;
CREATE POLICY director_readonly_update ON public.equipment_usage AS RESTRICTIVE FOR UPDATE TO authenticated
  USING ((NOT is_director(auth.uid())))
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS equipment_usage_select ON public.equipment_usage;
CREATE POLICY equipment_usage_select ON public.equipment_usage AS PERMISSIVE FOR SELECT TO authenticated
  USING (user_can_access_project(auth.uid(), project_id));
DROP POLICY IF EXISTS equipment_usage_write ON public.equipment_usage;
CREATE POLICY equipment_usage_write ON public.equipment_usage AS PERMISSIVE FOR ALL TO authenticated
  USING ((user_can_access_project(auth.uid(), project_id) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'accountant'::app_role))))
  WITH CHECK ((user_can_access_project(auth.uid(), project_id) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'accountant'::app_role))));
DROP POLICY IF EXISTS "Delete estimate docs (project access)" ON public.estimate_documents;
CREATE POLICY "Delete estimate docs (project access)" ON public.estimate_documents AS PERMISSIVE FOR DELETE TO authenticated
  USING (private.user_can_access_project(auth.uid(), project_id));
DROP POLICY IF EXISTS "Insert estimate docs (project access)" ON public.estimate_documents;
CREATE POLICY "Insert estimate docs (project access)" ON public.estimate_documents AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (private.user_can_access_project(auth.uid(), project_id));
DROP POLICY IF EXISTS "Read estimate docs via project" ON public.estimate_documents;
CREATE POLICY "Read estimate docs via project" ON public.estimate_documents AS PERMISSIVE FOR SELECT TO authenticated
  USING (private.user_can_access_project(auth.uid(), project_id));
DROP POLICY IF EXISTS director_read_project ON public.estimate_documents;
CREATE POLICY director_read_project ON public.estimate_documents AS PERMISSIVE FOR SELECT TO authenticated
  USING (private.director_can_read_project(auth.uid(), project_id));
DROP POLICY IF EXISTS director_readonly_delete ON public.estimate_documents;
CREATE POLICY director_readonly_delete ON public.estimate_documents AS RESTRICTIVE FOR DELETE TO authenticated
  USING ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_insert ON public.estimate_documents;
CREATE POLICY director_readonly_insert ON public.estimate_documents AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_update ON public.estimate_documents;
CREATE POLICY director_readonly_update ON public.estimate_documents AS RESTRICTIVE FOR UPDATE TO authenticated
  USING ((NOT is_director(auth.uid())))
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS "Delete estimate items (project access)" ON public.estimate_items;
CREATE POLICY "Delete estimate items (project access)" ON public.estimate_items AS PERMISSIVE FOR DELETE TO authenticated
  USING (private.user_can_access_project(auth.uid(), project_id));
DROP POLICY IF EXISTS "Insert estimate items (project access)" ON public.estimate_items;
CREATE POLICY "Insert estimate items (project access)" ON public.estimate_items AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (private.user_can_access_project(auth.uid(), project_id));
DROP POLICY IF EXISTS "Read estimate items via project" ON public.estimate_items;
CREATE POLICY "Read estimate items via project" ON public.estimate_items AS PERMISSIVE FOR SELECT TO authenticated
  USING (private.user_can_access_project(auth.uid(), project_id));
DROP POLICY IF EXISTS "Update estimate items (project access)" ON public.estimate_items;
CREATE POLICY "Update estimate items (project access)" ON public.estimate_items AS PERMISSIVE FOR UPDATE TO authenticated
  USING (private.user_can_access_project(auth.uid(), project_id))
  WITH CHECK (private.user_can_access_project(auth.uid(), project_id));
DROP POLICY IF EXISTS director_read_project ON public.estimate_items;
CREATE POLICY director_read_project ON public.estimate_items AS PERMISSIVE FOR SELECT TO authenticated
  USING (private.director_can_read_project(auth.uid(), project_id));
DROP POLICY IF EXISTS director_readonly_delete ON public.estimate_items;
CREATE POLICY director_readonly_delete ON public.estimate_items AS RESTRICTIVE FOR DELETE TO authenticated
  USING ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_insert ON public.estimate_items;
CREATE POLICY director_readonly_insert ON public.estimate_items AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_update ON public.estimate_items;
CREATE POLICY director_readonly_update ON public.estimate_items AS RESTRICTIVE FOR UPDATE TO authenticated
  USING ((NOT is_director(auth.uid())))
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS "Delete estimates (project access)" ON public.estimates;
CREATE POLICY "Delete estimates (project access)" ON public.estimates AS PERMISSIVE FOR DELETE TO authenticated
  USING (private.user_can_access_project(auth.uid(), project_id));
DROP POLICY IF EXISTS "Insert estimates (project access)" ON public.estimates;
CREATE POLICY "Insert estimates (project access)" ON public.estimates AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (private.user_can_access_project(auth.uid(), project_id));
DROP POLICY IF EXISTS "Read estimates via project" ON public.estimates;
CREATE POLICY "Read estimates via project" ON public.estimates AS PERMISSIVE FOR SELECT TO authenticated
  USING (private.user_can_access_project(auth.uid(), project_id));
DROP POLICY IF EXISTS "Update estimates (project access)" ON public.estimates;
CREATE POLICY "Update estimates (project access)" ON public.estimates AS PERMISSIVE FOR UPDATE TO authenticated
  USING (private.user_can_access_project(auth.uid(), project_id))
  WITH CHECK (private.user_can_access_project(auth.uid(), project_id));
DROP POLICY IF EXISTS director_read_company ON public.estimates;
CREATE POLICY director_read_company ON public.estimates AS PERMISSIVE FOR SELECT TO authenticated
  USING ((is_director(auth.uid()) AND (company_id = private.user_company_id(auth.uid()))));
DROP POLICY IF EXISTS director_read_project ON public.estimates;
CREATE POLICY director_read_project ON public.estimates AS PERMISSIVE FOR SELECT TO authenticated
  USING (private.director_can_read_project(auth.uid(), project_id));
DROP POLICY IF EXISTS director_readonly_delete ON public.estimates;
CREATE POLICY director_readonly_delete ON public.estimates AS RESTRICTIVE FOR DELETE TO authenticated
  USING ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_insert ON public.estimates;
CREATE POLICY director_readonly_insert ON public.estimates AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_update ON public.estimates;
CREATE POLICY director_readonly_update ON public.estimates AS RESTRICTIVE FOR UPDATE TO authenticated
  USING ((NOT is_director(auth.uid())))
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS exchange_rates_select ON public.exchange_rates;
CREATE POLICY exchange_rates_select ON public.exchange_rates AS PERMISSIVE FOR SELECT TO authenticated
  USING ((private.is_platform_admin(auth.uid()) OR (private.user_company_id(auth.uid()) IS NOT NULL)));
DROP POLICY IF EXISTS "Delete expenses (project or company)" ON public.expenses;
CREATE POLICY "Delete expenses (project or company)" ON public.expenses AS PERMISSIVE FOR DELETE TO authenticated
  USING ((((project_id IS NOT NULL) AND private.user_can_access_project(auth.uid(), project_id)) OR ((project_id IS NULL) AND (private.has_role(auth.uid(), 'owner'::app_role) OR private.has_role(auth.uid(), 'accountant'::app_role)))));
DROP POLICY IF EXISTS "Insert expenses (project or company)" ON public.expenses;
CREATE POLICY "Insert expenses (project or company)" ON public.expenses AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((((project_id IS NOT NULL) AND private.user_can_access_project(auth.uid(), project_id)) OR ((project_id IS NULL) AND (private.has_role(auth.uid(), 'owner'::app_role) OR private.has_role(auth.uid(), 'accountant'::app_role)) AND (created_by = auth.uid()))));
DROP POLICY IF EXISTS "Read expenses (project or company)" ON public.expenses;
CREATE POLICY "Read expenses (project or company)" ON public.expenses AS PERMISSIVE FOR SELECT TO authenticated
  USING ((((project_id IS NOT NULL) AND private.user_can_access_project(auth.uid(), project_id)) OR ((project_id IS NULL) AND (private.has_role(auth.uid(), 'owner'::app_role) OR private.has_role(auth.uid(), 'accountant'::app_role)) AND (created_by IN ( SELECT p.id
   FROM profiles p
  WHERE (p.company_id = private.user_company_id(auth.uid())))))));
DROP POLICY IF EXISTS "Read expenses via project" ON public.expenses;
CREATE POLICY "Read expenses via project" ON public.expenses AS PERMISSIVE FOR SELECT TO authenticated
  USING (private.user_can_access_project(auth.uid(), project_id));
DROP POLICY IF EXISTS "Update expenses (project or company)" ON public.expenses;
CREATE POLICY "Update expenses (project or company)" ON public.expenses AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((((project_id IS NOT NULL) AND private.user_can_access_project(auth.uid(), project_id)) OR ((project_id IS NULL) AND (private.has_role(auth.uid(), 'owner'::app_role) OR private.has_role(auth.uid(), 'accountant'::app_role)))))
  WITH CHECK ((((project_id IS NOT NULL) AND private.user_can_access_project(auth.uid(), project_id)) OR ((project_id IS NULL) AND (private.has_role(auth.uid(), 'owner'::app_role) OR private.has_role(auth.uid(), 'accountant'::app_role)))));
DROP POLICY IF EXISTS director_read_project ON public.expenses;
CREATE POLICY director_read_project ON public.expenses AS PERMISSIVE FOR SELECT TO authenticated
  USING (private.director_can_read_project(auth.uid(), project_id));
DROP POLICY IF EXISTS director_readonly_delete ON public.expenses;
CREATE POLICY director_readonly_delete ON public.expenses AS RESTRICTIVE FOR DELETE TO authenticated
  USING ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_insert ON public.expenses;
CREATE POLICY director_readonly_insert ON public.expenses AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_update ON public.expenses;
CREATE POLICY director_readonly_update ON public.expenses AS RESTRICTIVE FOR UPDATE TO authenticated
  USING ((NOT is_director(auth.uid())))
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS "Owners delete floors" ON public.floors;
CREATE POLICY "Owners delete floors" ON public.floors AS PERMISSIVE FOR DELETE TO authenticated
  USING ((private.has_role(auth.uid(), 'owner'::app_role) AND private.user_can_access_project(auth.uid(), project_id)));
DROP POLICY IF EXISTS "Project members insert floors" ON public.floors;
CREATE POLICY "Project members insert floors" ON public.floors AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (private.user_can_access_project(auth.uid(), project_id));
DROP POLICY IF EXISTS "Project members update floors" ON public.floors;
CREATE POLICY "Project members update floors" ON public.floors AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((private.user_can_access_project(auth.uid(), project_id) AND (private.has_role(auth.uid(), 'owner'::app_role) OR private.has_role(auth.uid(), 'manager'::app_role))))
  WITH CHECK ((private.user_can_access_project(auth.uid(), project_id) AND (private.has_role(auth.uid(), 'owner'::app_role) OR private.has_role(auth.uid(), 'manager'::app_role))));
DROP POLICY IF EXISTS "Read floors via project" ON public.floors;
CREATE POLICY "Read floors via project" ON public.floors AS PERMISSIVE FOR SELECT TO authenticated
  USING (private.user_can_access_project(auth.uid(), project_id));
DROP POLICY IF EXISTS director_read_project ON public.floors;
CREATE POLICY director_read_project ON public.floors AS PERMISSIVE FOR SELECT TO authenticated
  USING (private.director_can_read_project(auth.uid(), project_id));
DROP POLICY IF EXISTS director_readonly_delete ON public.floors;
CREATE POLICY director_readonly_delete ON public.floors AS RESTRICTIVE FOR DELETE TO authenticated
  USING ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_insert ON public.floors;
CREATE POLICY director_readonly_insert ON public.floors AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_update ON public.floors;
CREATE POLICY director_readonly_update ON public.floors AS RESTRICTIVE FOR UPDATE TO authenticated
  USING ((NOT is_director(auth.uid())))
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS fr_delete ON public.funding_requests;
CREATE POLICY fr_delete ON public.funding_requests AS PERMISSIVE FOR DELETE TO authenticated
  USING (((company_id = user_company_id(auth.uid())) AND ((requested_by = auth.uid()) OR has_role(auth.uid(), 'owner'::app_role))));
DROP POLICY IF EXISTS fr_insert ON public.funding_requests;
CREATE POLICY fr_insert ON public.funding_requests AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((company_id = user_company_id(auth.uid())) AND (requested_by = auth.uid()) AND user_can_access_project(auth.uid(), project_id)));
DROP POLICY IF EXISTS fr_select ON public.funding_requests;
CREATE POLICY fr_select ON public.funding_requests AS PERMISSIVE FOR SELECT TO authenticated
  USING (((company_id = user_company_id(auth.uid())) AND ((requested_by = auth.uid()) OR (approver_id = auth.uid()) OR has_role(auth.uid(), 'owner'::app_role) OR is_director(auth.uid()))));
DROP POLICY IF EXISTS fr_update ON public.funding_requests;
CREATE POLICY fr_update ON public.funding_requests AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((company_id = user_company_id(auth.uid())) AND ((approver_id = auth.uid()) OR has_role(auth.uid(), 'owner'::app_role) OR is_director(auth.uid()))))
  WITH CHECK ((company_id = user_company_id(auth.uid())));
DROP POLICY IF EXISTS co_read ON public.hidden_work_acts;
CREATE POLICY co_read ON public.hidden_work_acts AS PERMISSIVE FOR SELECT TO authenticated
  USING (((company_id = user_company_id(auth.uid())) OR is_platform_admin(auth.uid())));
DROP POLICY IF EXISTS co_write ON public.hidden_work_acts;
CREATE POLICY co_write ON public.hidden_work_acts AS PERMISSIVE FOR ALL TO authenticated
  USING ((company_id = user_company_id(auth.uid())))
  WITH CHECK ((company_id = user_company_id(auth.uid())));
DROP POLICY IF EXISTS director_read_company ON public.hidden_work_acts;
CREATE POLICY director_read_company ON public.hidden_work_acts AS PERMISSIVE FOR SELECT TO authenticated
  USING ((is_director(auth.uid()) AND (company_id = private.user_company_id(auth.uid()))));
DROP POLICY IF EXISTS director_read_project ON public.hidden_work_acts;
CREATE POLICY director_read_project ON public.hidden_work_acts AS PERMISSIVE FOR SELECT TO authenticated
  USING (private.director_can_read_project(auth.uid(), project_id));
DROP POLICY IF EXISTS director_readonly_delete ON public.hidden_work_acts;
CREATE POLICY director_readonly_delete ON public.hidden_work_acts AS RESTRICTIVE FOR DELETE TO authenticated
  USING ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_insert ON public.hidden_work_acts;
CREATE POLICY director_readonly_insert ON public.hidden_work_acts AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_update ON public.hidden_work_acts;
CREATE POLICY director_readonly_update ON public.hidden_work_acts AS RESTRICTIVE FOR UPDATE TO authenticated
  USING ((NOT is_director(auth.uid())))
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS maa_delete_company ON public.material_acceptance_acts;
CREATE POLICY maa_delete_company ON public.material_acceptance_acts AS PERMISSIVE FOR DELETE TO authenticated
  USING (((company_id = user_company_id(auth.uid())) AND (has_role(auth.uid(), 'owner'::app_role) OR is_director(auth.uid()))));
DROP POLICY IF EXISTS maa_insert_company ON public.material_acceptance_acts;
CREATE POLICY maa_insert_company ON public.material_acceptance_acts AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((company_id = user_company_id(auth.uid())) AND (created_by = auth.uid())));
DROP POLICY IF EXISTS maa_select_company ON public.material_acceptance_acts;
CREATE POLICY maa_select_company ON public.material_acceptance_acts AS PERMISSIVE FOR SELECT TO authenticated
  USING (((company_id = user_company_id(auth.uid())) OR is_platform_admin(auth.uid())));
DROP POLICY IF EXISTS maa_update_company ON public.material_acceptance_acts;
CREATE POLICY maa_update_company ON public.material_acceptance_acts AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((company_id = user_company_id(auth.uid())) AND ((created_by = auth.uid()) OR has_role(auth.uid(), 'owner'::app_role) OR is_director(auth.uid()))))
  WITH CHECK ((company_id = user_company_id(auth.uid())));
DROP POLICY IF EXISTS "Delete movements (project access)" ON public.material_movements;
CREATE POLICY "Delete movements (project access)" ON public.material_movements AS PERMISSIVE FOR DELETE TO authenticated
  USING (private.user_can_access_project(auth.uid(), project_id));
DROP POLICY IF EXISTS "Insert movements (project access)" ON public.material_movements;
CREATE POLICY "Insert movements (project access)" ON public.material_movements AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (private.user_can_access_project(auth.uid(), project_id));
DROP POLICY IF EXISTS "Read movements via project" ON public.material_movements;
CREATE POLICY "Read movements via project" ON public.material_movements AS PERMISSIVE FOR SELECT TO authenticated
  USING (private.user_can_access_project(auth.uid(), project_id));
DROP POLICY IF EXISTS director_read_project ON public.material_movements;
CREATE POLICY director_read_project ON public.material_movements AS PERMISSIVE FOR SELECT TO authenticated
  USING (private.director_can_read_project(auth.uid(), project_id));
DROP POLICY IF EXISTS director_readonly_delete ON public.material_movements;
CREATE POLICY director_readonly_delete ON public.material_movements AS RESTRICTIVE FOR DELETE TO authenticated
  USING ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_insert ON public.material_movements;
CREATE POLICY director_readonly_insert ON public.material_movements AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_update ON public.material_movements;
CREATE POLICY director_readonly_update ON public.material_movements AS RESTRICTIVE FOR UPDATE TO authenticated
  USING ((NOT is_director(auth.uid())))
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS "Delete materials (project access)" ON public.materials;
CREATE POLICY "Delete materials (project access)" ON public.materials AS PERMISSIVE FOR DELETE TO authenticated
  USING (private.user_can_access_project(auth.uid(), project_id));
DROP POLICY IF EXISTS "Insert materials (project access)" ON public.materials;
CREATE POLICY "Insert materials (project access)" ON public.materials AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (private.user_can_access_project(auth.uid(), project_id));
DROP POLICY IF EXISTS "Read materials via project" ON public.materials;
CREATE POLICY "Read materials via project" ON public.materials AS PERMISSIVE FOR SELECT TO authenticated
  USING (private.user_can_access_project(auth.uid(), project_id));
DROP POLICY IF EXISTS "Update materials (project access)" ON public.materials;
CREATE POLICY "Update materials (project access)" ON public.materials AS PERMISSIVE FOR UPDATE TO authenticated
  USING (private.user_can_access_project(auth.uid(), project_id))
  WITH CHECK (private.user_can_access_project(auth.uid(), project_id));
DROP POLICY IF EXISTS director_read_project ON public.materials;
CREATE POLICY director_read_project ON public.materials AS PERMISSIVE FOR SELECT TO authenticated
  USING (private.director_can_read_project(auth.uid(), project_id));
DROP POLICY IF EXISTS director_readonly_delete ON public.materials;
CREATE POLICY director_readonly_delete ON public.materials AS RESTRICTIVE FOR DELETE TO authenticated
  USING ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_insert ON public.materials;
CREATE POLICY director_readonly_insert ON public.materials AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_update ON public.materials;
CREATE POLICY director_readonly_update ON public.materials AS RESTRICTIVE FOR UPDATE TO authenticated
  USING ((NOT is_director(auth.uid())))
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS "Users delete own reads" ON public.notification_reads;
CREATE POLICY "Users delete own reads" ON public.notification_reads AS PERMISSIVE FOR DELETE TO authenticated
  USING ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users insert own reads" ON public.notification_reads;
CREATE POLICY "Users insert own reads" ON public.notification_reads AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM notifications n
  WHERE (n.id = notification_reads.notification_id)))));
DROP POLICY IF EXISTS "Users read own reads" ON public.notification_reads;
CREATE POLICY "Users read own reads" ON public.notification_reads AS PERMISSIVE FOR SELECT TO authenticated
  USING ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Owners and admins can read notifications" ON public.notifications;
CREATE POLICY "Owners and admins can read notifications" ON public.notifications AS PERMISSIVE FOR SELECT TO authenticated
  USING ((private.is_platform_admin(auth.uid()) OR private.has_role(auth.uid(), 'owner'::app_role)));
DROP POLICY IF EXISTS "Platform admins manage notifications" ON public.notifications;
CREATE POLICY "Platform admins manage notifications" ON public.notifications AS PERMISSIVE FOR ALL TO authenticated
  USING (private.is_platform_admin(auth.uid()))
  WITH CHECK (private.is_platform_admin(auth.uid()));
DROP POLICY IF EXISTS director_readonly_delete ON public.notifications;
CREATE POLICY director_readonly_delete ON public.notifications AS RESTRICTIVE FOR DELETE TO authenticated
  USING ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_insert ON public.notifications;
CREATE POLICY director_readonly_insert ON public.notifications AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_update ON public.notifications;
CREATE POLICY director_readonly_update ON public.notifications AS RESTRICTIVE FOR UPDATE TO authenticated
  USING ((NOT is_director(auth.uid())))
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS pdist_select ON public.partner_distributions;
CREATE POLICY pdist_select ON public.partner_distributions AS PERMISSIVE FOR SELECT TO authenticated
  USING ((private.is_platform_admin(auth.uid()) OR (private.has_role(auth.uid(), 'owner'::app_role) AND (company_id = private.user_company_id(auth.uid()))) OR (director_user_id = auth.uid())));
DROP POLICY IF EXISTS ppayout_delete ON public.partner_payouts;
CREATE POLICY ppayout_delete ON public.partner_payouts AS PERMISSIVE FOR DELETE TO authenticated
  USING ((private.is_platform_admin(auth.uid()) OR (private.has_role(auth.uid(), 'owner'::app_role) AND (company_id = private.user_company_id(auth.uid())))));
DROP POLICY IF EXISTS ppayout_insert ON public.partner_payouts;
CREATE POLICY ppayout_insert ON public.partner_payouts AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((private.is_platform_admin(auth.uid()) OR (private.has_role(auth.uid(), 'owner'::app_role) AND (company_id = private.user_company_id(auth.uid())))));
DROP POLICY IF EXISTS ppayout_select ON public.partner_payouts;
CREATE POLICY ppayout_select ON public.partner_payouts AS PERMISSIVE FOR SELECT TO authenticated
  USING ((private.is_platform_admin(auth.uid()) OR (private.has_role(auth.uid(), 'owner'::app_role) AND (company_id = private.user_company_id(auth.uid()))) OR (director_user_id = auth.uid())));
DROP POLICY IF EXISTS shares_delete ON public.partner_shares;
CREATE POLICY shares_delete ON public.partner_shares AS PERMISSIVE FOR DELETE TO authenticated
  USING ((private.is_platform_admin(auth.uid()) OR (private.has_role(auth.uid(), 'owner'::app_role) AND (company_id = private.user_company_id(auth.uid())))));
DROP POLICY IF EXISTS shares_insert ON public.partner_shares;
CREATE POLICY shares_insert ON public.partner_shares AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((private.is_platform_admin(auth.uid()) OR (private.has_role(auth.uid(), 'owner'::app_role) AND (company_id = private.user_company_id(auth.uid())))));
DROP POLICY IF EXISTS shares_select ON public.partner_shares;
CREATE POLICY shares_select ON public.partner_shares AS PERMISSIVE FOR SELECT TO authenticated
  USING ((private.is_platform_admin(auth.uid()) OR (private.has_role(auth.uid(), 'owner'::app_role) AND (company_id = private.user_company_id(auth.uid()))) OR (director_user_id = auth.uid())));
DROP POLICY IF EXISTS shares_update ON public.partner_shares;
CREATE POLICY shares_update ON public.partner_shares AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((private.is_platform_admin(auth.uid()) OR (private.has_role(auth.uid(), 'owner'::app_role) AND (company_id = private.user_company_id(auth.uid())))));
DROP POLICY IF EXISTS "Delete payable_payments (via payable)" ON public.payable_payments;
CREATE POLICY "Delete payable_payments (via payable)" ON public.payable_payments AS PERMISSIVE FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM payables p
  WHERE ((p.id = payable_payments.payable_id) AND (((p.project_id IS NOT NULL) AND private.user_can_access_project(auth.uid(), p.project_id)) OR ((p.project_id IS NULL) AND (p.company_id = private.user_company_id(auth.uid())) AND (private.has_role(auth.uid(), 'owner'::app_role) OR private.has_role(auth.uid(), 'accountant'::app_role))))))));
DROP POLICY IF EXISTS "Insert payable_payments (via payable)" ON public.payable_payments;
CREATE POLICY "Insert payable_payments (via payable)" ON public.payable_payments AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM payables p
  WHERE ((p.id = payable_payments.payable_id) AND (((p.project_id IS NOT NULL) AND private.user_can_access_project(auth.uid(), p.project_id)) OR ((p.project_id IS NULL) AND (p.company_id = private.user_company_id(auth.uid())) AND (private.has_role(auth.uid(), 'owner'::app_role) OR private.has_role(auth.uid(), 'accountant'::app_role))))))));
DROP POLICY IF EXISTS "Read payable_payments via payable" ON public.payable_payments;
CREATE POLICY "Read payable_payments via payable" ON public.payable_payments AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM payables p
  WHERE ((p.id = payable_payments.payable_id) AND (((p.project_id IS NOT NULL) AND private.user_can_access_project(auth.uid(), p.project_id)) OR ((p.project_id IS NULL) AND (p.company_id = private.user_company_id(auth.uid())) AND (private.has_role(auth.uid(), 'owner'::app_role) OR private.has_role(auth.uid(), 'accountant'::app_role))))))));
DROP POLICY IF EXISTS "Update payable_payments (via payable)" ON public.payable_payments;
CREATE POLICY "Update payable_payments (via payable)" ON public.payable_payments AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM payables p
  WHERE ((p.id = payable_payments.payable_id) AND (((p.project_id IS NOT NULL) AND private.user_can_access_project(auth.uid(), p.project_id)) OR ((p.project_id IS NULL) AND (p.company_id = private.user_company_id(auth.uid())) AND (private.has_role(auth.uid(), 'owner'::app_role) OR private.has_role(auth.uid(), 'accountant'::app_role))))))));
DROP POLICY IF EXISTS director_read_via_parent ON public.payable_payments;
CREATE POLICY director_read_via_parent ON public.payable_payments AS PERMISSIVE FOR SELECT TO authenticated
  USING ((is_director(auth.uid()) AND (EXISTS ( SELECT 1
   FROM payables p
  WHERE ((p.id = payable_payments.payable_id) AND private.director_can_read_project(auth.uid(), p.project_id))))));
DROP POLICY IF EXISTS director_readonly_delete ON public.payable_payments;
CREATE POLICY director_readonly_delete ON public.payable_payments AS RESTRICTIVE FOR DELETE TO authenticated
  USING ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_insert ON public.payable_payments;
CREATE POLICY director_readonly_insert ON public.payable_payments AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_update ON public.payable_payments;
CREATE POLICY director_readonly_update ON public.payable_payments AS RESTRICTIVE FOR UPDATE TO authenticated
  USING ((NOT is_director(auth.uid())))
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS "Delete payables (platform admin)" ON public.payables;
CREATE POLICY "Delete payables (platform admin)" ON public.payables AS PERMISSIVE FOR DELETE TO authenticated
  USING (private.is_platform_admin(auth.uid()));
DROP POLICY IF EXISTS "Insert payables (project or company)" ON public.payables;
CREATE POLICY "Insert payables (project or company)" ON public.payables AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((((project_id IS NOT NULL) AND private.user_can_access_project(auth.uid(), project_id)) OR ((project_id IS NULL) AND (company_id = private.user_company_id(auth.uid())) AND (private.has_role(auth.uid(), 'owner'::app_role) OR private.has_role(auth.uid(), 'accountant'::app_role)))));
DROP POLICY IF EXISTS "Read payables (project or company)" ON public.payables;
CREATE POLICY "Read payables (project or company)" ON public.payables AS PERMISSIVE FOR SELECT TO authenticated
  USING ((((project_id IS NOT NULL) AND private.user_can_access_project(auth.uid(), project_id)) OR ((project_id IS NULL) AND (company_id = private.user_company_id(auth.uid())) AND (private.has_role(auth.uid(), 'owner'::app_role) OR private.has_role(auth.uid(), 'accountant'::app_role)))));
DROP POLICY IF EXISTS "Update payables (project or company)" ON public.payables;
CREATE POLICY "Update payables (project or company)" ON public.payables AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((((project_id IS NOT NULL) AND private.user_can_access_project(auth.uid(), project_id)) OR ((project_id IS NULL) AND (company_id = private.user_company_id(auth.uid())) AND (private.has_role(auth.uid(), 'owner'::app_role) OR private.has_role(auth.uid(), 'accountant'::app_role)))))
  WITH CHECK ((((project_id IS NOT NULL) AND private.user_can_access_project(auth.uid(), project_id)) OR ((project_id IS NULL) AND (company_id = private.user_company_id(auth.uid())) AND (private.has_role(auth.uid(), 'owner'::app_role) OR private.has_role(auth.uid(), 'accountant'::app_role)))));
DROP POLICY IF EXISTS director_read_company ON public.payables;
CREATE POLICY director_read_company ON public.payables AS PERMISSIVE FOR SELECT TO authenticated
  USING ((is_director(auth.uid()) AND (company_id = private.user_company_id(auth.uid()))));
DROP POLICY IF EXISTS director_read_project ON public.payables;
CREATE POLICY director_read_project ON public.payables AS PERMISSIVE FOR SELECT TO authenticated
  USING (private.director_can_read_project(auth.uid(), project_id));
DROP POLICY IF EXISTS director_readonly_delete ON public.payables;
CREATE POLICY director_readonly_delete ON public.payables AS RESTRICTIVE FOR DELETE TO authenticated
  USING ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_insert ON public.payables;
CREATE POLICY director_readonly_insert ON public.payables AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_update ON public.payables;
CREATE POLICY director_readonly_update ON public.payables AS RESTRICTIVE FOR UPDATE TO authenticated
  USING ((NOT is_director(auth.uid())))
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS "Admin manages payment methods" ON public.payment_methods;
CREATE POLICY "Admin manages payment methods" ON public.payment_methods AS PERMISSIVE FOR ALL TO authenticated
  USING (private.is_platform_admin(auth.uid()))
  WITH CHECK (private.is_platform_admin(auth.uid()));
DROP POLICY IF EXISTS "Platform admins read payment methods" ON public.payment_methods;
CREATE POLICY "Platform admins read payment methods" ON public.payment_methods AS PERMISSIVE FOR SELECT TO authenticated
  USING (private.is_platform_admin(auth.uid()));
DROP POLICY IF EXISTS director_readonly_delete ON public.payment_methods;
CREATE POLICY director_readonly_delete ON public.payment_methods AS RESTRICTIVE FOR DELETE TO authenticated
  USING ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_insert ON public.payment_methods;
CREATE POLICY director_readonly_insert ON public.payment_methods AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_update ON public.payment_methods;
CREATE POLICY director_readonly_update ON public.payment_methods AS RESTRICTIVE FOR UPDATE TO authenticated
  USING ((NOT is_director(auth.uid())))
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS "Delete schedule" ON public.payment_schedule;
CREATE POLICY "Delete schedule" ON public.payment_schedule AS PERMISSIVE FOR DELETE TO authenticated
  USING ((private.has_role(auth.uid(), 'owner'::app_role) AND (EXISTS ( SELECT 1
   FROM sales s
  WHERE ((s.id = payment_schedule.sale_id) AND private.user_can_access_project(auth.uid(), s.project_id))))));
DROP POLICY IF EXISTS "Insert schedule via sale" ON public.payment_schedule;
CREATE POLICY "Insert schedule via sale" ON public.payment_schedule AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM sales s
  WHERE ((s.id = payment_schedule.sale_id) AND private.user_can_access_project(auth.uid(), s.project_id)))));
DROP POLICY IF EXISTS "Read schedule via sale" ON public.payment_schedule;
CREATE POLICY "Read schedule via sale" ON public.payment_schedule AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM sales s
  WHERE ((s.id = payment_schedule.sale_id) AND private.user_can_access_project(auth.uid(), s.project_id)))));
DROP POLICY IF EXISTS "Update schedule" ON public.payment_schedule;
CREATE POLICY "Update schedule" ON public.payment_schedule AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((private.has_role(auth.uid(), 'owner'::app_role) OR private.has_role(auth.uid(), 'accountant'::app_role)) AND (EXISTS ( SELECT 1
   FROM sales s
  WHERE ((s.id = payment_schedule.sale_id) AND private.user_can_access_project(auth.uid(), s.project_id))))))
  WITH CHECK (((private.has_role(auth.uid(), 'owner'::app_role) OR private.has_role(auth.uid(), 'accountant'::app_role)) AND (EXISTS ( SELECT 1
   FROM sales s
  WHERE ((s.id = payment_schedule.sale_id) AND private.user_can_access_project(auth.uid(), s.project_id))))));
DROP POLICY IF EXISTS director_read_via_parent ON public.payment_schedule;
CREATE POLICY director_read_via_parent ON public.payment_schedule AS PERMISSIVE FOR SELECT TO authenticated
  USING ((is_director(auth.uid()) AND (EXISTS ( SELECT 1
   FROM sales s
  WHERE ((s.id = payment_schedule.sale_id) AND private.director_can_read_project(auth.uid(), s.project_id))))));
DROP POLICY IF EXISTS director_readonly_delete ON public.payment_schedule;
CREATE POLICY director_readonly_delete ON public.payment_schedule AS RESTRICTIVE FOR DELETE TO authenticated
  USING ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_insert ON public.payment_schedule;
CREATE POLICY director_readonly_insert ON public.payment_schedule AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_update ON public.payment_schedule;
CREATE POLICY director_readonly_update ON public.payment_schedule AS RESTRICTIVE FOR UPDATE TO authenticated
  USING ((NOT is_director(auth.uid())))
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS "Delete payments (owner)" ON public.payments;
CREATE POLICY "Delete payments (owner)" ON public.payments AS PERMISSIVE FOR DELETE TO authenticated
  USING ((private.has_role(auth.uid(), 'owner'::app_role) AND (EXISTS ( SELECT 1
   FROM sales s
  WHERE ((s.id = payments.sale_id) AND private.user_can_access_project(auth.uid(), s.project_id))))));
DROP POLICY IF EXISTS "Insert payments via sale" ON public.payments;
CREATE POLICY "Insert payments via sale" ON public.payments AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((private.has_role(auth.uid(), 'owner'::app_role) OR private.has_role(auth.uid(), 'accountant'::app_role) OR private.has_role(auth.uid(), 'manager'::app_role)) AND (EXISTS ( SELECT 1
   FROM sales s
  WHERE ((s.id = payments.sale_id) AND private.user_can_access_project(auth.uid(), s.project_id))))));
DROP POLICY IF EXISTS "Read payments via sale" ON public.payments;
CREATE POLICY "Read payments via sale" ON public.payments AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM sales s
  WHERE ((s.id = payments.sale_id) AND private.user_can_access_project(auth.uid(), s.project_id)))));
DROP POLICY IF EXISTS "Update payments (owner/accountant)" ON public.payments;
CREATE POLICY "Update payments (owner/accountant)" ON public.payments AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((private.has_role(auth.uid(), 'owner'::app_role) OR private.has_role(auth.uid(), 'accountant'::app_role)) AND (EXISTS ( SELECT 1
   FROM sales s
  WHERE ((s.id = payments.sale_id) AND private.user_can_access_project(auth.uid(), s.project_id))))))
  WITH CHECK (((private.has_role(auth.uid(), 'owner'::app_role) OR private.has_role(auth.uid(), 'accountant'::app_role)) AND (EXISTS ( SELECT 1
   FROM sales s
  WHERE ((s.id = payments.sale_id) AND private.user_can_access_project(auth.uid(), s.project_id))))));
DROP POLICY IF EXISTS director_read_via_parent ON public.payments;
CREATE POLICY director_read_via_parent ON public.payments AS PERMISSIVE FOR SELECT TO authenticated
  USING ((is_director(auth.uid()) AND (EXISTS ( SELECT 1
   FROM sales s
  WHERE ((s.id = payments.sale_id) AND private.director_can_read_project(auth.uid(), s.project_id))))));
DROP POLICY IF EXISTS director_readonly_delete ON public.payments;
CREATE POLICY director_readonly_delete ON public.payments AS RESTRICTIVE FOR DELETE TO authenticated
  USING ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_insert ON public.payments;
CREATE POLICY director_readonly_insert ON public.payments AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_update ON public.payments;
CREATE POLICY director_readonly_update ON public.payments AS RESTRICTIVE FOR UPDATE TO authenticated
  USING ((NOT is_director(auth.uid())))
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS co_read ON public.permits;
CREATE POLICY co_read ON public.permits AS PERMISSIVE FOR SELECT TO authenticated
  USING (((company_id = user_company_id(auth.uid())) OR is_platform_admin(auth.uid())));
DROP POLICY IF EXISTS co_write ON public.permits;
CREATE POLICY co_write ON public.permits AS PERMISSIVE FOR ALL TO authenticated
  USING ((company_id = user_company_id(auth.uid())))
  WITH CHECK ((company_id = user_company_id(auth.uid())));
DROP POLICY IF EXISTS director_read_company ON public.permits;
CREATE POLICY director_read_company ON public.permits AS PERMISSIVE FOR SELECT TO authenticated
  USING ((is_director(auth.uid()) AND (company_id = private.user_company_id(auth.uid()))));
DROP POLICY IF EXISTS director_read_project ON public.permits;
CREATE POLICY director_read_project ON public.permits AS PERMISSIVE FOR SELECT TO authenticated
  USING (private.director_can_read_project(auth.uid(), project_id));
DROP POLICY IF EXISTS director_readonly_delete ON public.permits;
CREATE POLICY director_readonly_delete ON public.permits AS RESTRICTIVE FOR DELETE TO authenticated
  USING ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_insert ON public.permits;
CREATE POLICY director_readonly_insert ON public.permits AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_update ON public.permits;
CREATE POLICY director_readonly_update ON public.permits AS RESTRICTIVE FOR UPDATE TO authenticated
  USING ((NOT is_director(auth.uid())))
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS "Users see own admin status" ON public.platform_admins;
CREATE POLICY "Users see own admin status" ON public.platform_admins AS PERMISSIVE FOR SELECT TO authenticated
  USING (((user_id = auth.uid()) OR private.is_platform_admin(auth.uid())));
DROP POLICY IF EXISTS "platform_settings admin write" ON public.platform_settings;
CREATE POLICY "platform_settings admin write" ON public.platform_settings AS PERMISSIVE FOR ALL TO authenticated
  USING (private.is_platform_admin(auth.uid()))
  WITH CHECK (private.is_platform_admin(auth.uid()));
DROP POLICY IF EXISTS "platform_settings public keys read" ON public.platform_settings;
CREATE POLICY "platform_settings public keys read" ON public.platform_settings AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING ((key = ANY (ARRAY['demo_enabled'::text, 'social_links'::text, 'app_logos'::text])));
DROP POLICY IF EXISTS "Delete profile (owner/admin)" ON public.profiles;
CREATE POLICY "Delete profile (owner/admin)" ON public.profiles AS PERMISSIVE FOR DELETE TO authenticated
  USING ((private.is_platform_admin(auth.uid()) OR (private.has_role(auth.uid(), 'owner'::app_role) AND (company_id = private.user_company_id(auth.uid())))));
DROP POLICY IF EXISTS "Insert own profile" ON public.profiles;
CREATE POLICY "Insert own profile" ON public.profiles AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((private.is_platform_admin(auth.uid()) OR ((id = auth.uid()) AND (company_id IS NULL))));
DROP POLICY IF EXISTS "Read profile (self/company/admin)" ON public.profiles;
CREATE POLICY "Read profile (self/company/admin)" ON public.profiles AS PERMISSIVE FOR SELECT TO authenticated
  USING (((id = auth.uid()) OR private.is_platform_admin(auth.uid()) OR ((company_id IS NOT NULL) AND (company_id = private.user_company_id(auth.uid())) AND (private.has_role(auth.uid(), 'owner'::app_role) OR private.has_role(auth.uid(), 'manager'::app_role)))));
DROP POLICY IF EXISTS "Update profile (self/owner/admin)" ON public.profiles;
CREATE POLICY "Update profile (self/owner/admin)" ON public.profiles AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((id = auth.uid()) OR private.is_platform_admin(auth.uid()) OR (private.has_role(auth.uid(), 'owner'::app_role) AND (company_id = private.user_company_id(auth.uid())))))
  WITH CHECK (((NOT (company_id IS DISTINCT FROM ( SELECT p.company_id
   FROM profiles p
  WHERE (p.id = profiles.id)))) AND (((NOT (extra_pages IS DISTINCT FROM ( SELECT p.extra_pages
   FROM profiles p
  WHERE (p.id = profiles.id)))) AND (NOT (denied_pages IS DISTINCT FROM ( SELECT p.denied_pages
   FROM profiles p
  WHERE (p.id = profiles.id))))) OR private.is_platform_admin(auth.uid()) OR (private.has_role(auth.uid(), 'owner'::app_role) AND (company_id = private.user_company_id(auth.uid()))))));
DROP POLICY IF EXISTS director_read_company ON public.profiles;
CREATE POLICY director_read_company ON public.profiles AS PERMISSIVE FOR SELECT TO authenticated
  USING ((is_director(auth.uid()) AND (company_id = private.user_company_id(auth.uid()))));
DROP POLICY IF EXISTS budget_select ON public.project_budgets;
CREATE POLICY budget_select ON public.project_budgets AS PERMISSIVE FOR SELECT TO authenticated
  USING (user_can_access_project(auth.uid(), project_id));
DROP POLICY IF EXISTS budget_write ON public.project_budgets;
CREATE POLICY budget_write ON public.project_budgets AS PERMISSIVE FOR ALL TO authenticated
  USING ((user_can_access_project(auth.uid(), project_id) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'accountant'::app_role))))
  WITH CHECK ((user_can_access_project(auth.uid(), project_id) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'accountant'::app_role))));
DROP POLICY IF EXISTS director_read_company ON public.project_budgets;
CREATE POLICY director_read_company ON public.project_budgets AS PERMISSIVE FOR SELECT TO authenticated
  USING ((is_director(auth.uid()) AND (company_id = private.user_company_id(auth.uid()))));
DROP POLICY IF EXISTS director_read_project ON public.project_budgets;
CREATE POLICY director_read_project ON public.project_budgets AS PERMISSIVE FOR SELECT TO authenticated
  USING (private.director_can_read_project(auth.uid(), project_id));
DROP POLICY IF EXISTS director_readonly_delete ON public.project_budgets;
CREATE POLICY director_readonly_delete ON public.project_budgets AS RESTRICTIVE FOR DELETE TO authenticated
  USING ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_insert ON public.project_budgets;
CREATE POLICY director_readonly_insert ON public.project_budgets AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_update ON public.project_budgets;
CREATE POLICY director_readonly_update ON public.project_budgets AS RESTRICTIVE FOR UPDATE TO authenticated
  USING ((NOT is_director(auth.uid())))
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS "Owner manages project_staff" ON public.project_staff;
CREATE POLICY "Owner manages project_staff" ON public.project_staff AS PERMISSIVE FOR ALL TO authenticated
  USING ((private.has_role(auth.uid(), 'owner'::app_role) AND private.project_in_user_company(auth.uid(), project_id)))
  WITH CHECK ((private.has_role(auth.uid(), 'owner'::app_role) AND private.project_in_user_company(auth.uid(), project_id)));
DROP POLICY IF EXISTS "Read project_staff" ON public.project_staff;
CREATE POLICY "Read project_staff" ON public.project_staff AS PERMISSIVE FOR SELECT TO authenticated
  USING (((user_id = auth.uid()) OR private.is_platform_admin(auth.uid()) OR private.project_in_user_company(auth.uid(), project_id)));
DROP POLICY IF EXISTS director_read_project ON public.project_staff;
CREATE POLICY director_read_project ON public.project_staff AS PERMISSIVE FOR SELECT TO authenticated
  USING (private.director_can_read_project(auth.uid(), project_id));
DROP POLICY IF EXISTS director_readonly_delete ON public.project_staff;
CREATE POLICY director_readonly_delete ON public.project_staff AS RESTRICTIVE FOR DELETE TO authenticated
  USING ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_insert ON public.project_staff;
CREATE POLICY director_readonly_insert ON public.project_staff AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_update ON public.project_staff;
CREATE POLICY director_readonly_update ON public.project_staff AS RESTRICTIVE FOR UPDATE TO authenticated
  USING ((NOT is_director(auth.uid())))
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_read_company ON public.project_stages;
CREATE POLICY director_read_company ON public.project_stages AS PERMISSIVE FOR SELECT TO authenticated
  USING ((is_director(auth.uid()) AND (company_id = private.user_company_id(auth.uid()))));
DROP POLICY IF EXISTS director_read_project ON public.project_stages;
CREATE POLICY director_read_project ON public.project_stages AS PERMISSIVE FOR SELECT TO authenticated
  USING (private.director_can_read_project(auth.uid(), project_id));
DROP POLICY IF EXISTS director_readonly_delete ON public.project_stages;
CREATE POLICY director_readonly_delete ON public.project_stages AS RESTRICTIVE FOR DELETE TO authenticated
  USING ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_insert ON public.project_stages;
CREATE POLICY director_readonly_insert ON public.project_stages AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_update ON public.project_stages;
CREATE POLICY director_readonly_update ON public.project_stages AS RESTRICTIVE FOR UPDATE TO authenticated
  USING ((NOT is_director(auth.uid())))
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS stages_delete ON public.project_stages;
CREATE POLICY stages_delete ON public.project_stages AS PERMISSIVE FOR DELETE TO authenticated
  USING ((user_can_access_project(auth.uid(), project_id) AND has_role(auth.uid(), 'owner'::app_role)));
DROP POLICY IF EXISTS stages_insert ON public.project_stages;
CREATE POLICY stages_insert ON public.project_stages AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((user_can_access_project(auth.uid(), project_id) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'manager'::app_role))));
DROP POLICY IF EXISTS stages_select ON public.project_stages;
CREATE POLICY stages_select ON public.project_stages AS PERMISSIVE FOR SELECT TO authenticated
  USING (user_can_access_project(auth.uid(), project_id));
DROP POLICY IF EXISTS stages_update ON public.project_stages;
CREATE POLICY stages_update ON public.project_stages AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((user_can_access_project(auth.uid(), project_id) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'manager'::app_role))));
DROP POLICY IF EXISTS "Owner manages projects" ON public.projects;
CREATE POLICY "Owner manages projects" ON public.projects AS PERMISSIVE FOR ALL TO authenticated
  USING (((company_id = private.user_company_id(auth.uid())) AND private.has_role(auth.uid(), 'owner'::app_role)))
  WITH CHECK (((company_id = private.user_company_id(auth.uid())) AND private.has_role(auth.uid(), 'owner'::app_role)));
DROP POLICY IF EXISTS "Read projects in company" ON public.projects;
CREATE POLICY "Read projects in company" ON public.projects AS PERMISSIVE FOR SELECT TO authenticated
  USING ((private.user_can_access_project(auth.uid(), id) OR ((company_id = private.user_company_id(auth.uid())) AND private.has_role(auth.uid(), 'warehouse'::app_role))));
DROP POLICY IF EXISTS director_read_assigned_projects ON public.projects;
CREATE POLICY director_read_assigned_projects ON public.projects AS PERMISSIVE FOR SELECT TO authenticated
  USING (private.director_can_read_project(auth.uid(), id));
DROP POLICY IF EXISTS director_readonly_delete ON public.projects;
CREATE POLICY director_readonly_delete ON public.projects AS RESTRICTIVE FOR DELETE TO authenticated
  USING ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_insert ON public.projects;
CREATE POLICY director_readonly_insert ON public.projects AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_update ON public.projects;
CREATE POLICY director_readonly_update ON public.projects AS RESTRICTIVE FOR UPDATE TO authenticated
  USING ((NOT is_director(auth.uid())))
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_read_project ON public.quality_checks;
CREATE POLICY director_read_project ON public.quality_checks AS PERMISSIVE FOR SELECT TO authenticated
  USING (private.director_can_read_project(auth.uid(), project_id));
DROP POLICY IF EXISTS director_readonly_delete ON public.quality_checks;
CREATE POLICY director_readonly_delete ON public.quality_checks AS RESTRICTIVE FOR DELETE TO authenticated
  USING ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_insert ON public.quality_checks;
CREATE POLICY director_readonly_insert ON public.quality_checks AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_update ON public.quality_checks;
CREATE POLICY director_readonly_update ON public.quality_checks AS RESTRICTIVE FOR UPDATE TO authenticated
  USING ((NOT is_director(auth.uid())))
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS quality_checks_select ON public.quality_checks;
CREATE POLICY quality_checks_select ON public.quality_checks AS PERMISSIVE FOR SELECT TO authenticated
  USING (user_can_access_project(auth.uid(), project_id));
DROP POLICY IF EXISTS quality_checks_write ON public.quality_checks;
CREATE POLICY quality_checks_write ON public.quality_checks AS PERMISSIVE FOR ALL TO authenticated
  USING ((user_can_access_project(auth.uid(), project_id) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'manager'::app_role))))
  WITH CHECK ((user_can_access_project(auth.uid(), project_id) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'manager'::app_role))));
DROP POLICY IF EXISTS "Delete resettlements (project access)" ON public.resettlements;
CREATE POLICY "Delete resettlements (project access)" ON public.resettlements AS PERMISSIVE FOR DELETE TO authenticated
  USING (private.user_can_access_project(auth.uid(), project_id));
DROP POLICY IF EXISTS "Insert resettlements (project access)" ON public.resettlements;
CREATE POLICY "Insert resettlements (project access)" ON public.resettlements AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (private.user_can_access_project(auth.uid(), project_id));
DROP POLICY IF EXISTS "Read resettlements via project" ON public.resettlements;
CREATE POLICY "Read resettlements via project" ON public.resettlements AS PERMISSIVE FOR SELECT TO authenticated
  USING (private.user_can_access_project(auth.uid(), project_id));
DROP POLICY IF EXISTS "Update resettlements (project access)" ON public.resettlements;
CREATE POLICY "Update resettlements (project access)" ON public.resettlements AS PERMISSIVE FOR UPDATE TO authenticated
  USING (private.user_can_access_project(auth.uid(), project_id))
  WITH CHECK (private.user_can_access_project(auth.uid(), project_id));
DROP POLICY IF EXISTS director_read_company ON public.resettlements;
CREATE POLICY director_read_company ON public.resettlements AS PERMISSIVE FOR SELECT TO authenticated
  USING ((is_director(auth.uid()) AND (company_id = private.user_company_id(auth.uid()))));
DROP POLICY IF EXISTS director_read_project ON public.resettlements;
CREATE POLICY director_read_project ON public.resettlements AS PERMISSIVE FOR SELECT TO authenticated
  USING (private.director_can_read_project(auth.uid(), project_id));
DROP POLICY IF EXISTS director_readonly_delete ON public.resettlements;
CREATE POLICY director_readonly_delete ON public.resettlements AS RESTRICTIVE FOR DELETE TO authenticated
  USING ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_insert ON public.resettlements;
CREATE POLICY director_readonly_insert ON public.resettlements AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_update ON public.resettlements;
CREATE POLICY director_readonly_update ON public.resettlements AS RESTRICTIVE FOR UPDATE TO authenticated
  USING ((NOT is_director(auth.uid())))
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS company_members_delete_salary_accruals ON public.salary_accruals;
CREATE POLICY company_members_delete_salary_accruals ON public.salary_accruals AS PERMISSIVE FOR DELETE TO authenticated
  USING (((company_id = private.user_company_id(auth.uid())) AND (NOT is_director(auth.uid()))));
DROP POLICY IF EXISTS company_members_select_salary_accruals ON public.salary_accruals;
CREATE POLICY company_members_select_salary_accruals ON public.salary_accruals AS PERMISSIVE FOR SELECT TO authenticated
  USING ((company_id = private.user_company_id(auth.uid())));
DROP POLICY IF EXISTS company_members_update_salary_accruals ON public.salary_accruals;
CREATE POLICY company_members_update_salary_accruals ON public.salary_accruals AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((company_id = private.user_company_id(auth.uid())) AND (NOT is_director(auth.uid()))))
  WITH CHECK (((company_id = private.user_company_id(auth.uid())) AND (NOT is_director(auth.uid()))));
DROP POLICY IF EXISTS company_members_write_salary_accruals ON public.salary_accruals;
CREATE POLICY company_members_write_salary_accruals ON public.salary_accruals AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((company_id = private.user_company_id(auth.uid())) AND (NOT is_director(auth.uid()))));
DROP POLICY IF EXISTS "Insert sales via project" ON public.sales;
CREATE POLICY "Insert sales via project" ON public.sales AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (private.user_can_access_project(auth.uid(), project_id));
DROP POLICY IF EXISTS "Owners delete sales" ON public.sales;
CREATE POLICY "Owners delete sales" ON public.sales AS PERMISSIVE FOR DELETE TO authenticated
  USING ((private.has_role(auth.uid(), 'owner'::app_role) AND private.user_can_access_project(auth.uid(), project_id)));
DROP POLICY IF EXISTS "Read sales via project" ON public.sales;
CREATE POLICY "Read sales via project" ON public.sales AS PERMISSIVE FOR SELECT TO authenticated
  USING (private.user_can_access_project(auth.uid(), project_id));
DROP POLICY IF EXISTS "Update sales via project" ON public.sales;
CREATE POLICY "Update sales via project" ON public.sales AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((private.user_can_access_project(auth.uid(), project_id) AND (private.has_role(auth.uid(), 'owner'::app_role) OR private.has_role(auth.uid(), 'accountant'::app_role))))
  WITH CHECK ((private.user_can_access_project(auth.uid(), project_id) AND (private.has_role(auth.uid(), 'owner'::app_role) OR private.has_role(auth.uid(), 'accountant'::app_role))));
DROP POLICY IF EXISTS director_read_project ON public.sales;
CREATE POLICY director_read_project ON public.sales AS PERMISSIVE FOR SELECT TO authenticated
  USING (private.director_can_read_project(auth.uid(), project_id));
DROP POLICY IF EXISTS director_readonly_delete ON public.sales;
CREATE POLICY director_readonly_delete ON public.sales AS RESTRICTIVE FOR DELETE TO authenticated
  USING ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_insert ON public.sales;
CREATE POLICY director_readonly_insert ON public.sales AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_update ON public.sales;
CREATE POLICY director_readonly_update ON public.sales AS RESTRICTIVE FOR UPDATE TO authenticated
  USING ((NOT is_director(auth.uid())))
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS "company members can read sales team" ON public.sales_team_members;
CREATE POLICY "company members can read sales team" ON public.sales_team_members AS PERMISSIVE FOR SELECT TO authenticated
  USING ((company_id = user_company_id(auth.uid())));
DROP POLICY IF EXISTS director_readonly_delete ON public.sales_team_members;
CREATE POLICY director_readonly_delete ON public.sales_team_members AS RESTRICTIVE FOR DELETE TO authenticated
  USING ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_insert ON public.sales_team_members;
CREATE POLICY director_readonly_insert ON public.sales_team_members AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_update ON public.sales_team_members;
CREATE POLICY director_readonly_update ON public.sales_team_members AS RESTRICTIVE FOR UPDATE TO authenticated
  USING ((NOT is_director(auth.uid())))
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS "member reads own row" ON public.sales_team_members;
CREATE POLICY "member reads own row" ON public.sales_team_members AS PERMISSIVE FOR SELECT TO authenticated
  USING ((user_id = auth.uid()));
DROP POLICY IF EXISTS "team managers manage members" ON public.sales_team_members;
CREATE POLICY "team managers manage members" ON public.sales_team_members AS PERMISSIVE FOR ALL TO authenticated
  USING (((company_id = user_company_id(auth.uid())) AND ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = sales_team_members.company_id) AND (c.owner_user_id = auth.uid())))) OR has_role(auth.uid(), 'owner'::app_role))))
  WITH CHECK (((company_id = user_company_id(auth.uid())) AND ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = sales_team_members.company_id) AND (c.owner_user_id = auth.uid())))) OR has_role(auth.uid(), 'owner'::app_role))));
DROP POLICY IF EXISTS "member reads own payouts" ON public.sales_team_payouts;
CREATE POLICY "member reads own payouts" ON public.sales_team_payouts AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM sales_team_members m
  WHERE ((m.id = sales_team_payouts.member_id) AND (m.user_id = auth.uid())))));
DROP POLICY IF EXISTS "team owner manages payouts" ON public.sales_team_payouts;
CREATE POLICY "team owner manages payouts" ON public.sales_team_payouts AS PERMISSIVE FOR ALL TO authenticated
  USING (((owner_user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = sales_team_payouts.company_id) AND (c.owner_user_id = auth.uid())))) AND (EXISTS ( SELECT 1
   FROM sales_team_members m
  WHERE ((m.id = sales_team_payouts.member_id) AND (m.company_id = sales_team_payouts.company_id))))))
  WITH CHECK (((owner_user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = sales_team_payouts.company_id) AND (c.owner_user_id = auth.uid())))) AND (EXISTS ( SELECT 1
   FROM sales_team_members m
  WHERE ((m.id = sales_team_payouts.member_id) AND (m.company_id = sales_team_payouts.company_id))))));
DROP POLICY IF EXISTS "Scan packages admin write" ON public.scan_credit_packages;
CREATE POLICY "Scan packages admin write" ON public.scan_credit_packages AS PERMISSIVE FOR ALL TO authenticated
  USING (is_platform_admin(auth.uid()))
  WITH CHECK (is_platform_admin(auth.uid()));
DROP POLICY IF EXISTS "Scan packages authenticated read" ON public.scan_credit_packages;
CREATE POLICY "Scan packages authenticated read" ON public.scan_credit_packages AS PERMISSIVE FOR SELECT TO authenticated
  USING ((is_active = true));
DROP POLICY IF EXISTS "Scan purchases admin all" ON public.scan_credit_purchases;
CREATE POLICY "Scan purchases admin all" ON public.scan_credit_purchases AS PERMISSIVE FOR ALL TO authenticated
  USING (is_platform_admin(auth.uid()))
  WITH CHECK (is_platform_admin(auth.uid()));
DROP POLICY IF EXISTS "Scan purchases owner insert" ON public.scan_credit_purchases;
CREATE POLICY "Scan purchases owner insert" ON public.scan_credit_purchases AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((company_id = user_company_id(auth.uid())));
DROP POLICY IF EXISTS "Scan purchases owner read own" ON public.scan_credit_purchases;
CREATE POLICY "Scan purchases owner read own" ON public.scan_credit_purchases AS PERMISSIVE FOR SELECT TO authenticated
  USING ((company_id = user_company_id(auth.uid())));
DROP POLICY IF EXISTS "Platform admins can delete showcase companies" ON public.showcase_companies;
CREATE POLICY "Platform admins can delete showcase companies" ON public.showcase_companies AS PERMISSIVE FOR DELETE TO authenticated
  USING (is_platform_admin(auth.uid()));
DROP POLICY IF EXISTS "Platform admins can insert showcase companies" ON public.showcase_companies;
CREATE POLICY "Platform admins can insert showcase companies" ON public.showcase_companies AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (is_platform_admin(auth.uid()));
DROP POLICY IF EXISTS "Platform admins can update showcase companies" ON public.showcase_companies;
CREATE POLICY "Platform admins can update showcase companies" ON public.showcase_companies AS PERMISSIVE FOR UPDATE TO authenticated
  USING (is_platform_admin(auth.uid()))
  WITH CHECK (is_platform_admin(auth.uid()));
DROP POLICY IF EXISTS "Platform admins can view all showcase companies" ON public.showcase_companies;
CREATE POLICY "Platform admins can view all showcase companies" ON public.showcase_companies AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_platform_admin(auth.uid()));
DROP POLICY IF EXISTS showcase_public_read_active ON public.showcase_companies;
CREATE POLICY showcase_public_read_active ON public.showcase_companies AS PERMISSIVE FOR SELECT TO anon
  USING ((is_active = true));
DROP POLICY IF EXISTS director_read_project ON public.site_incidents;
CREATE POLICY director_read_project ON public.site_incidents AS PERMISSIVE FOR SELECT TO authenticated
  USING (private.director_can_read_project(auth.uid(), project_id));
DROP POLICY IF EXISTS director_readonly_delete ON public.site_incidents;
CREATE POLICY director_readonly_delete ON public.site_incidents AS RESTRICTIVE FOR DELETE TO authenticated
  USING ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_insert ON public.site_incidents;
CREATE POLICY director_readonly_insert ON public.site_incidents AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_update ON public.site_incidents;
CREATE POLICY director_readonly_update ON public.site_incidents AS RESTRICTIVE FOR UPDATE TO authenticated
  USING ((NOT is_director(auth.uid())))
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS site_incidents_select ON public.site_incidents;
CREATE POLICY site_incidents_select ON public.site_incidents AS PERMISSIVE FOR SELECT TO authenticated
  USING (user_can_access_project(auth.uid(), project_id));
DROP POLICY IF EXISTS site_incidents_write ON public.site_incidents;
CREATE POLICY site_incidents_write ON public.site_incidents AS PERMISSIVE FOR ALL TO authenticated
  USING ((user_can_access_project(auth.uid(), project_id) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'manager'::app_role))))
  WITH CHECK ((user_can_access_project(auth.uid(), project_id) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'manager'::app_role))));
DROP POLICY IF EXISTS "Platform admins can delete site plan requests" ON public.site_plan_requests;
CREATE POLICY "Platform admins can delete site plan requests" ON public.site_plan_requests AS PERMISSIVE FOR DELETE TO authenticated
  USING (is_platform_admin(auth.uid()));
DROP POLICY IF EXISTS "Platform admins can read site plan requests" ON public.site_plan_requests;
CREATE POLICY "Platform admins can read site plan requests" ON public.site_plan_requests AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_platform_admin(auth.uid()));
DROP POLICY IF EXISTS "Platform admins can update site plan requests" ON public.site_plan_requests;
CREATE POLICY "Platform admins can update site plan requests" ON public.site_plan_requests AS PERMISSIVE FOR UPDATE TO authenticated
  USING (is_platform_admin(auth.uid()))
  WITH CHECK (is_platform_admin(auth.uid()));
DROP POLICY IF EXISTS "Company members read their sms logs" ON public.sms_logs;
CREATE POLICY "Company members read their sms logs" ON public.sms_logs AS PERMISSIVE FOR SELECT TO authenticated
  USING ((company_id = private.user_company_id(auth.uid())));
DROP POLICY IF EXISTS director_read_company ON public.sms_logs;
CREATE POLICY director_read_company ON public.sms_logs AS PERMISSIVE FOR SELECT TO authenticated
  USING ((is_director(auth.uid()) AND (company_id = private.user_company_id(auth.uid()))));
DROP POLICY IF EXISTS director_readonly_delete ON public.sms_logs;
CREATE POLICY director_readonly_delete ON public.sms_logs AS RESTRICTIVE FOR DELETE TO authenticated
  USING ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_insert ON public.sms_logs;
CREATE POLICY director_readonly_insert ON public.sms_logs AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_update ON public.sms_logs;
CREATE POLICY director_readonly_update ON public.sms_logs AS RESTRICTIVE FOR UPDATE TO authenticated
  USING ((NOT is_director(auth.uid())))
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS stage_tasks_select ON public.stage_tasks;
CREATE POLICY stage_tasks_select ON public.stage_tasks AS PERMISSIVE FOR SELECT TO authenticated
  USING ((company_id = user_company_id(auth.uid())));
DROP POLICY IF EXISTS stage_tasks_write ON public.stage_tasks;
CREATE POLICY stage_tasks_write ON public.stage_tasks AS PERMISSIVE FOR ALL TO authenticated
  USING (((company_id = user_company_id(auth.uid())) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'director'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR user_can_access_project(auth.uid(), project_id))))
  WITH CHECK (((company_id = user_company_id(auth.uid())) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'director'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR user_can_access_project(auth.uid(), project_id))));
DROP POLICY IF EXISTS director_read_project ON public.stage_updates;
CREATE POLICY director_read_project ON public.stage_updates AS PERMISSIVE FOR SELECT TO authenticated
  USING (private.director_can_read_project(auth.uid(), project_id));
DROP POLICY IF EXISTS director_readonly_delete ON public.stage_updates;
CREATE POLICY director_readonly_delete ON public.stage_updates AS RESTRICTIVE FOR DELETE TO authenticated
  USING ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_insert ON public.stage_updates;
CREATE POLICY director_readonly_insert ON public.stage_updates AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_update ON public.stage_updates;
CREATE POLICY director_readonly_update ON public.stage_updates AS RESTRICTIVE FOR UPDATE TO authenticated
  USING ((NOT is_director(auth.uid())))
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS stage_updates_delete ON public.stage_updates;
CREATE POLICY stage_updates_delete ON public.stage_updates AS PERMISSIVE FOR DELETE TO authenticated
  USING ((user_can_access_project(auth.uid(), project_id) AND has_role(auth.uid(), 'owner'::app_role)));
DROP POLICY IF EXISTS stage_updates_insert ON public.stage_updates;
CREATE POLICY stage_updates_insert ON public.stage_updates AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (user_can_access_project(auth.uid(), project_id));
DROP POLICY IF EXISTS stage_updates_select ON public.stage_updates;
CREATE POLICY stage_updates_select ON public.stage_updates AS PERMISSIVE FOR SELECT TO authenticated
  USING (user_can_access_project(auth.uid(), project_id));
DROP POLICY IF EXISTS studio_pub_company_read ON public.studio_publications;
CREATE POLICY studio_pub_company_read ON public.studio_publications AS PERMISSIVE FOR SELECT TO authenticated
  USING ((company_id IN ( SELECT profiles.company_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));
DROP POLICY IF EXISTS studio_pub_owner_write ON public.studio_publications;
CREATE POLICY studio_pub_owner_write ON public.studio_publications AS PERMISSIVE FOR ALL TO authenticated
  USING (((company_id IN ( SELECT profiles.company_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'manager'::app_role))))
  WITH CHECK (((company_id IN ( SELECT profiles.company_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'manager'::app_role))));
DROP POLICY IF EXISTS director_read_via_parent ON public.subcontract_acts;
CREATE POLICY director_read_via_parent ON public.subcontract_acts AS PERMISSIVE FOR SELECT TO authenticated
  USING ((is_director(auth.uid()) AND (EXISTS ( SELECT 1
   FROM subcontract_works w
  WHERE ((w.id = subcontract_acts.work_id) AND private.director_can_read_project(auth.uid(), w.project_id))))));
DROP POLICY IF EXISTS director_readonly_delete ON public.subcontract_acts;
CREATE POLICY director_readonly_delete ON public.subcontract_acts AS RESTRICTIVE FOR DELETE TO authenticated
  USING ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_insert ON public.subcontract_acts;
CREATE POLICY director_readonly_insert ON public.subcontract_acts AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_update ON public.subcontract_acts;
CREATE POLICY director_readonly_update ON public.subcontract_acts AS RESTRICTIVE FOR UPDATE TO authenticated
  USING ((NOT is_director(auth.uid())))
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS subcontract_acts_select ON public.subcontract_acts;
CREATE POLICY subcontract_acts_select ON public.subcontract_acts AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM subcontract_works w
  WHERE ((w.id = subcontract_acts.work_id) AND user_can_access_project(auth.uid(), w.project_id)))));
DROP POLICY IF EXISTS subcontract_acts_write ON public.subcontract_acts;
CREATE POLICY subcontract_acts_write ON public.subcontract_acts AS PERMISSIVE FOR ALL TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM subcontract_works w
  WHERE ((w.id = subcontract_acts.work_id) AND user_can_access_project(auth.uid(), w.project_id)))) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'accountant'::app_role))))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM subcontract_works w
  WHERE ((w.id = subcontract_acts.work_id) AND user_can_access_project(auth.uid(), w.project_id)))) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'accountant'::app_role))));
DROP POLICY IF EXISTS director_read_via_parent ON public.subcontract_payments;
CREATE POLICY director_read_via_parent ON public.subcontract_payments AS PERMISSIVE FOR SELECT TO authenticated
  USING ((is_director(auth.uid()) AND (EXISTS ( SELECT 1
   FROM subcontract_works w
  WHERE ((w.id = subcontract_payments.work_id) AND private.director_can_read_project(auth.uid(), w.project_id))))));
DROP POLICY IF EXISTS director_readonly_delete ON public.subcontract_payments;
CREATE POLICY director_readonly_delete ON public.subcontract_payments AS RESTRICTIVE FOR DELETE TO authenticated
  USING ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_insert ON public.subcontract_payments;
CREATE POLICY director_readonly_insert ON public.subcontract_payments AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_update ON public.subcontract_payments;
CREATE POLICY director_readonly_update ON public.subcontract_payments AS RESTRICTIVE FOR UPDATE TO authenticated
  USING ((NOT is_director(auth.uid())))
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS subcontract_payments_select ON public.subcontract_payments;
CREATE POLICY subcontract_payments_select ON public.subcontract_payments AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM subcontract_works w
  WHERE ((w.id = subcontract_payments.work_id) AND user_can_access_project(auth.uid(), w.project_id)))));
DROP POLICY IF EXISTS subcontract_payments_write ON public.subcontract_payments;
CREATE POLICY subcontract_payments_write ON public.subcontract_payments AS PERMISSIVE FOR ALL TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM subcontract_works w
  WHERE ((w.id = subcontract_payments.work_id) AND user_can_access_project(auth.uid(), w.project_id)))) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'accountant'::app_role))))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM subcontract_works w
  WHERE ((w.id = subcontract_payments.work_id) AND user_can_access_project(auth.uid(), w.project_id)))) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'accountant'::app_role))));
DROP POLICY IF EXISTS director_read_company ON public.subcontract_works;
CREATE POLICY director_read_company ON public.subcontract_works AS PERMISSIVE FOR SELECT TO authenticated
  USING ((is_director(auth.uid()) AND (company_id = private.user_company_id(auth.uid()))));
DROP POLICY IF EXISTS director_read_project ON public.subcontract_works;
CREATE POLICY director_read_project ON public.subcontract_works AS PERMISSIVE FOR SELECT TO authenticated
  USING (private.director_can_read_project(auth.uid(), project_id));
DROP POLICY IF EXISTS director_readonly_delete ON public.subcontract_works;
CREATE POLICY director_readonly_delete ON public.subcontract_works AS RESTRICTIVE FOR DELETE TO authenticated
  USING ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_insert ON public.subcontract_works;
CREATE POLICY director_readonly_insert ON public.subcontract_works AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_update ON public.subcontract_works;
CREATE POLICY director_readonly_update ON public.subcontract_works AS RESTRICTIVE FOR UPDATE TO authenticated
  USING ((NOT is_director(auth.uid())))
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS subcontract_works_select ON public.subcontract_works;
CREATE POLICY subcontract_works_select ON public.subcontract_works AS PERMISSIVE FOR SELECT TO authenticated
  USING (user_can_access_project(auth.uid(), project_id));
DROP POLICY IF EXISTS subcontract_works_write ON public.subcontract_works;
CREATE POLICY subcontract_works_write ON public.subcontract_works AS PERMISSIVE FOR ALL TO authenticated
  USING ((user_can_access_project(auth.uid(), project_id) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'accountant'::app_role))))
  WITH CHECK ((user_can_access_project(auth.uid(), project_id) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'accountant'::app_role))));
DROP POLICY IF EXISTS director_read_company ON public.subcontractors;
CREATE POLICY director_read_company ON public.subcontractors AS PERMISSIVE FOR SELECT TO authenticated
  USING ((is_director(auth.uid()) AND (company_id = private.user_company_id(auth.uid()))));
DROP POLICY IF EXISTS director_readonly_delete ON public.subcontractors;
CREATE POLICY director_readonly_delete ON public.subcontractors AS RESTRICTIVE FOR DELETE TO authenticated
  USING ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_insert ON public.subcontractors;
CREATE POLICY director_readonly_insert ON public.subcontractors AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_update ON public.subcontractors;
CREATE POLICY director_readonly_update ON public.subcontractors AS RESTRICTIVE FOR UPDATE TO authenticated
  USING ((NOT is_director(auth.uid())))
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS subcontractors_company_all ON public.subcontractors;
CREATE POLICY subcontractors_company_all ON public.subcontractors AS PERMISSIVE FOR ALL TO authenticated
  USING ((company_id = user_company_id(auth.uid())))
  WITH CHECK ((company_id = user_company_id(auth.uid())));
DROP POLICY IF EXISTS "Admin updates subscription payments" ON public.subscription_payments;
CREATE POLICY "Admin updates subscription payments" ON public.subscription_payments AS PERMISSIVE FOR UPDATE TO authenticated
  USING (private.is_platform_admin(auth.uid()))
  WITH CHECK (private.is_platform_admin(auth.uid()));
DROP POLICY IF EXISTS "Insert own subscription payment" ON public.subscription_payments;
CREATE POLICY "Insert own subscription payment" ON public.subscription_payments AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((company_id = private.user_company_id(auth.uid())) AND (created_by = auth.uid()) AND (status = 'pending'::text) AND (activated_until IS NULL) AND (reviewed_by IS NULL) AND (reviewed_at IS NULL)));
DROP POLICY IF EXISTS "Read own/admin subscription payments" ON public.subscription_payments;
CREATE POLICY "Read own/admin subscription payments" ON public.subscription_payments AS PERMISSIVE FOR SELECT TO authenticated
  USING ((private.is_platform_admin(auth.uid()) OR (company_id = private.user_company_id(auth.uid()))));
DROP POLICY IF EXISTS director_read_company ON public.subscription_payments;
CREATE POLICY director_read_company ON public.subscription_payments AS PERMISSIVE FOR SELECT TO authenticated
  USING ((is_director(auth.uid()) AND (company_id = private.user_company_id(auth.uid()))));
DROP POLICY IF EXISTS director_readonly_delete ON public.subscription_payments;
CREATE POLICY director_readonly_delete ON public.subscription_payments AS RESTRICTIVE FOR DELETE TO authenticated
  USING ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_insert ON public.subscription_payments;
CREATE POLICY director_readonly_insert ON public.subscription_payments AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_update ON public.subscription_payments;
CREATE POLICY director_readonly_update ON public.subscription_payments AS RESTRICTIVE FOR UPDATE TO authenticated
  USING ((NOT is_director(auth.uid())))
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS "Delete suppliers (owner)" ON public.suppliers;
CREATE POLICY "Delete suppliers (owner)" ON public.suppliers AS PERMISSIVE FOR DELETE TO authenticated
  USING (((company_id = private.user_company_id(auth.uid())) AND private.has_role(auth.uid(), 'owner'::app_role)));
DROP POLICY IF EXISTS "Insert suppliers in company" ON public.suppliers;
CREATE POLICY "Insert suppliers in company" ON public.suppliers AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((company_id = private.user_company_id(auth.uid())) AND (private.has_role(auth.uid(), 'owner'::app_role) OR private.has_role(auth.uid(), 'accountant'::app_role) OR private.has_role(auth.uid(), 'manager'::app_role))));
DROP POLICY IF EXISTS "Read suppliers in company" ON public.suppliers;
CREATE POLICY "Read suppliers in company" ON public.suppliers AS PERMISSIVE FOR SELECT TO authenticated
  USING ((private.is_platform_admin(auth.uid()) OR (company_id = private.user_company_id(auth.uid()))));
DROP POLICY IF EXISTS "Update suppliers in company" ON public.suppliers;
CREATE POLICY "Update suppliers in company" ON public.suppliers AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((company_id = private.user_company_id(auth.uid())) AND (private.has_role(auth.uid(), 'owner'::app_role) OR private.has_role(auth.uid(), 'accountant'::app_role) OR private.has_role(auth.uid(), 'manager'::app_role))))
  WITH CHECK (((company_id = private.user_company_id(auth.uid())) AND (private.has_role(auth.uid(), 'owner'::app_role) OR private.has_role(auth.uid(), 'accountant'::app_role) OR private.has_role(auth.uid(), 'manager'::app_role))));
DROP POLICY IF EXISTS director_read_company ON public.suppliers;
CREATE POLICY director_read_company ON public.suppliers AS PERMISSIVE FOR SELECT TO authenticated
  USING ((is_director(auth.uid()) AND (company_id = private.user_company_id(auth.uid()))));
DROP POLICY IF EXISTS director_readonly_delete ON public.suppliers;
CREATE POLICY director_readonly_delete ON public.suppliers AS RESTRICTIVE FOR DELETE TO authenticated
  USING ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_insert ON public.suppliers;
CREATE POLICY director_readonly_insert ON public.suppliers AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_update ON public.suppliers;
CREATE POLICY director_readonly_update ON public.suppliers AS RESTRICTIVE FOR UPDATE TO authenticated
  USING ((NOT is_director(auth.uid())))
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS "company members delete supply alerts" ON public.supply_alerts;
CREATE POLICY "company members delete supply alerts" ON public.supply_alerts AS PERMISSIVE FOR DELETE TO authenticated
  USING ((company_id = user_company_id(auth.uid())));
DROP POLICY IF EXISTS "company members insert supply alerts" ON public.supply_alerts;
CREATE POLICY "company members insert supply alerts" ON public.supply_alerts AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((company_id = user_company_id(auth.uid())));
DROP POLICY IF EXISTS "company members read supply alerts" ON public.supply_alerts;
CREATE POLICY "company members read supply alerts" ON public.supply_alerts AS PERMISSIVE FOR SELECT TO authenticated
  USING ((company_id = user_company_id(auth.uid())));
DROP POLICY IF EXISTS "company members update supply alerts" ON public.supply_alerts;
CREATE POLICY "company members update supply alerts" ON public.supply_alerts AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((company_id = user_company_id(auth.uid())))
  WITH CHECK ((company_id = user_company_id(auth.uid())));
DROP POLICY IF EXISTS "admin update tickets" ON public.support_tickets;
CREATE POLICY "admin update tickets" ON public.support_tickets AS PERMISSIVE FOR UPDATE TO authenticated
  USING (is_platform_admin(auth.uid()))
  WITH CHECK (is_platform_admin(auth.uid()));
DROP POLICY IF EXISTS "users create their tickets" ON public.support_tickets;
CREATE POLICY "users create their tickets" ON public.support_tickets AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((user_id = auth.uid()));
DROP POLICY IF EXISTS "users read their tickets" ON public.support_tickets;
CREATE POLICY "users read their tickets" ON public.support_tickets AS PERMISSIVE FOR SELECT TO authenticated
  USING (((user_id = auth.uid()) OR is_platform_admin(auth.uid())));
DROP POLICY IF EXISTS "Admin manages tariffs" ON public.tariffs;
CREATE POLICY "Admin manages tariffs" ON public.tariffs AS PERMISSIVE FOR ALL TO authenticated
  USING (private.is_platform_admin(auth.uid()))
  WITH CHECK (private.is_platform_admin(auth.uid()));
DROP POLICY IF EXISTS "Read active tariffs (auth)" ON public.tariffs;
CREATE POLICY "Read active tariffs (auth)" ON public.tariffs AS PERMISSIVE FOR SELECT TO authenticated
  USING ((is_active = true));
DROP POLICY IF EXISTS co_read ON public.tax_reports;
CREATE POLICY co_read ON public.tax_reports AS PERMISSIVE FOR SELECT TO authenticated
  USING (((company_id = user_company_id(auth.uid())) OR is_platform_admin(auth.uid())));
DROP POLICY IF EXISTS co_write ON public.tax_reports;
CREATE POLICY co_write ON public.tax_reports AS PERMISSIVE FOR ALL TO authenticated
  USING (((company_id = user_company_id(auth.uid())) AND has_role(auth.uid(), 'owner'::app_role)))
  WITH CHECK (((company_id = user_company_id(auth.uid())) AND has_role(auth.uid(), 'owner'::app_role)));
DROP POLICY IF EXISTS director_read_company ON public.tax_reports;
CREATE POLICY director_read_company ON public.tax_reports AS PERMISSIVE FOR SELECT TO authenticated
  USING ((is_director(auth.uid()) AND (company_id = private.user_company_id(auth.uid()))));
DROP POLICY IF EXISTS director_readonly_delete ON public.tax_reports;
CREATE POLICY director_readonly_delete ON public.tax_reports AS RESTRICTIVE FOR DELETE TO authenticated
  USING ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_insert ON public.tax_reports;
CREATE POLICY director_readonly_insert ON public.tax_reports AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_update ON public.tax_reports;
CREATE POLICY director_readonly_update ON public.tax_reports AS RESTRICTIVE FOR UPDATE TO authenticated
  USING ((NOT is_director(auth.uid())))
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS "Super Admin manages templates" ON public.tour_templates;
CREATE POLICY "Super Admin manages templates" ON public.tour_templates AS PERMISSIVE FOR ALL TO authenticated
  USING (is_platform_admin(auth.uid()))
  WITH CHECK (is_platform_admin(auth.uid()));
DROP POLICY IF EXISTS "Templates readable by authenticated" ON public.tour_templates;
CREATE POLICY "Templates readable by authenticated" ON public.tour_templates AS PERMISSIVE FOR SELECT TO authenticated
  USING (((is_active = true) OR is_platform_admin(auth.uid())));
DROP POLICY IF EXISTS "Owner/admin write user_roles" ON public.user_roles;
CREATE POLICY "Owner/admin write user_roles" ON public.user_roles AS PERMISSIVE FOR ALL TO authenticated
  USING ((private.is_platform_admin(auth.uid()) OR (private.has_role(auth.uid(), 'owner'::app_role) AND (role <> 'owner'::app_role) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = user_roles.user_id) AND (p.company_id = private.user_company_id(auth.uid()))))))))
  WITH CHECK ((private.is_platform_admin(auth.uid()) OR (private.has_role(auth.uid(), 'owner'::app_role) AND (role <> 'owner'::app_role) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = user_roles.user_id) AND (p.company_id = private.user_company_id(auth.uid()))))))));
DROP POLICY IF EXISTS "Read user_roles" ON public.user_roles;
CREATE POLICY "Read user_roles" ON public.user_roles AS PERMISSIVE FOR SELECT TO authenticated
  USING (((user_id = auth.uid()) OR private.is_platform_admin(auth.uid()) OR (private.has_role(auth.uid(), 'owner'::app_role) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = user_roles.user_id) AND (p.company_id = private.user_company_id(auth.uid()))))))));
DROP POLICY IF EXISTS director_read_roles ON public.user_roles;
CREATE POLICY director_read_roles ON public.user_roles AS PERMISSIVE FOR SELECT TO authenticated
  USING ((is_director(auth.uid()) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = user_roles.user_id) AND (p.company_id = private.user_company_id(auth.uid())))))));
DROP POLICY IF EXISTS "Delete warehouse_issues (company)" ON public.warehouse_issues;
CREATE POLICY "Delete warehouse_issues (company)" ON public.warehouse_issues AS PERMISSIVE FOR DELETE TO authenticated
  USING ((company_id = private.user_company_id(auth.uid())));
DROP POLICY IF EXISTS "Insert warehouse_issues (company)" ON public.warehouse_issues;
CREATE POLICY "Insert warehouse_issues (company)" ON public.warehouse_issues AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((company_id = private.user_company_id(auth.uid())));
DROP POLICY IF EXISTS "Read warehouse_issues (company)" ON public.warehouse_issues;
CREATE POLICY "Read warehouse_issues (company)" ON public.warehouse_issues AS PERMISSIVE FOR SELECT TO authenticated
  USING ((private.is_platform_admin(auth.uid()) OR (company_id = private.user_company_id(auth.uid()))));
DROP POLICY IF EXISTS director_read_company ON public.warehouse_issues;
CREATE POLICY director_read_company ON public.warehouse_issues AS PERMISSIVE FOR SELECT TO authenticated
  USING ((is_director(auth.uid()) AND (company_id = private.user_company_id(auth.uid()))));
DROP POLICY IF EXISTS director_read_project ON public.warehouse_issues;
CREATE POLICY director_read_project ON public.warehouse_issues AS PERMISSIVE FOR SELECT TO authenticated
  USING (private.director_can_read_project(auth.uid(), project_id));
DROP POLICY IF EXISTS director_readonly_delete ON public.warehouse_issues;
CREATE POLICY director_readonly_delete ON public.warehouse_issues AS RESTRICTIVE FOR DELETE TO authenticated
  USING ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_insert ON public.warehouse_issues;
CREATE POLICY director_readonly_insert ON public.warehouse_issues AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_update ON public.warehouse_issues;
CREATE POLICY director_readonly_update ON public.warehouse_issues AS RESTRICTIVE FOR UPDATE TO authenticated
  USING ((NOT is_director(auth.uid())))
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS "Delete warehouse_items (company)" ON public.warehouse_items;
CREATE POLICY "Delete warehouse_items (company)" ON public.warehouse_items AS PERMISSIVE FOR DELETE TO authenticated
  USING ((company_id = private.user_company_id(auth.uid())));
DROP POLICY IF EXISTS "Insert warehouse_items (company)" ON public.warehouse_items;
CREATE POLICY "Insert warehouse_items (company)" ON public.warehouse_items AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((company_id = private.user_company_id(auth.uid())));
DROP POLICY IF EXISTS "Read warehouse_items (company)" ON public.warehouse_items;
CREATE POLICY "Read warehouse_items (company)" ON public.warehouse_items AS PERMISSIVE FOR SELECT TO authenticated
  USING ((private.is_platform_admin(auth.uid()) OR (company_id = private.user_company_id(auth.uid()))));
DROP POLICY IF EXISTS "Update warehouse_items (company)" ON public.warehouse_items;
CREATE POLICY "Update warehouse_items (company)" ON public.warehouse_items AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((company_id = private.user_company_id(auth.uid())))
  WITH CHECK ((company_id = private.user_company_id(auth.uid())));
DROP POLICY IF EXISTS director_read_company ON public.warehouse_items;
CREATE POLICY director_read_company ON public.warehouse_items AS PERMISSIVE FOR SELECT TO authenticated
  USING ((is_director(auth.uid()) AND (company_id = private.user_company_id(auth.uid()))));
DROP POLICY IF EXISTS director_readonly_delete ON public.warehouse_items;
CREATE POLICY director_readonly_delete ON public.warehouse_items AS RESTRICTIVE FOR DELETE TO authenticated
  USING ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_insert ON public.warehouse_items;
CREATE POLICY director_readonly_insert ON public.warehouse_items AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_update ON public.warehouse_items;
CREATE POLICY director_readonly_update ON public.warehouse_items AS RESTRICTIVE FOR UPDATE TO authenticated
  USING ((NOT is_director(auth.uid())))
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS "Delete warehouse_receipts (company)" ON public.warehouse_receipts;
CREATE POLICY "Delete warehouse_receipts (company)" ON public.warehouse_receipts AS PERMISSIVE FOR DELETE TO authenticated
  USING ((company_id = private.user_company_id(auth.uid())));
DROP POLICY IF EXISTS "Insert warehouse_receipts (company)" ON public.warehouse_receipts;
CREATE POLICY "Insert warehouse_receipts (company)" ON public.warehouse_receipts AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((company_id = private.user_company_id(auth.uid())));
DROP POLICY IF EXISTS "Read warehouse_receipts (company)" ON public.warehouse_receipts;
CREATE POLICY "Read warehouse_receipts (company)" ON public.warehouse_receipts AS PERMISSIVE FOR SELECT TO authenticated
  USING ((private.is_platform_admin(auth.uid()) OR (company_id = private.user_company_id(auth.uid()))));
DROP POLICY IF EXISTS "Update warehouse_receipts (company)" ON public.warehouse_receipts;
CREATE POLICY "Update warehouse_receipts (company)" ON public.warehouse_receipts AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((company_id = private.user_company_id(auth.uid())))
  WITH CHECK ((company_id = private.user_company_id(auth.uid())));
DROP POLICY IF EXISTS director_read_company ON public.warehouse_receipts;
CREATE POLICY director_read_company ON public.warehouse_receipts AS PERMISSIVE FOR SELECT TO authenticated
  USING ((is_director(auth.uid()) AND (company_id = private.user_company_id(auth.uid()))));
DROP POLICY IF EXISTS director_readonly_delete ON public.warehouse_receipts;
CREATE POLICY director_readonly_delete ON public.warehouse_receipts AS RESTRICTIVE FOR DELETE TO authenticated
  USING ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_insert ON public.warehouse_receipts;
CREATE POLICY director_readonly_insert ON public.warehouse_receipts AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_update ON public.warehouse_receipts;
CREATE POLICY director_readonly_update ON public.warehouse_receipts AS RESTRICTIVE FOR UPDATE TO authenticated
  USING ((NOT is_director(auth.uid())))
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS wa_accounts_company_select ON public.whatsapp_accounts;
CREATE POLICY wa_accounts_company_select ON public.whatsapp_accounts AS PERMISSIVE FOR SELECT TO authenticated
  USING ((company_id = user_company_id(auth.uid())));
DROP POLICY IF EXISTS wa_accounts_company_write ON public.whatsapp_accounts;
CREATE POLICY wa_accounts_company_write ON public.whatsapp_accounts AS PERMISSIVE FOR ALL TO authenticated
  USING ((company_id = user_company_id(auth.uid())))
  WITH CHECK ((company_id = user_company_id(auth.uid())));
DROP POLICY IF EXISTS wa_chats_company_select ON public.whatsapp_chats;
CREATE POLICY wa_chats_company_select ON public.whatsapp_chats AS PERMISSIVE FOR SELECT TO authenticated
  USING ((company_id = user_company_id(auth.uid())));
DROP POLICY IF EXISTS wa_chats_company_write ON public.whatsapp_chats;
CREATE POLICY wa_chats_company_write ON public.whatsapp_chats AS PERMISSIVE FOR ALL TO authenticated
  USING ((company_id = user_company_id(auth.uid())))
  WITH CHECK ((company_id = user_company_id(auth.uid())));
DROP POLICY IF EXISTS wa_messages_company_select ON public.whatsapp_messages;
CREATE POLICY wa_messages_company_select ON public.whatsapp_messages AS PERMISSIVE FOR SELECT TO authenticated
  USING ((company_id = user_company_id(auth.uid())));
DROP POLICY IF EXISTS wa_messages_company_write ON public.whatsapp_messages;
CREATE POLICY wa_messages_company_write ON public.whatsapp_messages AS PERMISSIVE FOR ALL TO authenticated
  USING ((company_id = user_company_id(auth.uid())))
  WITH CHECK ((company_id = user_company_id(auth.uid())));
DROP POLICY IF EXISTS wa_logs_company_select ON public.whatsapp_webhook_logs;
CREATE POLICY wa_logs_company_select ON public.whatsapp_webhook_logs AS PERMISSIVE FOR SELECT TO authenticated
  USING (((company_id IS NOT NULL) AND (company_id = user_company_id(auth.uid()))));
DROP POLICY IF EXISTS director_read_company ON public.worker_payments;
CREATE POLICY director_read_company ON public.worker_payments AS PERMISSIVE FOR SELECT TO authenticated
  USING ((is_director(auth.uid()) AND (company_id = private.user_company_id(auth.uid()))));
DROP POLICY IF EXISTS director_read_project ON public.worker_payments;
CREATE POLICY director_read_project ON public.worker_payments AS PERMISSIVE FOR SELECT TO authenticated
  USING (private.director_can_read_project(auth.uid(), project_id));
DROP POLICY IF EXISTS director_readonly_delete ON public.worker_payments;
CREATE POLICY director_readonly_delete ON public.worker_payments AS RESTRICTIVE FOR DELETE TO authenticated
  USING ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_insert ON public.worker_payments;
CREATE POLICY director_readonly_insert ON public.worker_payments AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS director_readonly_update ON public.worker_payments;
CREATE POLICY director_readonly_update ON public.worker_payments AS RESTRICTIVE FOR UPDATE TO authenticated
  USING ((NOT is_director(auth.uid())))
  WITH CHECK ((NOT is_director(auth.uid())));
DROP POLICY IF EXISTS wp_select ON public.worker_payments;
CREATE POLICY wp_select ON public.worker_payments AS PERMISSIVE FOR SELECT TO authenticated
  USING ((company_id = user_company_id(auth.uid())));
DROP POLICY IF EXISTS wp_write ON public.worker_payments;
CREATE POLICY wp_write ON public.worker_payments AS PERMISSIVE FOR ALL TO authenticated
  USING (((company_id = user_company_id(auth.uid())) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'accountant'::app_role))))
  WITH CHECK (((company_id = user_company_id(auth.uid())) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'accountant'::app_role))));
DROP POLICY IF EXISTS "Company members can add workers" ON public.workers;
CREATE POLICY "Company members can add workers" ON public.workers AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((COALESCE(((auth.jwt() ->> 'is_anonymous'::text))::boolean, false) = false) AND (company_id = private.user_company_id(auth.uid())) AND (NOT is_director(auth.uid()))));
DROP POLICY IF EXISTS "Company members can delete workers" ON public.workers;
CREATE POLICY "Company members can delete workers" ON public.workers AS PERMISSIVE FOR DELETE TO authenticated
  USING (((COALESCE(((auth.jwt() ->> 'is_anonymous'::text))::boolean, false) = false) AND (company_id = private.user_company_id(auth.uid())) AND (NOT is_director(auth.uid()))));
DROP POLICY IF EXISTS "Company members can update workers" ON public.workers;
CREATE POLICY "Company members can update workers" ON public.workers AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((COALESCE(((auth.jwt() ->> 'is_anonymous'::text))::boolean, false) = false) AND (company_id = private.user_company_id(auth.uid())) AND (NOT is_director(auth.uid()))))
  WITH CHECK (((COALESCE(((auth.jwt() ->> 'is_anonymous'::text))::boolean, false) = false) AND (company_id = private.user_company_id(auth.uid())) AND (NOT is_director(auth.uid()))));
DROP POLICY IF EXISTS "Company members can view workers" ON public.workers;
CREATE POLICY "Company members can view workers" ON public.workers AS PERMISSIVE FOR SELECT TO authenticated
  USING (((COALESCE(((auth.jwt() ->> 'is_anonymous'::text))::boolean, false) = false) AND (company_id = private.user_company_id(auth.uid()))));
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

-- Grants (Data API)
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role;
