import { useState } from "react";
import { Text } from "react-native";
import { router, type Href } from "expo-router";

import { localYearMonth } from "@/components/calendar-grid";
import { DataTable } from "@/components/data-table";
import { formatIsoDate } from "@/components/format-date";
import { ConfirmDialog, RowActions } from "@/components/form-controls";
import { LotteryGate } from "@/components/lottery-gate";
import { ScreenFrame, SectionTitle } from "@/components/screen-frame";
import { ledgerErrorMessage, HIPICA_GAME_ID, useLedger, useLottery, type AgencyDayRow } from "@/modules/ledger";

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
    <LotteryGate title="Historial">
      <LotteryHistory />
    </LotteryGate>
  );
}

function LotteryHistory() {
  const { viewMonth, agencyMode, readOnly } = useLedger();
  const { snapshot, games, agencyDays, removeAgencyDay } = useLottery();
  const [pending, setPending] = useState<AgencyDayRow | null>(null);
  const [error, setError] = useState("");
  const audit = snapshot?.audit ?? [];
  const changes = audit
    .filter((entry) => localYearMonth(entry.at) === viewMonth)
    .slice()
    .reverse()
    .map((entry) => ({
      id: entry.id,
      at: formatWhen(entry.at),
      actor: whoLabel(entry.actor, entry.actorName),
      summary: entry.summary,
    }));

  function edit(row: AgencyDayRow) {
    router.push(`/carga-dia?fecha=${row.date}&terminal=${row.terminalId}` as Href);
  }

  async function confirmRemove() {
    if (!pending) {
      return;
    }
    const row = pending;
    setPending(null);
    try {
      await removeAgencyDay({ date: row.date, terminalId: row.terminalId });
      setError("");
    } catch (caught) {
      setError(ledgerErrorMessage(caught));
    }
  }

  const visibleGames = games.filter((game) => game.id !== HIPICA_GAME_ID || agencyMode === "both");
  const visibleIds = new Set(visibleGames.map((game) => game.id));
  const retiredIds = [
    ...new Set(
      agencyDays.flatMap((day) =>
        Object.keys({ ...day.soldByGame, ...day.prizesByGame, ...day.cancelledByGame }).filter((id) => !visibleIds.has(id)),
      ),
    ),
  ];
  const gameColumns = [
    ...visibleGames.map((game) => ({
      key: `game-${game.id}`,
      header: game.name,
      align: "right" as const,
      cents: (row: AgencyDayRow) => row.soldByGame[game.id] ?? 0,
    })),
    ...retiredIds.map((id) => ({
      key: `game-${id}`,
      header: snapshot?.games.find((game) => game.id === id)?.name ?? id,
      align: "right" as const,
      cents: (row: AgencyDayRow) => row.soldByGame[id] ?? 0,
    })),
  ];

  return (
    <ScreenFrame title="Historial">
      <Text className="text-[15px] leading-5 text-muted">
        Cada día y cada terminal, en el orden de la boleta. Editar abre la carga.
      </Text>
      {error ? <Text className="text-[15px] text-negative">{error}</Text> : null}
      <DataTable
        empty="Todavía no hay días cargados."
        columns={[
          { key: "date", header: "Fecha", compact: true, render: (row: AgencyDayRow) => formatIsoDate(row.date) },
          { key: "terminal", header: "Terminal", compact: true, render: (row: AgencyDayRow) => `Terminal ${row.terminalId}` },
          ...gameColumns,
          { key: "sold", header: "Venta neta", align: "right" as const, compact: true, cents: (row: AgencyDayRow) => row.soldCents },
          { key: "commission", header: "Comisión", align: "right" as const, cents: (row: AgencyDayRow) => row.commissionCents },
          {
            key: "actions",
            header: "",
            compact: true,
            align: "right" as const,
            minWidth: 160,
            node: (row: AgencyDayRow) =>
              readOnly ? null : (
                <RowActions onEdit={() => edit(row)} onRemove={() => setPending(row)} />
              ),
          },
        ]}
        rows={agencyDays}
      />
      <ConfirmDialog
        visible={pending !== null}
        title="¿Quitar el día?"
        detail="Se quita lo cargado de esa terminal. No se puede deshacer."
        onCancel={() => setPending(null)}
        onConfirm={() => void confirmRemove()}
      />
      <SectionTitle title="Cambios" />
      <DataTable
        empty={audit.length === 0 ? "Todavía no hay cambios." : "No hay cambios en este mes."}
        columns={[
          { key: "at", header: "Fecha", compact: true, minWidth: 260, render: (row) => row.at },
          { key: "actor", header: "Quién", compact: true, minWidth: 180, render: (row) => row.actor },
          { key: "summary", header: "Qué cambió", compact: true, wrap: true, render: (row) => row.summary },
        ]}
        rows={changes}
      />
    </ScreenFrame>
  );
}
