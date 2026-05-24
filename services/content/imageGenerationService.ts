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
  platform: "instagram" | "pinterest" | "facebook" | "tiktok",
  brandId: string,
  workspaceId: string,
  characterReferenceUrl?: string,
): Promise<GeneratedImage> {
  const { data, error } = await supabase.functions.invoke<GeneratedImage>(
    "generate-image",
    {
      body: {
        prompt,
        platform,
        brand_id: brandId,
        workspace_id: workspaceId,
        character_reference_url: characterReferenceUrl ?? null,
      },
    },
  );
  if (error) {
    let message = error.message;
    try {
      const ctx = (error as { context?: unknown }).context;
      if (ctx && typeof (ctx as Response).json === "function") {
        const body = await (ctx as Response).json();
        if (body?.error) message = body.error;
      }
    } catch {
      // ignore — use original error.message
    }
    throw new Error(message);
  }
  if (!data) throw new Error("No image returned from generation");
  return data;
}

export async function regenerateVariation(
  prompt: string,
  platform: "instagram" | "pinterest" | "facebook" | "tiktok",
  brandId: string,
  workspaceId: string,
): Promise<GeneratedImage> {
  return generateImage(prompt, platform, brandId, workspaceId);
}
