import * as ImagePicker from "expo-image-picker";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database";
import type { GeneratedImage } from "@/services/content/imageGenerationService";

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

export type AssetWithUsage = AssetRow & { postCount: number };

export async function getAssetsWithUsage(
  workspaceId: string,
): Promise<AssetWithUsage[]> {
  const { data, error } = await supabase
    .from("assets")
    .select("*, post_assets(id)")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as (AssetRow & { post_assets: { id: string }[] })[]).map(
    (row) => ({ ...row, postCount: row.post_assets?.length ?? 0 }),
  );
}

export async function deleteAsset(assetId: string): Promise<void> {
  // Deletion is routed through an edge function so the service role can
  // remove the storage object (uploaded via service role, unreachable by
  // client-side RLS) while still enforcing workspace membership via RLS.
  const { error } = await supabase.functions.invoke("delete-asset", {
    body: { asset_id: assetId },
  });
  if (error) {
    let message = error.message;
    try {
      const ctx = (error as { context?: unknown }).context;
      if (ctx && typeof (ctx as Response).json === "function") {
        const body = await (ctx as Response).json() as { error?: string };
        if (body?.error) message = body.error;
      }
    } catch { /* ignore — use original message */ }
    throw new Error(message);
  }
}

export function getAssetPublicUrl(filePath: string): string {
  const { data } = supabase.storage.from("assets").getPublicUrl(filePath);
  return data.publicUrl;
}

/**
 * Opens the device photo library, uploads the selected image to Supabase
 * storage, records it in the assets table, and returns a GeneratedImage-
 * compatible object so it slots into the same post-creation flow.
 */
export async function uploadExternalImage(
  workspaceId: string,
  brandId: string,
): Promise<GeneratedImage> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== "granted") {
    throw new Error("Permission to access photo library was denied.");
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: "images",
    allowsEditing: true,
    quality: 0.9,
    exif: false,
  });

  if (result.canceled || !result.assets[0]) {
    throw new Error("No image selected.");
  }

  const picked = result.assets[0];
  const ext = (picked.uri.split(".").pop() ?? "jpg").toLowerCase();
  const mime = picked.mimeType ?? `image/${ext === "jpg" ? "jpeg" : ext}`;

  // Fetch as blob for upload
  const response = await fetch(picked.uri);
  const blob = await response.blob();

  const filePath = `${workspaceId}/${brandId}/${Date.now()}_upload.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from("assets")
    .upload(filePath, blob, { contentType: mime, upsert: false });
  if (uploadError) throw uploadError;

  const { data: row, error: dbError } = await supabase
    .from("assets")
    .insert({
      workspace_id: workspaceId,
      brand_id: brandId,
      file_path: filePath,
      type: "uploaded_image" as Database["public"]["Enums"]["asset_type"],
      mime_type: mime,
      width: picked.width ?? null,
      height: picked.height ?? null,
    })
    .select()
    .single();
  if (dbError) throw dbError;

  const { data: urlData } = supabase.storage.from("assets").getPublicUrl(filePath);

  return {
    asset_id: row.id,
    file_path: filePath,
    public_url: urlData.publicUrl,
    width: picked.width ?? 0,
    height: picked.height ?? 0,
    revised_prompt: "",
  };
}

/**
 * Marks an asset as the brand's character reference image used in Runway
 * image generation. Clears any previous character reference for the brand.
 */
export async function setAsCharacterReference(
  assetId: string,
  brandId: string,
): Promise<void> {
  // Clear any existing character reference for this brand
  await supabase
    .from("assets")
    .update({ alt_text: null })
    .eq("brand_id", brandId)
    .eq("alt_text", "character_reference");

  const { error } = await supabase
    .from("assets")
    .update({
      alt_text: "character_reference",
      type: "template_image" as Database["public"]["Enums"]["asset_type"],
    })
    .eq("id", assetId);

  if (error) throw error;
}

/** Returns the current character reference asset for a brand, or null. */
export async function getCharacterReference(brandId: string): Promise<AssetRow | null> {
  const { data } = await supabase
    .from("assets")
    .select("*")
    .eq("brand_id", brandId)
    .eq("alt_text", "character_reference")
    .maybeSingle();
  return data ?? null;
}
