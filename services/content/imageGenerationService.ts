import { supabase } from "@/lib/supabase";

export interface GeneratedImage {
  asset_id: string;
  file_path: string;
  public_url: string;
  width: number;
  height: number;
  revised_prompt: string;
}

export async function generateImage(
  prompt: string,
  platform: "instagram" | "pinterest",
  brandId: string,
  workspaceId: string,
): Promise<GeneratedImage> {
  const { data, error } = await supabase.functions.invoke<GeneratedImage>(
    "generate-image",
    { body: { prompt, platform, brand_id: brandId, workspace_id: workspaceId } },
  );
  if (error) {
    const body = await (error as { context?: Response }).context?.json().catch(() => null);
    const message = body?.error ?? error.message;
    throw new Error(message);
  }
  if (!data) throw new Error("No image returned from generation");
  return data;
}

export async function regenerateVariation(
  prompt: string,
  platform: "instagram" | "pinterest",
  brandId: string,
  workspaceId: string,
): Promise<GeneratedImage> {
  return generateImage(prompt, platform, brandId, workspaceId);
}
