-- Migration: Add UPDATE policy for authenticated workspace members on public.assets

DROP POLICY IF EXISTS "assets_update_workspace_member" ON public.assets;

CREATE POLICY "assets_update_workspace_member"
  ON public.assets FOR UPDATE
  TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid()
    )
  );
