import { useEffect, useState } from "react";

import { browserSupabase } from "@/modules/ledger/adapters/outbound/supabase-browser";
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
    const client = browserSupabase({ url, anonKey, publicAccess: false });
    let alive = true;
    let sawSession = false;
    void client.auth.getSession().then(({ data }) => {
      if (!alive) {
        return;
      }
      if (data.session) {
        sawSession = true;
        setState("in");
        return;
      }
      if (!sawSession) {
        setState("out");
      }
    });
    const { data } = client.auth.onAuthStateChange((event, session) => {
      // INITIAL_SESSION can arrive with null before the stored session is read.
      // That null was sending people who were already signed in back to /entrada.
      if (!alive || event === "INITIAL_SESSION") {
        return;
      }
      if (session) {
        sawSession = true;
        setState("in");
        return;
      }
      if (event === "SIGNED_OUT") {
        sawSession = false;
        setState("out");
      }
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
