-- Migration: add_campaigns_table
-- Applied: 2026-04-04

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  name text not null,
  goal text,
  start_date date,
  end_date date,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

alter table public.campaigns enable row level security;

create policy "workspace_members_select_campaigns"
  on public.campaigns for select
  using (public.is_workspace_member(workspace_id));

create policy "workspace_members_insert_campaigns"
  on public.campaigns for insert
  with check (public.is_workspace_member(workspace_id));

create policy "workspace_members_update_campaigns"
  on public.campaigns for update
  using (public.is_workspace_member(workspace_id));

create policy "workspace_members_delete_campaigns"
  on public.campaigns for delete
  using (public.is_workspace_member(workspace_id));

-- Add campaign_id to posts table
alter table public.posts
  add column if not exists campaign_id uuid references public.campaigns(id) on delete set null;
