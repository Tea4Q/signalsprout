import { inngest } from "../client";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Waits until a post's scheduled_for time, then triggers the appropriate
 * Supabase queue processor (publish-instagram or publish-pinterest).
 * Can be cancelled by a "post/unscheduled" event with a matching post_id.
 */
export const publishScheduledPost = inngest.createFunction(
  {
    id: "publish-scheduled-post",
    name: "Publish Scheduled Post",
    cancelOn: [
      {
        event: "post/unscheduled",
        match: "data.post_id",
      },
    ],
    retries: 3,
  },
  { event: "post/scheduled" },
  async ({ event, step }) => {
    const { post_id, scheduled_for, platform } = event.data;

    // Sleep until the exact scheduled time
    await step.sleepUntil("wait-until-scheduled-time", scheduled_for);

    // Trigger the appropriate platform publisher
    const result = await step.run("trigger-platform-publisher", async () => {
      const functionName =
        platform === "pinterest" ? "publish-pinterest" : "publish-instagram";

      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/${functionName}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
            "Content-Type": "application/json",
          },
          // Body is intentionally empty — the publisher processes all due queue jobs
          body: JSON.stringify({}),
        },
      );

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Publisher function failed (${res.status}): ${errText}`);
      }

      return (await res.json()) as Record<string, unknown>;
    });

    return { post_id, platform, result };
  },
);
