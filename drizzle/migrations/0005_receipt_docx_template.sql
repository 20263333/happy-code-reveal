ALTER TABLE public.contract_templates ADD COLUMN IF NOT EXISTS docx_receipt_path text;
NOTIFY pgrst,'reload schema';