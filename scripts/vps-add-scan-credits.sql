-- Бахшидани 1000 скан кредити ройгон барои ширкатҳо (давраи озмоишӣ / муваққатӣ)
BEGIN;

UPDATE public.ai_credits
SET scan_paid_balance = COALESCE(scan_paid_balance, 0) + 1000,
    scan_free_limit = 1000,
    updated_at = now();

INSERT INTO public.ai_credits (company_id, scan_free_limit, scan_free_used, scan_paid_balance)
SELECT id, 1000, 0, 1000
FROM public.companies
ON CONFLICT (company_id) DO UPDATE
SET scan_paid_balance = public.ai_credits.scan_paid_balance + 1000,
    scan_free_limit = 1000,
    updated_at = now();

COMMIT;
