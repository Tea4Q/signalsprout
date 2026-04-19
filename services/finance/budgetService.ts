import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database";

type MetricPeriod = Database["public"]["Enums"]["metric_period"];
type BudgetRuleRow = Database["public"]["Tables"]["budget_rules"]["Row"];
type BudgetRuleInsert = Database["public"]["Tables"]["budget_rules"]["Insert"];
type BudgetRuleUpdate = Database["public"]["Tables"]["budget_rules"]["Update"];

export type BudgetRule = BudgetRuleRow;

export interface BudgetStatus {
  spent: number;
  limit: number;
  percent: number;
  threshold: number;
  isOverThreshold: boolean;
  hasRule: boolean;
}

export async function getBudgetRules(
  workspaceId: string,
): Promise<BudgetRuleRow[]> {
  const { data, error } = await supabase
    .from("budget_rules")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("period");
  if (error) throw error;
  return data ?? [];
}

export async function createBudgetRule(
  data: BudgetRuleInsert,
): Promise<BudgetRuleRow> {
  const { data: row, error } = await supabase
    .from("budget_rules")
    .insert(data)
    .select()
    .single();
  if (error) throw error;
  return row;
}

export async function updateBudgetRule(
  id: string,
  data: BudgetRuleUpdate,
): Promise<BudgetRuleRow> {
  const { data: row, error } = await supabase
    .from("budget_rules")
    .update(data)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return row;
}

export async function checkBudgetStatus(
  workspaceId: string,
  period: MetricPeriod,
  spent: number,
): Promise<BudgetStatus> {
  const { data, error } = await supabase
    .from("budget_rules")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("period", period)
    .is("brand_id", null)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    return {
      spent,
      limit: 0,
      percent: 0,
      threshold: 80,
      isOverThreshold: false,
      hasRule: false,
    };
  }

  const percent = data.spend_limit > 0 ? (spent / data.spend_limit) * 100 : 0;

  return {
    spent,
    limit: data.spend_limit,
    percent,
    threshold: data.alert_threshold_percent,
    isOverThreshold: percent >= data.alert_threshold_percent,
    hasRule: true,
  };
}
