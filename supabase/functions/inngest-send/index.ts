/**
 * inngest-send — Internal proxy that sends an event to Inngest.
 *
 * Called by client-side code (schedulerService) for operations that need
 * to fire Inngest events without exposing INNGEST_EVENT_KEY to the client.
 *
 * POST { name: string, data: Record<string, unknown> }
 * Requires: valid user JWT (Authorization header)
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Allowed event names this proxy will forward — explicit allowlist for safety
const ALLOWED_EVENTS = new Set(["post/unscheduled"]);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the caller is an authenticated user
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { name, data } = await req.json() as {
      name: string;
      data: Record<string, unknown>;
    };

    if (!name || !ALLOWED_EVENTS.has(name)) {
      return new Response(
        JSON.stringify({ error: `Event "${name}" is not permitted` }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const inngestEventKey = Deno.env.get("INNGEST_EVENT_KEY");
    if (!inngestEventKey) {
      throw new Error("INNGEST_EVENT_KEY is not configured");
    }

    // Send event to Inngest Events API
    const res = await fetch(`https://inn.gs/e/${inngestEventKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, data }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Inngest event delivery failed: ${errText}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
