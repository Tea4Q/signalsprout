// Self-contained Inngest serve handler for Vercel.
// No local TypeScript imports — avoids esbuild CJS bundling conflicts.
import { serve } from "inngest/node";
import { Inngest } from "inngest";

const inngest = new Inngest({ id: "signalsprout" });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const publishScheduledPost = inngest.createFunction(
  {
    id: "publish-scheduled-post",
    name: "Publish Scheduled Post",
    triggers: [{ event: "post/scheduled" }],
    cancelOn: [{ event: "post/unscheduled", match: "data.post_id" }],
    retries: 3,
  },
  async ({ event, step }) => {
    const { post_id, scheduled_for, platform } = event.data;

    await step.sleepUntil("wait-until-scheduled-time", scheduled_for);

    const result = await step.run("trigger-platform-publisher", async () => {
      const PLATFORM_FUNCTION = {
        pinterest: "publish-pinterest",
        facebook: "publish-facebook",
        tiktok: "publish-tiktok",
      };
      const functionName = PLATFORM_FUNCTION[platform] ?? "publish-instagram";

      const res = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ post_id }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Publisher function failed (${res.status}): ${errText}`);
      }

      return /** @type {Record<string, unknown>} */ (await res.json());
    });

    return { post_id, platform, result };
  },
);

const trackPublishedPost = inngest.createFunction(
  {
    id: "track-published-post",
    name: "Track Published Post",
    triggers: [{ event: "post/published" }],
  },
  async ({ event }) => {
    const { post_id, platform, external_post_id, mode } = event.data;
    return { post_id, platform, external_post_id, mode, received: true };
  },
);

const syncPlatformAnalyticsNightly = inngest.createFunction(
  {
    id: "sync-platform-analytics-nightly",
    name: "Sync Platform Analytics Nightly",
    triggers: [{ cron: "TZ=UTC 0 0 * * *" }],
  },
  async ({ step }) => {
    const result = await step.run("sync-platform-analytics", async () => {
      if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
        throw new Error("Supabase URL or service role key is not configured.");
      }

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/sync-platform-analytics`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Analytics sync failed (${response.status}): ${errorText}`,
        );
      }

      return await response.json();
    });

    const failedPosts = (result.results ?? []).filter((row) => !row.success).length;
    const failedAccounts = (result.account_insights ?? []).filter(
      (row) => !row.success,
    ).length;

    return {
      checkedPosts: result.synced ?? 0,
      failedPosts,
      failedAccounts,
    };
  },
);

export default serve({
  client: inngest,
  functions: [
    publishScheduledPost,
    trackPublishedPost,
    syncPlatformAnalyticsNightly,
  ],
});
