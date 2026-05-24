-- Fix storage DELETE policy to handle both asset path structures:
--   Uploaded images/videos: workspace_id/brand_id/file  (foldername[1] = workspace_id)
--   Generated images:       assets/workspace_id/brand_id/file  (foldername[2] = workspace_id)

DROP POLICY IF EXISTS "assets_delete_own_workspace" ON storage.objects;

CREATE POLICY "assets_delete_own_workspace"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'assets'
    AND (
      (storage.foldername(name))[1] IN (
        SELECT id::text FROM public.workspaces
        WHERE id IN (
          SELECT workspace_id FROM public.workspace_members
          WHERE user_id = auth.uid()
        )
      )
      OR
      (storage.foldername(name))[2] IN (
        SELECT id::text FROM public.workspaces
        WHERE id IN (
          SELECT workspace_id FROM public.workspace_members
          WHERE user_id = auth.uid()
        )
      )
    )
  );
