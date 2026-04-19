import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database";

type BrandRow = Database["public"]["Tables"]["brands"]["Row"];
type BrandInsert = Database["public"]["Tables"]["brands"]["Insert"];
type BrandUpdate = Database["public"]["Tables"]["brands"]["Update"];
type BrandProfileRow = Database["public"]["Tables"]["brand_profiles"]["Row"];
type BrandProfileInsert =
  Database["public"]["Tables"]["brand_profiles"]["Insert"];

export async function getBrands(workspaceId: string): Promise<BrandRow[]> {
  const { data, error } = await supabase
    .from("brands")
    .select()
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function createBrand(
  workspaceId: string,
  data: Omit<BrandInsert, "workspace_id">,
): Promise<BrandRow> {
  const { data: brand, error } = await supabase
    .from("brands")
    .insert({ ...data, workspace_id: workspaceId })
    .select()
    .single();

  if (error) throw error;
  return brand;
}

export async function updateBrand(
  brandId: string,
  data: BrandUpdate,
): Promise<BrandRow> {
  const { data: brand, error } = await supabase
    .from("brands")
    .update(data)
    .eq("id", brandId)
    .select()
    .single();

  if (error) throw error;
  return brand;
}

export async function getBrandProfile(
  brandId: string,
): Promise<BrandProfileRow | null> {
  const { data, error } = await supabase
    .from("brand_profiles")
    .select()
    .eq("brand_id", brandId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function upsertBrandProfile(
  brandId: string,
  data: Omit<BrandProfileInsert, "brand_id">,
): Promise<BrandProfileRow> {
  const { data: profile, error } = await supabase
    .from("brand_profiles")
    .upsert({ ...data, brand_id: brandId }, { onConflict: "brand_id" })
    .select()
    .single();

  if (error) throw error;
  return profile;
}
