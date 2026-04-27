-- Migration: add_credential_vault_table
-- Applied: 2026-04-04

create table public.credential_vault (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  service text not null,
  environment text not null default 'production',
  encrypted_value bytea not null,
  iv bytea not null,
  key_metadata jsonb not null default '{}'::jsonb,
  rotation_due_at timestamptz,
  last_rotated_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.credential_vault enable row level security;

create trigger set_updated_at_credential_vault
  before update on public.credential_vault
  for each row execute function public.set_updated_at();

create policy "workspace_members_select_credential_vault"
  on public.credential_vault for select
  using (public.is_workspace_member(workspace_id));

create policy "workspace_members_insert_credential_vault"
  on public.credential_vault for insert
  with check (public.is_workspace_member(workspace_id));

create policy "workspace_members_update_credential_vault"
  on public.credential_vault for update
  using (public.is_workspace_member(workspace_id));

create policy "workspace_members_delete_credential_vault"
  on public.credential_vault for delete
  using (public.is_workspace_member(workspace_id));
