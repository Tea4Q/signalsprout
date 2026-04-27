-- Migration: social_accounts OAuth token fields + extended platform_type

-- ── Extend platform_type enum ────────────────────────────────────────────────
-- PostgreSQL allows adding enum values conditionally only in a DO block
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'facebook'
      AND enumtypid = 'public.platform_type'::regtype
  ) THEN ALTER TYPE public.platform_type ADD VALUE 'facebook'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'tiktok'
      AND enumtypid = 'public.platform_type'::regtype
  ) THEN ALTER TYPE public.platform_type ADD VALUE 'tiktok'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'x'
      AND enumtypid = 'public.platform_type'::regtype
  ) THEN ALTER TYPE public.platform_type ADD VALUE 'x'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'linkedin'
      AND enumtypid = 'public.platform_type'::regtype
  ) THEN ALTER TYPE public.platform_type ADD VALUE 'linkedin'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'youtube'
      AND enumtypid = 'public.platform_type'::regtype
  ) THEN ALTER TYPE public.platform_type ADD VALUE 'youtube'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'threads'
      AND enumtypid = 'public.platform_type'::regtype
  ) THEN ALTER TYPE public.platform_type ADD VALUE 'threads'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'snapchat'
      AND enumtypid = 'public.platform_type'::regtype
  ) THEN ALTER TYPE public.platform_type ADD VALUE 'snapchat'; END IF;
END $$;

-- ── Add OAuth token columns to social_accounts ───────────────────────────────
ALTER TABLE public.social_accounts
  ADD COLUMN IF NOT EXISTS access_token     text,
  ADD COLUMN IF NOT EXISTS refresh_token    text,
  ADD COLUMN IF NOT EXISTS token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS avatar_url       text,
  ADD COLUMN IF NOT EXISTS scopes           text;

-- Protect token columns: only accessible via service_role (Edge Functions)
-- Regular users can read everything except the raw tokens
ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "social_accounts_workspace_member_select" ON public.social_accounts;
CREATE POLICY "social_accounts_workspace_member_select"
  ON public.social_accounts FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "social_accounts_workspace_member_delete" ON public.social_accounts;
CREATE POLICY "social_accounts_workspace_member_delete"
  ON public.social_accounts FOR DELETE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );
