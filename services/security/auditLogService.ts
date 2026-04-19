import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database";

type AuditLogRow = Database["public"]["Tables"]["audit_logs"]["Row"];
type AuditLogInsert = Database["public"]["Tables"]["audit_logs"]["Insert"];

export interface AuditLogFilters {
  entity_type?: string;
  action?: string;
  from?: string; // ISO date string
  to?: string;   // ISO date string
  page?: number;
  pageSize?: number;
}

export interface AuditLogPage {
  entries: AuditLogRow[];
  total: number;
  page: number;
  pageSize: number;
}

export async function getAuditLog(
  workspaceId: string,
  filters: AuditLogFilters = {},
): Promise<AuditLogPage> {
  const { entity_type, action, from, to, page = 1, pageSize = 20 } = filters;

  let query = supabase
    .from("audit_logs")
    .select("*", { count: "exact" })
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (entity_type) query = query.eq("entity_type", entity_type);
  if (action) query = query.eq("action", action);
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", to);

  const from_ = (page - 1) * pageSize;
  const to_ = from_ + pageSize - 1;
  query = query.range(from_, to_);

  const { data, error, count } = await query;
  if (error) throw error;

  return {
    entries: data ?? [],
    total: count ?? 0,
    page,
    pageSize,
  };
}

/** Internal helper used by other services to record audit events. */
export async function writeAuditEntry(
  entry: Omit<AuditLogInsert, "id" | "created_at">,
): Promise<void> {
  const { error } = await supabase.from("audit_logs").insert(entry);
  if (error) throw error;
}
