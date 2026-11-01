import { afterEach, describe, expect, it, vi } from "vitest";
import { getSession, resetPassword, signIn, signOut, signUp } from "@/services/auth/authService";

const authMocks = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: { auth: authMocks },
}));

afterEach(() => {
  vi.resetAllMocks();
});

describe("authService", () => {
  it("passes credentials to Supabase and returns the sign-in data", async () => {
    const data = { user: { id: "user-1" }, session: { access_token: "token" } };
    authMocks.signInWithPassword.mockResolvedValue({ data, error: null });

    await expect(signIn("person@example.com", "StrongPass1")).resolves.toBe(data);
    expect(authMocks.signInWithPassword).toHaveBeenCalledWith({
      email: "person@example.com",
      password: "StrongPass1",
    });
  });

  it("returns sign-up data and propagates authentication failures", async () => {
    const data = { user: { id: "user-2" } };
    authMocks.signUp.mockResolvedValue({ data, error: null });
    await expect(signUp("person@example.com", "StrongPass1")).resolves.toBe(data);

    const error = new Error("Invalid credentials");
    authMocks.signInWithPassword.mockResolvedValue({ data: null, error });
    await expect(signIn("person@example.com", "wrong")).rejects.toBe(error);
  });

  it("propagates sign-out and password-reset failures", async () => {
    const error = new Error("Network unavailable");
    authMocks.signOut.mockResolvedValue({ error });
    await expect(signOut()).rejects.toBe(error);

    authMocks.resetPasswordForEmail.mockResolvedValue({ error });
    await expect(resetPassword("person@example.com")).rejects.toBe(error);
  });

  it("returns the current session and propagates session lookup failures", async () => {
    const session = { access_token: "token" };
    authMocks.getSession.mockResolvedValue({ data: { session }, error: null });
    await expect(getSession()).resolves.toBe(session);

    const error = new Error("Session unavailable");
    authMocks.getSession.mockResolvedValue({ data: { session: null }, error });
    await expect(getSession()).rejects.toBe(error);
  });
});
