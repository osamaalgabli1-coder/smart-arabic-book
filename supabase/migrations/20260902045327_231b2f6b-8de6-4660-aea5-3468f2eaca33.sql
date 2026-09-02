CREATE TABLE public.sync_workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL DEFAULT 'مكتبي',
  owner_device_id text NOT NULL,
  max_devices integer NOT NULL DEFAULT 4,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.sync_workspaces TO service_role;
ALTER TABLE public.sync_workspaces ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.sync_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.sync_workspaces(id) ON DELETE CASCADE,
  device_id text NOT NULL,
  name text NOT NULL DEFAULT 'جهاز',
  platform text NOT NULL DEFAULT 'web',
  status text NOT NULL DEFAULT 'pending',
  is_owner boolean NOT NULL DEFAULT false,
  last_seen timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, device_id)
);

GRANT ALL ON public.sync_devices TO service_role;
ALTER TABLE public.sync_devices ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.sync_snapshots (
  workspace_id uuid PRIMARY KEY REFERENCES public.sync_workspaces(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  version bigint NOT NULL DEFAULT 0,
  updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.sync_snapshots TO service_role;
ALTER TABLE public.sync_snapshots ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER sync_workspaces_touch BEFORE UPDATE ON public.sync_workspaces
  FOR EACH ROW EXECUTE FUNCTION public.wa_touch_updated_at();
CREATE TRIGGER sync_devices_touch BEFORE UPDATE ON public.sync_devices
  FOR EACH ROW EXECUTE FUNCTION public.wa_touch_updated_at();
CREATE TRIGGER sync_snapshots_touch BEFORE UPDATE ON public.sync_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.wa_touch_updated_at();