import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database";

type PostRow = Database["public"]["Tables"]["posts"]["Row"];
type PublishJobRow = Database["public"]["Tables"]["publish_jobs"]["Row"];

export type QueueItem = {
  id: string;
  run_at: string;
  status: string;
  last_error: string | null;
  attempt_count: number;
  post: {
    id: string;
    title: string | null;
    caption: string | null;
    hook: string | null;
    platform: string;
    status: string;
    brand_id: string;
  } | null;
};

export interface DateRange {
  from: string; // ISO date
  to: string; // ISO date
}

export async function getQueue(
  workspaceId: string,
  dateRange?: DateRange,
): Promise<QueueItem[]> {
  let query = supabase
    .from("publish_jobs")
    .select(`*, posts!inner(*)`)
    .eq("posts.workspace_id", workspaceId)
    .order("run_at", { ascending: true });

  if (dateRange) {
    query = query.gte("run_at", dateRange.from).lte("run_at", dateRange.to);
  }

  const { data, error } = await query;
  if (error) throw error;
  // Supabase returns the joined table as the key "posts" (table name).
  // Map it to "post" to match the QueueItem shape.
  return ((data ?? []) as unknown as Array<Record<string, unknown>>).map((row) => ({
    ...row,
    post: row["posts"] ?? null,
  })) as unknown as QueueItem[];
}

export async function retryFailedPost(postId: string): Promise<void> {
  // Reset post status to scheduled and re-queue
  const { data: post, error: postFetchError } = await supabase
    .from("posts")
    .select("id, scheduled_for")
    .eq("id", postId)
    .single();
  if (postFetchError) throw postFetchError;
  if (!post.scheduled_for) throw new Error("Post has no scheduled_for time");

  const { error: postUpdateError } = await supabase
    .from("posts")
    .update({ status: "scheduled", failure_reason: null })
    .eq("id", postId);
  if (postUpdateError) throw postUpdateError;

  // Upsert a fresh queued publish_jobs row
  const { error: jobError } = await supabase
    .from("publish_jobs")
    .upsert(
      {
        post_id: postId,
        run_at: post.scheduled_for,
        status: "queued",
        attempt_count: 0,
        last_error: null,
      },
      { onConflict: "post_id" },
    );
  if (jobError) throw jobError;
}

export async function publishNow(postId: string): Promise<void> {
  const runAt = new Date().toISOString();
  const { error: postError } = await supabase
    .from("posts")
    .update({ status: "scheduled", scheduled_for: runAt, failure_reason: null })
    .eq("id", postId);
  if (postError) throw postError;
  const { error: jobError } = await supabase
    .from("publish_jobs")
    .upsert(
      { post_id: postId, run_at: runAt, status: "queued", attempt_count: 0, last_error: null },
      { onConflict: "post_id" },
    );
  if (jobError) throw jobError;
}

export async function reschedulePost(postId: string, newScheduledFor: string): Promise<void> {
  const { error: postError } = await supabase
    .from("posts")
    .update({ scheduled_for: newScheduledFor })
    .eq("id", postId);
  if (postError) throw postError;
  // Also update the publish job if one exists
  await supabase
    .from("publish_jobs")
    .update({ run_at: newScheduledFor })
    .eq("post_id", postId);
}

export async function getFailedPosts(workspaceId: string): Promise<PostRow[]> {
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("status", "failed")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export type AuditLogEntry = {
  id: string;
  action: string;
  created_at: string;
  metadata: Record<string, unknown>;
};

export async function getPostAuditLog(postId: string): Promise<AuditLogEntry[]> {
  const { data, error } = await supabase
    .from("audit_logs")
    .select("id, action, created_at, metadata")
    .eq("entity_id", postId)
    .in("action", ["post.publish_failed", "post.published"])
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data ?? []) as AuditLogEntry[];
}
