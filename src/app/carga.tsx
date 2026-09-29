import { useState } from "react";
import { Text, useWindowDimensions, View } from "react-native";

import { DataTable } from "@/components/data-table";
import { formatIsoDate } from "@/components/format-date";
import { DateField } from "@/components/date-field";
import {
  ChoiceChips,
  ConfirmDialog,
  Feedback,
  Field,
  PrimaryButton,
  RowActions,
  SecondaryButton,
  TextField,
} from "@/components/form-controls";
import { Card, ScreenFrame, SectionTitle } from "@/components/screen-frame";
import { MoneyText } from "@/components/stat-card";
import { wideLayout } from "@/constants/layout";
import {
  RACETRACKS,
  currentCommissionBasisPoints,
  formatAmountInput,
  formatSignedPercent,
  ledgerErrorMessage,
  readAmount,
  settleDay,
  useLedger,
  type DaySettlement,
  type RacetrackId,
  type SettledDay,
} from "@/modules/ledger";

export default function CargaScreen() {
  const { days, recordDay, updateDay, removeDay, snapshot } = useLedger();
  const wide = useWindowDimensions().width >= wideLayout;
  const [date, setDate] = useState("2026-08-16");
  const [racetrackId, setRacetrackId] = useState<RacetrackId>("san-isidro");
  const [sold, setSold] = useState("");
  const [cancelled, setCancelled] = useState("");
  const [paid, setPaid] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const soldCents = readAmount(sold, true);
  const cancelledCents = readAmount(cancelled, true);
  const paidCents = readAmount(paid, true);
  const editingDay = editingId ? days.find((day) => day.id === editingId) : undefined;
  const previewCommission =
    editingDay && editingDay.racetrackId === racetrackId
      ? editingDay.commissionBasisPoints
      : currentCommissionBasisPoints(racetrackId, snapshot.commissions);
  const preview =
    soldCents !== null && cancelledCents !== null && paidCents !== null
      ? settleDay({
          racetrackId,
          soldCents,
          cancelledCents,
          paidCents,
          commissionBasisPoints: previewCommission,
        })
      : null;

  function clearAmounts() {
    setSold("");
    setCancelled("");
    setPaid("");
  }

  function startEdit(row: SettledDay) {
    setEditingId(row.id);
    setDate(row.date);
    setRacetrackId(row.racetrackId);
    setSold(formatAmountInput(row.soldCents));
    setCancelled(formatAmountInput(row.cancelledCents));
    setPaid(formatAmountInput(row.paidCents));
    setError("");
    setMessage("");
  }

  function cancelEdit() {
    setEditingId(null);
    clearAmounts();
    setError("");
    setMessage("");
  }

  async function onSave() {
    if (soldCents === null || cancelledCents === null || paidCents === null) {
      setError("Revisá los importes. Usá 1234,50.");
      setMessage("");
      return;
    }

    setMessage("Guardando…");
    setError("");
    try {
      if (editingId) {
        await updateDay({ id: editingId, date, racetrackId, soldCents, cancelledCents, paidCents });
        setEditingId(null);
        setMessage("Día actualizado.");
      } else {
        await recordDay({ date, racetrackId, soldCents, cancelledCents, paidCents });
        setMessage("Día cargado.");
      }
      clearAmounts();
    } catch (caught) {
      setMessage("");
      setError(ledgerErrorMessage(caught));
    }
  }

  async function confirmRemove() {
    if (!pendingRemoveId) {
      return;
    }
    const id = pendingRemoveId;
    setPendingRemoveId(null);
    try {
      await removeDay(id);
      if (editingId === id) {
        cancelEdit();
      }
      setMessage("Movimiento quitado.");
      setError("");
    } catch (caught) {
      setMessage("");
      setError(ledgerErrorMessage(caught));
    }
  }

  return (
    <ScreenFrame title="Carga del día">
      <View className={wide ? "flex-row items-start gap-4" : "gap-4"}>
        <View className="flex-1">
          <Card>
            <View className="gap-4">
              <Field label="Fecha">
                <DateField value={date} onChange={setDate} />
              </Field>
              <Field label="Hipódromo">
                <ChoiceChips
                  options={RACETRACKS.map((track) => ({ id: track.id, label: track.name }))}
                  value={racetrackId}
                  onChange={setRacetrackId}
                />
              </Field>
              <Field label="Vendido">
                <TextField value={sold} onChangeText={setSold} keyboardType="decimal-pad" placeholder="0,00" />
              </Field>
              <Field label="Cancelados">
                <TextField value={cancelled} onChangeText={setCancelled} keyboardType="decimal-pad" placeholder="0,00" />
              </Field>
              <Field label="Pagado">
                <TextField value={paid} onChangeText={setPaid} keyboardType="decimal-pad" placeholder="0,00" />
              </Field>
              <Feedback error={error} message={message} />
              <PrimaryButton label={editingId ? "Guardar cambios" : "Cargar día"} onPress={onSave} />
              {editingId ? <SecondaryButton label="Cancelar" onPress={cancelEdit} /> : null}
            </View>
          </Card>
        </View>
        <View className={wide ? "w-96" : ""}>
          <Card>
            <Text className="font-sans text-[22px] font-semibold text-navy">Cálculo del día</Text>
            <Text className="mt-1 text-[13px] text-muted">
              {RACETRACKS.find((track) => track.id === racetrackId)?.name ?? racetrackId}
            </Text>
            {preview && soldCents !== null && cancelledCents !== null && paidCents !== null ? (
              <View className="mt-3">
                <DayBreakdown soldCents={soldCents} cancelledCents={cancelledCents} paidCents={paidCents} settlement={preview} />
              </View>
            ) : (
              <Text className="mt-3 text-[13px] text-negative">Revisá los importes. Usá 1234,50.</Text>
            )}
          </Card>
        </View>
      </View>

      <SectionTitle title="Agosto 2026" />
      <DataTable
        columns={[
          { key: "date", header: "Fecha", compact: true, render: (row) => formatIsoDate(row.date) },
          { key: "track", header: "Hipódromo", compact: true, render: (row) => row.racetrackName },
          { key: "sold", header: "Vendido", align: "right", cents: (row) => row.soldCents },
          { key: "cancelled", header: "Cancelados", align: "right", cents: (row) => row.cancelledCents },
          { key: "paid", header: "Pagado", align: "right", cents: (row) => row.paidCents },
          { key: "net", header: "Neto", align: "right", compact: true, cents: (row) => row.netCents },
          { key: "commission", header: "Comisión", align: "right", cents: (row) => row.commissionCents },
          { key: "deposit", header: "A depositar", align: "right", compact: true, cents: (row) => row.amountToDepositCents },
          {
            key: "actions",
            header: "",
            compact: true,
            align: "right",
            node: (row) => <RowActions onEdit={() => startEdit(row)} onRemove={() => setPendingRemoveId(row.id)} />,
          },
        ]}
        rows={days}
        empty="Todavía no hay días cargados."
      />
      <ConfirmDialog visible={pendingRemoveId !== null} onCancel={() => setPendingRemoveId(null)} onConfirm={confirmRemove} />
    </ScreenFrame>
  );
}

function DayBreakdown({
  soldCents,
  cancelledCents,
  paidCents,
  settlement,
}: {
  soldCents: number;
  cancelledCents: number;
  paidCents: number;
  settlement: DaySettlement;
}) {
  const commissionLabel = `Comisión (${formatSignedPercent(settlement.commissionBasisPoints)})`;
  const adjustmentLabel = `Ajuste (${formatSignedPercent(settlement.depositAdjustmentBasisPoints)})`;

  return (
    <View>
      <BreakdownLine label="Vendido" cents={soldCents} />
      <BreakdownLine label="− Cancelados" cents={cancelledCents} />
      <View className="my-2 h-px bg-line" />
      <BreakdownLine label="Neto" cents={settlement.netCents} size="md" />
      <View className="mt-2">
        <BreakdownLine label={commissionLabel} cents={settlement.commissionCents} />
      </View>
      <BreakdownLine label="− Pagado" cents={paidCents} />
      <BreakdownLine label={adjustmentLabel} cents={settlement.adjustmentCents} />
      <View className="my-2 h-px bg-line" />
      <BreakdownLine label="A depositar" cents={settlement.amountToDepositCents} size="md" tone="navy" />
    </View>
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
      <Text className="shrink text-[13px] text-muted">{label}</Text>
      <MoneyText cents={cents} size={size} tone={tone} />
    </View>
  );
}
