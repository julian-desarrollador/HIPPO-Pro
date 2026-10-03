import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import { useLedger } from "./ledger-provider";
import {
  dayPhotoUrl,
  deleteDayPhoto,
  listDayPhotoIds,
  uploadDayPhoto,
  type DayPhotoFile,
} from "../outbound/day-photos";

type DayPhotos = {
  list: () => Promise<Set<string>>;
  upload: (dayId: string, file: DayPhotoFile) => Promise<void>;
  remove: (dayId: string) => Promise<void>;
  url: (dayId: string) => Promise<string | null>;
};

const DayPhotoContext = createContext<DayPhotos | null>(null);

export function DayPhotoProvider({ client, children }: { client: SupabaseClient; children: ReactNode }) {
  const { snapshot } = useLedger();
  const agencyId = snapshot.agencyId;
  const photos = useMemo<DayPhotos>(
    () => ({
      list: () => listDayPhotoIds(client, agencyId),
      upload: (dayId, file) => uploadDayPhoto(client, agencyId, dayId, file),
      remove: (dayId) => deleteDayPhoto(client, agencyId, dayId),
      url: (dayId) => dayPhotoUrl(client, agencyId, dayId),
    }),
    [agencyId, client],
  );
  return <DayPhotoContext.Provider value={photos}>{children}</DayPhotoContext.Provider>;
}

export function useDayPhotos(): DayPhotos | null {
  return useContext(DayPhotoContext);
}
