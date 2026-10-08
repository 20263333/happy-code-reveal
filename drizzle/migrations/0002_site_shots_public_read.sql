DROP POLICY IF EXISTS "platform_settings public keys read" ON public.platform_settings;
CREATE POLICY "platform_settings public keys read" ON public.platform_settings FOR SELECT TO anon, authenticated
USING (key = ANY (ARRAY['demo_enabled'::text, 'social_links'::text, 'app_logos'::text, 'site_shots'::text]));