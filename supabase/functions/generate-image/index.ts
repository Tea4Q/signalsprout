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
}

function dalleSize(platform: Platform): "1024x1024" | "1024x1792" {
  // Pinterest = 2:3 portrait (1024×1792), Instagram = square (1024×1024)
  return platform === "pinterest" ? "1024x1792" : "1024x1024";
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
    const { prompt, platform, brand_id, workspace_id } = body;

    if (!prompt || !platform || !brand_id || !workspace_id) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const openAiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAiKey) throw new Error("OPENAI_API_KEY not configured");

    const size = dalleSize(platform);
    const startTime = Date.now();

    // Generate image via DALL·E 3
    const dalleResponse = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openAiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt,
        n: 1,
        size,
        response_format: "b64_json",
      }),
    });

    if (!dalleResponse.ok) {
      const err = await dalleResponse.text();
      throw new Error(`DALL·E error: ${err}`);
    }

    const dalleData = await dalleResponse.json();
    const b64 = dalleData.data[0].b64_json as string;
    const revisedPrompt: string = dalleData.data[0].revised_prompt ?? prompt;

    // Decode base64 and upload to Supabase Storage
    const imageBytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const fileName = `${Date.now()}-${platform}.png`;
    const filePath = `assets/${workspace_id}/${brand_id}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("assets")
      .upload(filePath, imageBytes, { contentType: "image/png", upsert: false });

    if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);

    const { data: urlData } = supabase.storage.from("assets").getPublicUrl(filePath);

    // Parse dimensions from size string
    const [width, height] = size.split("x").map(Number);

    // Insert asset row
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
        mime_type: "image/png",
      })
      .select()
      .single();

    if (assetError) throw new Error(`Asset insert failed: ${assetError.message}`);

    // Cost: DALL·E 3 standard $0.040/image (1024×1024) or $0.080/image (1024×1792)
    const imageCost = size === "1024x1792" ? 0.08 : 0.04;

    await supabase.from("cost_entries").insert({
      workspace_id,
      brand_id,
      amount: imageCost,
      entry_date: new Date().toISOString().split("T")[0],
      unit: "image",
      quantity: 1,
      notes: `DALL·E 3 image generation — ${platform} ${size}`,
      metadata: {
        model: "dall-e-3",
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
