-- Storage buckets + policies synced from Lovable Cloud
-- Иҷро: docker exec -i --user root supabase-db psql -U supabase_admin -d postgres -f ...
INSERT INTO storage.buckets (id, name, public, file_size_limit) VALUES ('invoices','invoices','f',NULL), ('receipts','receipts','f',NULL), ('subscription-receipts','subscription-receipts','f',NULL), ('payable-docs','payable-docs','f',NULL), ('customer-docs','customer-docs','f',NULL), ('estimate-docs','estimate-docs','f',NULL), ('resettlement-docs','resettlement-docs','f',NULL), ('barter-docs','barter-docs','f',NULL), ('notification-media','notification-media','f',NULL), ('apartment-plans','apartment-plans','f',NULL), ('customer-passports','customer-passports','f',NULL), ('project-covers','project-covers','f',NULL), ('apartment-tours','apartment-tours','f',NULL), ('hidden-work-acts','hidden-work-acts','f',NULL), ('permits','permits','f',NULL), ('tax-reports','tax-reports','f',NULL), ('project-3d-models','project-3d-models','f',NULL), ('showcase-logos','showcase-logos','f',NULL), ('app-logos','app-logos','f',NULL), ('contract-templates','contract-templates','f',NULL), ('construction-photos','construction-photos','f',20971520), ('warehouse-docs','warehouse-docs','f',10485760), ('worker-faces','worker-faces','f',10485760) ON CONFLICT (id) DO UPDATE SET public=EXCLUDED.public, file_size_limit=EXCLUDED.file_size_limit;
DROP POLICY IF EXISTS "3d models: company read" ON storage.objects;
CREATE POLICY "3d models: company read" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'project-3d-models'::text) AND (private.is_platform_admin(auth.uid()) OR ((storage.foldername(name))[1] = (private.user_company_id(auth.uid()))::text))));
DROP POLICY IF EXISTS "3d models: owner delete" ON storage.objects;
CREATE POLICY "3d models: owner delete" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'project-3d-models'::text) AND has_role(auth.uid(), 'owner'::app_role) AND ((storage.foldername(name))[1] = (private.user_company_id(auth.uid()))::text)));
DROP POLICY IF EXISTS "3d models: owner insert" ON storage.objects;
CREATE POLICY "3d models: owner insert" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'project-3d-models'::text) AND has_role(auth.uid(), 'owner'::app_role) AND ((storage.foldername(name))[1] = (private.user_company_id(auth.uid()))::text)));
DROP POLICY IF EXISTS "3d models: owner update" ON storage.objects;
CREATE POLICY "3d models: owner update" ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated USING (((bucket_id = 'project-3d-models'::text) AND has_role(auth.uid(), 'owner'::app_role) AND ((storage.foldername(name))[1] = (private.user_company_id(auth.uid()))::text))) WITH CHECK (((bucket_id = 'project-3d-models'::text) AND has_role(auth.uid(), 'owner'::app_role) AND ((storage.foldername(name))[1] = (private.user_company_id(auth.uid()))::text)));
DROP POLICY IF EXISTS "Admin manages subscription receipts" ON storage.objects;
CREATE POLICY "Admin manages subscription receipts" ON storage.objects AS PERMISSIVE FOR ALL TO authenticated USING (((bucket_id = 'subscription-receipts'::text) AND private.is_platform_admin(auth.uid()))) WITH CHECK (((bucket_id = 'subscription-receipts'::text) AND private.is_platform_admin(auth.uid())));
DROP POLICY IF EXISTS "Admins delete notification media" ON storage.objects;
CREATE POLICY "Admins delete notification media" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'notification-media'::text) AND private.is_platform_admin(auth.uid())));
DROP POLICY IF EXISTS "Admins update notification media" ON storage.objects;
CREATE POLICY "Admins update notification media" ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated USING (((bucket_id = 'notification-media'::text) AND private.is_platform_admin(auth.uid())));
DROP POLICY IF EXISTS "Admins upload notification media" ON storage.objects;
CREATE POLICY "Admins upload notification media" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'notification-media'::text) AND private.is_platform_admin(auth.uid())));
DROP POLICY IF EXISTS "Company members delete apartment tours" ON storage.objects;
CREATE POLICY "Company members delete apartment tours" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'apartment-tours'::text) AND (private.is_platform_admin(auth.uid()) OR ((private.user_company_id(auth.uid()))::text = split_part(name, '/'::text, 1)))));
DROP POLICY IF EXISTS "Company members read apartment tours" ON storage.objects;
CREATE POLICY "Company members read apartment tours" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'apartment-tours'::text) AND (private.is_platform_admin(auth.uid()) OR ((private.user_company_id(auth.uid()))::text = split_part(name, '/'::text, 1)))));
DROP POLICY IF EXISTS "Company members upload apartment tours" ON storage.objects;
CREATE POLICY "Company members upload apartment tours" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'apartment-tours'::text) AND ((user_company_id(auth.uid()))::text = split_part(name, '/'::text, 1))));
DROP POLICY IF EXISTS "Delete barter-docs (project access)" ON storage.objects;
CREATE POLICY "Delete barter-docs (project access)" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'barter-docs'::text) AND private.user_can_access_project(auth.uid(), (NULLIF((storage.foldername(name))[1], ''::text))::uuid)));
DROP POLICY IF EXISTS "Delete resettlement-docs (project access)" ON storage.objects;
CREATE POLICY "Delete resettlement-docs (project access)" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'resettlement-docs'::text) AND private.user_can_access_project(auth.uid(), (NULLIF((storage.foldername(name))[1], ''::text))::uuid)));
DROP POLICY IF EXISTS "Estimate docs delete by project access" ON storage.objects;
CREATE POLICY "Estimate docs delete by project access" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'estimate-docs'::text) AND private.user_can_access_project(auth.uid(), (NULLIF((storage.foldername(name))[1], ''::text))::uuid)));
DROP POLICY IF EXISTS "Estimate docs read by project access" ON storage.objects;
CREATE POLICY "Estimate docs read by project access" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'estimate-docs'::text) AND private.user_can_access_project(auth.uid(), (NULLIF((storage.foldername(name))[1], ''::text))::uuid)));
DROP POLICY IF EXISTS "Estimate docs update by project access" ON storage.objects;
CREATE POLICY "Estimate docs update by project access" ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated USING (((bucket_id = 'estimate-docs'::text) AND private.user_can_access_project(auth.uid(), (NULLIF((storage.foldername(name))[1], ''::text))::uuid))) WITH CHECK (((bucket_id = 'estimate-docs'::text) AND private.user_can_access_project(auth.uid(), (NULLIF((storage.foldername(name))[1], ''::text))::uuid)));
DROP POLICY IF EXISTS "Estimate docs upload by project access" ON storage.objects;
CREATE POLICY "Estimate docs upload by project access" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'estimate-docs'::text) AND private.user_can_access_project(auth.uid(), (NULLIF((storage.foldername(name))[1], ''::text))::uuid)));
DROP POLICY IF EXISTS "Owner delete invoices" ON storage.objects;
CREATE POLICY "Owner delete invoices" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'invoices'::text) AND private.has_role(auth.uid(), 'owner'::app_role) AND private.user_can_access_project(auth.uid(), (NULLIF((storage.foldername(name))[1], ''::text))::uuid)));
DROP POLICY IF EXISTS "Owner reads own subscription receipt" ON storage.objects;
CREATE POLICY "Owner reads own subscription receipt" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'subscription-receipts'::text) AND (((storage.foldername(name))[1] = (private.user_company_id(auth.uid()))::text) OR private.is_platform_admin(auth.uid()))));
DROP POLICY IF EXISTS "Owner uploads subscription receipt" ON storage.objects;
CREATE POLICY "Owner uploads subscription receipt" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'subscription-receipts'::text) AND ((storage.foldername(name))[1] = (private.user_company_id(auth.uid()))::text)));
DROP POLICY IF EXISTS "Owner/accountant update invoices" ON storage.objects;
CREATE POLICY "Owner/accountant update invoices" ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated USING (((bucket_id = 'invoices'::text) AND (private.has_role(auth.uid(), 'owner'::app_role) OR private.has_role(auth.uid(), 'accountant'::app_role)) AND private.user_can_access_project(auth.uid(), (NULLIF((storage.foldername(name))[1], ''::text))::uuid))) WITH CHECK (((bucket_id = 'invoices'::text) AND (private.has_role(auth.uid(), 'owner'::app_role) OR private.has_role(auth.uid(), 'accountant'::app_role)) AND private.user_can_access_project(auth.uid(), (NULLIF((storage.foldername(name))[1], ''::text))::uuid)));
DROP POLICY IF EXISTS "Owner/accountant upload invoices" ON storage.objects;
CREATE POLICY "Owner/accountant upload invoices" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'invoices'::text) AND (private.has_role(auth.uid(), 'owner'::app_role) OR private.has_role(auth.uid(), 'accountant'::app_role)) AND private.user_can_access_project(auth.uid(), (NULLIF((storage.foldername(name))[1], ''::text))::uuid)));
DROP POLICY IF EXISTS "Owners and admins read notification media" ON storage.objects;
CREATE POLICY "Owners and admins read notification media" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'notification-media'::text) AND (private.is_platform_admin(auth.uid()) OR private.has_role(auth.uid(), 'owner'::app_role))));
DROP POLICY IF EXISTS "Read barter-docs (project access)" ON storage.objects;
CREATE POLICY "Read barter-docs (project access)" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'barter-docs'::text) AND private.user_can_access_project(auth.uid(), (NULLIF((storage.foldername(name))[1], ''::text))::uuid)));
DROP POLICY IF EXISTS "Read resettlement-docs (project access)" ON storage.objects;
CREATE POLICY "Read resettlement-docs (project access)" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'resettlement-docs'::text) AND private.user_can_access_project(auth.uid(), (NULLIF((storage.foldername(name))[1], ''::text))::uuid)));
DROP POLICY IF EXISTS "Receipts delete by owner" ON storage.objects;
CREATE POLICY "Receipts delete by owner" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'receipts'::text) AND private.has_role(auth.uid(), 'owner'::app_role) AND private.user_can_access_project(auth.uid(), (NULLIF((storage.foldername(name))[1], ''::text))::uuid)));
DROP POLICY IF EXISTS "Receipts insert by owner/accountant" ON storage.objects;
CREATE POLICY "Receipts insert by owner/accountant" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'receipts'::text) AND (private.has_role(auth.uid(), 'owner'::app_role) OR private.has_role(auth.uid(), 'accountant'::app_role)) AND private.user_can_access_project(auth.uid(), (NULLIF((storage.foldername(name))[1], ''::text))::uuid)));
DROP POLICY IF EXISTS "Receipts read by project access" ON storage.objects;
CREATE POLICY "Receipts read by project access" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'receipts'::text) AND private.user_can_access_project(auth.uid(), (NULLIF((storage.foldername(name))[1], ''::text))::uuid)));
DROP POLICY IF EXISTS "Receipts update by owner/accountant" ON storage.objects;
CREATE POLICY "Receipts update by owner/accountant" ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated USING (((bucket_id = 'receipts'::text) AND (private.has_role(auth.uid(), 'owner'::app_role) OR private.has_role(auth.uid(), 'accountant'::app_role)) AND private.user_can_access_project(auth.uid(), (NULLIF((storage.foldername(name))[1], ''::text))::uuid))) WITH CHECK (((bucket_id = 'receipts'::text) AND (private.has_role(auth.uid(), 'owner'::app_role) OR private.has_role(auth.uid(), 'accountant'::app_role)) AND private.user_can_access_project(auth.uid(), (NULLIF((storage.foldername(name))[1], ''::text))::uuid)));
DROP POLICY IF EXISTS "Restricted read invoices" ON storage.objects;
CREATE POLICY "Restricted read invoices" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'invoices'::text) AND (private.has_role(auth.uid(), 'owner'::app_role) OR private.has_role(auth.uid(), 'accountant'::app_role) OR private.user_can_access_project(auth.uid(), (NULLIF((storage.foldername(name))[1], ''::text))::uuid))));
DROP POLICY IF EXISTS "Update barter-docs (project access)" ON storage.objects;
CREATE POLICY "Update barter-docs (project access)" ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated USING (((bucket_id = 'barter-docs'::text) AND private.user_can_access_project(auth.uid(), (NULLIF((storage.foldername(name))[1], ''::text))::uuid)));
DROP POLICY IF EXISTS "Update resettlement-docs (project access)" ON storage.objects;
CREATE POLICY "Update resettlement-docs (project access)" ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated USING (((bucket_id = 'resettlement-docs'::text) AND private.user_can_access_project(auth.uid(), (NULLIF((storage.foldername(name))[1], ''::text))::uuid)));
DROP POLICY IF EXISTS "Upload barter-docs (project access)" ON storage.objects;
CREATE POLICY "Upload barter-docs (project access)" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'barter-docs'::text) AND private.user_can_access_project(auth.uid(), (NULLIF((storage.foldername(name))[1], ''::text))::uuid)));
DROP POLICY IF EXISTS "Upload resettlement-docs (project access)" ON storage.objects;
CREATE POLICY "Upload resettlement-docs (project access)" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'resettlement-docs'::text) AND private.user_can_access_project(auth.uid(), (NULLIF((storage.foldername(name))[1], ''::text))::uuid)));
DROP POLICY IF EXISTS "Warehouse docs: company insert" ON storage.objects;
CREATE POLICY "Warehouse docs: company insert" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'warehouse-docs'::text) AND ((storage.foldername(name))[1] = (private.user_company_id(auth.uid()))::text)));
DROP POLICY IF EXISTS "Warehouse docs: company read" ON storage.objects;
CREATE POLICY "Warehouse docs: company read" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'warehouse-docs'::text) AND (private.is_platform_admin(auth.uid()) OR ((storage.foldername(name))[1] = (private.user_company_id(auth.uid()))::text))));
DROP POLICY IF EXISTS "Warehouse docs: owner delete" ON storage.objects;
CREATE POLICY "Warehouse docs: owner delete" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'warehouse-docs'::text) AND (private.is_platform_admin(auth.uid()) OR (private.has_role(auth.uid(), 'owner'::app_role) AND ((storage.foldername(name))[1] = (private.user_company_id(auth.uid()))::text)))));
DROP POLICY IF EXISTS apartment_plans_delete_scoped ON storage.objects;
CREATE POLICY apartment_plans_delete_scoped ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'apartment-plans'::text) AND private.user_can_access_project(auth.uid(), ((storage.foldername(name))[1])::uuid)));
DROP POLICY IF EXISTS apartment_plans_insert_scoped ON storage.objects;
CREATE POLICY apartment_plans_insert_scoped ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'apartment-plans'::text) AND private.user_can_access_project(auth.uid(), ((storage.foldername(name))[1])::uuid)));
DROP POLICY IF EXISTS apartment_plans_select_scoped ON storage.objects;
CREATE POLICY apartment_plans_select_scoped ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'apartment-plans'::text) AND private.user_can_access_project(auth.uid(), ((storage.foldername(name))[1])::uuid)));
DROP POLICY IF EXISTS apartment_plans_update_scoped ON storage.objects;
CREATE POLICY apartment_plans_update_scoped ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated USING (((bucket_id = 'apartment-plans'::text) AND private.user_can_access_project(auth.uid(), ((storage.foldername(name))[1])::uuid))) WITH CHECK (((bucket_id = 'apartment-plans'::text) AND private.user_can_access_project(auth.uid(), ((storage.foldername(name))[1])::uuid)));
DROP POLICY IF EXISTS "app_logos admin delete" ON storage.objects;
CREATE POLICY "app_logos admin delete" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'app-logos'::text) AND private.is_platform_admin(auth.uid())));
DROP POLICY IF EXISTS "app_logos admin read" ON storage.objects;
CREATE POLICY "app_logos admin read" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'app-logos'::text) AND private.is_platform_admin(auth.uid())));
DROP POLICY IF EXISTS "app_logos admin update" ON storage.objects;
CREATE POLICY "app_logos admin update" ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated USING (((bucket_id = 'app-logos'::text) AND private.is_platform_admin(auth.uid())));
DROP POLICY IF EXISTS "app_logos admin write" ON storage.objects;
CREATE POLICY "app_logos admin write" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'app-logos'::text) AND private.is_platform_admin(auth.uid())));
DROP POLICY IF EXISTS co_hwa_delete ON storage.objects;
CREATE POLICY co_hwa_delete ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'hidden-work-acts'::text) AND ((storage.foldername(name))[1] = (private.user_company_id(auth.uid()))::text) AND ((owner = auth.uid()) OR (EXISTS ( SELECT 1
   FROM hidden_work_acts h
  WHERE ((h.file_path = objects.name) AND (h.company_id = private.user_company_id(auth.uid()))))))));
DROP POLICY IF EXISTS co_hwa_read ON storage.objects;
CREATE POLICY co_hwa_read ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'hidden-work-acts'::text) AND ((storage.foldername(name))[1] = (private.user_company_id(auth.uid()))::text) AND ((owner = auth.uid()) OR (EXISTS ( SELECT 1
   FROM hidden_work_acts h
  WHERE ((h.file_path = objects.name) AND (h.company_id = private.user_company_id(auth.uid()))))))));
DROP POLICY IF EXISTS co_hwa_write ON storage.objects;
CREATE POLICY co_hwa_write ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'hidden-work-acts'::text) AND ((storage.foldername(name))[1] = (user_company_id(auth.uid()))::text)));
DROP POLICY IF EXISTS co_permits_delete ON storage.objects;
CREATE POLICY co_permits_delete ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'permits'::text) AND ((storage.foldername(name))[1] = (private.user_company_id(auth.uid()))::text) AND ((owner = auth.uid()) OR (EXISTS ( SELECT 1
   FROM permits p
  WHERE ((p.file_path = objects.name) AND (p.company_id = private.user_company_id(auth.uid()))))))));
DROP POLICY IF EXISTS co_permits_read ON storage.objects;
CREATE POLICY co_permits_read ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'permits'::text) AND ((storage.foldername(name))[1] = (private.user_company_id(auth.uid()))::text) AND ((owner = auth.uid()) OR (EXISTS ( SELECT 1
   FROM permits p
  WHERE ((p.file_path = objects.name) AND (p.company_id = private.user_company_id(auth.uid()))))))));
DROP POLICY IF EXISTS co_permits_write ON storage.objects;
CREATE POLICY co_permits_write ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'permits'::text) AND ((storage.foldername(name))[1] = (user_company_id(auth.uid()))::text)));
DROP POLICY IF EXISTS co_tax_delete ON storage.objects;
CREATE POLICY co_tax_delete ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'tax-reports'::text) AND ((storage.foldername(name))[1] = (private.user_company_id(auth.uid()))::text) AND private.has_role(auth.uid(), 'owner'::app_role) AND ((owner = auth.uid()) OR (EXISTS ( SELECT 1
   FROM tax_reports t
  WHERE ((t.file_path = objects.name) AND (t.company_id = private.user_company_id(auth.uid()))))))));
DROP POLICY IF EXISTS co_tax_read ON storage.objects;
CREATE POLICY co_tax_read ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'tax-reports'::text) AND ((storage.foldername(name))[1] = (private.user_company_id(auth.uid()))::text) AND ((owner = auth.uid()) OR (EXISTS ( SELECT 1
   FROM tax_reports t
  WHERE ((t.file_path = objects.name) AND (t.company_id = private.user_company_id(auth.uid()))))))));
DROP POLICY IF EXISTS co_tax_write ON storage.objects;
CREATE POLICY co_tax_write ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'tax-reports'::text) AND ((storage.foldername(name))[1] = (user_company_id(auth.uid()))::text) AND has_role(auth.uid(), 'owner'::app_role)));
DROP POLICY IF EXISTS contract_tpl_delete ON storage.objects;
CREATE POLICY contract_tpl_delete ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'contract-templates'::text) AND ((storage.foldername(name))[1] = (user_company_id(auth.uid()))::text) AND has_role(auth.uid(), 'owner'::app_role)));
DROP POLICY IF EXISTS contract_tpl_read ON storage.objects;
CREATE POLICY contract_tpl_read ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'contract-templates'::text) AND ((storage.foldername(name))[1] = (user_company_id(auth.uid()))::text)));
DROP POLICY IF EXISTS contract_tpl_update ON storage.objects;
CREATE POLICY contract_tpl_update ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated USING (((bucket_id = 'contract-templates'::text) AND ((storage.foldername(name))[1] = (user_company_id(auth.uid()))::text) AND has_role(auth.uid(), 'owner'::app_role)));
DROP POLICY IF EXISTS contract_tpl_write ON storage.objects;
CREATE POLICY contract_tpl_write ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'contract-templates'::text) AND ((storage.foldername(name))[1] = (user_company_id(auth.uid()))::text) AND has_role(auth.uid(), 'owner'::app_role)));
DROP POLICY IF EXISTS cphotos_delete ON storage.objects;
CREATE POLICY cphotos_delete ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'construction-photos'::text) AND ((storage.foldername(name))[1] = (user_company_id(auth.uid()))::text) AND (is_platform_admin(auth.uid()) OR is_director(auth.uid()) OR (EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.owner_user_id = auth.uid()) AND ((c.id)::text = (storage.foldername(c.name))[1])))))));
DROP POLICY IF EXISTS cphotos_insert ON storage.objects;
CREATE POLICY cphotos_insert ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'construction-photos'::text) AND ((storage.foldername(name))[1] = (user_company_id(auth.uid()))::text)));
DROP POLICY IF EXISTS cphotos_read ON storage.objects;
CREATE POLICY cphotos_read ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'construction-photos'::text) AND (((storage.foldername(name))[1] = (user_company_id(auth.uid()))::text) OR is_platform_admin(auth.uid()))));
DROP POLICY IF EXISTS "customer-docs delete only platform admin" ON storage.objects;
CREATE POLICY "customer-docs delete only platform admin" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'customer-docs'::text) AND private.is_platform_admin(auth.uid())));
DROP POLICY IF EXISTS "customer-docs insert for company members" ON storage.objects;
CREATE POLICY "customer-docs insert for company members" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'customer-docs'::text) AND (private.is_platform_admin(auth.uid()) OR (EXISTS ( SELECT 1
   FROM customers c
  WHERE ((c.id = (NULLIF((storage.foldername(objects.name))[1], ''::text))::uuid) AND (c.company_id = private.user_company_id(auth.uid()))))))));
DROP POLICY IF EXISTS "customer-docs read for company members" ON storage.objects;
CREATE POLICY "customer-docs read for company members" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'customer-docs'::text) AND (private.is_platform_admin(auth.uid()) OR (EXISTS ( SELECT 1
   FROM customers c
  WHERE ((c.id = (NULLIF((storage.foldername(objects.name))[1], ''::text))::uuid) AND (c.company_id = private.user_company_id(auth.uid()))))))));
DROP POLICY IF EXISTS "customer-docs update for company members" ON storage.objects;
CREATE POLICY "customer-docs update for company members" ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated USING (((bucket_id = 'customer-docs'::text) AND (private.is_platform_admin(auth.uid()) OR (EXISTS ( SELECT 1
   FROM customers c
  WHERE ((c.id = (NULLIF((storage.foldername(objects.name))[1], ''::text))::uuid) AND (c.company_id = private.user_company_id(auth.uid())))))))) WITH CHECK (((bucket_id = 'customer-docs'::text) AND (private.is_platform_admin(auth.uid()) OR (EXISTS ( SELECT 1
   FROM customers c
  WHERE ((c.id = (NULLIF((storage.foldername(objects.name))[1], ''::text))::uuid) AND (c.company_id = private.user_company_id(auth.uid()))))))));
DROP POLICY IF EXISTS customer_passports_company_delete ON storage.objects;
CREATE POLICY customer_passports_company_delete ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'customer-passports'::text) AND (private.is_platform_admin(auth.uid()) OR ((storage.foldername(name))[1] = (private.user_company_id(auth.uid()))::text))));
DROP POLICY IF EXISTS customer_passports_company_insert ON storage.objects;
CREATE POLICY customer_passports_company_insert ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'customer-passports'::text) AND (private.is_platform_admin(auth.uid()) OR ((storage.foldername(name))[1] = (private.user_company_id(auth.uid()))::text))));
DROP POLICY IF EXISTS customer_passports_company_select ON storage.objects;
CREATE POLICY customer_passports_company_select ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'customer-passports'::text) AND (private.is_platform_admin(auth.uid()) OR ((storage.foldername(name))[1] = (private.user_company_id(auth.uid()))::text))));
DROP POLICY IF EXISTS customer_passports_company_update ON storage.objects;
CREATE POLICY customer_passports_company_update ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated USING (((bucket_id = 'customer-passports'::text) AND (private.is_platform_admin(auth.uid()) OR ((storage.foldername(name))[1] = (private.user_company_id(auth.uid()))::text)))) WITH CHECK (((bucket_id = 'customer-passports'::text) AND (private.is_platform_admin(auth.uid()) OR ((storage.foldername(name))[1] = (private.user_company_id(auth.uid()))::text))));
DROP POLICY IF EXISTS "payable-docs delete" ON storage.objects;
CREATE POLICY "payable-docs delete" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'payable-docs'::text) AND private.user_can_access_project(auth.uid(), (NULLIF((storage.foldername(name))[1], ''::text))::uuid)));
DROP POLICY IF EXISTS "payable-docs insert" ON storage.objects;
CREATE POLICY "payable-docs insert" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'payable-docs'::text) AND private.user_can_access_project(auth.uid(), (NULLIF((storage.foldername(name))[1], ''::text))::uuid)));
DROP POLICY IF EXISTS "payable-docs read" ON storage.objects;
CREATE POLICY "payable-docs read" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'payable-docs'::text) AND private.user_can_access_project(auth.uid(), (NULLIF((storage.foldername(name))[1], ''::text))::uuid)));
DROP POLICY IF EXISTS "payable-docs update" ON storage.objects;
CREATE POLICY "payable-docs update" ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated USING (((bucket_id = 'payable-docs'::text) AND private.user_can_access_project(auth.uid(), (NULLIF((storage.foldername(name))[1], ''::text))::uuid))) WITH CHECK (((bucket_id = 'payable-docs'::text) AND private.user_can_access_project(auth.uid(), (NULLIF((storage.foldername(name))[1], ''::text))::uuid)));
DROP POLICY IF EXISTS project_covers_company_delete ON storage.objects;
CREATE POLICY project_covers_company_delete ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'project-covers'::text) AND (private.is_platform_admin(auth.uid()) OR ((private.user_company_id(auth.uid()))::text = (storage.foldername(name))[1]))));
DROP POLICY IF EXISTS project_covers_company_insert ON storage.objects;
CREATE POLICY project_covers_company_insert ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'project-covers'::text) AND (private.is_platform_admin(auth.uid()) OR ((private.user_company_id(auth.uid()))::text = (storage.foldername(name))[1]))));
DROP POLICY IF EXISTS project_covers_company_select ON storage.objects;
CREATE POLICY project_covers_company_select ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'project-covers'::text) AND (private.is_platform_admin(auth.uid()) OR ((private.user_company_id(auth.uid()))::text = (storage.foldername(name))[1]))));
DROP POLICY IF EXISTS project_covers_company_update ON storage.objects;
CREATE POLICY project_covers_company_update ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated USING (((bucket_id = 'project-covers'::text) AND (private.is_platform_admin(auth.uid()) OR ((private.user_company_id(auth.uid()))::text = (storage.foldername(name))[1]))));
DROP POLICY IF EXISTS "showcase_logos admin delete" ON storage.objects;
CREATE POLICY "showcase_logos admin delete" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'showcase-logos'::text) AND private.is_platform_admin(auth.uid())));
DROP POLICY IF EXISTS "showcase_logos admin read" ON storage.objects;
CREATE POLICY "showcase_logos admin read" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'showcase-logos'::text) AND private.is_platform_admin(auth.uid())));
DROP POLICY IF EXISTS "showcase_logos admin update" ON storage.objects;
CREATE POLICY "showcase_logos admin update" ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated USING (((bucket_id = 'showcase-logos'::text) AND private.is_platform_admin(auth.uid())));
DROP POLICY IF EXISTS "showcase_logos admin write" ON storage.objects;
CREATE POLICY "showcase_logos admin write" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'showcase-logos'::text) AND private.is_platform_admin(auth.uid())));
DROP POLICY IF EXISTS worker_faces_delete_owner_admin ON storage.objects;
CREATE POLICY worker_faces_delete_owner_admin ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'worker-faces'::text) AND (is_platform_admin(auth.uid()) OR ((split_part(name, '/'::text, 1))::uuid = user_company_id(auth.uid())))));
DROP POLICY IF EXISTS worker_faces_insert_owner_admin ON storage.objects;
CREATE POLICY worker_faces_insert_owner_admin ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'worker-faces'::text) AND (is_platform_admin(auth.uid()) OR ((split_part(name, '/'::text, 1))::uuid = user_company_id(auth.uid())))));
DROP POLICY IF EXISTS worker_faces_select_owner_admin_kiosk ON storage.objects;
CREATE POLICY worker_faces_select_owner_admin_kiosk ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'worker-faces'::text) AND (is_platform_admin(auth.uid()) OR ((split_part(name, '/'::text, 1))::uuid = user_company_id(auth.uid())) OR has_kiosk_access(auth.uid(), (split_part(name, '/'::text, 1))::uuid))));
