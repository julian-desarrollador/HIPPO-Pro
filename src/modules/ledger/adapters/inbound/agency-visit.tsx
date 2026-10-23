import { createContext, useContext, type ReactNode } from "react";

import type { AgencyMode } from "@/modules/ledger";
import type { OpenedAgency } from "@/modules/identity/agency-admin";

type AgencyVisit = {
  open: (agency: OpenedAgency) => void;
  openPersonal: (agencyId: string, agencyName: string, agencyMode?: AgencyMode) => Promise<string | null>;
  leave: () => void;
};

const AgencyVisitContext = createContext<AgencyVisit | null>(null);

export function AgencyVisitProvider({
  value,
  children,
}: {
  value: AgencyVisit;
  children: ReactNode;
}) {
  return <AgencyVisitContext.Provider value={value}>{children}</AgencyVisitContext.Provider>;
}

export function useAgencyVisit(): AgencyVisit | null {
  return useContext(AgencyVisitContext);
}
