import { supabase } from "@/lib/supabase";

async function getEdgeFunctionError(error: Error): Promise<Error> {
  try {
    const context = (error as Error & {
      context?: { json?: () => Promise<{ error?: string; message?: string }> };
    }).context;
    const body = await context?.json?.();
    const message = body?.error ?? body?.message;
    if (message) return new Error(message);
  } catch {
    // Keep the original invoke error when the response has no readable body.
  }
  return error;
}

export async function schedulePost(
  postId: string,
  scheduledFor: string,
): Promise<void> {
  const { data, error } = await supabase.functions.invoke("schedule-post", {
    body: { post_id: postId, scheduled_for: scheduledFor },
  });
  if (error) throw await getEdgeFunctionError(error);
  if (data?.error) throw new Error(data.error);
}

export async function reschedulePost(
  postId: string,
  newTime: string,
): Promise<void> {
  return schedulePost(postId, newTime);
}

export async function cancelSchedule(postId: string): Promise<void> {
  // Revert post to approved status and remove all publish_jobs for this post
  const { error: postError } = await supabase
    .from("posts")
    .update({ status: "approved", scheduled_for: null })
    .eq("id", postId);
  if (postError) throw postError;

  const { error: jobError } = await supabase
    .from("publish_jobs")
    .delete()
    .eq("post_id", postId)
    .in("status", ["queued", "failed"]);
  if (jobError) throw jobError;

  // Cancel the sleeping Inngest function for this post (non-blocking — ignore errors)
  supabase.functions
    .invoke("inngest-send", {
      body: { name: "post/unscheduled", data: { post_id: postId } },
    })
    .catch((err) => console.warn("Inngest cancel event failed (non-fatal):", err));
}

export async function publishNow(postId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke("publish-now", {
    body: { post_id: postId },
  });
  if (error) throw await getEdgeFunctionError(error);
  if (data?.error) throw new Error(data.error);
}
