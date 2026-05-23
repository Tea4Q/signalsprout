import { supabase } from "@/lib/supabase";

export interface GeneratedContent {
  hook: string;
  caption: string;
  hashtags: string[];
  image_prompt: string;
  pin_title: string;
  pin_description: string;
}

export interface GenerateContentParams {
  brand_id: string;
  workspace_id: string;
  platform: "instagram" | "pinterest" | "facebook" | "tiktok";
  content_type: string;
  tone: string;
  cta?: string;
  source_material?: string;
}

export async function generateContent(
  params: GenerateContentParams,
): Promise<GeneratedContent> {
  const { data, error } = await supabase.functions.invoke<GeneratedContent>(
    "generate-content",
    { body: params },
  );
  if (error) {
    // Extract the real error message from the function response body
    const body = await (error as { context?: Response }).context?.json().catch(() => null);
    const message = body?.error ?? error.message;
    throw new Error(message);
  }
  if (!data) throw new Error("No content returned from generation");
  return data;
}

export async function improveCaption(
  caption: string,
  brandId: string,
  workspaceId: string,
): Promise<GeneratedContent> {
  const { data, error } = await supabase.functions.invoke<GeneratedContent>(
    "generate-content",
    {
      body: {
        brand_id: brandId,
        workspace_id: workspaceId,
        platform: "instagram",
        content_type: "improvement",
        tone: "existing",
        source_material: `Improve this existing caption:\n\n${caption}`,
      },
    },
  );
  if (error) throw error;
  if (!data) throw new Error("No content returned");
  return data;
}

export async function rewriteCTA(
  caption: string,
  cta: string,
  brandId: string,
  workspaceId: string,
): Promise<GeneratedContent> {
  const { data, error } = await supabase.functions.invoke<GeneratedContent>(
    "generate-content",
    {
      body: {
        brand_id: brandId,
        workspace_id: workspaceId,
        platform: "instagram",
        content_type: "cta-rewrite",
        tone: "existing",
        cta,
        source_material: `Rewrite the CTA in this caption to use the new CTA:\n\n${caption}`,
      },
    },
  );
  if (error) throw error;
  if (!data) throw new Error("No content returned");
  return data;
}
