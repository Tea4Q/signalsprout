import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database";

type BrandRow = Database["public"]["Tables"]["brands"]["Row"];
type BrandInsert = Database["public"]["Tables"]["brands"]["Insert"];
type BrandUpdate = Database["public"]["Tables"]["brands"]["Update"];
type BrandProfileRow = Database["public"]["Tables"]["brand_profiles"]["Row"];
type BrandProfileInsert =
  Database["public"]["Tables"]["brand_profiles"]["Insert"];
type AssetRow = Database["public"]["Tables"]["assets"]["Row"];

export async function getBrands(workspaceId: string): Promise<BrandRow[]> {
  const { data, error } = await supabase
    .from("brands")
    .select()
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function createBrand(
  workspaceId: string,
  data: Omit<BrandInsert, "workspace_id">,
): Promise<BrandRow> {
  const { data: brand, error } = await supabase
    .from("brands")
    .insert({ ...data, workspace_id: workspaceId })
    .select()
    .single();

  if (error) throw error;
  return brand;
}

export async function updateBrand(
  brandId: string,
  data: BrandUpdate,
): Promise<BrandRow> {
  const { data: brand, error } = await supabase
    .from("brands")
    .update(data)
    .eq("id", brandId)
    .select()
    .single();

  if (error) throw error;
  return brand;
}

export async function getBrandProfile(
  brandId: string,
): Promise<BrandProfileRow | null> {
  const { data, error } = await supabase
    .from("brand_profiles")
    .select()
    .eq("brand_id", brandId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function upsertBrandProfile(
  brandId: string,
  data: Omit<BrandProfileInsert, "brand_id">,
): Promise<BrandProfileRow> {
  const { data: profile, error } = await supabase
    .from("brand_profiles")
    .upsert({ ...data, brand_id: brandId }, { onConflict: "brand_id" })
    .select()
    .single();

  if (error) throw error;
  return profile;
}

export async function getBrandAssets(
  workspaceId: string,
  brandId: string,
): Promise<AssetRow[]> {
  const { data, error } = await supabase
    .from("assets")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("brand_id", brandId)
    .eq("type", "uploaded_image")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function uploadBrandAsset(
  workspaceId: string,
  brandId: string,
  /** File object (web) or { uri, name, mimeType } (native) */
  file: File | { uri: string; name: string; mimeType: string },
  label: string,
): Promise<AssetRow> {
  let blob: Blob;
  let fileName: string;
  let mimeType: string;

  if (file instanceof File) {
    blob = file;
    fileName = file.name;
    mimeType = file.type;
  } else {
    const res = await fetch(file.uri);
    blob = await res.blob();
    fileName = file.name;
    mimeType = file.mimeType;
  }

  const ext = fileName.split(".").pop()?.replace(/[^a-z0-9]/gi, "") || "png";
  const timestamp = Date.now();
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const path = `${workspaceId}/${brandId}/${timestamp}-${slug}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("assets")
    .upload(path, blob, { contentType: mimeType, upsert: false });
  if (uploadError) throw uploadError;

  const { data: asset, error: insertError } = await supabase
    .from("assets")
    .insert({
      workspace_id: workspaceId,
      brand_id: brandId,
      type: "uploaded_image",
      file_path: path,
      alt_text: label,
      mime_type: mimeType,
    })
    .select()
    .single();
  if (insertError) throw insertError;
  return asset;
}

export async function deleteBrandAsset(assetId: string, filePath: string): Promise<void> {
  await supabase.storage.from("assets").remove([filePath]);
  const { error } = await supabase.from("assets").delete().eq("id", assetId);
  if (error) throw error;
}
