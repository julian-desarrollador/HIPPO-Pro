import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

import { readSupabaseConfig } from "@/modules/ledger/adapters/outbound/supabase-config";

export type RemoteSession = "local" | "loading" | "in" | "out";

/** Local and public books stay in the app. A configured project reports the session. */
export function useRemoteSession(): RemoteSession {
  const config = readSupabaseConfig();
  const remote = config && config !== "incomplete" && !config.publicAccess ? config : null;
  const [state, setState] = useState<"loading" | "in" | "out">(remote ? "loading" : "out");

  const url = remote?.url ?? "";
  const anonKey = remote?.anonKey ?? "";

  useEffect(() => {
    if (!url || !anonKey) {
      return;
    }
    const client = createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
    let alive = true;
    void client.auth.getSession().then(({ data }) => {
      if (alive) {
        setState(data.session ? "in" : "out");
      }
    });
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      setState(session ? "in" : "out");
    });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, [anonKey, url]);

  if (!remote) {
    return "local";
  }
  return state;
}
