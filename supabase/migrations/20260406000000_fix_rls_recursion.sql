-- Migration: fix_workspace_members_rls_recursion
-- Problem: is_workspace_member() queries workspace_members, whose SELECT
-- policy called is_workspace_member() → infinite recursion → stack depth exceeded.
--
-- Fix 1: workspace_members SELECT policy uses a direct column check only.
-- Fix 2: is_workspace_member() is recreated as SECURITY DEFINER so it
--         bypasses RLS when invoked from other tables' policies.

-- ── Fix workspace_members SELECT policy ──────────────────────────────────────

-- Drop any existing recursive SELECT policies on workspace_members
do $do$
declare
  pol text;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename  = 'workspace_members'
      and cmd        = 'SELECT'
  loop
    execute format('drop policy if exists %I on public.workspace_members', pol);
  end loop;
end $do$;

-- Simple, non-recursive: a member can only see their own rows.
drop policy if exists "workspace_members_select_own" on public.workspace_members;
create policy "workspace_members_select_own"
  on public.workspace_members for select
  using (user_id = auth.uid());

-- ── Fix is_workspace_member as SECURITY DEFINER ───────────────────────────────
-- SECURITY DEFINER means the function runs as its definer (postgres / service
-- role) and therefore bypasses RLS on workspace_members, breaking the cycle.

create or replace function public.is_workspace_member(check_workspace_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $func$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = check_workspace_id
      and user_id      = auth.uid()
  )
$func$;
