import { serve } from "inngest/node";
import { inngest } from "../inngest/client";
import { publishScheduledPost } from "../inngest/functions/publish-post";
import { trackPublishedPost } from "../inngest/functions/track-post";

export default serve({
  client: inngest,
  functions: [publishScheduledPost, trackPublishedPost],
});
