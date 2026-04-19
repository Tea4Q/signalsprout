import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database";

type CampaignRow = Database["public"]["Tables"]["campaigns"]["Row"];
type CampaignInsert = Database["public"]["Tables"]["campaigns"]["Insert"];
type CampaignUpdate = Database["public"]["Tables"]["campaigns"]["Update"];

export async function getCampaigns(
  workspaceId: string,
  brandId?: string,
): Promise<CampaignRow[]> {
  let query = supabase
    .from("campaigns")
    .select()
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (brandId) {
    query = query.eq("brand_id", brandId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function createCampaign(
  data: CampaignInsert,
): Promise<CampaignRow> {
  const { data: campaign, error } = await supabase
    .from("campaigns")
    .insert(data)
    .select()
    .single();

  if (error) throw error;
  return campaign;
}

export async function updateCampaign(
  id: string,
  data: CampaignUpdate,
): Promise<CampaignRow> {
  const { data: campaign, error } = await supabase
    .from("campaigns")
    .update(data)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return campaign;
}
