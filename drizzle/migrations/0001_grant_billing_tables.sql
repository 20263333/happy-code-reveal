GRANT SELECT, INSERT, UPDATE, DELETE ON public.tariffs TO authenticated;
GRANT ALL ON public.tariffs TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_methods TO authenticated;
GRANT ALL ON public.payment_methods TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_payments TO authenticated;
GRANT ALL ON public.subscription_payments TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_change_requests TO authenticated;
GRANT ALL ON public.company_change_requests TO service_role;