import { inngest } from "../client";

/**
 * Receives a post/published event and performs any follow-up processing
 * (analytics sync, notifications, credit deduction, etc.).
 */
export const trackPublishedPost = inngest.createFunction(
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
