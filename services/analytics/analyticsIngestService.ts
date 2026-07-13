import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database";

type PlatformMetricsRow =
  Database["public"]["Tables"]["platform_metrics"]["Row"];

export type MetricsSnapshot = PlatformMetricsRow;

export interface SyncMetricsResult {
  postId: string;
  platform: string;
  success: boolean;
  error?: string;
}

export interface SyncMetricsResponse {
  ok: boolean;
  synced: number;
  results: SyncMetricsResult[];
}

export async function syncMetrics(
  workspaceId: string,
): Promise<SyncMetricsResponse> {
  const { data, error } = await supabase.functions.invoke<SyncMetricsResponse>("sync-platform-analytics", {
    body: { workspace_id: workspaceId },
  });
  if (error) throw error;
  if (!data) {
    throw new Error("No sync response returned.");
  }
  return data;
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
