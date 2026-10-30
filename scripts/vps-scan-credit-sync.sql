-- Data-preserving repair for passport OCR in both the app and kiosk.
BEGIN;

ALTER TABLE public.ai_credits ADD COLUMN IF NOT EXISTS scan_free_limit integer DEFAULT 50;
ALTER TABLE public.ai_credits ADD COLUMN IF NOT EXISTS scan_free_used integer DEFAULT 0;
ALTER TABLE public.ai_credits ADD COLUMN IF NOT EXISTS scan_paid_balance integer DEFAULT 0;
ALTER TABLE public.ai_credits ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Refuse ambiguous balances instead of deleting or merging company records.
CREATE UNIQUE INDEX IF NOT EXISTS ai_credits_company_id_scan_uidx
  ON public.ai_credits(company_id);
GRANT SELECT, INSERT, UPDATE ON public.ai_credits TO service_role;

CREATE OR REPLACE FUNCTION public.consume_scan_credit(_company_id uuid)
RETURNS TABLE(scan_free_limit integer, scan_free_used integer, paid_balance integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  r public.ai_credits%ROWTYPE;
BEGIN
  IF _company_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.companies WHERE id = _company_id
  ) THEN
    RAISE EXCEPTION 'company_not_found';
  END IF;

  INSERT INTO public.ai_credits(company_id) VALUES (_company_id)
  ON CONFLICT (company_id) DO NOTHING;

  SELECT ac.* INTO r FROM public.ai_credits AS ac
  WHERE ac.company_id = _company_id FOR UPDATE;

  IF r.scan_free_used < r.scan_free_limit THEN
    UPDATE public.ai_credits AS ac
    SET scan_free_used = ac.scan_free_used + 1, updated_at = now()
    WHERE ac.company_id = _company_id RETURNING ac.* INTO r;
  ELSIF COALESCE(r.scan_paid_balance, 0) > 0 THEN
    UPDATE public.ai_credits AS ac
    SET scan_paid_balance = ac.scan_paid_balance - 1, updated_at = now()
    WHERE ac.company_id = _company_id RETURNING ac.* INTO r;
  ELSE
    RAISE EXCEPTION 'no_scan_credits';
  END IF;

  RETURN QUERY SELECT r.scan_free_limit, r.scan_free_used, r.scan_paid_balance;
END;
$function$;

-- Only the authenticated app/kiosk server may charge a company.
REVOKE ALL ON FUNCTION public.consume_scan_credit(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_scan_credit(uuid) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;