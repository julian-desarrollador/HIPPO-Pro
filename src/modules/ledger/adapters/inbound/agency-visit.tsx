import { createContext, useContext, type ReactNode } from "react";

import type { OpenedAgency } from "@/modules/identity/agency-admin";

type AgencyVisit = {
  open: (agency: OpenedAgency) => void;
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
