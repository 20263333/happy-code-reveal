CREATE TABLE public.wappi_webhook_events (delivery_id text PRIMARY KEY,payload jsonb NOT NULL,normalized_event jsonb NOT NULL,company_id uuid,received_at timestamptz NOT NULL DEFAULT now(),processed_at timestamptz,retry_at timestamptz NOT NULL DEFAULT now(),processing_error text);
GRANT ALL ON public.wappi_webhook_events TO service_role;
ALTER TABLE public.wappi_webhook_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX wappi_events_pending ON public.wappi_webhook_events(retry_at) WHERE processed_at IS NULL;
CREATE OR REPLACE FUNCTION public.process_wappi_event(_delivery_id text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE inbox public.wappi_webhook_events%ROWTYPE; e jsonb; tenant uuid; profile text; customer uuid; chat uuid; msg uuid; moment timestamptz; result text:='message_saved'; old_status text;
BEGIN
 SELECT * INTO inbox FROM public.wappi_webhook_events WHERE delivery_id=_delivery_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'missing_receipt'; END IF;
 IF inbox.processed_at IS NOT NULL THEN RETURN jsonb_build_object('ok',true,'result','duplicate_skipped'); END IF;
 e:=inbox.normalized_event; profile:=nullif(e->>'profileId','');
 IF profile IS NOT NULL THEN
  IF (SELECT count(*) FROM public.whatsapp_accounts WHERE profile_id=profile AND enabled IS TRUE)=1 THEN SELECT company_id INTO tenant FROM public.whatsapp_accounts WHERE profile_id=profile AND enabled IS TRUE; END IF;
 ELSE
  IF (SELECT count(*) FROM public.whatsapp_accounts WHERE enabled IS TRUE)=1 THEN SELECT company_id,profile_id INTO tenant,profile FROM public.whatsapp_accounts WHERE enabled IS TRUE; END IF;
 END IF;
 IF tenant IS NULL THEN UPDATE public.wappi_webhook_events SET processing_error='unmapped_profile',retry_at=now()+interval '1 minute' WHERE delivery_id=_delivery_id; RETURN jsonb_build_object('ok',false,'result','unmapped_profile'); END IF;
 UPDATE public.wappi_webhook_events SET company_id=tenant WHERE delivery_id=_delivery_id;
 PERFORM pg_advisory_xact_lock(hashtextextended(tenant::text,0));
 moment:=(e->>'sentAt')::timestamptz;
 IF e->>'kind'='status' THEN
  SELECT id,status INTO msg,old_status FROM public.whatsapp_messages WHERE company_id=tenant AND wappi_message_id=e->>'messageId' ORDER BY created_at LIMIT 1;
  IF msg IS NULL THEN UPDATE public.wappi_webhook_events SET processing_error='status_pending',retry_at=now()+interval '1 minute' WHERE delivery_id=_delivery_id; RETURN jsonb_build_object('ok',true,'result','status_pending'); END IF;
  IF e->>'status' IN ('sent','delivered','read','failed') AND (CASE old_status WHEN 'read' THEN 3 WHEN 'delivered' THEN 2 WHEN 'sent' THEN 1 ELSE 0 END)<=(CASE e->>'status' WHEN 'read' THEN 3 WHEN 'delivered' THEN 2 WHEN 'sent' THEN 1 ELSE 0 END) THEN UPDATE public.whatsapp_messages SET status=e->>'status' WHERE id=msg AND company_id=tenant; END IF;
  result:='status_updated';
 ELSIF e->>'kind' NOT IN ('incoming','outgoing') OR nullif(e->>'phone','') IS NULL THEN result:='ignored';
 ELSE
  SELECT id INTO msg FROM public.whatsapp_messages WHERE company_id=tenant AND wappi_message_id=e->>'messageId' ORDER BY created_at LIMIT 1;
  IF msg IS NOT NULL THEN result:='duplicate_skipped';
  ELSE
   SELECT id INTO customer FROM public.customers WHERE company_id=tenant AND right(regexp_replace(coalesce(phone,''),'[^0-9]','','g'),9)=right(e->>'phone',9) ORDER BY created_at,id LIMIT 1;
   IF customer IS NULL AND e->>'kind'='incoming' THEN INSERT INTO public.customers(company_id,fullname,phone,status,funnel_stage,source) VALUES(tenant,coalesce(nullif(e->>'senderName',''),'WhatsApp +'||(e->>'phone')),'+'||(e->>'phone'),'new','lead','whatsapp') RETURNING id INTO customer; END IF;
   SELECT id INTO chat FROM public.whatsapp_chats WHERE company_id=tenant AND chat_id=coalesce(e->>'chatId',(e->>'phone')||'@c.us') ORDER BY created_at,id LIMIT 1;
   IF chat IS NULL THEN INSERT INTO public.whatsapp_chats(company_id,profile_id,chat_id,phone,display_name,customer_id,avatar_url) VALUES(tenant,profile,coalesce(e->>'chatId',(e->>'phone')||'@c.us'),e->>'phone',e->>'senderName',customer,e->>'avatarUrl') RETURNING id INTO chat;
   ELSE UPDATE public.whatsapp_chats SET customer_id=coalesce(customer_id,customer),display_name=coalesce(display_name,e->>'senderName') WHERE id=chat AND company_id=tenant; END IF;
   IF e->>'kind'='outgoing' AND nullif(e->>'messageId','') IS NOT NULL THEN SELECT id INTO msg FROM public.whatsapp_messages WHERE company_id=tenant AND chat_id=chat AND direction='outgoing' AND wappi_message_id IS NULL AND status='pending' AND body=coalesce(e->>'text','') ORDER BY created_at DESC LIMIT 1; END IF;
   IF msg IS NOT NULL THEN UPDATE public.whatsapp_messages SET wappi_message_id=e->>'messageId',status=coalesce(e->>'status','sent') WHERE id=msg AND company_id=tenant;
   ELSE INSERT INTO public.whatsapp_messages(company_id,chat_id,customer_id,direction,body,message_type,media_url,media_meta,wappi_message_id,status,sent_at,raw) VALUES(tenant,chat,customer,e->>'kind',e->>'text',e->>'messageType',e->>'mediaUrl',nullif(e->'mediaMeta','null'::jsonb),e->>'messageId',CASE WHEN e->>'kind'='incoming' THEN 'delivered' ELSE coalesce(e->>'status','sent') END,moment,inbox.payload); END IF;
   UPDATE public.whatsapp_chats SET last_message_text=CASE WHEN last_message_at IS NULL OR last_message_at<=moment THEN coalesce(e->>'text',CASE WHEN e->>'mediaUrl' IS NOT NULL THEN 'Файл' END) ELSE last_message_text END,last_direction=CASE WHEN last_message_at IS NULL OR last_message_at<=moment THEN e->>'kind' ELSE last_direction END,unread_count=CASE WHEN e->>'kind'='incoming' THEN coalesce(unread_count,0)+1 WHEN last_message_at IS NULL OR last_message_at<=moment THEN 0 ELSE unread_count END,last_message_at=greatest(last_message_at,moment) WHERE id=chat AND company_id=tenant;
  END IF;
 END IF;
 UPDATE public.wappi_webhook_events SET processed_at=now(),processing_error=NULL WHERE delivery_id=_delivery_id;
 INSERT INTO public.whatsapp_webhook_logs(company_id,event,level,message) VALUES(tenant,e->>'kind','info',result);
 RETURN jsonb_build_object('ok',true,'result',result);
EXCEPTION WHEN OTHERS THEN
 UPDATE public.wappi_webhook_events SET processing_error=SQLSTATE,retry_at=now()+interval '1 minute' WHERE delivery_id=_delivery_id;
 RETURN jsonb_build_object('ok',false,'result','processing_failed','code',SQLSTATE);
END;
$$;
CREATE OR REPLACE FUNCTION public.receive_wappi_event(_delivery_id text,_payload jsonb,_event jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF length(_delivery_id)<>64 OR jsonb_typeof(_payload)<>'object' OR jsonb_typeof(_event)<>'object' THEN RAISE EXCEPTION 'invalid_event'; END IF;
 INSERT INTO public.wappi_webhook_events(delivery_id,payload,normalized_event) VALUES(_delivery_id,_payload,_event) ON CONFLICT(delivery_id) DO NOTHING;
 RETURN public.process_wappi_event(_delivery_id);
END;
$$;
CREATE OR REPLACE FUNCTION public.recover_wappi_events(_limit integer DEFAULT 10) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE row record; recovered integer:=0; outcome jsonb;
BEGIN
 FOR row IN SELECT delivery_id FROM public.wappi_webhook_events WHERE processed_at IS NULL AND retry_at<=now() ORDER BY retry_at,received_at LIMIT least(greatest(_limit,1),10) FOR UPDATE SKIP LOCKED LOOP
  outcome:=public.process_wappi_event(row.delivery_id);
  IF outcome->>'ok'='true' AND outcome->>'result'<>'status_pending' THEN recovered:=recovered+1; END IF;
 END LOOP;
 RETURN recovered;
END;
$$;
REVOKE ALL ON FUNCTION public.process_wappi_event(text),public.receive_wappi_event(text,jsonb,jsonb),public.recover_wappi_events(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.process_wappi_event(text),public.receive_wappi_event(text,jsonb,jsonb),public.recover_wappi_events(integer) TO service_role;
NOTIFY pgrst,'reload schema';