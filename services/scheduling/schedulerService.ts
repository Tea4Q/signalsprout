import { supabase } from "@/lib/supabase";

export async function schedulePost(
  postId: string,
  scheduledFor: string,
): Promise<void> {
  const { data, error } = await supabase.functions.invoke("schedule-post", {
    body: { post_id: postId, scheduled_for: scheduledFor },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}

export async function reschedulePost(
  postId: string,
  newTime: string,
): Promise<void> {
  return schedulePost(postId, newTime);
}

export async function cancelSchedule(postId: string): Promise<void> {
  // Revert post to approved status and remove queued publish_jobs
  const { error: postError } = await supabase
    .from("posts")
    .update({ status: "approved", scheduled_for: null })
    .eq("id", postId);
  if (postError) throw postError;

  const { error: jobError } = await supabase
    .from("publish_jobs")
    .delete()
    .eq("post_id", postId)
    .eq("status", "queued");
  if (jobError) throw jobError;
}
