import { afterEach, describe, expect, it, vi } from "vitest";
import { retryFailedPost } from "@/services/scheduling/publishQueueService";
import { schedulePost } from "@/services/scheduling/schedulerService";

const supabaseMocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  from: vi.fn(),
  postResult: {
    data: { id: "post-1", scheduled_for: "2027-01-02T03:04:05.000Z" as string | null },
    error: null as Error | null,
  },
  postWriteError: null as Error | null,
  jobWriteError: null as Error | null,
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    functions: { invoke: supabaseMocks.invoke },
    from: supabaseMocks.from,
  },
}));

function queryBuilder(table: string) {
  const result = table === "posts" ? supabaseMocks.postResult : { data: null, error: null };
  const writeError = table === "posts" ? supabaseMocks.postWriteError : supabaseMocks.jobWriteError;
  const query = {
    select: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
    eq: vi.fn(),
    single: vi.fn().mockImplementation(() => Promise.resolve(
      table === "posts" ? supabaseMocks.postResult : result,
    )),
    then: (resolve: (value: { error: Error | null }) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve({ error: writeError }).then(resolve, reject),
  };
  query.select.mockReturnValue(query);
  query.update.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.upsert.mockResolvedValue({ error: supabaseMocks.jobWriteError });
  return query;
}

afterEach(() => {
  vi.resetAllMocks();
  supabaseMocks.postResult = {
    data: { id: "post-1", scheduled_for: "2027-01-02T03:04:05.000Z" },
    error: null,
  };
  supabaseMocks.postWriteError = null;
  supabaseMocks.jobWriteError = null;
});

describe("post scheduling", () => {
  it("sends a scheduling request to the edge function and reports returned errors", async () => {
    supabaseMocks.invoke.mockResolvedValue({ data: { success: true }, error: null });
    await expect(schedulePost("post-1", "2027-01-02T03:04:05.000Z")).resolves.toBeUndefined();
    expect(supabaseMocks.invoke).toHaveBeenCalledWith("schedule-post", {
      body: { post_id: "post-1", scheduled_for: "2027-01-02T03:04:05.000Z" },
    });

    supabaseMocks.invoke.mockResolvedValue({ data: { error: "scheduled_for must be in the future" }, error: null });
    await expect(schedulePost("post-1", "2020-01-01T00:00:00.000Z"))
      .rejects.toThrow("scheduled_for must be in the future");
  });

  it("requeues a failed post with reset retry metadata", async () => {
    const posts = queryBuilder("posts");
    const jobs = queryBuilder("publish_jobs");
    supabaseMocks.from.mockImplementation((table: string) => table === "posts" ? posts : jobs);

    await expect(retryFailedPost("post-1")).resolves.toBeUndefined();
    expect(posts.update).toHaveBeenCalledWith({
      status: "scheduled",
      failure_reason: null,
    });
    expect(jobs.upsert).toHaveBeenCalledWith(
      {
        post_id: "post-1",
        run_at: "2027-01-02T03:04:05.000Z",
        status: "queued",
        attempt_count: 0,
        last_error: null,
      },
      { onConflict: "post_id" },
    );
  });

  it("does not requeue posts without a schedule or after a database failure", async () => {
    supabaseMocks.postResult = {
      data: { id: "post-1", scheduled_for: null },
      error: null,
    };
    const posts = queryBuilder("posts");
    const jobs = queryBuilder("publish_jobs");
    supabaseMocks.from.mockImplementation((table: string) => table === "posts" ? posts : jobs);
    await expect(retryFailedPost("post-1")).rejects.toThrow("Post has no scheduled_for time");
    expect(posts.update).not.toHaveBeenCalled();
    expect(jobs.upsert).not.toHaveBeenCalled();

    supabaseMocks.postResult = {
      data: { id: "post-1", scheduled_for: "2027-01-02T03:04:05.000Z" },
      error: null,
    };
    supabaseMocks.postWriteError = new Error("write failed");
    const postsWithTime = queryBuilder("posts");
    const jobsWithTime = queryBuilder("publish_jobs");
    supabaseMocks.from.mockImplementation((table: string) => table === "posts" ? postsWithTime : jobsWithTime);
    await expect(retryFailedPost("post-1")).rejects.toThrow("write failed");
    expect(jobsWithTime.upsert).not.toHaveBeenCalled();
  });
});
