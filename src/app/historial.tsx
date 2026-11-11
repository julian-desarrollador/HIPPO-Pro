import { Text } from "react-native";

import { localYearMonth } from "@/components/calendar-grid";
import { ChangeLog } from "@/components/change-log";
import { ScreenFrame } from "@/components/screen-frame";
import { useLedger, visibleAuditEntries } from "@/modules/ledger";

export default function HistorialScreen() {
  const { snapshot, viewMonth, role } = useLedger();
  const audit = visibleAuditEntries(snapshot.audit ?? [], role);
  const entries = audit
    .filter((entry) => localYearMonth(entry.at) === viewMonth)
    .slice()
    .reverse();

  return (
    <ScreenFrame title="Historial">
      <Text className="text-[15px] leading-5 text-muted">Lo más nuevo arriba. Cada cambio dice quién lo hizo.</Text>
      <ChangeLog entries={entries} empty={audit.length === 0 ? "Todavía no hay cambios." : "No hay cambios en este mes."} />
    </ScreenFrame>
  );
}
