import { Text } from "react-native";

import { localYearMonth } from "@/components/calendar-grid";
import { DataTable } from "@/components/data-table";
import { LotteryGate } from "@/components/lottery-gate";
import { ScreenFrame } from "@/components/screen-frame";
import { useLedger, useLottery } from "@/modules/ledger";

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function whoLabel(actor: string, actorName?: string): string {
  const name = actorName?.trim();
  if (name) {
    return name;
  }
  return actor === "owner" ? "Dueño" : "Operador";
}

export default function LotteryHistoryScreen() {
  return (
    <LotteryGate title="Historial de quiniela">
      <LotteryHistory />
    </LotteryGate>
  );
}

function LotteryHistory() {
  const { viewMonth } = useLedger();
  const { snapshot } = useLottery();
  const audit = snapshot?.audit ?? [];
  const rows = audit
    .filter((entry) => localYearMonth(entry.at) === viewMonth)
    .slice()
    .reverse()
    .map((entry) => ({
      id: entry.id,
      at: formatWhen(entry.at),
      actor: whoLabel(entry.actor, entry.actorName),
      summary: entry.summary,
    }));

  return (
    <ScreenFrame title="Historial de quiniela">
      <Text className="text-[15px] leading-5 text-muted">
        Cada cambio de la quiniela queda con la fecha y con el nombre de quien lo hizo. Los de hípica siguen en su Historial.
      </Text>
      <DataTable
        empty={audit.length === 0 ? "Todavía no hay cambios." : "No hay cambios en este mes."}
        columns={[
          { key: "at", header: "Fecha", compact: true, minWidth: 260, render: (row) => row.at },
          { key: "actor", header: "Quién", compact: true, minWidth: 180, render: (row) => row.actor },
          { key: "summary", header: "Qué cambió", compact: true, wrap: true, render: (row) => row.summary },
        ]}
        rows={rows}
      />
    </ScreenFrame>
  );
}
