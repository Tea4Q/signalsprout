import { afterEach, describe, expect, it, vi } from "vitest";

const registration = vi.hoisted(() => ({
  options: undefined as { retries: number } | undefined,
  handler: undefined as ((input: {
    event: { data: { post_id: string; scheduled_for: string; platform: string } };
    step: {
      sleepUntil: (name: string, time: string) => Promise<void>;
      run: (name: string, callback: () => Promise<unknown>) => Promise<unknown>;
    };
  }) => Promise<unknown>) | undefined,
}));

vi.mock("../inngest/client", () => ({
  inngest: {
    createFunction: (
      options: { retries: number },
      handler: typeof registration.handler,
    ) => {
      registration.options = options;
      registration.handler = handler;
      return {};
    },
  },
}));

import "../inngest/functions/publish-post";

const event = {
  post_id: "post-1",
  scheduled_for: "2027-01-02T03:04:05.000Z",
  platform: "tiktok",
};

function stepMock() {
  return {
    sleepUntil: vi.fn().mockResolvedValue(undefined),
    run: vi.fn((_name: string, callback: () => Promise<unknown>) => callback()),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("scheduled publishing retries", () => {
  it("configures three Inngest retries and waits until the scheduled time", async () => {
    expect(registration.options?.retries).toBe(3);
    const step = stepMock();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    }));

    await expect(registration.handler!({ event: { data: event }, step }))
      .resolves.toEqual({ post_id: "post-1", platform: "tiktok", result: { success: true } });
    expect(step.sleepUntil).toHaveBeenCalledWith("wait-until-scheduled-time", event.scheduled_for);
    expect(step.run).toHaveBeenCalledWith("trigger-platform-publisher", expect.any(Function));
  });

  it("throws publisher HTTP failures so Inngest retries them", async () => {
    const step = stepMock();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => "temporarily unavailable",
    }));

    await expect(registration.handler!({ event: { data: event }, step }))
      .rejects.toThrow("Publisher function failed (503): temporarily unavailable");
  });

  it("routes Instagram, Facebook, and Pinterest to their publisher functions", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const step = stepMock();

    for (const [platform, expectedFunction] of [
      ["instagram", "publish-instagram"],
      ["facebook", "publish-facebook"],
      ["pinterest", "publish-pinterest"],
    ]) {
      await registration.handler!({
        event: { data: { ...event, platform } },
        step,
      });
      expect(fetchMock).toHaveBeenLastCalledWith(
        expect.stringContaining(`/functions/v1/${expectedFunction}`),
        expect.objectContaining({ method: "POST" }),
      );
    }
  });
});
