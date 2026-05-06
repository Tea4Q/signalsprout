import React, { createContext, useContext } from "react";
import type { Database } from "@/types/database";

type WorkspaceRow = Database["public"]["Tables"]["workspaces"]["Row"];

export type WorkspaceRole = "owner" | "admin" | "editor" | "viewer";

interface WorkspaceContextValue {
  workspace: WorkspaceRow | null;
  workspaceId: string | null;
  allWorkspaces: WorkspaceRow[];
  role: WorkspaceRole | null;
  loading: boolean;
  setWorkspace: (workspace: WorkspaceRow) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue>({
  workspace: null,
  workspaceId: null,
  allWorkspaces: [],
  role: null,
  loading: true,
  setWorkspace: () => {},
});

export function WorkspaceProvider({
  workspace,
  allWorkspaces,
  role,
  loading,
  onSwitch,
  children,
}: {
  workspace: WorkspaceRow | null;
  allWorkspaces: WorkspaceRow[];
  role: WorkspaceRole | null;
  loading: boolean;
  onSwitch: (workspace: WorkspaceRow) => void;
  children: React.ReactNode;
}) {
  return (
    <WorkspaceContext.Provider
      value={{
        workspace,
        workspaceId: workspace?.id ?? null,
        allWorkspaces,
        role,
        loading,
        setWorkspace: onSwitch,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  return useContext(WorkspaceContext);
}

/** Returns true if the role is allowed to perform write operations on posts/content. */
export function canEdit(role: WorkspaceRole | null): boolean {
  return role === "owner" || role === "admin" || role === "editor";
}

/** Returns true if the role can manage workspace members and billing. */
export function canManageMembers(role: WorkspaceRole | null): boolean {
  return role === "owner" || role === "admin";
}

/** Returns true if the role can delete the workspace. */
export function canDeleteWorkspace(role: WorkspaceRole | null): boolean {
  return role === "owner";
}
