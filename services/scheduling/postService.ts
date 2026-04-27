import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database";

type PostRow = Database["public"]["Tables"]["posts"]["Row"];
type PostInsert = Database["public"]["Tables"]["posts"]["Insert"];
type PostUpdate = Database["public"]["Tables"]["posts"]["Update"];
type PostStatus = Database["public"]["Enums"]["post_status"];

export interface PostFilters {
  brand_id?: string;
  platform?: "instagram" | "pinterest";
  status?: PostStatus;
}

export async function createPost(data: PostInsert): Promise<PostRow> {
  const { data: post, error } = await supabase
    .from("posts")
    .insert({ ...data, status: data.status ?? "draft" })
    .select()
    .single();
  if (error) throw error;
  return post;
}

export async function updatePost(id: string, data: PostUpdate): Promise<PostRow> {
  const { data: post, error } = await supabase
    .from("posts")
    .update(data)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return post;
}

export async function getPost(id: string): Promise<PostRow> {
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function linkPostAsset(postId: string, assetId: string): Promise<void> {
  const { error } = await supabase
    .from("post_assets")
    .insert({ post_id: postId, asset_id: assetId, sort_order: 0 });
  if (error) throw error;
}

export async function getPosts(
  workspaceId: string,
  filters?: PostFilters,
): Promise<PostRow[]> {
  let query = supabase
    .from("posts")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (filters?.brand_id) query = query.eq("brand_id", filters.brand_id);
  if (filters?.platform) query = query.eq("platform", filters.platform);
  if (filters?.status) query = query.eq("status", filters.status);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}
