-- Migration: fix workspace_members RLS
-- Allow authenticated users to insert a membership row for themselves.
-- This is required when a user creates a new workspace and needs to add
-- themselves as the owner in the same request.

create policy "users_insert_own_membership"
  on public.workspace_members for insert
  with check (user_id = auth.uid());
