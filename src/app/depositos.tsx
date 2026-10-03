import { useEffect, useState } from "react";
import { Text, View } from "react-native";

import { monthTitle } from "@/components/calendar-grid";
import { DataTable, KeyValueList } from "@/components/data-table";
import { formatIsoDate } from "@/components/format-date";
import { AmountField } from "@/components/amount-field";
import { DateField } from "@/components/date-field";
import {
  ChoiceChips,
  ConfirmDialog,
  Feedback,
  Field,
  PrimaryButton,
  RowActions,
  SecondaryButton,
} from "@/components/form-controls";
import { Card, NoRacetracksCard, ScreenFrame, SectionTitle } from "@/components/screen-frame";
import { MoneyText } from "@/components/stat-card";
import {
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
  const { snapshot, summary, canViewBalances, recordDeposit, updateDeposit, removeDeposit, racetracks, viewMonth, setViewMonth } = useLedger();
  const [date, setDate] = useState(`${viewMonth}-01`);
  const [racetrackId, setRacetrackId] = useState<RacetrackId>("san-isidro");
  const [amount, setAmount] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (!editingId) {
      setDate(`${viewMonth}-01`);
    }
  }, [editingId, viewMonth]);

  useEffect(() => {
    if (!racetracks.some((track) => track.id === racetrackId)) {
      setRacetrackId(racetracks[0]?.id ?? "san-isidro");
    }
  }, [racetrackId, racetracks, snapshot.racetracks]);
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const selectedId = racetracks.some((track) => track.id === racetrackId) ? racetrackId : (racetracks[0]?.id ?? "san-isidro");

  const deposits = snapshot.deposits
    .filter((deposit) => deposit.date.startsWith(viewMonth))
    .slice()
    .sort((left, right) => left.date.localeCompare(right.date) || left.racetrackId.localeCompare(right.racetrackId))
    .map((deposit) => ({
      ...deposit,
      racetrackName: racetracks.find((track) => track.id === deposit.racetrackId)?.name ?? deposit.racetrackId,
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

  async function onSave() {
    const amountCents = readAmount(amount, false);
    if (amountCents === null) {
      setError("Revisá el importe. Usá 2.908.511,00.");
      setMessage("");
      return;
    }

    setMessage("Guardando…");
    setError("");
    try {
      if (editingId) {
        await updateDeposit({ id: editingId, date, racetrackId: selectedId, amountCents });
        setEditingId(null);
        setMessage("Depósito actualizado.");
      } else {
        await recordDeposit({ date, racetrackId: selectedId, amountCents });
        setMessage("Depósito cargado.");
      }
      setAmount("");
      setViewMonth(date.slice(0, 7));
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
      await removeDeposit(id);
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
    <ScreenFrame title="Depósitos">
      {canViewBalances ? (
        summary.racetracks.map((track) => (
          <Card key={track.racetrackId}>
            <Text className="font-sans text-[24px] font-semibold text-navy">{track.name}</Text>
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

      {racetracks.length === 0 ? (
        <NoRacetracksCard />
      ) : (
        <Card>
          <View className="gap-4">
            <Field label="Fecha">
              <DateField value={date} onChange={setDate} />
            </Field>
            <Field label="Hipódromo">
              <ChoiceChips
                options={racetracks.map((track) => ({ id: track.id, label: track.name }))}
                value={selectedId}
                onChange={setRacetrackId}
              />
            </Field>
            <Field label="Monto">
              <AmountField value={amount} onChangeText={setAmount} />
            </Field>
            <Feedback error={error} message={message} />
            <PrimaryButton label={editingId ? "Guardar cambios" : "Registrar depósito"} onPress={onSave} />
            {editingId ? <SecondaryButton label="Cancelar" onPress={cancelEdit} /> : null}
          </View>
        </Card>
      )}

      <SectionTitle title={`Movimientos de ${monthTitle(viewMonth)}`} />
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
