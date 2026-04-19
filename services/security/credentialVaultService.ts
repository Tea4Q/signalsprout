import { supabase } from "@/lib/supabase";

/** Metadata-only shape — never includes the encrypted value. */
export interface CredentialMeta {
  id: string;
  workspace_id: string;
  name: string;
  service: string;
  environment: string;
  key_metadata: Record<string, unknown>;
  rotation_due_at: string | null;
  last_rotated_at: string | null;
  created_at: string;
  updated_at: string;
}

type CredentialMetaRow = {
  id: string;
  workspace_id: string;
  name: string;
  service: string;
  environment: string;
  key_metadata: import("@/types/database").Json;
  rotation_due_at: string | null;
  last_rotated_at: string | null;
  created_at: string;
  updated_at: string;
};

function toMeta(row: CredentialMetaRow): CredentialMeta {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    name: row.name,
    service: row.service,
    environment: row.environment,
    key_metadata: (row.key_metadata as Record<string, unknown>) ?? {},
    rotation_due_at: row.rotation_due_at,
    last_rotated_at: row.last_rotated_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/** Returns metadata only — never the encrypted_value or iv. */
export async function listCredentials(
  workspaceId: string,
): Promise<CredentialMeta[]> {
  const { data, error } = await supabase
    .from("credential_vault")
    .select(
      "id, workspace_id, name, service, environment, key_metadata, rotation_due_at, last_rotated_at, created_at, updated_at",
    )
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(toMeta);
}

export interface StoreCredentialInput {
  workspace_id: string;
  name: string;
  service: string;
  environment: string;
  value: string;
  rotation_due_at?: string;
}

/** Calls the store-credential Edge Function. Returns the new credential id. */
export async function storeCredential(
  input: StoreCredentialInput,
): Promise<string> {
  const { data, error } = await supabase.functions.invoke("store-credential", {
    body: input,
  });
  if (error) throw error;
  if (!data?.id) throw new Error("store-credential did not return an id");
  return data.id as string;
}

/** Calls the rotate-credential Edge Function with the new plaintext value. */
export async function rotateCredential(
  credentialId: string,
  newValue: string,
): Promise<void> {
  const { error } = await supabase.functions.invoke("rotate-credential", {
    body: { credential_id: credentialId, new_value: newValue },
  });
  if (error) throw error;
}

/** Deletes a credential from the vault and writes an audit log entry. */
export async function deleteCredential(credentialId: string): Promise<void> {
  // Fetch workspace_id for audit log before deleting
  const { data: row, error: fetchError } = await supabase
    .from("credential_vault")
    .select("id, workspace_id, name, service, environment")
    .eq("id", credentialId)
    .single();

  if (fetchError) throw fetchError;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error: deleteError } = await supabase
    .from("credential_vault")
    .delete()
    .eq("id", credentialId);

  if (deleteError) throw deleteError;

  // Best-effort audit log — ignore failure so the delete still succeeds
  await supabase.from("audit_logs").insert({
    workspace_id: row.workspace_id,
    actor_user_id: user?.id ?? null,
    entity_type: "credential_vault",
    entity_id: credentialId,
    action: "credential_deleted",
    metadata: { name: row.name, service: row.service, environment: row.environment },
  });
}

/** Returns credentials whose rotation_due_at is within the next 7 days. */
export async function getRotationAlerts(
  workspaceId: string,
): Promise<CredentialMeta[]> {
  const now = new Date();
  const sevenDaysFromNow = new Date(
    now.getTime() + 7 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data, error } = await supabase
    .from("credential_vault")
    .select(
      "id, workspace_id, name, service, environment, key_metadata, rotation_due_at, last_rotated_at, created_at, updated_at",
    )
    .eq("workspace_id", workspaceId)
    .not("rotation_due_at", "is", null)
    .lte("rotation_due_at", sevenDaysFromNow)
    .order("rotation_due_at", { ascending: true });

  if (error) throw error;
  return (data ?? []).map(toMeta);
}
