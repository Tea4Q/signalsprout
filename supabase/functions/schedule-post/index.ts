import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SchedulePostRequest {
  post_id: string;
  scheduled_for: string; // ISO 8601
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Build a client scoped to the calling user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body: SchedulePostRequest = await req.json();
    const { post_id, scheduled_for } = body;

    if (!post_id || !scheduled_for) {
      return new Response(
        JSON.stringify({ error: "post_id and scheduled_for are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Validate scheduled_for is in the future
    if (new Date(scheduled_for) <= new Date()) {
      return new Response(
        JSON.stringify({ error: "scheduled_for must be in the future" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Fetch post via user-scoped client (RLS enforces workspace membership)
    const { data: post, error: postError } = await supabase
      .from("posts")
      .select("id, workspace_id, status, social_account_id, platform")
      .eq("id", post_id)
      .single();

    if (postError || !post) {
      return new Response(
        JSON.stringify({ error: "Post not found or access denied" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Get caller's user id
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update post status + scheduled_for
    const { error: updateError } = await serviceClient
      .from("posts")
      .update({ status: "scheduled", scheduled_for })
      .eq("id", post_id);

    if (updateError) throw updateError;

    // Delete any existing queued publish_jobs for this post, then insert fresh
    await serviceClient
      .from("publish_jobs")
      .delete()
      .eq("post_id", post_id)
      .eq("status", "queued");

    const { data: job, error: jobError } = await serviceClient
      .from("publish_jobs")
      .insert({
        post_id,
        run_at: scheduled_for,
        status: "queued",
        attempt_count: 0,
      })
      .select()
      .single();

    if (jobError) throw jobError;

    // Audit log
    await serviceClient.from("audit_logs").insert({
      workspace_id: post.workspace_id,
      action: "post.scheduled",
      entity_type: "post",
      entity_id: post_id,
      actor_user_id: user.id,
      metadata: { scheduled_for, publish_job_id: job.id },
    });

    // Fire Inngest event so the publish-scheduled-post function can sleep
    // until the scheduled time and then trigger the queue processor.
    // Non-blocking: a delivery failure does not fail the schedule operation.
    const inngestEventKey = Deno.env.get("INNGEST_API_KEY") ?? Deno.env.get("INNGEST_EVENT_KEY");
    if (inngestEventKey) {
      try {
        const inngestRes = await fetch(`https://inn.gs/e/${inngestEventKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "post/scheduled",
            data: {
              post_id,
              scheduled_for,
              platform: post.platform,
            },
          }),
        });
        if (!inngestRes.ok) {
          const body = await inngestRes.text();
          console.error(`Inngest event rejected (${inngestRes.status}): ${body}`);
        }
      } catch (inngestErr) {
        console.error("Inngest event delivery failed (non-fatal):", inngestErr);
      }
    } else {
      console.warn("No INNGEST_API_KEY secret set — post/scheduled event not sent");
    }

    return new Response(
      JSON.stringify({ success: true, publish_job_id: job.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
