CREATE TABLE public.notification_relay_settings (
 user_id uuid PRIMARY KEY,
 url text NOT NULL,
 encrypted_api_key text NOT NULL,
 auth_header text NOT NULL DEFAULT 'Authorization',
 enabled boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_relay_settings TO authenticated;
GRANT ALL ON public.notification_relay_settings TO service_role;
ALTER TABLE public.notification_relay_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages notification relay" ON public.notification_relay_settings FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TABLE public.notification_relay_attempts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL,
 event_id text NOT NULL,
 status text NOT NULL,
 http_status integer,
 error text,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.notification_relay_attempts TO authenticated;
GRANT ALL ON public.notification_relay_attempts TO service_role;
ALTER TABLE public.notification_relay_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads notification attempts" ON public.notification_relay_attempts FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Owner records notification attempts" ON public.notification_relay_attempts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE INDEX notification_attempts_owner_date ON public.notification_relay_attempts(user_id, created_at DESC);