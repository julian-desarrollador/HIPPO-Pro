import { useState } from "react";
import { Text, useWindowDimensions, View } from "react-native";

import { AmountField } from "@/components/amount-field";
import { monthTitle, openingDate } from "@/components/calendar-grid";
import { DataTable, type TableColumn } from "@/components/data-table";
import { DateField } from "@/components/date-field";
import { formatIsoDate } from "@/components/format-date";
import { ChoiceChips, ConfirmDialog, Feedback, Field, PrimaryButton, RowActions, SecondaryButton } from "@/components/form-controls";
import { LotteryGate } from "@/components/lottery-gate";
import { Card, ScreenFrame, SectionTitle } from "@/components/screen-frame";
import { MoneyText } from "@/components/stat-card";
import { wideLayout } from "@/constants/layout";
import {
  TERMINAL_IDS,
  formatAmountInput,
  formatSignedPercent,
  ledgerErrorMessage,
  readAmount,
  useLedger,
  useLottery,
  type LotteryAmount,
  type LotteryDayRow,
  type TerminalId,
} from "@/modules/ledger";

const terminalOptions = TERMINAL_IDS.map((id) => ({ id, label: `Terminal ${id}` }));

type DayKey = { date: string; terminalId: TerminalId };

export default function LotteryEntryScreen() {
  return (
    <LotteryGate title="Carga de quiniela">
      <LotteryEntry />
    </LotteryGate>
  );
}

function LotteryEntry() {
  const { viewMonth, setViewMonth } = useLedger();
  const { games, days, previewDay, recordDay, updateDay, removeDay } = useLottery();
  const wide = useWindowDimensions().width >= wideLayout;
  const [date, setDate] = useState(() => openingDate(viewMonth));
  const [terminalId, setTerminalId] = useState<TerminalId>("1");
  const [sold, setSold] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<DayKey | null>(null);
  const [pendingRemove, setPendingRemove] = useState<DayKey | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [dateMonth, setDateMonth] = useState(viewMonth);
  if (dateMonth !== viewMonth) {
    setDateMonth(viewMonth);
    if (!editing) {
      setDate(openingDate(viewMonth));
    }
  }

  const parsed = games.map((game) => ({ gameId: game.id, soldCents: readAmount(sold[game.id] ?? "", true) }));
  const valid = parsed.every((amount) => amount.soldCents !== null);
  const amounts: LotteryAmount[] = parsed.map((amount) => ({ gameId: amount.gameId, soldCents: amount.soldCents ?? 0 }));
  const preview = valid ? previewDay(amounts, editing ?? undefined) : null;

  function clearForm() {
    setSold({});
    setTerminalId("1");
  }

  function startEdit(row: LotteryDayRow) {
    setEditing({ date: row.date, terminalId: row.terminalId });
    setDate(row.date);
    setTerminalId(row.terminalId);
    setSold(
      Object.fromEntries(
        games.map((game) => [game.id, row.soldByGame[game.id] ? formatAmountInput(row.soldByGame[game.id] ?? 0) : ""]),
      ),
    );
    setError("");
    setMessage("");
  }

  function cancelEdit() {
    setEditing(null);
    setDate(openingDate(viewMonth));
    clearForm();
    setError("");
    setMessage("");
  }

  async function onSave() {
    if (saving) {
      return;
    }
    if (!valid) {
      setError("Revisá los importes. Usá 2.908.511,00.");
      setMessage("");
      return;
    }
    setSaving(true);
    setMessage("Guardando…");
    setError("");
    try {
      if (editing) {
        await updateDay({ fromDate: editing.date, fromTerminalId: editing.terminalId, date, terminalId, amounts });
        setEditing(null);
        setDate(openingDate(date.slice(0, 7)));
        setMessage("Día actualizado.");
      } else {
        await recordDay({ date, terminalId, amounts });
        setMessage("Día cargado.");
      }
      clearForm();
      setViewMonth(date.slice(0, 7));
    } catch (caught) {
      setMessage("");
      setError(ledgerErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  async function confirmRemove() {
    if (!pendingRemove) {
      return;
    }
    const key = pendingRemove;
    setPendingRemove(null);
    try {
      await removeDay(key);
      if (editing && editing.date === key.date && editing.terminalId === key.terminalId) {
        cancelEdit();
      }
      setMessage("Movimiento quitado.");
      setError("");
    } catch (caught) {
      setMessage("");
      setError(ledgerErrorMessage(caught));
    }
  }

  const gameColumns: TableColumn<LotteryDayRow>[] = games.map((game) => ({
    key: `game-${game.id}`,
    header: game.name,
    align: "right",
    cents: (row) => row.soldByGame[game.id] ?? 0,
  }));

  return (
    <ScreenFrame title="Carga de quiniela">
      <View className={wide ? "flex-row items-start gap-4" : "gap-4"}>
        <View className="flex-1">
          <Card>
            <View className="gap-4">
              <Field label="Fecha">
                <DateField value={date} onChange={setDate} />
              </Field>
              <Field label="Terminal">
                <ChoiceChips options={terminalOptions} value={terminalId} onChange={setTerminalId} />
              </Field>
              <Text className="text-[17px] font-semibold text-navy">Vendido por juego</Text>
              {games.map((game) => (
                <Field key={game.id} label={game.name}>
                  <AmountField
                    value={sold[game.id] ?? ""}
                    onChangeText={(text) => setSold((current) => ({ ...current, [game.id]: text }))}
                  />
                </Field>
              ))}
              <Feedback error={error} message={message} />
              <PrimaryButton label={editing ? "Guardar cambios" : "Cargar día"} onPress={() => void onSave()} />
              {editing ? <SecondaryButton label="Cancelar" onPress={cancelEdit} /> : null}
            </View>
          </Card>
        </View>
        <View className={wide ? "w-96" : ""}>
          <Card>
            <Text className="font-sans text-[24px] font-semibold text-navy">Cálculo del día</Text>
            <Text className="mt-1 text-[15px] text-muted">Terminal {terminalId}</Text>
            {preview ? (
              <View className="mt-3">
                <Text className="text-[15px] font-semibold text-navy">Comisión por juego</Text>
                {preview.lines
                  .filter((line) => line.soldCents > 0)
                  .map((line) => (
                    <BreakdownLine
                      key={line.gameId}
                      label={`${line.name} (${formatSignedPercent(line.commissionBasisPoints)})`}
                      cents={line.commissionCents}
                    />
                  ))}
                {preview.soldCents === 0 ? (
                  <Text className="py-0.5 text-[15px] text-muted">Cargá lo vendido de cada juego.</Text>
                ) : null}
                <View className="my-2 h-px bg-line" />
                <BreakdownLine label="Vendido" cents={preview.soldCents} size="md" />
                <BreakdownLine label="− Comisión" cents={preview.commissionCents} />
                <View className="my-2 h-px bg-line" />
                <BreakdownLine label="A depositar" cents={preview.amountToDepositCents} size="md" tone="navy" />
              </View>
            ) : (
              <Text className="mt-3 text-[15px] text-negative">Revisá los importes. Usá 2.908.511,00.</Text>
            )}
          </Card>
        </View>
      </View>

      <SectionTitle title={monthTitle(viewMonth)} />
      <DataTable
        columns={[
          { key: "date", header: "Fecha", compact: true, render: (row) => formatIsoDate(row.date) },
          { key: "terminal", header: "Terminal", compact: true, render: (row) => `Terminal ${row.terminalId}` },
          ...gameColumns,
          { key: "sold", header: "Vendido", align: "right", compact: true, cents: (row) => row.soldCents },
          { key: "commission", header: "Comisión", align: "right", cents: (row) => row.commissionCents },
          { key: "deposit", header: "A depositar", align: "right", compact: true, cents: (row) => row.amountToDepositCents },
          {
            key: "actions",
            header: "",
            compact: true,
            align: "right",
            minWidth: 160,
            node: (row) => (
              <RowActions
                onEdit={() => startEdit(row)}
                onRemove={() => setPendingRemove({ date: row.date, terminalId: row.terminalId })}
              />
            ),
          },
        ]}
        rows={days}
        empty="Todavía no hay días cargados."
      />
      <ConfirmDialog visible={pendingRemove !== null} onCancel={() => setPendingRemove(null)} onConfirm={() => void confirmRemove()} />
    </ScreenFrame>
  );
}

function BreakdownLine({
  label,
  cents,
  size = "sm",
  tone,
}: {
  label: string;
  cents: number;
  size?: "sm" | "md";
  tone?: "auto" | "navy";
}) {
  return (
    <View className="flex-row items-center justify-between gap-3 py-0.5">
      <Text className="shrink text-[15px] text-muted">{label}</Text>
      <MoneyText cents={cents} size={size} tone={tone} />
    </View>
  );
}
