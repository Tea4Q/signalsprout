import { Inngest } from "inngest";

export const inngest = new Inngest({ id: "signalsprout" });

export type PostScheduledEvent = {
  name: "post/scheduled";
  data: {
    post_id: string;
    scheduled_for: string; // ISO 8601
    platform: string;
  };
};

export type PostUnscheduledEvent = {
  name: "post/unscheduled";
  data: {
    post_id: string;
  };
};

export type Events = {
  "post/scheduled": PostScheduledEvent;
  "post/unscheduled": PostUnscheduledEvent;
};
