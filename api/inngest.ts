import { serve } from "inngest/node";
import { inngest } from "../inngest/client";
import { publishScheduledPost } from "../inngest/functions/publish-post";

// Use the canonical production URL so Inngest always registers the right endpoint.
// VERCEL_URL is the deployment-specific URL (set automatically by Vercel);
// INNGEST_SERVE_ORIGIN overrides it for the production alias.
const serveOrigin =
  process.env.INNGEST_SERVE_ORIGIN ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);

export default serve({
  client: inngest,
  functions: [publishScheduledPost],
  ...(serveOrigin ? { serveOrigin } : {}),
});
