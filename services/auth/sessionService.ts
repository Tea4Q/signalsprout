import { supabase } from "@/lib/supabase";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

export function onAuthStateChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void,
) {
  const { data } = supabase.auth.onAuthStateChange(callback);
  return data.subscription;
}

export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user;
}
