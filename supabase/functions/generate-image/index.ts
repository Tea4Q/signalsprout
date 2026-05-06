import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RUNWAY_API_BASE = "https://api.dev.runwayml.com";
const RUNWAY_VERSION = "2024-11-06";

type Platform = "instagram" | "pinterest";

interface GenerateImageRequest {
  prompt: string;
  platform: Platform;
  brand_id: string;
  workspace_id: string;
}

/** Runway-supported ratios (width:height) */
function runwayRatio(platform: Platform): "1080:1080" | "1080:1920" {
  // Pinterest = tall portrait pin, Instagram = square
  return platform === "pinterest" ? "1080:1920" : "1080:1080";
}

function dimensions(ratio: "1080:1080" | "1080:1920"): { width: number; height: number } {
  const [w, h] = ratio.split(":").map(Number);
  return { width: w, height: h };
}

async function pollTask(
  taskId: string,
  apiKey: string,
  maxAttempts = 60,
  intervalMs = 3000,
): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, intervalMs));

    const res = await fetch(`${RUNWAY_API_BASE}/v1/tasks/${taskId}`, {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "X-Runway-Version": RUNWAY_VERSION,
      },
    });

    if (!res.ok) throw new Error(`Runway poll error: ${await res.text()}`);

    const task = await res.json();

    if (task.status === "SUCCEEDED") {
      const url = task.output?.[0];
      if (!url) throw new Error("Runway task succeeded but returned no output URL");
      return url as string;
    }

    if (task.status === "FAILED") {
      throw new Error(`Runway task failed: ${task.failure ?? task.failureCode ?? "unknown"}`);
    }
    // PENDING / THROTTLED / RUNNING — keep polling
  }
  throw new Error("Runway task timed out after 3 minutes");
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

    const runwayKey = Deno.env.get("RUNWAY_API_KEY");
    if (!runwayKey) throw new Error("RUNWAY_API_KEY not configured");

    const ratio = runwayRatio(platform);
    const { width, height } = dimensions(ratio);
    const startTime = Date.now();

    // Look up character reference image for this brand
    const { data: charRef } = await supabase
      .from("assets")
      .select("file_path")
      .eq("brand_id", brand_id)
      .eq("alt_text", "character_reference")
      .maybeSingle();

    let referenceImages: Array<{ uri: string; tag: string }> | undefined;
    let finalPrompt = prompt;

    if (charRef?.file_path) {
      const { data: signedUrlData } = await supabase.storage
        .from("assets")
        .createSignedUrl(charRef.file_path, 3600);

      if (signedUrlData?.signedUrl) {
        referenceImages = [{ uri: signedUrlData.signedUrl, tag: "character" }];
        finalPrompt = `@character ${prompt}`;
      }
    }

    // Step 1: Create text-to-image task
    const createRes = await fetch(`${RUNWAY_API_BASE}/v1/text_to_image`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${runwayKey}`,
        "X-Runway-Version": RUNWAY_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gen4_image",
        promptText: finalPrompt,
        ratio,
        ...(referenceImages ? { referenceImages } : {}),
      }),
    });

    if (!createRes.ok) {
      const err = await createRes.text();
      throw new Error(`Runway create task error: ${err}`);
    }

    const { id: taskId } = await createRes.json() as { id: string };

    // Step 2: Poll until complete (~3 min max, 3s interval)
    const imageUrl = await pollTask(taskId, runwayKey);

    // Step 3: Download the generated image
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) throw new Error("Failed to download Runway output image");
    const imageBytes = new Uint8Array(await imgRes.arrayBuffer());

    // Infer extension from Content-Type or URL
    const contentType = imgRes.headers.get("content-type") ?? "image/jpeg";
    const ext = contentType.includes("png") ? "png" : "jpg";
    const mimeType = contentType.split(";")[0].trim();

    // Step 4: Upload to Supabase Storage
    const fileName = `${Date.now()}-${platform}.${ext}`;
    const filePath = `assets/${workspace_id}/${brand_id}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("assets")
      .upload(filePath, imageBytes, { contentType: mimeType, upsert: false });

    if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);

    const { data: urlData } = supabase.storage.from("assets").getPublicUrl(filePath);

    // Step 5: Insert asset row
    const { data: asset, error: assetError } = await supabase
      .from("assets")
      .insert({
        workspace_id,
        brand_id,
        file_path: filePath,
        type: "generated_image",
        prompt_used: prompt,
        width,
        height,
        mime_type: mimeType,
      })
      .select()
      .single();

    if (assetError) throw new Error(`Asset insert failed: ${assetError.message}`);

    // Cost: Runway Gen-4 Image ~$0.02/image (standard tier)
    await supabase.from("cost_entries").insert({
      workspace_id,
      brand_id,
      amount: 0.02,
      entry_date: new Date().toISOString().split("T")[0],
      unit: "image",
      quantity: 1,
      notes: `Runway Gen-4 Image generation — ${platform} ${ratio}`,
      metadata: {
        model: "gen4_image",
        provider: "runway",
        ratio,
        platform,
        task_id: taskId,
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
        revised_prompt: prompt,
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

/** Nano Banana aspect ratio per platform */
function aspectRatio(platform: Platform): "4:5" | "2:3" {
  // Instagram portrait (4:5 = 1080×1350), Pinterest pin (2:3 = 1000×1500)
  return platform === "pinterest" ? "2:3" : "4:5";
}

/** Approximate pixel dimensions for the DB record */
function dimensions(ratio: "4:5" | "2:3"): { width: number; height: number } {
  return ratio === "2:3"
    ? { width: 1000, height: 1500 }
    : { width: 1080, height: 1350 };
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

    const nanoBananaKey = Deno.env.get("NANOBANANA_API_KEY");
    if (!nanoBananaKey) throw new Error("NANOBANANA_API_KEY not configured");

    const ratio = aspectRatio(platform);
    const startTime = Date.now();

    // Generate image via Nano Banana (Gemini-compatible API)
    const nbResponse = await fetch(
      `https://api.nanobananai.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${nanoBananaKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseModalities: ["IMAGE"],
            imageConfig: {
              aspectRatio: ratio,
              imageSize: "2K",
            },
          },
        }),
      },
    );

    if (!nbResponse.ok) {
      const err = await nbResponse.text();
      throw new Error(`Nano Banana error: ${err}`);
    }

    const nbData = await nbResponse.json();
    const parts = nbData?.candidates?.[0]?.content?.parts;
    const imagePart = parts?.find((p: { inline_data?: { mime_type: string; data: string } }) => p.inline_data?.data);
    if (!imagePart) throw new Error("No image returned from Nano Banana");

    const { data: b64, mime_type: mimeType } = imagePart.inline_data as { data: string; mime_type: string };
    const ext = mimeType === "image/jpeg" ? "jpg" : "png";

    // Decode base64 and upload to Supabase Storage
    const imageBytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const fileName = `${Date.now()}-${platform}.${ext}`;
    const filePath = `assets/${workspace_id}/${brand_id}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("assets")
      .upload(filePath, imageBytes, { contentType: mimeType, upsert: false });

    if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);

    const { data: urlData } = supabase.storage.from("assets").getPublicUrl(filePath);

    const { width, height } = dimensions(ratio);

    // Insert asset row
    const { data: asset, error: assetError } = await supabase
      .from("assets")
      .insert({
        workspace_id,
        brand_id,
        file_path: filePath,
        type: "generated_image",
        prompt_used: prompt,
        width,
        height,
        mime_type: mimeType,
      })
      .select()
      .single();

    if (assetError) throw new Error(`Asset insert failed: ${assetError.message}`);

    // Cost: Nano Banana ~$0.008/image (approx 1/5 of DALL·E 3)
    const imageCost = 0.008;

    await supabase.from("cost_entries").insert({
      workspace_id,
      brand_id,
      amount: imageCost,
      entry_date: new Date().toISOString().split("T")[0],
      unit: "image",
      quantity: 1,
      notes: `Nano Banana image generation — ${platform} ${ratio}`,
      metadata: {
        model: "gemini-3-pro-image-preview",
        provider: "nanobananai",
        aspect_ratio: ratio,
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
        revised_prompt: prompt,
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
