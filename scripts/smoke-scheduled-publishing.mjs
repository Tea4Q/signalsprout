const required = [
  "SMOKE_SUPABASE_URL",
  "SMOKE_SUPABASE_ANON_KEY",
  "SMOKE_EMAIL",
  "SMOKE_PASSWORD",
  "SMOKE_POST_ID",
];

for (const name of required) {
  if (!process.env[name]) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
}

if (process.env.SMOKE_CONFIRM !== "publish") {
  throw new Error(
    'This smoke test publishes a dedicated test post. Set SMOKE_CONFIRM=publish to continue.',
  );
}

const baseUrl = process.env.SMOKE_SUPABASE_URL.replace(/\/$/, "");
const anonKey = process.env.SMOKE_SUPABASE_ANON_KEY;
const postId = process.env.SMOKE_POST_ID;
const delaySeconds = Number(process.env.SMOKE_DELAY_SECONDS ?? 90);
const timeoutSeconds = Number(process.env.SMOKE_TIMEOUT_SECONDS ?? 420);

if (!Number.isFinite(delaySeconds) || delaySeconds < 30) {
  throw new Error("SMOKE_DELAY_SECONDS must be at least 30 seconds.");
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      apikey: anonKey,
      ...(options.headers ?? {}),
      "Content-Type": "application/json",
    },
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!response.ok) {
    throw new Error(`${options.method ?? "GET"} ${path} failed (${response.status}): ${text}`);
  }
  return body;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const auth = await request("/auth/v1/token?grant_type=password", {
  method: "POST",
  body: JSON.stringify({
    email: process.env.SMOKE_EMAIL,
    password: process.env.SMOKE_PASSWORD,
  }),
});

const accessToken = auth.access_token;
if (!accessToken) throw new Error("Supabase login did not return an access token.");

const scheduledFor = new Date(Date.now() + delaySeconds * 1000).toISOString();
console.log(`Scheduling smoke post ${postId} for ${scheduledFor}`);

const scheduleResponse = await request("/functions/v1/schedule-post", {
  method: "POST",
  headers: { Authorization: `Bearer ${accessToken}` },
  body: JSON.stringify({ post_id: postId, scheduled_for: scheduledFor }),
});

if (!scheduleResponse?.success || !scheduleResponse.publish_job_id) {
  throw new Error(`schedule-post returned an unexpected response: ${JSON.stringify(scheduleResponse)}`);
}

const jobId = scheduleResponse.publish_job_id;
const deadline = Date.now() + timeoutSeconds * 1000;
let lastStatus = "unknown";

while (Date.now() < deadline) {
  const [jobs, posts] = await Promise.all([
    request(`/rest/v1/publish_jobs?id=eq.${encodeURIComponent(jobId)}&select=id,status,attempt_count,last_error`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
    request(`/rest/v1/posts?id=eq.${encodeURIComponent(postId)}&select=id,status,published_at,failure_reason`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  ]);

  const job = jobs?.[0];
  const post = posts?.[0];
  lastStatus = `job=${job?.status ?? "missing"}, post=${post?.status ?? "missing"}`;
  console.log(`${new Date().toISOString()} ${lastStatus}`);

  if (post?.status === "published" && job?.status === "done") {
    console.log(`Scheduled publishing smoke test passed for post ${postId}.`);
    process.exit(0);
  }

  if (post?.status === "failed" || job?.status === "failed") {
    throw new Error(
      `Scheduled publishing failed: ${lastStatus}; ` +
        `${post?.failure_reason ?? job?.last_error ?? "no failure reason"}`,
    );
  }

  await sleep(10_000);
}

throw new Error(`Timed out waiting for scheduled publishing: ${lastStatus}`);
