import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database";

type MetricPeriod = Database["public"]["Enums"]["metric_period"];
type RecommendationRow = Database["public"]["Tables"]["recommendations"]["Row"];

export type Recommendation = RecommendationRow;

export async function getRecommendations(
  workspaceId: string,
  period?: MetricPeriod,
): Promise<Recommendation[]> {
  let q = supabase
    .from("recommendations")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (period) q = q.eq("period", period);

  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function generateRecommendations(
  workspaceId: string,
  period: MetricPeriod = "weekly",
): Promise<void> {
  const { error } = await supabase.functions.invoke(
    "generate-recommendations",
    { body: { workspace_id: workspaceId, period } },
  );
  if (error) throw error;
}

export async function dismissRecommendation(id: string): Promise<void> {
  const { error } = await supabase
    .from("recommendations")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
