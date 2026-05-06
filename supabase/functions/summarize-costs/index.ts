/// <reference types="jsr:@supabase/functions-js/edge-runtime.d.ts" />
import { createClient } from "jsr:@supabase/supabase-js@2";

const PERIODS = ["daily", "weekly", "monthly", "yearly"] as const;
type Period = (typeof PERIODS)[number];

function periodDateRange(period: Period): { from: string; to: string } {
  const now = new Date();
  let from: Date;

  switch (period) {
    case "daily":
      from = new Date(now);
      from.setHours(0, 0, 0, 0);
      break;
    case "weekly":
      from = new Date(now);
      from.setDate(now.getDate() - now.getDay());
      from.setHours(0, 0, 0, 0);
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

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: workspaces, error: wsError } = await supabase
    .from("workspaces")
    .select("id");

  if (wsError) {
    return new Response(JSON.stringify({ error: wsError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const summaries: {
    workspaceId: string;
    period: string;
    totalSpent: number;
    alertFired: boolean;
  }[] = [];

  for (const ws of workspaces ?? []) {
    for (const period of PERIODS) {
      const { from, to } = periodDateRange(period);

      // Aggregate spend for this workspace + period
      const { data: entries, error: entryError } = await supabase
        .from("cost_entries")
        .select("amount")
        .eq("workspace_id", ws.id)
        .gte("entry_date", from)
        .lte("entry_date", to);

      if (entryError) continue;

      const totalSpent = (entries ?? []).reduce(
        (sum, e) => sum + (e.amount ?? 0),
        0,
      );

      // Load workspace-level budget rules for this period
      const { data: rules } = await supabase
        .from("budget_rules")
        .select("*")
        .eq("workspace_id", ws.id)
        .eq("period", period)
        .is("brand_id", null);

      let alertFired = false;

      for (const rule of rules ?? []) {
        if (rule.spend_limit <= 0) continue;

        const percent = (totalSpent / rule.spend_limit) * 100;

        if (percent >= rule.alert_threshold_percent) {
          alertFired = true;

          // Avoid duplicate alerts — check if a recommendation was already
          // created today for this workspace+period with action=pause
          const today = new Date().toISOString().slice(0, 10);
          const { data: existing } = await supabase
            .from("recommendations")
            .select("id")
            .eq("workspace_id", ws.id)
            .eq("period", period)
            .eq("action", "pause")
            .gte("created_at", `${today}T00:00:00`)
            .limit(1);

          if ((existing ?? []).length > 0) continue;

          await supabase.from("recommendations").insert({
            workspace_id: ws.id,
            action: "pause" as const,
            period,
            summary: `Budget alert: ${period} spend is ${Math.round(percent)}% of $${rule.spend_limit.toFixed(2)} limit ($${totalSpent.toFixed(2)} spent). Consider pausing non-essential AI generation.`,
            source_data: {
              totalSpent,
              percent: Math.round(percent),
              limit: rule.spend_limit,
              threshold: rule.alert_threshold_percent,
              from,
              to,
            },
          });
        }
      }

      summaries.push({ workspaceId: ws.id, period, totalSpent, alertFired });
    }
  }

  return new Response(JSON.stringify({ ok: true, summaries }), {
    headers: { "Content-Type": "application/json" },
  });
});
