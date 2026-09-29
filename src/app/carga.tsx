import { useState } from "react";
import { Text, useWindowDimensions, View } from "react-native";

import { DataTable, KeyValueList } from "@/components/data-table";
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
  formatAmountInput,
  ledgerErrorMessage,
  readAmount,
  settleDay,
  useLedger,
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
  const preview =
    soldCents !== null && cancelledCents !== null && paidCents !== null
      ? settleDay({ racetrackId, soldCents, cancelledCents, paidCents })
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

  function onSave() {
    if (soldCents === null || cancelledCents === null || paidCents === null) {
      setError("Revisá los importes. Usá 1234,50.");
      setMessage("");
      return;
    }

    try {
      if (editingId) {
        updateDay({ id: editingId, date, racetrackId, soldCents, cancelledCents, paidCents });
        setEditingId(null);
        setMessage("Día actualizado.");
      } else {
        recordDay({ date, racetrackId, soldCents, cancelledCents, paidCents });
        setMessage("Día cargado.");
      }
      clearAmounts();
      setError("");
    } catch (caught) {
      setMessage("");
      setError(ledgerErrorMessage(caught));
    }
  }

  function confirmRemove() {
    if (!pendingRemoveId) {
      return;
    }
    try {
      removeDay(pendingRemoveId);
      if (editingId === pendingRemoveId) {
        cancelEdit();
      }
      setMessage("Movimiento quitado.");
      setError("");
    } catch (caught) {
      setMessage("");
      setError(ledgerErrorMessage(caught));
    }
    setPendingRemoveId(null);
  }

  return (
    <ScreenFrame title="Carga del día">
      <View className={wide ? "flex-row items-start gap-4" : "gap-4"}>
        <View className="flex-1">
          <Card>
            <View className="gap-4">
              <Field label="Fecha">
                <DateField value={date} onChange={setDate} lockedMonth={snapshot.month} />
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
        <View className={wide ? "w-80" : ""}>
          <Card>
            <Text className="text-sm text-muted">Cálculo del día</Text>
            {preview ? (
              <View className="mt-3">
                <KeyValueList
                  rows={[
                    { label: "Neto", value: <MoneyText cents={preview.netCents} size="lg" /> },
                    { label: "Comisión", value: <MoneyText cents={preview.commissionCents} /> },
                    { label: "A depositar", value: <MoneyText cents={preview.amountToDepositCents} size="lg" tone="navy" /> },
                  ]}
                />
              </View>
            ) : (
              <Text className="mt-3 text-sm text-negative">Revisá los importes. Usá 1234,50.</Text>
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
