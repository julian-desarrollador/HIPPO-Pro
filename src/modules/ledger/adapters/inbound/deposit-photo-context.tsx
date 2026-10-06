import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import { useLedger } from "./ledger-provider";
import {
  deleteDepositPhoto,
  depositPhotoUrl,
  listDepositPhotoIds,
  uploadDepositPhoto,
  type DayPhotoFile,
} from "../outbound/day-photos";

type DepositPhotos = {
  list: () => Promise<Set<string>>;
  upload: (depositId: string, file: DayPhotoFile) => Promise<void>;
  remove: (depositId: string) => Promise<void>;
  url: (depositId: string) => Promise<string | null>;
};

const DepositPhotoContext = createContext<DepositPhotos | null>(null);

export function DepositPhotoProvider({ client, children }: { client: SupabaseClient; children: ReactNode }) {
  const { snapshot } = useLedger();
  const agencyId = snapshot.agencyId;
  const photos = useMemo<DepositPhotos>(
    () => ({
      list: () => listDepositPhotoIds(client, agencyId),
      upload: (depositId, file) => uploadDepositPhoto(client, agencyId, depositId, file),
      remove: (depositId) => deleteDepositPhoto(client, agencyId, depositId),
      url: (depositId) => depositPhotoUrl(client, agencyId, depositId),
    }),
    [agencyId, client],
  );
  return <DepositPhotoContext.Provider value={photos}>{children}</DepositPhotoContext.Provider>;
}

export function useDepositPhotos(): DepositPhotos | null {
  return useContext(DepositPhotoContext);
}
