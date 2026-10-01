export type WorkspaceRole = "owner" | "admin" | "editor" | "viewer";

export class AuthorizationError extends Error {
  status: number;

  constructor(message = "You do not have permission to perform this action.") {
    super(message);
    this.name = "AuthorizationError";
    this.status = 403;
  }
}

export async function requireWorkspaceRole(
  serviceClient: { from: (table: string) => any },
  workspaceId: string,
  userId: string,
  allowedRoles: readonly WorkspaceRole[],
): Promise<WorkspaceRole> {
  const { data, error } = await serviceClient
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data || !allowedRoles.includes(data.role as WorkspaceRole)) {
    throw new AuthorizationError();
  }

  return data.role as WorkspaceRole;
}

export function isWriteRole(role: WorkspaceRole): boolean {
  return role === "owner" || role === "admin" || role === "editor";
}

export function jsonError(error: unknown, corsHeaders: Record<string, string>): Response {
  const status = error instanceof AuthorizationError ? error.status : 500;
  const message = error instanceof Error ? error.message : "Internal server error";
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
