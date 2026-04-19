/**
 * use-credential — Internal Edge Function
 *
 * NOT directly callable from the client. Called by other Edge Functions
 * (publish-instagram, publish-pinterest, generate-content) via service role.
 *
 * Accepts: { credential_id } OR { workspace_id, service, environment }
 * Returns: { value: string } — decrypted secret, in-memory only.
 * Writes audit log: action = 'credential_accessed'
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const MASTER_KEY_ENV = "CREDENTIAL_MASTER_KEY";

async function getMasterKey(): Promise<CryptoKey> {
  const raw = Deno.env.get(MASTER_KEY_ENV);
  if (!raw) throw new Error("CREDENTIAL_MASTER_KEY secret not configured");
  const encoded = new TextEncoder().encode(raw);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  return crypto.subtle.importKey("raw", hashBuffer, { name: "AES-GCM" }, false, [
    "decrypt",
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

    // This function is intended to be called only by other Edge Functions using
    // the service role key. Verify via the Authorization header.
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

    // Caller must supply the service-role key as Bearer token
    const token = authHeader.replace("Bearer ", "");
    if (token !== Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
      return new Response(JSON.stringify({ error: "Forbidden: service role required" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { credential_id, workspace_id, service, environment } = body as {
      credential_id?: string;
      workspace_id?: string;
      service?: string;
      environment?: string;
    };

    let query = serviceClient
      .from("credential_vault")
      .select("id, encrypted_value, iv, workspace_id, name, service, environment");

    if (credential_id) {
      query = query.eq("id", credential_id);
    } else if (workspace_id && service && environment) {
      query = query
        .eq("workspace_id", workspace_id)
        .eq("service", service)
        .eq("environment", environment);
    } else {
      return new Response(
        JSON.stringify({ error: "Provide credential_id or workspace_id+service+environment" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const { data: row, error: fetchError } = await query.maybeSingle();
    if (fetchError) throw fetchError;
    if (!row) {
      return new Response(JSON.stringify({ error: "Credential not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Decrypt in memory
    const masterKey = await getMasterKey();
    const ivBytes = Uint8Array.from(atob(row.iv), (c) => c.charCodeAt(0));
    const cipherBytes = Uint8Array.from(atob(row.encrypted_value), (c) =>
      c.charCodeAt(0),
    );
    const plainBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: ivBytes },
      masterKey,
      cipherBytes,
    );
    const value = new TextDecoder().decode(plainBuffer);

    // Write audit log
    await serviceClient.from("audit_logs").insert({
      workspace_id: row.workspace_id,
      actor_user_id: null, // system-invoked
      entity_type: "credential_vault",
      entity_id: row.id,
      action: "credential_accessed",
      metadata: { name: row.name, service: row.service, environment: row.environment },
    });

    return new Response(JSON.stringify({ value }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("use-credential error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
