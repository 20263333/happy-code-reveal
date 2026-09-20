CREATE TABLE public.site_plan_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_code text NOT NULL,
  business_type text NOT NULL,
  full_name text NOT NULL,
  company_name text NOT NULL,
  job_title text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  locale text NOT NULL DEFAULT 'tg',
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT site_plan_requests_plan_code_check CHECK (plan_code IN ('construction', 'construction_sales', 'premium_unlimited')),
  CONSTRAINT site_plan_requests_business_type_check CHECK (business_type IN ('developer', 'management', 'other')),
  CONSTRAINT site_plan_requests_locale_check CHECK (locale IN ('tg', 'ru', 'en')),
  CONSTRAINT site_plan_requests_status_check CHECK (status IN ('new', 'in_progress', 'completed'))
);

GRANT SELECT, UPDATE, DELETE ON public.site_plan_requests TO authenticated;
GRANT ALL ON public.site_plan_requests TO service_role;

ALTER TABLE public.site_plan_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can read site plan requests"
ON public.site_plan_requests
FOR SELECT
TO authenticated
USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can update site plan requests"
ON public.site_plan_requests
FOR UPDATE
TO authenticated
USING (public.is_platform_admin(auth.uid()))
WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins can delete site plan requests"
ON public.site_plan_requests
FOR DELETE
TO authenticated
USING (public.is_platform_admin(auth.uid()));

CREATE TRIGGER site_plan_requests_set_updated_at
BEFORE UPDATE ON public.site_plan_requests
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX site_plan_requests_status_created_idx
ON public.site_plan_requests (status, created_at DESC);