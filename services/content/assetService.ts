import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
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
  // Fetch file_path before deleting (needed for storage cleanup).
  const { data: asset, error: fetchError } = await supabase
    .from("assets")
    .select("file_path")
    .eq("id", assetId)
    .single();

  if (fetchError || !asset) {
    throw new Error("Asset not found or access denied.");
  }

  // Remove post_assets join rows first — the FK has no CASCADE so the asset
  // delete would be blocked if any post still references this asset.
  const { error: unlinkError } = await supabase
    .from("post_assets")
    .delete()
    .eq("asset_id", assetId);
  if (unlinkError) throw unlinkError;

  // Delete the DB record.
  const { error: dbError, count } = await supabase
    .from("assets")
    .delete({ count: "exact" })
    .eq("id", assetId);

  if (dbError) throw dbError;
  if (count === 0) throw new Error("Delete blocked — check workspace permissions.");

  // Best-effort storage cleanup — don't fail the operation if the file
  // is already gone or the RLS policy can't match the path.
  await supabase.storage.from("assets").remove([asset.file_path]);
}

export function getAssetPublicUrl(filePath: string): string {
  const { data } = supabase.storage.from("assets").getPublicUrl(filePath);
  return data.publicUrl;
}

/**
 * Resizes an image so its longest side is at most `maxPx` pixels, then
 * compresses it to JPEG at the given quality. Returns the manipulated URI
 * and dimensions. This keeps uploads well within Supabase's size limit.
 */
async function resizeForUpload(
  uri: string,
  width: number,
  height: number,
  maxPx = 1920,
  quality = 0.82,
): Promise<{ uri: string; width: number; height: number; mime: string }> {
  const longest = Math.max(width, height);
  const actions: ImageManipulator.Action[] = [];

  if (longest > maxPx) {
    actions.push(
      width >= height
        ? { resize: { width: maxPx } }
        : { resize: { height: maxPx } },
    );
  }

  const result = await ImageManipulator.manipulateAsync(
    uri,
    actions,
    { compress: quality, format: ImageManipulator.SaveFormat.JPEG },
  );

  return {
    uri: result.uri,
    width: result.width,
    height: result.height,
    mime: "image/jpeg",
  };
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

  // Resize + compress before uploading to stay within Supabase storage limits
  // and keep file sizes appropriate for social media.
  const processed = await resizeForUpload(
    picked.uri,
    picked.width ?? 1080,
    picked.height ?? 1080,
  );

  const ext = "jpg";
  const mime = processed.mime;

  // Fetch as blob for upload
  const response = await fetch(processed.uri);
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
      width: processed.width ?? null,
      height: processed.height ?? null,
    })
    .select()
    .single();
  if (dbError) throw dbError;

  const { data: urlData } = supabase.storage.from("assets").getPublicUrl(filePath);

  return {
    asset_id: row.id,
    file_path: filePath,
    public_url: urlData.publicUrl,
    width: processed.width ?? 0,
    height: processed.height ?? 0,
    revised_prompt: "",
  };
}

/**
 * Opens the device video library, uploads the selected video to Supabase
 * storage, records it in the assets table with type "uploaded_video", and
 * returns a GeneratedImage-compatible object so it slots into the same
 * post-creation flow.
 *
 * Supports Instagram Reels and TikTok video posts.
 */
export async function uploadVideo(
  workspaceId: string,
  brandId: string,
): Promise<GeneratedImage & { fileName: string; durationMs: number | null }> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== "granted") {
    throw new Error("Permission to access photo library was denied.");
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: "videos",
    allowsEditing: false,
    quality: 1,
    // Instagram Reels hard cap is 90 s; TikTok allows up to 600 s (10 min).
    // We use 600 s here so the same upload works for both; the scheduling
    // layer enforces per-platform duration rules before posting.
    videoMaxDuration: 600,
  });

  if (result.canceled || !result.assets[0]) {
    throw new Error("No video selected.");
  }

  const picked = result.assets[0];

  // Enforce Instagram Reels hard duration cap of 90 s at the client level
  // so we surface a clear message rather than a cryptic API error later.
  if (picked.duration !== null && picked.duration !== undefined) {
    const durationSec = picked.duration / 1000;
    if (durationSec > 90) {
      throw new Error(
        `Video is ${Math.round(durationSec)} seconds long. Instagram Reels requires 90 seconds or less. For TikTok-only posts up to 10 minutes are supported — please choose your platform before uploading.`,
      );
    }
  }

  const uri = picked.uri;
  const ext = (uri.split(".").pop() ?? "mp4").toLowerCase();
  const mime = picked.mimeType ?? `video/${ext === "mov" ? "quicktime" : ext}`;
  const fileName = uri.split("/").pop() ?? `video.${ext}`;

  const response = await fetch(uri);
  const blob = await response.blob();

  // 500 MB cap — keeps uploads well within Supabase storage limits and
  // comfortably under both Instagram Reels (1 GB) and TikTok (4 GB) URL limits.
  const MAX_VIDEO_BYTES = 500 * 1024 * 1024;
  if (blob.size > MAX_VIDEO_BYTES) {
    const sizeMb = (blob.size / 1024 / 1024).toFixed(0);
    throw new Error(
      `Video file is ${sizeMb} MB, which exceeds the 500 MB upload limit. Please trim or compress the video before uploading.`,
    );
  }

  const filePath = `${workspaceId}/${brandId}/${Date.now()}_video.${ext}`;
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
      type: "uploaded_video" as Database["public"]["Enums"]["asset_type"],
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
    fileName,
    durationMs: picked.duration ?? null,
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
