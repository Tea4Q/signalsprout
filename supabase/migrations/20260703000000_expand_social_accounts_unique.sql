-- Allow multiple connected accounts per platform within the same workspace.
-- We use external_account_id as the stable provider identifier for upserts.

UPDATE public.social_accounts
SET external_account_id = COALESCE(NULLIF(external_account_id, ''), NULLIF(account_identifier, ''), account_name)
WHERE external_account_id IS NULL OR external_account_id = '';

ALTER TABLE public.social_accounts
  ALTER COLUMN external_account_id SET NOT NULL;

ALTER TABLE public.social_accounts
  DROP CONSTRAINT IF EXISTS social_accounts_workspace_platform_unique;

ALTER TABLE public.social_accounts
  DROP CONSTRAINT IF EXISTS social_accounts_workspace_platform_external_account_unique;

ALTER TABLE public.social_accounts
  ADD CONSTRAINT social_accounts_workspace_platform_external_account_unique
  UNIQUE (workspace_id, platform, external_account_id);

CREATE INDEX IF NOT EXISTS social_accounts_workspace_platform_status_idx
  ON public.social_accounts (workspace_id, platform, status);

CREATE INDEX IF NOT EXISTS social_accounts_workspace_status_idx
  ON public.social_accounts (workspace_id, status);