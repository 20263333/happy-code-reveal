-- Binosoz: Add scheme_pins to projects table for interactive kiosk & CRM floor plans
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'scheme_pins'
  ) THEN
    ALTER TABLE public.projects ADD COLUMN scheme_pins jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
