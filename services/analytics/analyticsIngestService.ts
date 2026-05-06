import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database";

type PlatformMetricsRow =
  Database["public"]["Tables"]["platform_metrics"]["Row"];

export type MetricsSnapshot = PlatformMetricsRow;

export async function syncMetrics(workspaceId: string): Promise<void> {
  const { error } = await supabase.functions.invoke("sync-platform-analytics", {
    body: { workspace_id: workspaceId },
  });
  if (error) throw error;
}

export async function getMetrics(postId: string): Promise<MetricsSnapshot[]> {
  const { data, error } = await supabase
    .from("platform_metrics")
    .select("*")
    .eq("post_id", postId)
    .order("captured_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getLatestMetrics(
  postId: string,
): Promise<MetricsSnapshot | null> {
  const { data, error } = await supabase
    .from("platform_metrics")
    .select("*")
    .eq("post_id", postId)
    .order("captured_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}
