import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const MASTER_KEY_ENV = "CREDENTIAL_MASTER_KEY";

async function getEncryptKey(): Promise<CryptoKey> {
  const raw = Deno.env.get(MASTER_KEY_ENV);
  if (!raw) throw new Error("CREDENTIAL_MASTER_KEY secret not configured");
  const encoded = new TextEncoder().encode(raw);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  return crypto.subtle.importKey("raw", hashBuffer, { name: "AES-GCM" }, false, [
    "encrypt",
  ]);
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify calling user's JWT
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { credential_id, new_value } = body as {
      credential_id: string;
      new_value: string;
    };

    if (!credential_id || !new_value) {
      return new Response(
        JSON.stringify({ error: "Missing credential_id or new_value" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // Fetch existing row to verify workspace membership
    const { data: existing, error: fetchError } = await serviceClient
      .from("credential_vault")
      .select("id, workspace_id, name, service, environment")
      .eq("id", credential_id)
      .single();

    if (fetchError || !existing) {
      return new Response(JSON.stringify({ error: "Credential not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Verify caller is a workspace member
    const { data: member } = await serviceClient
      .from("workspace_members")
      .select("id")
      .eq("workspace_id", existing.workspace_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!member) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Re-encrypt with a fresh IV
    const masterKey = await getEncryptKey();
    const newIv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(new_value);
    const cipherBuffer = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: newIv },
      masterKey,
      encoded,
    );

    const encryptedValue = btoa(
      String.fromCharCode(...new Uint8Array(cipherBuffer)),
    );
    const ivBase64 = btoa(String.fromCharCode(...newIv));

    // Update the vault row
    const { error: updateError } = await serviceClient
      .from("credential_vault")
      .update({
        encrypted_value: encryptedValue,
        iv: ivBase64,
        last_rotated_at: new Date().toISOString(),
      })
      .eq("id", credential_id);

    if (updateError) throw updateError;

    // Write audit log
    await serviceClient.from("audit_logs").insert({
      workspace_id: existing.workspace_id,
      actor_user_id: user.id,
      entity_type: "credential_vault",
      entity_id: credential_id,
      action: "credential_rotated",
      metadata: {
        name: existing.name,
        service: existing.service,
        environment: existing.environment,
      },
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("rotate-credential error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
