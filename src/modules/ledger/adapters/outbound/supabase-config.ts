export type SupabaseConfig = {
  url: string;
  anonKey: string;
  /** When true, the book opens without a signed-in user. */
  publicAccess: boolean;
};

function isPublicAccess(value: string | undefined): boolean {
  const clean = value?.trim().toLowerCase() ?? "";
  return clean === "1" || clean === "true";
}

export function readSupabaseConfig(
  url = process.env.EXPO_PUBLIC_SUPABASE_URL,
  anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  publicAccess = process.env.EXPO_PUBLIC_SUPABASE_PUBLIC,
): SupabaseConfig | null | "incomplete" {
  const cleanUrl = url?.trim() ?? "";
  const cleanKey = anonKey?.trim() ?? "";
  if (!cleanUrl && !cleanKey) {
    return null;
  }
  if (!cleanUrl || !cleanKey) {
    return "incomplete";
  }
  return { url: cleanUrl, anonKey: cleanKey, publicAccess: isPublicAccess(publicAccess) };
}
