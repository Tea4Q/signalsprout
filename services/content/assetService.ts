import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database";

type AssetRow = Database["public"]["Tables"]["assets"]["Row"];

export async function getAssets(
  workspaceId: string,
  brandId?: string,
): Promise<AssetRow[]> {
  let query = supabase
    .from("assets")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (brandId) query = query.eq("brand_id", brandId);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function deleteAsset(assetId: string): Promise<void> {
  const { data: asset, error: fetchError } = await supabase
    .from("assets")
    .select("file_path")
    .eq("id", assetId)
    .single();

  if (fetchError) throw fetchError;

  const { error: storageError } = await supabase.storage
    .from("assets")
    .remove([asset.file_path]);

  if (storageError) throw storageError;

  const { error: dbError } = await supabase
    .from("assets")
    .delete()
    .eq("id", assetId);

  if (dbError) throw dbError;
}

export function getAssetPublicUrl(filePath: string): string {
  const { data } = supabase.storage.from("assets").getPublicUrl(filePath);
  return data.publicUrl;
}
