/// <reference types="jsr:@supabase/functions-js/edge-runtime.d.ts" />
import { createClient } from "jsr:@supabase/supabase-js@2";

type Period = "weekly" | "monthly" | "yearly";

function periodDateRange(period: Period): { from: string; to: string } {
  const now = new Date();
  let from: Date;
  switch (period) {
    case "weekly":
      from = new Date(now);
      from.setDate(now.getDate() - 7);
      break;
    case "monthly":
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "yearly":
      from = new Date(now.getFullYear(), 0, 1);
      break;
  }
  return {
    from: from.toISOString().slice(0, 10),
    to: now.toISOString().slice(0, 10),
  };
}

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Support on-demand: POST with { workspace_id?, period? }
  let targetWorkspaceId: string | undefined;
  let period: Period = "weekly";
  if (req.method === "POST") {
    try {
      const body = await req.json();
      targetWorkspaceId = body.workspace_id;
      if (body.period) period = body.period;
    } catch {
      // ignore parse errors — use defaults
    }
  }

  const { from, to } = periodDateRange(period);

  // Load system prompt from prompts table or use inline fallback
  const systemPromptFallback = await Deno.readTextFile(
    new URL("../../prompts/recommendation-system.txt", import.meta.url),
  ).catch(
    () =>
      "You are a social media growth analyst. Return a JSON array of recommendations.",
  );

  // Fetch workspaces
  const wsQuery = supabase.from("workspaces").select("id, name");
  if (targetWorkspaceId) wsQuery.eq("id", targetWorkspaceId);
  const { data: workspaces, error: wsError } = await wsQuery;
  if (wsError) {
    return new Response(JSON.stringify({ error: wsError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const allInserted: string[] = [];

  for (const ws of workspaces ?? []) {
    // Fetch brands for this workspace
    const { data: brands } = await supabase
      .from("brands")
      .select("id, name")
      .eq("workspace_id", ws.id);

    if (!brands || brands.length === 0) continue;

    const brandInputs = [];

    for (const brand of brands) {
      // Fetch published posts in period
      const { data: posts } = await supabase
        .from("posts")
        .select("id, platform, title, hook, published_at")
        .eq("workspace_id", ws.id)
        .eq("brand_id", brand.id)
        .eq("status", "published")
        .gte("published_at", `${from}T00:00:00`)
        .lte("published_at", `${to}T23:59:59`);

      if (!posts || posts.length === 0) continue;

      const postIds = posts.map((p) => p.id);

      // Fetch metrics for these posts
      const { data: metrics } = await supabase
        .from("platform_metrics")
        .select("*")
        .in("post_id", postIds)
        .gte("captured_at", `${from}T00:00:00`);

      // Fetch cost entries in period
      const { data: costEntries } = await supabase
        .from("cost_entries")
        .select("amount, cost_source_id, cost_sources(category)")
        .eq("workspace_id", ws.id)
        .eq("brand_id", brand.id)
        .gte("entry_date", from)
        .lte("entry_date", to);

      // Aggregate metrics
      const agg = {
        impressions: 0,
        likes: 0,
        saves: 0,
        comments: 0,
        shares: 0,
        outbound_clicks: 0,
        engagement_sum: 0,
        post_count: posts.length,
        platform_breakdown: {
          instagram: { impressions: 0, engagement_sum: 0, post_count: 0 },
          pinterest: { impressions: 0, engagement_sum: 0, post_count: 0 },
        } as Record<
          string,
          { impressions: number; engagement_sum: number; post_count: number }
        >,
      };

      for (const m of metrics ?? []) {
        agg.impressions += m.impressions ?? 0;
        agg.likes += m.likes ?? 0;
        agg.saves += m.saves ?? 0;
        agg.comments += m.comments ?? 0;
        agg.shares += m.shares ?? 0;
        agg.outbound_clicks += m.outbound_clicks ?? 0;
        agg.engagement_sum += m.engagement_rate ?? 0;
        const plat = m.platform as "instagram" | "pinterest";
        if (agg.platform_breakdown[plat]) {
          agg.platform_breakdown[plat].impressions += m.impressions ?? 0;
          agg.platform_breakdown[plat].engagement_sum += m.engagement_rate ?? 0;
          agg.platform_breakdown[plat].post_count += 1;
        }
      }

      const metricCount = (metrics ?? []).length;
      const avgEngagement =
        metricCount > 0 ? agg.engagement_sum / metricCount : 0;

      // Aggregate costs
      const costAgg = {
        total: 0,
        ai_text: 0,
        ai_images: 0,
        infra: 0,
        other: 0,
      };
      for (const c of costEntries ?? []) {
        costAgg.total += c.amount;
        const cat =
          (c.cost_sources as Record<string, string> | null)?.category ??
          "other";
        if (cat === "ai_text") costAgg.ai_text += c.amount;
        else if (cat === "ai_images") costAgg.ai_images += c.amount;
        else if (cat === "infra") costAgg.infra += c.amount;
        else costAgg.other += c.amount;
      }

      // Top post
      const topMetric = (metrics ?? []).sort(
        (a, b) => (b.engagement_rate ?? 0) - (a.engagement_rate ?? 0),
      )[0];
      const topPost = topMetric
        ? (posts.find((p) => p.id === topMetric.post_id) ?? null)
        : null;

      brandInputs.push({
        brandId: brand.id,
        brandName: brand.name,
        metrics: {
          impressions: agg.impressions,
          likes: agg.likes,
          saves: agg.saves,
          comments: agg.comments,
          shares: agg.shares,
          outbound_clicks: agg.outbound_clicks,
          engagement_rate: avgEngagement,
          post_count: agg.post_count,
          platform_breakdown: Object.fromEntries(
            Object.entries(agg.platform_breakdown).map(([k, v]) => [
              k,
              {
                impressions: v.impressions,
                engagement_rate:
                  v.post_count > 0 ? v.engagement_sum / v.post_count : 0,
                post_count: v.post_count,
              },
            ]),
          ),
        },
        costs: {
          total: costAgg.total,
          by_category: {
            ai_text: costAgg.ai_text,
            ai_images: costAgg.ai_images,
            infra: costAgg.infra,
            other: costAgg.other,
          },
          cost_per_post: posts.length > 0 ? costAgg.total / posts.length : null,
        },
        top_post: topPost
          ? {
              title: topPost.title,
              hook: topPost.hook,
              platform: topPost.platform,
              engagement_rate: topMetric?.engagement_rate ?? 0,
            }
          : null,
      });
    }

    if (brandInputs.length === 0) continue;

    // Call GPT-4o
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) continue;

    const gptPayload = {
      model: "gpt-4o",
      temperature: 0.3,
      max_tokens: 1500,
      messages: [
        { role: "system", content: systemPromptFallback },
        {
        role: "user",
          content: JSON.stringify({ period, brands: brandInputs }),
        },
      ],
      response_format: { type: "json_object" },
    };

    let recommendations: {
      brand_id: string;
      action: string;
      summary: string;
      confidence_score: number;
      reasoning?: string;
    }[] = [];

    try {
      const gptRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify(gptPayload),
      });

      const gptJson = await gptRes.json();
      const raw = gptJson?.choices?.[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(raw);
      // Model may return array directly or wrapped in a key
      recommendations = Array.isArray(parsed)
        ? parsed
        : (parsed.recommendations ?? []);
    } catch {
      continue;
    }

    // Insert recommendations
    const validActions = new Set([
      "scale",
      "keep_testing",
      "rewrite",
      "pause",
      "remove",
    ]);
    for (const rec of recommendations) {
      if (!rec.brand_id || !rec.action || !rec.summary) continue;
      if (!validActions.has(rec.action)) continue;

      const { data: inserted } = await supabase
        .from("recommendations")
        .insert({
          workspace_id: ws.id,
          brand_id: rec.brand_id,
          action: rec.action as
            | "scale"
            | "keep_testing"
            | "rewrite"
            | "pause"
            | "remove",
          period,
          summary: rec.summary,
          confidence_score: Math.min(
            1,
            Math.max(0, rec.confidence_score ?? 0.5),
          ),
          source_data: { reasoning: rec.reasoning ?? "", from, to },
        })
        .select("id")
        .single();

      if (inserted?.id) allInserted.push(inserted.id);
    }

    await supabase.from("audit_logs").insert({
      workspace_id: ws.id,
      entity_type: "recommendations",
      action: "recommendations.generated",
      metadata: {
        period,
        count: recommendations.length,
        brands: brandInputs.map((b) => b.brandId),
      },
    });
  }

  return new Response(
    JSON.stringify({ ok: true, inserted: allInserted.length }),
    { headers: { "Content-Type": "application/json" } },
  );
});
