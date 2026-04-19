/**
 * lib/crypto.ts — Client-side helpers only.
 * No secret handling; no master key access.
 */

/**
 * Generates a cryptographically secure random token suitable for
 * display to the user (e.g. for TOTP seeds or webhook secret generation).
 * Returns a 32-character hex string.
 */
export function generateSecureToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Returns a masked representation of a secret value for safe display.
 * Preserves the first 3 characters and replaces the rest with bullets.
 *
 * Examples:
 *   "sk-abc123xyz"  → "sk-••••••••"
 *   "Bearer tok..."  → "Bea••••••••"
 */
export function maskSecret(value: string): string {
  if (!value) return "••••••••••••";
  const prefix = value.slice(0, 3);
  return `${prefix}${"•".repeat(Math.min(9, Math.max(4, value.length - 3)))}`;
}
