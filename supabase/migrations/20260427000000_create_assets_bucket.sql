-- Migration: Create 'assets' storage bucket for generated images

-- ── Create bucket ─────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'assets',
  'assets',
  true,                          -- public bucket so getPublicUrl works without signing
  10485760,                      -- 10 MB per file
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ── RLS policies ──────────────────────────────────────────────────────────────
-- Read: any authenticated user whose workspace_id appears in the path may read
DROP POLICY IF EXISTS "assets_select_own_workspace" ON storage.objects;
CREATE POLICY "assets_select_own_workspace"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'assets'
    AND (storage.foldername(name))[2] IN (
      SELECT id::text FROM public.workspaces
      WHERE id IN (
        SELECT workspace_id FROM public.workspace_members
        WHERE user_id = auth.uid()
      )
    )
  );

-- Insert: only the service-role key (used by the edge function) uploads objects.
-- Authenticated users are NOT permitted to upload directly.
DROP POLICY IF EXISTS "assets_insert_service_role" ON storage.objects;
CREATE POLICY "assets_insert_service_role"
  ON storage.objects FOR INSERT
  TO service_role
  WITH CHECK (bucket_id = 'assets');

-- Delete: workspace members may delete their own workspace assets
DROP POLICY IF EXISTS "assets_delete_own_workspace" ON storage.objects;
CREATE POLICY "assets_delete_own_workspace"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'assets'
    AND (storage.foldername(name))[2] IN (
      SELECT id::text FROM public.workspaces
      WHERE id IN (
        SELECT workspace_id FROM public.workspace_members
        WHERE user_id = auth.uid()
      )
    )
  );
