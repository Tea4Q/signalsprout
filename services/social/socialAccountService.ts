import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database";

export type SocialAccount =
  Database["public"]["Tables"]["social_accounts"]["Row"];

/** Returns all social accounts for a workspace (tokens excluded from SELECT). */
export async function listSocialAccounts(
  workspaceId: string,
): Promise<SocialAccount[]> {
  const { data, error } = await supabase
    .from("social_accounts")
    .select(
      "id, workspace_id, brand_id, platform, account_name, account_identifier, external_account_id, avatar_url, status, token_expires_at, scopes, created_at",
    )
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data as SocialAccount[]) ?? [];
}

/** Disconnects a social account by deleting the row. */
export async function disconnectSocialAccount(accountId: string): Promise<void> {
  const { error } = await supabase
    .from("social_accounts")
    .delete()
    .eq("id", accountId);

  if (error) throw error;
}

/** Returns true if the token will expire within the next 48 hours. */
export function isTokenExpiringSoon(account: SocialAccount): boolean {
  if (!account.token_expires_at) return false;
  const expiresAt = new Date(account.token_expires_at).getTime();
  const fortyEightHours = 2 * 24 * 60 * 60 * 1000;
  return expiresAt - Date.now() < fortyEightHours;
}

/** Returns true if the token has already expired. */
export function isTokenExpired(account: SocialAccount): boolean {
  if (!account.token_expires_at) return false;
  return new Date(account.token_expires_at).getTime() < Date.now();
}
