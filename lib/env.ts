function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Ensure it is set in your .env.local file with the EXPO_PUBLIC_ prefix.`,
    );
  }
  return value;
}

export const env = {
  supabaseUrl: requireEnv("EXPO_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: requireEnv("EXPO_PUBLIC_SUPABASE_ANON_KEY"),
} as const;
