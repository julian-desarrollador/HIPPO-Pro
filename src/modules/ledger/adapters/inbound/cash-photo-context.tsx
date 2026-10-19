import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import { useLedger } from "./ledger-provider";
import {
  cashPhotoUrl,
  deleteCashPhoto,
  listCashPhotoIds,
  uploadCashPhoto,
  type DayPhotoFile,
} from "../outbound/day-photos";

type CashPhotos = {
  list: () => Promise<Set<string>>;
  upload: (expenseId: string, file: DayPhotoFile) => Promise<void>;
  remove: (expenseId: string) => Promise<void>;
  url: (expenseId: string) => Promise<string | null>;
};

const CashPhotoContext = createContext<CashPhotos | null>(null);

export function CashPhotoProvider({ client, children }: { client: SupabaseClient; children: ReactNode }) {
  const { snapshot } = useLedger();
  const agencyId = snapshot.agencyId;
  const photos = useMemo<CashPhotos>(
    () => ({
      list: () => listCashPhotoIds(client, agencyId),
      upload: (expenseId, file) => uploadCashPhoto(client, agencyId, expenseId, file),
      remove: (expenseId) => deleteCashPhoto(client, agencyId, expenseId),
      url: (expenseId) => cashPhotoUrl(client, agencyId, expenseId),
    }),
    [agencyId, client],
  );
  return <CashPhotoContext.Provider value={photos}>{children}</CashPhotoContext.Provider>;
}

export function useCashPhotos(): CashPhotos | null {
  return useContext(CashPhotoContext);
}
