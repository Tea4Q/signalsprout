import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const MASTER_KEY_ENV = "CREDENTIAL_MASTER_KEY";

async function getMasterKey(): Promise<CryptoKey> {
  const raw = Deno.env.get(MASTER_KEY_ENV);
  if (!raw) throw new Error("CREDENTIAL_MASTER_KEY secret not configured");
  // Derive a 32-byte key from the secret using SHA-256
  const encoded = new TextEncoder().encode(raw);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  return crypto.subtle.importKey("raw", hashBuffer, { name: "AES-GCM" }, false, [
    "encrypt",
  ]);
}

Deno.serve(async (req: Request) => {
  try {
    // Only accept POST
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Authenticate the calling user via JWT
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

    // Verify the caller's JWT
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
    const { workspace_id, name, service, environment, value, rotation_due_at } =
      body as {
        workspace_id: string;
        name: string;
        service: string;
        environment: string;
        value: string;
        rotation_due_at?: string;
      };

    if (!workspace_id || !name || !service || !environment || !value) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // Verify user is a workspace member before storing
    const { data: member } = await serviceClient
      .from("workspace_members")
      .select("id")
      .eq("workspace_id", workspace_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!member) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Encrypt the secret value with AES-256-GCM
    const masterKey = await getMasterKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(value);
    const cipherBuffer = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      masterKey,
      encoded,
    );

    const encryptedValue = btoa(
      String.fromCharCode(...new Uint8Array(cipherBuffer)),
    );
    const ivBase64 = btoa(String.fromCharCode(...iv));

    // Insert into credential_vault — no plaintext value stored
    const { data: row, error: insertError } = await serviceClient
      .from("credential_vault")
      .insert({
        workspace_id,
        name,
        service,
        environment,
        encrypted_value: encryptedValue,
        iv: ivBase64,
        key_metadata: { name, service, environment },
        rotation_due_at: rotation_due_at ?? null,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (insertError) throw insertError;

    // Write audit log
    await serviceClient.from("audit_logs").insert({
      workspace_id,
      actor_user_id: user.id,
      entity_type: "credential_vault",
      entity_id: row.id,
      action: "credential_stored",
      metadata: { name, service, environment },
    });

    return new Response(JSON.stringify({ id: row.id }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("store-credential error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
