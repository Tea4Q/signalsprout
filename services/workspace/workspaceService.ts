import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database";

type WorkspaceRow = Database["public"]["Tables"]["workspaces"]["Row"];

export async function createWorkspace(
  name: string,
  slug: string,
): Promise<WorkspaceRow> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) throw new Error("Not authenticated");

  const { data: workspace, error: wsError } = await supabase
    .from("workspaces")
    .insert({ name, slug, owner_user_id: user.id })
    .select()
    .single();

  if (wsError) throw wsError;

  const { error: memberError } = await supabase
    .from("workspace_members")
    .insert({ workspace_id: workspace.id, user_id: user.id, role: "owner" });

  if (memberError) {
    // Clean up the orphan workspace before surfacing the error
    await supabase.from("workspaces").delete().eq("id", workspace.id);
    throw memberError;
  }

  return workspace;
}

export async function getMyWorkspaces(): Promise<WorkspaceRow[]> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) return [];

  const { data: memberships, error: memberError } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id);

  if (memberError) throw memberError;
  if (!memberships?.length) return [];

  const ids = memberships.map((m) => m.workspace_id);

  const { data: workspaces, error: wsError } = await supabase
    .from("workspaces")
    .select("*")
    .in("id", ids);

  if (wsError) throw wsError;
  return workspaces ?? [];
}

export async function getWorkspace(id: string): Promise<WorkspaceRow> {
  const { data, error } = await supabase
    .from("workspaces")
    .select()
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}
