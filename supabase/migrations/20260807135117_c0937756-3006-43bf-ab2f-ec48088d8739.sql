CREATE TABLE public.wa_config (
  id TEXT PRIMARY KEY DEFAULT 'default',
  enabled BOOLEAN NOT NULL DEFAULT false,
  phone_number_id TEXT,
  business_account_id TEXT,
  access_token TEXT,
  api_version TEXT NOT NULL DEFAULT 'v21.0',
  webhook_verify_token TEXT,
  default_template TEXT,
  default_lang TEXT NOT NULL DEFAULT 'ar',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.wa_config TO service_role;
ALTER TABLE public.wa_config ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.wa_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT NOT NULL,
  client_name TEXT,
  phone TEXT,
  group_id TEXT,
  group_link TEXT,
  notify_whatsapp BOOLEAN NOT NULL DEFAULT true,
  notify_group BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_id)
);
GRANT ALL ON public.wa_recipients TO service_role;
ALTER TABLE public.wa_recipients ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.wa_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT,
  client_name TEXT,
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  kind TEXT NOT NULL DEFAULT 'notification',
  ref_number TEXT,
  to_phone TEXT,
  group_id TEXT,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  provider_message_id TEXT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX wa_messages_created_at_idx ON public.wa_messages (created_at DESC);
CREATE INDEX wa_messages_client_idx ON public.wa_messages (client_id);
CREATE INDEX wa_messages_provider_idx ON public.wa_messages (provider_message_id);
GRANT ALL ON public.wa_messages TO service_role;
ALTER TABLE public.wa_messages ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.wa_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT,
  provider_message_id TEXT,
  from_phone TEXT,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX wa_events_created_at_idx ON public.wa_events (created_at DESC);
GRANT ALL ON public.wa_events TO service_role;
ALTER TABLE public.wa_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.wa_touch_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER wa_config_touch BEFORE UPDATE ON public.wa_config FOR EACH ROW EXECUTE FUNCTION public.wa_touch_updated_at();
CREATE TRIGGER wa_recipients_touch BEFORE UPDATE ON public.wa_recipients FOR EACH ROW EXECUTE FUNCTION public.wa_touch_updated_at();
CREATE TRIGGER wa_messages_touch BEFORE UPDATE ON public.wa_messages FOR EACH ROW EXECUTE FUNCTION public.wa_touch_updated_at();

INSERT INTO public.wa_config (id) VALUES ('default') ON CONFLICT (id) DO NOTHING;