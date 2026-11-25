BEGIN;
CREATE TABLE IF NOT EXISTS public.ai_action_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  tool_name text NOT NULL,
  arguments jsonb NOT NULL,
  preview jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','executing','completed','cancelled','failed')),
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 minutes'),
  completed_at timestamptz
);
GRANT SELECT ON public.ai_action_requests TO authenticated;
GRANT ALL ON public.ai_action_requests TO service_role;
ALTER TABLE public.ai_action_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ai_actions_read_own ON public.ai_action_requests;
CREATE POLICY ai_actions_read_own ON public.ai_action_requests FOR SELECT TO authenticated
USING (user_id = auth.uid() AND EXISTS (
  SELECT 1 FROM public.companies c WHERE c.id = company_id
    AND (c.owner_user_id = auth.uid() OR (public.has_role(auth.uid(), 'owner')
      AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.company_id = c.id)))
));
CREATE INDEX IF NOT EXISTS ai_actions_user_pending ON public.ai_action_requests (user_id, company_id, status, created_at);

-- The browser cannot supply arbitrary SQL or bypass the authenticated client's RLS.
CREATE OR REPLACE FUNCTION public.ai_apply_apartment_updates(_company_id uuid, _updates jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $$
DECLARE r jsonb; a public.apartments; n integer; project_ids uuid[];
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.companies c WHERE c.id = _company_id
      AND (c.owner_user_id = auth.uid() OR (public.has_role(auth.uid(), 'owner')
        AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.company_id = c.id)))
  ) THEN RAISE EXCEPTION 'Дастрасӣ манъ аст'; END IF;
  IF jsonb_typeof(_updates) <> 'array' OR jsonb_array_length(_updates) NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION 'Рӯйхати тағйирот нодуруст аст';
  END IF;
  IF (SELECT count(*) FROM jsonb_array_elements(_updates)) <> (SELECT count(DISTINCT x->>'id') FROM jsonb_array_elements(_updates) x) THEN
    RAISE EXCEPTION 'Як хона ду бор интихоб шудааст';
  END IF;
  SELECT array_agg(DISTINCT ap.project_id) INTO project_ids FROM public.apartments ap
  JOIN public.projects p ON p.id = ap.project_id AND p.company_id = _company_id
  WHERE ap.id IN (SELECT (x->>'id')::uuid FROM jsonb_array_elements(_updates) x);
  -- Serialize renumbering within a block; lock rows in stable order.
  PERFORM 1 FROM public.projects WHERE id = ANY(project_ids) ORDER BY id FOR UPDATE;
  PERFORM 1 FROM public.apartments WHERE project_id = ANY(project_ids) ORDER BY id FOR UPDATE;
  FOR r IN SELECT value FROM jsonb_array_elements(_updates) LOOP
    IF EXISTS (SELECT 1 FROM jsonb_object_keys(r) k WHERE k NOT IN ('id','apartment_number','area','price','rooms','before'))
      OR NOT r ? 'before' OR jsonb_typeof(r->'before') <> 'object' THEN RAISE EXCEPTION 'Майдон иҷозат надорад'; END IF;
    IF NOT ((r->'before') ?& ARRAY['apartment_number','area','price','rooms','price_per_sqm']) THEN
      RAISE EXCEPTION 'Маълумоти пешина нопурра аст'; END IF;
    SELECT ap.* INTO a FROM public.apartments ap JOIN public.projects p ON p.id = ap.project_id
      WHERE ap.id = (r->>'id')::uuid AND p.company_id = _company_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Хона ба ширкати шумо тааллуқ надорад'; END IF;
    IF EXISTS (SELECT 1 FROM jsonb_each(r->'before') b WHERE to_jsonb(a)->b.key IS DISTINCT FROM b.value) THEN
      RAISE EXCEPTION 'Маълумот баъди пешниҳод тағйир ёфт. Дархостро дубора фиристед'; END IF;
    IF r ? 'apartment_number' AND (jsonb_typeof(r->'apartment_number') <> 'string' OR length(trim(r->>'apartment_number')) NOT BETWEEN 1 AND 30) THEN
      RAISE EXCEPTION 'Рақами хона нодуруст аст'; END IF;
    IF r ? 'area' AND (jsonb_typeof(r->'area') <> 'number' OR (r->>'area')::numeric <= 0) THEN RAISE EXCEPTION 'Масоҳат бояд аз сифр зиёд бошад'; END IF;
    IF r ? 'price' AND (jsonb_typeof(r->'price') <> 'number' OR (r->>'price')::numeric < 0) THEN RAISE EXCEPTION 'Нарх нодуруст аст'; END IF;
    IF r ? 'rooms' AND (jsonb_typeof(r->'rooms') <> 'number' OR (r->>'rooms')::numeric NOT BETWEEN 0 AND 30 OR (r->>'rooms')::numeric <> trunc((r->>'rooms')::numeric)) THEN RAISE EXCEPTION 'Шумораи ҳуҷраҳо нодуруст аст'; END IF;
  END LOOP;
  IF EXISTS (
    SELECT 1 FROM public.apartments ap
    LEFT JOIN jsonb_array_elements(_updates) u ON ap.id = (u->>'id')::uuid
    WHERE ap.project_id = ANY(project_ids)
    GROUP BY ap.project_id, COALESCE(trim(u->>'apartment_number'), ap.apartment_number)
    HAVING count(*) > 1 AND bool_or(u ? 'apartment_number')
  ) THEN RAISE EXCEPTION 'Дар блок рақами такрории хона пайдо мешавад'; END IF;
  -- Temporary unique numbers make swaps safe if a VPS adds a uniqueness constraint.
  UPDATE public.apartments ap SET apartment_number = 'AI-' || ap.id::text
    FROM jsonb_array_elements(_updates) u WHERE ap.id = (u->>'id')::uuid AND u ? 'apartment_number';
  UPDATE public.apartments ap SET
    apartment_number = COALESCE(trim(u->>'apartment_number'), ap.apartment_number),
    area = COALESCE((u->>'area')::numeric, ap.area),
    price = COALESCE((u->>'price')::numeric, ap.price),
    rooms = COALESCE((u->>'rooms')::integer, ap.rooms),
    price_per_sqm = CASE WHEN u ? 'area' OR u ? 'price'
      THEN round(COALESCE((u->>'price')::numeric, ap.price) / COALESCE((u->>'area')::numeric, ap.area), 2)
      ELSE ap.price_per_sqm END
    FROM jsonb_array_elements(_updates) u WHERE ap.id = (u->>'id')::uuid;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN jsonb_build_object('ok',true,'updated',n);
END;
$$;
REVOKE ALL ON FUNCTION public.ai_apply_apartment_updates(uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ai_apply_apartment_updates(uuid,jsonb) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;