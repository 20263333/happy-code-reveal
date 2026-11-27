-- Binosoz: Fix project_staff keys and constraints
DO $$
BEGIN
  -- Ensure id column is populated and not null
  UPDATE public.project_staff SET id = gen_random_uuid() WHERE id IS NULL;
  ALTER TABLE public.project_staff ALTER COLUMN id SET NOT NULL;

  -- Primary key
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'project_staff_pkey'
  ) THEN
    ALTER TABLE public.project_staff ADD CONSTRAINT project_staff_pkey PRIMARY KEY (id);
  END IF;

  -- Deduplicate rows before creating unique constraint
  DELETE FROM public.project_staff a
  USING public.project_staff b
  WHERE a.project_id = b.project_id
    AND a.user_id = b.user_id
    AND a.created_at < b.created_at;

  DELETE FROM public.project_staff a
  USING public.project_staff b
  WHERE a.project_id = b.project_id
    AND a.user_id = b.user_id
    AND a.ctid < b.ctid;

  -- Unique constraint on (project_id, user_id)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'project_staff_project_id_user_id_key'
  ) THEN
    ALTER TABLE public.project_staff ADD CONSTRAINT project_staff_project_id_user_id_key UNIQUE (project_id, user_id);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'project_staff constraint warning: %', SQLERRM;
END $$;

NOTIFY pgrst, 'reload schema';
