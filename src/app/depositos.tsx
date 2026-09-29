import { useState } from "react";
import { Text, View } from "react-native";

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
import {
  RACETRACKS,
  formatAmountInput,
  ledgerErrorMessage,
  readAmount,
  useLedger,
  type RacetrackId,
} from "@/modules/ledger";

type DepositRow = {
  id: string;
  date: string;
  racetrackId: RacetrackId;
  amountCents: number;
  racetrackName: string;
};

export default function DepositosScreen() {
  const { snapshot, summary, canViewBalances, recordDeposit, updateDeposit, removeDeposit } = useLedger();
  const [date, setDate] = useState("2026-08-16");
  const [racetrackId, setRacetrackId] = useState<RacetrackId>("san-isidro");
  const [amount, setAmount] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const deposits = snapshot.deposits
    .filter((deposit) => deposit.date.startsWith(snapshot.month))
    .slice()
    .sort((left, right) => left.date.localeCompare(right.date) || left.racetrackId.localeCompare(right.racetrackId))
    .map((deposit) => ({
      ...deposit,
      racetrackName: RACETRACKS.find((track) => track.id === deposit.racetrackId)?.name ?? deposit.racetrackId,
    }));

  function startEdit(row: DepositRow) {
    setEditingId(row.id);
    setDate(row.date);
    setRacetrackId(row.racetrackId);
    setAmount(formatAmountInput(row.amountCents));
    setError("");
    setMessage("");
  }

  function cancelEdit() {
    setEditingId(null);
    setAmount("");
    setError("");
    setMessage("");
  }

  function onSave() {
    const amountCents = readAmount(amount, false);
    if (amountCents === null) {
      setError("Revisá el importe. Usá 1234,50.");
      setMessage("");
      return;
    }

    try {
      if (editingId) {
        updateDeposit({ id: editingId, date, racetrackId, amountCents });
        setEditingId(null);
        setMessage("Depósito actualizado.");
      } else {
        recordDeposit({ date, racetrackId, amountCents });
        setMessage("Depósito cargado.");
      }
      setAmount("");
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
      removeDeposit(pendingRemoveId);
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
    <ScreenFrame title="Depósitos">
      {canViewBalances ? (
        summary.racetracks.map((track) => (
          <Card key={track.racetrackId}>
            <Text className="font-sans text-[22px] font-semibold text-navy">{track.name}</Text>
            <Text className="mt-3 text-sm text-muted">Saldo a pagar</Text>
            <View className="mt-1">
              <MoneyText cents={track.owedCents} size="lg" tone="navy" />
            </View>
            <View className="mt-4">
              <KeyValueList
                rows={[
                  { label: "Saldo anterior", value: <MoneyText cents={track.openingCents} /> },
                  { label: "A depositar del mes", value: <MoneyText cents={track.amountToDepositCents} /> },
                  { label: "Depósitos", value: <MoneyText cents={track.depositsCents} /> },
                ]}
              />
            </View>
          </Card>
        ))
      ) : (
        <Card>
          <Text className="text-base text-ink">El saldo a pagar lo ve el dueño de la agencia.</Text>
        </Card>
      )}

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
          <Field label="Monto">
            <TextField value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0,00" />
          </Field>
          <Feedback error={error} message={message} />
          <PrimaryButton label={editingId ? "Guardar cambios" : "Registrar depósito"} onPress={onSave} />
          {editingId ? <SecondaryButton label="Cancelar" onPress={cancelEdit} /> : null}
        </View>
      </Card>

      <SectionTitle title="Movimientos de agosto" />
      <DataTable
        columns={[
          { key: "date", header: "Fecha", compact: true, render: (row) => formatIsoDate(row.date) },
          { key: "track", header: "Hipódromo", compact: true, render: (row) => row.racetrackName },
          { key: "amount", header: "Monto", align: "right", compact: true, cents: (row) => row.amountCents },
          {
            key: "actions",
            header: "",
            compact: true,
            align: "right",
            node: (row) => <RowActions onEdit={() => startEdit(row)} onRemove={() => setPendingRemoveId(row.id)} />,
          },
        ]}
        rows={deposits}
      />
      <ConfirmDialog visible={pendingRemoveId !== null} onCancel={() => setPendingRemoveId(null)} onConfirm={confirmRemove} />
    </ScreenFrame>
  );
}
