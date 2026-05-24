import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Platform = "instagram" | "pinterest";

interface GenerateImageRequest {
  prompt: string;
  platform: Platform;
  brand_id: string;
  workspace_id: string;
  character_reference_url?: string | null;
}

function imageSize(platform: Platform): "1024x1024" | "1024x1536" {
  // gpt-image-1 portrait: 1024x1536 (Pinterest), square: 1024x1024 (Instagram)
  return platform === "pinterest" ? "1024x1536" : "1024x1024";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body: GenerateImageRequest = await req.json();
    const { prompt, platform, brand_id, workspace_id, character_reference_url } = body;

    if (!prompt || !platform || !brand_id || !workspace_id) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const openAiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAiKey) throw new Error("OPENAI_API_KEY not configured");

    const size = imageSize(platform);
    const startTime = Date.now();

    let b64: string;
    let revisedPrompt: string;

    if (character_reference_url) {
      // ── Character reference mode: use images/edits so the model keeps the
      // character's appearance while placing them into the scene.
      const refRes = await fetch(character_reference_url);
      if (!refRes.ok) throw new Error("Failed to fetch character reference image");
      const refBlob = await refRes.blob();

      const formData = new FormData();
      formData.append("model", "gpt-image-1");
      formData.append("prompt", prompt);
      formData.append("n", "1");
      formData.append("size", size);
      formData.append("quality", "medium");
      formData.append("output_format", "jpeg");
      formData.append("output_compression", "85");
      formData.append("image[]", refBlob, "character_reference.jpg");

      const genResponse = await fetch("https://api.openai.com/v1/images/edits", {
        method: "POST",
        headers: { "Authorization": `Bearer ${openAiKey}` },
        body: formData,
      });

      if (!genResponse.ok) {
        const err = await genResponse.text();
        throw new Error(`Image edit error: ${err}`);
      }

      const genData = await genResponse.json();
      b64 = genData.data[0].b64_json;
      revisedPrompt = genData.data[0].revised_prompt ?? prompt;
    } else {
      // ── Standard text-to-image generation ──
      const genResponse = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openAiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-image-1",
          prompt,
          n: 1,
          size,
          quality: "medium",
          output_format: "jpeg",
          output_compression: 85,
        }),
      });

      if (!genResponse.ok) {
        const err = await genResponse.text();
        throw new Error(`Image generation error: ${err}`);
      }

      const genData = await genResponse.json();
      b64 = genData.data[0].b64_json;
      revisedPrompt = genData.data[0].revised_prompt ?? prompt;
    }

    const imageBytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const fileName = `${Date.now()}-${platform}.jpg`;
    const filePath = `assets/${workspace_id}/${brand_id}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("assets")
      .upload(filePath, imageBytes, { contentType: "image/jpeg", upsert: false });

    if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);

    const { data: urlData } = supabase.storage.from("assets").getPublicUrl(filePath);

    const [width, height] = size.split("x").map(Number);

    const { data: asset, error: assetError } = await supabase
      .from("assets")
      .insert({
        workspace_id,
        brand_id,
        file_path: filePath,
        type: "generated_image",
        prompt_used: revisedPrompt,
        width,
        height,
        mime_type: "image/jpeg",
      })
      .select()
      .single();

    if (assetError) throw new Error(`Asset insert failed: ${assetError.message}`);

    // gpt-image-1 pricing: ~$0.04 per image (1024x1024), ~$0.06 per image (1024x1536)
    const imageCost = size === "1024x1536" ? 0.06 : 0.04;

    await supabase.from("cost_entries").insert({
      workspace_id,
      brand_id,
      amount: imageCost,
      entry_date: new Date().toISOString().split("T")[0],
      unit: "image",
      quantity: 1,
      notes: `gpt-image-1 generation — ${platform} ${size}`,
      metadata: {
        model: "gpt-image-1",
        size,
        platform,
        asset_id: asset.id,
        latency_ms: Date.now() - startTime,
      },
    });

    return new Response(
      JSON.stringify({
        asset_id: asset.id,
        file_path: filePath,
        public_url: urlData.publicUrl,
        width,
        height,
        revised_prompt: revisedPrompt,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
