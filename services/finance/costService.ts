import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database";

type MetricPeriod = Database["public"]["Enums"]["metric_period"];
type CostSourceRow = Database["public"]["Tables"]["cost_sources"]["Row"];
type CostSourceInsert = Database["public"]["Tables"]["cost_sources"]["Insert"];
type CostSourceUpdate = Database["public"]["Tables"]["cost_sources"]["Update"];
type CostEntryRow = Database["public"]["Tables"]["cost_entries"]["Row"];
type CostEntryInsert = Database["public"]["Tables"]["cost_entries"]["Insert"];

export type CostSource = CostSourceRow;
export type CostEntryWithSource = CostEntryRow & {
  cost_sources: CostSourceRow | null;
};

export interface CostEntryFilters {
  brandId?: string;
  costSourceId?: string;
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
}

export interface PeriodCostSummary {
  total: number;
  from: string;
  to: string;
  entries: CostEntryWithSource[];
}

function periodDateRange(period: MetricPeriod): { from: string; to: string } {
  const now = new Date();
  let from: Date;

  switch (period) {
    case "daily":
      from = new Date(now);
      from.setHours(0, 0, 0, 0);
      break;
    case "weekly":
      from = new Date(now);
      from.setDate(now.getDate() - now.getDay());
      from.setHours(0, 0, 0, 0);
      break;
    case "monthly":
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "yearly":
      from = new Date(now.getFullYear(), 0, 1);
      break;
  }

  return {
    from: from.toISOString().slice(0, 10),
    to: now.toISOString().slice(0, 10),
  };
}

export async function getCostSources(
  workspaceId: string,
): Promise<CostSourceRow[]> {
  const { data, error } = await supabase
    .from("cost_sources")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("active", true)
    .order("name");
  if (error) throw error;
  return data ?? [];
}

export async function createCostSource(
  data: CostSourceInsert,
): Promise<CostSourceRow> {
  const { data: row, error } = await supabase
    .from("cost_sources")
    .insert(data)
    .select()
    .single();
  if (error) throw error;
  return row;
}

export async function updateCostSource(
  id: string,
  data: CostSourceUpdate,
): Promise<CostSourceRow> {
  const { data: row, error } = await supabase
    .from("cost_sources")
    .update(data)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return row;
}

export async function getCostEntries(
  workspaceId: string,
  filters?: CostEntryFilters,
): Promise<CostEntryWithSource[]> {
  let q = supabase
    .from("cost_entries")
    .select("*, cost_sources(*)")
    .eq("workspace_id", workspaceId)
    .order("entry_date", { ascending: false });

  if (filters?.brandId) q = q.eq("brand_id", filters.brandId);
  if (filters?.costSourceId) q = q.eq("cost_source_id", filters.costSourceId);
  if (filters?.from) q = q.gte("entry_date", filters.from);
  if (filters?.to) q = q.lte("entry_date", filters.to);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as CostEntryWithSource[];
}

export async function createCostEntry(
  data: CostEntryInsert,
): Promise<CostEntryRow> {
  const { data: row, error } = await supabase
    .from("cost_entries")
    .insert(data)
    .select()
    .single();
  if (error) throw error;
  return row;
}

export async function getCostSummary(
  workspaceId: string,
  period: MetricPeriod,
): Promise<PeriodCostSummary> {
  const { from, to } = periodDateRange(period);
  const entries = await getCostEntries(workspaceId, { from, to });
  const total = entries.reduce((sum, e) => sum + e.amount, 0);
  return { total, from, to, entries };
}
