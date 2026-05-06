-- Migration: add unique constraint on (workspace_id, platform) for social_accounts
-- Required for the oauth-exchange Edge Function's upsert ON CONFLICT clause.

ALTER TABLE public.social_accounts
  ADD CONSTRAINT social_accounts_workspace_platform_unique
  UNIQUE (workspace_id, platform);
