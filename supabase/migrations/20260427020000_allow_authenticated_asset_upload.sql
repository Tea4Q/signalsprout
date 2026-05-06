-- Migration: Allow authenticated workspace members to upload brand assets directly

-- ── Storage: replace service_role-only INSERT with workspace-member INSERT ────
DROP POLICY IF EXISTS "assets_insert_service_role" ON storage.objects;

CREATE POLICY "assets_insert_workspace_member"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'assets'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.workspaces
      WHERE id IN (
        SELECT workspace_id FROM public.workspace_members
        WHERE user_id = auth.uid()
      )
    )
  );

-- ── public.assets table: INSERT for workspace members ─────────────────────────
DROP POLICY IF EXISTS "assets_insert_workspace_member" ON public.assets;

CREATE POLICY "assets_insert_workspace_member"
  ON public.assets FOR INSERT
  TO authenticated
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid()
    )
  );

-- ── public.assets table: SELECT for workspace members ─────────────────────────
DROP POLICY IF EXISTS "assets_select_workspace_member" ON public.assets;

CREATE POLICY "assets_select_workspace_member"
  ON public.assets FOR SELECT
  TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid()
    )
  );

-- ── public.assets table: DELETE for workspace members ─────────────────────────
DROP POLICY IF EXISTS "assets_delete_workspace_member" ON public.assets;

CREATE POLICY "assets_delete_workspace_member"
  ON public.assets FOR DELETE
  TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid()
    )
  );
