import { Text } from "react-native";

import { localYearMonth } from "@/components/calendar-grid";
import { DataTable } from "@/components/data-table";
import { ScreenFrame } from "@/components/screen-frame";
import { useLedger } from "@/modules/ledger";

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

function actorLabel(actor: string): string {
  return actor === "owner" ? "Dueño" : "Operador";
}

export default function HistorialScreen() {
  const { snapshot, viewMonth } = useLedger();
  const audit = snapshot.audit ?? [];
  const rows = audit
    .filter((entry) => localYearMonth(entry.at) === viewMonth)
    .slice()
    .reverse()
    .map((entry) => ({
      id: entry.id,
      at: formatWhen(entry.at),
      actor: actorLabel(entry.actor),
      summary: entry.summary,
    }));

  return (
    <ScreenFrame title="Historial">
      <Text className="text-[15px] leading-5 text-muted">
        Cada cambio queda con la fecha y con Dueño u Operador, según quién estaba elegido en la barra.
      </Text>
      <DataTable
        empty={audit.length === 0 ? "Todavía no hay cambios." : "No hay cambios en este mes."}
        columns={[
          { key: "at", header: "Fecha", compact: true, render: (row) => row.at },
          { key: "actor", header: "Quién", compact: true, render: (row) => row.actor },
          { key: "summary", header: "Qué cambió", compact: true, render: (row) => row.summary },
        ]}
        rows={rows}
      />
    </ScreenFrame>
  );
}
