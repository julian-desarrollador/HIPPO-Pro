import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import { useLedger } from "./ledger-provider";
import {
  deleteExpensePhoto,
  expensePhotoUrl,
  listExpensePhotoIds,
  uploadExpensePhoto,
  type DayPhotoFile,
} from "../outbound/day-photos";

type ExpensePhotos = {
  list: () => Promise<Set<string>>;
  upload: (expenseId: string, file: DayPhotoFile) => Promise<void>;
  remove: (expenseId: string) => Promise<void>;
  url: (expenseId: string) => Promise<string | null>;
};

const ExpensePhotoContext = createContext<ExpensePhotos | null>(null);

export function ExpensePhotoProvider({ client, children }: { client: SupabaseClient; children: ReactNode }) {
  const { snapshot } = useLedger();
  const agencyId = snapshot.agencyId;
  const photos = useMemo<ExpensePhotos>(
    () => ({
      list: () => listExpensePhotoIds(client, agencyId),
      upload: (expenseId, file) => uploadExpensePhoto(client, agencyId, expenseId, file),
      remove: (expenseId) => deleteExpensePhoto(client, agencyId, expenseId),
      url: (expenseId) => expensePhotoUrl(client, agencyId, expenseId),
    }),
    [agencyId, client],
  );
  return <ExpensePhotoContext.Provider value={photos}>{children}</ExpensePhotoContext.Provider>;
}

export function useExpensePhotos(): ExpensePhotos | null {
  return useContext(ExpensePhotoContext);
}
