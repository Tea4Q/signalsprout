# SignalSprout — Security Model

---

## Threat Model

SignalSprout handles OAuth tokens and API keys for third-party services (Instagram, Pinterest, OpenAI). The primary risks are:

1. **Credential exposure** — API keys leaked via logs, client code, or DB dumps
2. **Unauthorised access** — Users accessing other workspaces' data
3. **Privilege escalation** — Lower-privileged roles performing admin actions
4. **Audit gaps** — Sensitive mutations occurring without a trace

---

## Envelope Encryption (Credential Vault)

All credentials stored in `credential_vault` are encrypted at rest using **AES-256-GCM envelope encryption**:

```
plaintext → AES-256-GCM(data_key) → ciphertext + iv + tag
data_key  → AES-256-GCM(master_key) → wrapped_key
```

Both `ciphertext` and `wrapped_key` are stored in the `credential_vault` row. The `master_key` is **never stored in the database**; it is stored as a Supabase Edge Function secret (`VAULT_MASTER_KEY`).

All encryption/decryption operations happen inside Edge Functions, not in client code. The client only receives the plaintext value transiently (never stored locally).

### Key Rotation

When a credential is rotated:
1. A new `data_key` is generated
2. The new plaintext is encrypted with the new `data_key`
3. The new `data_key` is wrapped with the `master_key`
4. The old ciphertext and wrapped key are replaced atomically
5. An `audit_log` record is written with `action = "credential_rotated"`

---

## Row-Level Security (RLS)

Every table has RLS enabled. All queries are scoped to the authenticated user's workspaces via the `is_workspace_member(workspace_id)` function:

```sql
create or replace function is_workspace_member(check_workspace_id uuid)
returns boolean as $$
  select exists (
    select 1 from workspace_members
    where workspace_id = check_workspace_id
      and user_id = auth.uid()
  );
$$ language sql security definer;
```

All `SELECT` / `INSERT` / `UPDATE` / `DELETE` policies reference this function.

---

## Role Enforcement

Roles are stored in `workspace_members.role` (owner / admin / editor / viewer) and enforced at two layers:

1. **RLS policies** — Mutations require role checks in the policy `using` clause
2. **UI layer** — `canEdit()`, `canManageMembers()`, `canDeleteWorkspace()` functions in `context/workspace-context.tsx` gate buttons and actions

---

## Audit Log

All mutations to sensitive entities log an entry in `audit_logs`:

| Field | Description |
|---|---|
| `actor_user_id` | The authenticated user who performed the action |
| `action` | e.g. `credential_created`, `credential_rotated`, `member_invited` |
| `entity_type` | e.g. `credential_vault`, `workspace_members` |
| `entity_id` | ID of the affected row |
| `metadata` | JSON blob with relevant context (name, service, etc.) |
| `workspace_id` | Scope of the action |

Audit logs are **append-only** — no `UPDATE` or `DELETE` policies exist on the table.

---

## Secret Management

- API keys are **never hardcoded** in client code
- All secrets are stored via the Security Vault (`credential_vault` table) or as Supabase Edge Function secrets
- The `lib/env.ts` module reads `EXPO_PUBLIC_` prefixed variables only — these are non-sensitive public keys (Supabase URL + anon key)
- The Supabase anon key is safe to expose client-side because RLS enforces access control

---

## OWASP Top 10 Mitigations

| Risk | Mitigation |
|---|---|
| Broken Access Control | RLS on all tables; role checks in UI |
| Cryptographic Failures | AES-256-GCM envelope encryption for credentials |
| Injection | Supabase parameterised queries only; no raw SQL in client |
| Insecure Design | Threat model documented; audit log on all sensitive mutations |
| Security Misconfiguration | No hardcoded secrets; env vars validated at startup |
| Vulnerable Components | Dependency updates tracked via `npm audit` |
| Auth Failures | Supabase Auth with `expo-secure-store` for session persistence |
