import { describe, expect, it, vi } from "vitest";
import {
  canDeleteWorkspace,
  canEdit,
  canManageCosts,
  canManageMembers,
  canManageSocialAccounts,
  canManageWorkspaceContent,
  type WorkspaceRole,
} from "@/context/workspace-context";
import {
  AuthorizationError,
  isWriteRole,
  requireWorkspaceRole,
} from "../supabase/functions/_shared/authorization";

const roles: WorkspaceRole[] = ["owner", "admin", "editor", "viewer"];

function membershipClient(role: string | null, error: Error | null = null) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: role ? { role } : null,
      error,
    }),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  return { from: vi.fn().mockReturnValue(query), query };
}

describe("workspace permissions", () => {
  it("allows writes for owners, admins, and editors, but not viewers", () => {
    for (const role of roles) {
      const expected = role !== "viewer";
      expect(canEdit(role)).toBe(expected);
      expect(canManageCosts(role)).toBe(expected);
      expect(canManageWorkspaceContent(role)).toBe(expected);
      expect(isWriteRole(role)).toBe(expected);
    }
    expect(canEdit(null)).toBe(false);
  });

  it("limits social-account and member management to owners and admins", () => {
    for (const role of roles) {
      const expected = role === "owner" || role === "admin";
      expect(canManageSocialAccounts(role)).toBe(expected);
      expect(canManageMembers(role)).toBe(expected);
    }
  });

  it("reserves workspace deletion for owners", () => {
    for (const role of roles) {
      expect(canDeleteWorkspace(role)).toBe(role === "owner");
    }
  });

  it("returns a permitted membership role and denies disallowed or missing membership", async () => {
    const client = membershipClient("editor");
    await expect(
      requireWorkspaceRole(client, "workspace-1", "user-1", ["owner", "admin", "editor"]),
    ).resolves.toBe("editor");
    expect(client.from).toHaveBeenCalledWith("workspace_members");

    await expect(
      requireWorkspaceRole(membershipClient("viewer"), "workspace-1", "user-1", ["editor"]),
    ).rejects.toBeInstanceOf(AuthorizationError);
    await expect(
      requireWorkspaceRole(membershipClient(null), "workspace-1", "user-1", ["editor"]),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("denies membership lookup errors instead of granting access", async () => {
    await expect(
      requireWorkspaceRole(
        membershipClient("owner", new Error("database unavailable")),
        "workspace-1",
        "user-1",
        ["owner"],
      ),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });
});
