-- Binosoz: Fix RLS policies for contract_templates and storage bucket contract-templates

-- 1. Helper function grants and owner-fallback
CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id AND role = _role
    )
    OR (_role = 'owner'::public.app_role AND EXISTS (
      SELECT 1 FROM public.companies WHERE owner_user_id = _user_id
    ))
  )
$$;

GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role, anon;

-- Ensure public wrapper exists and is granted
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT private.has_role(_user_id, _role);
$$;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.user_company_id(uuid) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION private.user_company_id(uuid) TO authenticated, service_role, anon;

-- 2. Fix contract_templates table RLS policies
DROP POLICY IF EXISTS "Company members read contract template" ON public.contract_templates;
CREATE POLICY "Company members read contract template" ON public.contract_templates AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    company_id = private.user_company_id(auth.uid()) OR
    EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.owner_user_id = auth.uid()) OR
    private.is_platform_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Owner inserts contract template" ON public.contract_templates;
CREATE POLICY "Owner inserts contract template" ON public.contract_templates AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
    private.is_platform_admin(auth.uid()) OR
    (
      (company_id = private.user_company_id(auth.uid()) OR EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.owner_user_id = auth.uid()))
      AND (private.has_role(auth.uid(), 'owner'::app_role) OR EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.owner_user_id = auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Owner updates contract template" ON public.contract_templates;
CREATE POLICY "Owner updates contract template" ON public.contract_templates AS PERMISSIVE FOR UPDATE TO authenticated
  USING (
    private.is_platform_admin(auth.uid()) OR
    (
      (company_id = private.user_company_id(auth.uid()) OR EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.owner_user_id = auth.uid()))
      AND (private.has_role(auth.uid(), 'owner'::app_role) OR EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.owner_user_id = auth.uid()))
    )
  )
  WITH CHECK (
    private.is_platform_admin(auth.uid()) OR
    (
      (company_id = private.user_company_id(auth.uid()) OR EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.owner_user_id = auth.uid()))
      AND (private.has_role(auth.uid(), 'owner'::app_role) OR EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.owner_user_id = auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Owner deletes contract template" ON public.contract_templates;
CREATE POLICY "Owner deletes contract template" ON public.contract_templates AS PERMISSIVE FOR DELETE TO authenticated
  USING (
    private.is_platform_admin(auth.uid()) OR
    (
      (company_id = private.user_company_id(auth.uid()) OR EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.owner_user_id = auth.uid()))
      AND (private.has_role(auth.uid(), 'owner'::app_role) OR EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.owner_user_id = auth.uid()))
    )
  );

-- 3. Fix storage.objects RLS policies for contract-templates bucket
DROP POLICY IF EXISTS contract_tpl_write ON storage.objects;
CREATE POLICY contract_tpl_write ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
    (bucket_id = 'contract-templates'::text) AND (
      private.is_platform_admin(auth.uid()) OR
      ((storage.foldername(name))[1] = (private.user_company_id(auth.uid()))::text) OR
      EXISTS (
        SELECT 1 FROM public.companies c
        WHERE c.id::text = (storage.foldername(name))[1] AND c.owner_user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS contract_tpl_update ON storage.objects;
CREATE POLICY contract_tpl_update ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated
  USING (
    (bucket_id = 'contract-templates'::text) AND (
      private.is_platform_admin(auth.uid()) OR
      ((storage.foldername(name))[1] = (private.user_company_id(auth.uid()))::text) OR
      EXISTS (
        SELECT 1 FROM public.companies c
        WHERE c.id::text = (storage.foldername(name))[1] AND c.owner_user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS contract_tpl_delete ON storage.objects;
CREATE POLICY contract_tpl_delete ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated
  USING (
    (bucket_id = 'contract-templates'::text) AND (
      private.is_platform_admin(auth.uid()) OR
      ((storage.foldername(name))[1] = (private.user_company_id(auth.uid()))::text) OR
      EXISTS (
        SELECT 1 FROM public.companies c
        WHERE c.id::text = (storage.foldername(name))[1] AND c.owner_user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS contract_tpl_read ON storage.objects;
CREATE POLICY contract_tpl_read ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    (bucket_id = 'contract-templates'::text) AND (
      private.is_platform_admin(auth.uid()) OR
      ((storage.foldername(name))[1] = (private.user_company_id(auth.uid()))::text) OR
      EXISTS (
        SELECT 1 FROM public.companies c
        WHERE c.id::text = (storage.foldername(name))[1] AND c.owner_user_id = auth.uid()
      )
    )
  );


-- 4. Deduplicate and ensure constraints on contract_templates
DO $$
BEGIN
  -- Ensure id column is populated and not null
  UPDATE public.contract_templates SET id = gen_random_uuid() WHERE id IS NULL;
  ALTER TABLE public.contract_templates ALTER COLUMN id SET NOT NULL;

  -- Primary key
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contract_templates_pkey'
  ) THEN
    ALTER TABLE public.contract_templates ADD CONSTRAINT contract_templates_pkey PRIMARY KEY (id);
  END IF;

  -- Deduplicate: keep the newest record per company_id
  DELETE FROM public.contract_templates a
  USING public.contract_templates b
  WHERE a.company_id = b.company_id
    AND a.created_at < b.created_at;

  DELETE FROM public.contract_templates a
  USING public.contract_templates b
  WHERE a.company_id = b.company_id
    AND a.ctid < b.ctid;

  -- Unique constraint on company_id
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contract_templates_company_id_key'
  ) THEN
    ALTER TABLE public.contract_templates ADD CONSTRAINT contract_templates_company_id_key UNIQUE (company_id);
  END IF;

  -- Foreign key
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contract_templates_company_id_fkey'
  ) THEN
    ALTER TABLE public.contract_templates ADD CONSTRAINT contract_templates_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Constraint setup warning: %', SQLERRM;
END $$;

NOTIFY pgrst, 'reload schema';
