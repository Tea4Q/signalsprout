-- Account-level insights snapshots + top-content cards

CREATE TABLE IF NOT EXISTS public.account_insight_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  social_account_id uuid NOT NULL REFERENCES public.social_accounts(id) ON DELETE CASCADE,
  platform public.platform_type NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  captured_date date NOT NULL DEFAULT timezone('utc', now())::date,
  views bigint NOT NULL DEFAULT 0,
  accounts_reached bigint NOT NULL DEFAULT 0,
  followers_views bigint,
  non_followers_views bigint,
  posts_views bigint,
  stories_views bigint,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT account_insight_snapshots_unique_per_day UNIQUE (social_account_id, captured_date)
);

CREATE INDEX IF NOT EXISTS account_insight_snapshots_workspace_idx
  ON public.account_insight_snapshots (workspace_id, captured_at DESC);

CREATE TABLE IF NOT EXISTS public.account_top_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  social_account_id uuid NOT NULL REFERENCES public.social_accounts(id) ON DELETE CASCADE,
  snapshot_id uuid NOT NULL REFERENCES public.account_insight_snapshots(id) ON DELETE CASCADE,
  platform public.platform_type NOT NULL,
  external_media_id text NOT NULL,
  media_type text,
  title text,
  thumbnail_url text,
  permalink text,
  posted_at timestamptz,
  views bigint NOT NULL DEFAULT 0,
  rank smallint,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT account_top_content_unique_media_per_snapshot UNIQUE (snapshot_id, external_media_id)
);

CREATE INDEX IF NOT EXISTS account_top_content_workspace_views_idx
  ON public.account_top_content (workspace_id, views DESC);

ALTER TABLE public.account_insight_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_top_content ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "account_insight_snapshots_workspace_member_select" ON public.account_insight_snapshots;
CREATE POLICY "account_insight_snapshots_workspace_member_select"
  ON public.account_insight_snapshots
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT wm.workspace_id
      FROM public.workspace_members wm
      WHERE wm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "account_insight_snapshots_workspace_member_manage" ON public.account_insight_snapshots;
CREATE POLICY "account_insight_snapshots_workspace_member_manage"
  ON public.account_insight_snapshots
  FOR ALL
  USING (
    workspace_id IN (
      SELECT wm.workspace_id
      FROM public.workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin', 'editor')
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT wm.workspace_id
      FROM public.workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin', 'editor')
    )
  );

DROP POLICY IF EXISTS "account_top_content_workspace_member_select" ON public.account_top_content;
CREATE POLICY "account_top_content_workspace_member_select"
  ON public.account_top_content
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT wm.workspace_id
      FROM public.workspace_members wm
      WHERE wm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "account_top_content_workspace_member_manage" ON public.account_top_content;
CREATE POLICY "account_top_content_workspace_member_manage"
  ON public.account_top_content
  FOR ALL
  USING (
    workspace_id IN (
      SELECT wm.workspace_id
      FROM public.workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin', 'editor')
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT wm.workspace_id
      FROM public.workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin', 'editor')
    )
  );
