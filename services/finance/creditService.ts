import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database";

type CreditPurchaseRow =
  Database["public"]["Tables"]["credit_purchases"]["Row"];
type CreditPurchaseInsert =
  Database["public"]["Tables"]["credit_purchases"]["Insert"];

export type CreditPurchase = CreditPurchaseRow;

export interface VendorCreditSummary {
  vendor: string;
  totalPurchased: number;   // credits bought (e.g. Runway credits)
  totalSpentUSD: number;    // USD spent via cost_entries matching this vendor
  totalPurchasedUSD: number;// USD paid for credits
  remainingCredits: number; // purchased credits minus used (credits)
  purchases: CreditPurchase[];
}

export async function getCreditPurchases(
  workspaceId: string,
): Promise<CreditPurchase[]> {
  const { data, error } = await supabase
    .from("credit_purchases")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("purchased_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function addCreditPurchase(
  entry: CreditPurchaseInsert,
): Promise<CreditPurchase> {
  const { data, error } = await supabase
    .from("credit_purchases")
    .insert(entry)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCreditPurchase(id: string): Promise<void> {
  const { error } = await supabase
    .from("credit_purchases")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

/**
 * Builds per-vendor summaries by combining credit purchases with cost_entries.
 * Cost entries are matched to a vendor via cost_sources.vendor.
 */
export async function getVendorCreditSummaries(
  workspaceId: string,
): Promise<VendorCreditSummary[]> {
  const [purchases, entriesRes] = await Promise.all([
    getCreditPurchases(workspaceId),
    supabase
      .from("cost_entries")
      .select("amount, cost_sources(vendor)")
      .eq("workspace_id", workspaceId),
  ]);

  if (entriesRes.error) throw entriesRes.error;

  // Sum USD spent per vendor from cost_entries
  const spentByVendor = new Map<string, number>();
  for (const e of entriesRes.data ?? []) {
    const vendor = (e.cost_sources as { vendor: string } | null)?.vendor;
    if (!vendor) continue;
    spentByVendor.set(
      vendor,
      (spentByVendor.get(vendor) ?? 0) + e.amount,
    );
  }

  // Group purchases by vendor
  const purchasesByVendor = new Map<string, CreditPurchase[]>();
  for (const p of purchases) {
    const list = purchasesByVendor.get(p.vendor) ?? [];
    list.push(p);
    purchasesByVendor.set(p.vendor, list);
  }

  // Build summaries for every vendor that has purchases
  const summaries: VendorCreditSummary[] = [];
  for (const [vendor, list] of purchasesByVendor) {
    const totalPurchasedUSD = list.reduce((s, p) => s + p.amount_usd, 0);
    const totalPurchased = list.reduce((s, p) => s + p.credits, 0);
    const totalSpentUSD = spentByVendor.get(vendor) ?? 0;

    // Remaining = purchased credits minus the USD-equivalent consumed
    // (credits are stored in the same currency as USD cost entries)
    const remainingCredits = Math.max(0, totalPurchased - totalSpentUSD);

    summaries.push({
      vendor,
      totalPurchased,
      totalSpentUSD,
      totalPurchasedUSD,
      remainingCredits,
      purchases: list,
    });
  }

  return summaries.sort((a, b) => a.vendor.localeCompare(b.vendor));
}
