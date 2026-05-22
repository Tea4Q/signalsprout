// CommonJS handler — avoids ESM/CJS mismatch from root tsconfig "module": "ES2022"
const { serve } = require("inngest/node");
const { Inngest } = require("inngest");

const inngest = new Inngest({
  id: "signalsprout",
  signingKey: process.env.INNGEST_SIGNING_KEY,
  // Env var is INNGEST_API_KEY; fall back to INNGEST_EVENT_KEY for older configs
  eventKey: process.env.INNGEST_API_KEY || process.env.INNGEST_EVENT_KEY,
});

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
      const functionName =
        platform === "pinterest" ? "publish-pinterest" : "publish-instagram";

      const supabaseUrl = process.env.SUPABASE_URL;
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !serviceRoleKey) {
        throw new Error(
          `Missing Vercel env vars: SUPABASE_URL=${!!supabaseUrl}, SUPABASE_SERVICE_ROLE_KEY=${!!serviceRoleKey}`,
        );
      }

      const res = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Publisher function failed (${res.status}): ${errText}`);
      }
      return res.json();
    });

    return { post_id, platform, result };
  },
);

// INNGEST_BASE_URL is the full endpoint URL (e.g. https://signalsprout.vercel.app/api/inngest).
// serve() only needs the origin; extract it so VERCEL_URL (which changes per deployment) is
// used only as a last resort.
function getServeOrigin() {
  if (process.env.INNGEST_SERVE_ORIGIN) return process.env.INNGEST_SERVE_ORIGIN;
  if (process.env.INNGEST_BASE_URL) {
    try { return new URL(process.env.INNGEST_BASE_URL).origin; } catch {}
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return undefined;
}
const serveOrigin = getServeOrigin();

const trackPublishedPost = inngest.createFunction(
  {
    id: "track-published-post",
    name: "Track Published Post",
    triggers: [{ event: "post/published" }],
  },
  async ({ event }) => {
    const { post_id, platform, external_post_id, mode } = event.data;
    // Placeholder for post-publish processing:
    // analytics sync, notifications, credit deduction, etc.
    return { post_id, platform, external_post_id, mode, received: true };
  },
);

module.exports = serve({
  client: inngest,
  functions: [publishScheduledPost, trackPublishedPost],
  ...(serveOrigin ? { serveOrigin } : {}),
});
