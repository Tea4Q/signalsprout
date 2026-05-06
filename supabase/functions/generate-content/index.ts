import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GenerateContentRequest {
  brand_id: string;
  workspace_id: string;
  platform: "instagram" | "pinterest";
  content_type: string;
  tone: string;
  cta?: string;
  source_material?: string;
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

    const body: GenerateContentRequest = await req.json();
    const { brand_id, workspace_id, platform, content_type, tone, cta, source_material } = body;

    if (!brand_id || !workspace_id || !platform || !content_type || !tone) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch brand + brand profile
    const [{ data: brand }, { data: profile }] = await Promise.all([
      supabase.from("brands").select("name, voice_summary, target_audience").eq("id", brand_id).single(),
      supabase.from("brand_profiles").select("tone_keywords, hashtag_library, cta_library, posting_notes").eq("brand_id", brand_id).maybeSingle(),
    ]);

    if (!brand) {
      return new Response(JSON.stringify({ error: "Brand not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // System prompt (inlined — Deno Deploy cannot read files outside the bundle)
    const systemPrompt = `You are an expert social media strategist and copywriter. Your job is to create high-converting social media content.

You will be given:
- Brand voice summary
- Tone keywords
- CTA library (calls to action the brand uses)
- Hashtag library
- Platform (instagram or pinterest)
- Content type (educational, promotional, inspirational, behind-the-scenes, product-feature, ugc-style)
- Requested tone
- Optional CTA to use
- Optional source material (article, product details, brief, etc.)

You MUST respond with ONLY a valid JSON object. No markdown, no explanation, no preamble. The JSON must match this exact structure:

{
  "hook": "The first line / opening statement that stops the scroll. Max 15 words.",
  "caption": "The full caption body. Use line breaks. No hashtags inline — they go in the hashtags field.",
  "hashtags": ["hashtag1", "hashtag2"],
  "image_prompt": "A detailed DALL·E 3 image generation prompt describing the creative. Include style, mood, composition, colors, and any text overlays.",
  "pin_title": "Pinterest pin title (max 100 characters). Empty string if platform is instagram.",
  "pin_description": "Pinterest pin description (max 500 characters). Empty string if platform is instagram."
}

Rules:
- The hook must be punchy, specific, and platform-appropriate.
- Instagram captions can be up to 2200 characters. Pinterest descriptions up to 500.
- Include 5–15 hashtags from the brand's hashtag library plus relevant trending ones.
- Always end the caption body with a CTA from the brand's CTA library (or the requested CTA).
- The image_prompt must describe exactly what should appear visually — camera angle, lighting, subject, background, style (e.g. "flat lay", "lifestyle photo", "bold graphic"), color palette, any text overlays in quotes.
- Stay true to the brand voice and tone keywords at all times.`;

    const userMessage = [
      `Brand: ${brand.name}`,
      brand.voice_summary ? `Voice summary: ${brand.voice_summary}` : null,
      brand.target_audience ? `Target audience: ${brand.target_audience}` : null,
      profile?.tone_keywords?.length ? `Tone keywords: ${profile.tone_keywords.join(", ")}` : null,
      profile?.cta_library?.length ? `CTA library: ${profile.cta_library.join(" | ")}` : null,
      profile?.hashtag_library?.length ? `Hashtag library: ${profile.hashtag_library.join(" ")}` : null,
      profile?.posting_notes ? `Posting notes: ${profile.posting_notes}` : null,
      `Platform: ${platform}`,
      `Content type: ${content_type}`,
      `Tone: ${tone}`,
      cta ? `Use this CTA: ${cta}` : null,
      source_material ? `Source material:\n${source_material}` : null,
    ].filter(Boolean).join("\n");

    const openAiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAiKey) throw new Error("OPENAI_API_KEY not configured");

    const startTime = Date.now();
    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openAiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        temperature: 0.8,
        max_tokens: 1500,
      }),
    });

    if (!aiResponse.ok) {
      const err = await aiResponse.text();
      throw new Error(`OpenAI error: ${err}`);
    }

    const aiData = await aiResponse.json();
    const usage = aiData.usage ?? {};
    const result = JSON.parse(aiData.choices[0].message.content);

    // Cost: GPT-4o pricing ($5/1M input, $15/1M output)
    const inputCost = (usage.prompt_tokens ?? 0) * 0.000005;
    const outputCost = (usage.completion_tokens ?? 0) * 0.000015;
    const totalCost = inputCost + outputCost;

    await supabase.from("cost_entries").insert({
      workspace_id,
      brand_id,
      amount: totalCost,
      entry_date: new Date().toISOString().split("T")[0],
      unit: "tokens",
      quantity: usage.total_tokens ?? 0,
      notes: `GPT-4o content generation — ${content_type} for ${platform}`,
      metadata: {
        model: "gpt-4o",
        prompt_tokens: usage.prompt_tokens,
        completion_tokens: usage.completion_tokens,
        content_type,
        platform,
        latency_ms: Date.now() - startTime,
      },
    });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
