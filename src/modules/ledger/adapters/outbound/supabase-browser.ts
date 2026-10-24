import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { SupabaseConfig } from "./supabase-config";

let browser: SupabaseClient | null = null;
let browserKey = "";

/**
 * One GoTrue client for the whole tab. A second client on the same storage key
 * refreshes the token, the first refresh wins, and the loser clears the session.
 * That was sending people who were already signed in back to /entrada.
 */
export function browserSupabase(config: SupabaseConfig): SupabaseClient {
  const key = `${config.url}|${config.anonKey}`;
  if (!browser || browserKey !== key) {
    browser = createClient(config.url, config.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
    browserKey = key;
  }
  return browser;
}
