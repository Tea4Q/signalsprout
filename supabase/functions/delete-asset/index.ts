import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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

    // Verify the caller is authenticated and fetch the asset through RLS
    // (RLS ensures the user can only see assets in their own workspace)
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { asset_id } = await req.json() as { asset_id: string };
    if (!asset_id) {
      return new Response(JSON.stringify({ error: "asset_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch via user-scoped client so RLS enforces workspace membership
    const { data: asset, error: fetchError } = await userClient
      .from("assets")
      .select("file_path")
      .eq("id", asset_id)
      .single();

    if (fetchError || !asset) {
      return new Response(
        JSON.stringify({ error: "Asset not found or access denied" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Use service role for the actual deletions — storage was uploaded with
    // service role so client-side RLS cannot delete it directly.
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { error: storageError } = await serviceClient.storage
      .from("assets")
      .remove([asset.file_path]);

    if (storageError) {
      // Log but do not abort — the DB record should still be cleaned up
      console.error("Storage delete failed:", storageError.message);
    }

    // Remove post_asset join rows first (FK constraint would otherwise block deletion)
    const { error: joinError } = await serviceClient
      .from("post_assets")
      .delete()
      .eq("asset_id", asset_id);

    if (joinError) throw joinError;

    const { error: dbError } = await serviceClient
      .from("assets")
      .delete()
      .eq("id", asset_id);

    if (dbError) throw dbError;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
