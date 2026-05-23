const _supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const _supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!_supabaseUrl) {
  throw new Error(
    "Missing required environment variable: EXPO_PUBLIC_SUPABASE_URL. " +
      "Ensure it is set in your .env.local file with the EXPO_PUBLIC_ prefix.",
  );
}
if (!_supabaseAnonKey) {
  throw new Error(
    "Missing required environment variable: EXPO_PUBLIC_SUPABASE_ANON_KEY. " +
      "Ensure it is set in your .env.local file with the EXPO_PUBLIC_ prefix.",
  );
}

export const env = {
  supabaseUrl: _supabaseUrl,
  supabaseAnonKey: _supabaseAnonKey,
} as const;
