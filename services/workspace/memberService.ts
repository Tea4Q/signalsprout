import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database";

type MemberRow = Database["public"]["Tables"]["workspace_members"]["Row"];
type MemberRole = "owner" | "admin" | "editor" | "viewer";

export type WorkspaceMember = MemberRow;

export async function getWorkspaceMembers(
  workspaceId: string,
): Promise<WorkspaceMember[]> {
  const { data, error } = await supabase
    .from("workspace_members")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getMyRole(workspaceId: string): Promise<MemberRole | null> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) return null;

  const { data, error } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .single();
  if (error) return null;
  return (data?.role as MemberRole) ?? null;
}

export async function updateMemberRole(
  workspaceId: string,
  userId: string,
  role: MemberRole,
): Promise<void> {
  const { error } = await supabase
    .from("workspace_members")
    .update({ role })
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function removeMember(
  workspaceId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from("workspace_members")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId);
  if (error) throw error;
}

/**
 * Invites a user by email to the workspace.
 * Delegates to the `invite-member` Edge Function which can use
 * the Supabase admin API to send the invitation email.
 */
export async function inviteMember(
  workspaceId: string,
  email: string,
  role: MemberRole = "editor",
): Promise<void> {
  const { error } = await supabase.functions.invoke("invite-member", {
    body: { workspaceId, email, role },
  });
  if (error) throw error;
}
