import { serve } from "inngest/node";
import { inngest } from "../inngest/client";
import { publishScheduledPost } from "../inngest/functions/publish-post";

/**
 * Vercel serverless handler for Inngest.
 * Inngest will call POST /api/inngest to execute function steps.
 * Register this URL in the Inngest dashboard: https://your-app.vercel.app/api/inngest
 */
export default serve({
  client: inngest,
  functions: [publishScheduledPost],
});
