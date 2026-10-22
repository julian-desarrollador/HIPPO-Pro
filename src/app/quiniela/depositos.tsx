import { useState } from "react";
import { Text, View } from "react-native";

import { AmountField } from "@/components/amount-field";
import { monthTitle, openingDate } from "@/components/calendar-grid";
import { DataTable, KeyValueList } from "@/components/data-table";
import { DateField } from "@/components/date-field";
import { formatIsoDate } from "@/components/format-date";
import { ConfirmDialog, Feedback, Field, PrimaryButton, RowActions, SecondaryButton } from "@/components/form-controls";
import { LotteryGate } from "@/components/lottery-gate";
import { Card, ScreenFrame, SectionTitle } from "@/components/screen-frame";
import { MoneyText } from "@/components/stat-card";
import {
  formatAmountInput,
  ledgerErrorMessage,
  readAmount,
  useLedger,
  useLottery,
  type LotteryDeposit,
} from "@/modules/ledger";

export default function LotteryDepositsScreen() {
  return (
    <LotteryGate title="Depósitos a la lotería">
      <LotteryDeposits />
    </LotteryGate>
  );
}

function LotteryDeposits() {
  const { canViewBalances, viewMonth, setViewMonth } = useLedger();
  const { snapshot, summary, recordDeposit, updateDeposit, removeDeposit } = useLottery();
  const [date, setDate] = useState(() => openingDate(viewMonth));
  const [amount, setAmount] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [dateMonth, setDateMonth] = useState(viewMonth);
  if (dateMonth !== viewMonth) {
    setDateMonth(viewMonth);
    if (!editingId) {
      setDate(openingDate(viewMonth));
    }
  }

  const deposits = (snapshot?.deposits ?? [])
    .filter((deposit) => deposit.date.startsWith(viewMonth))
    .slice()
    .sort((left, right) => left.date.localeCompare(right.date));

  function startEdit(row: LotteryDeposit) {
    setEditingId(row.id);
    setDate(row.date);
    setAmount(formatAmountInput(row.amountCents));
    setError("");
    setMessage("");
  }

  function cancelEdit() {
    setEditingId(null);
    setDate(openingDate(viewMonth));
    setAmount("");
    setError("");
    setMessage("");
  }

  async function onSave() {
    if (saving) {
      return;
    }
    const amountCents = readAmount(amount, false);
    if (amountCents === null) {
      setError("Revisá el importe. Usá 2.908.511,00.");
      setMessage("");
      return;
    }
    setSaving(true);
    setMessage("Guardando…");
    setError("");
    try {
      if (editingId) {
        await updateDeposit({ id: editingId, date, amountCents });
        setEditingId(null);
        setDate(openingDate(date.slice(0, 7)));
        setMessage("Depósito actualizado.");
      } else {
        await recordDeposit({ date, amountCents });
        setMessage("Depósito cargado.");
      }
      setAmount("");
      setViewMonth(date.slice(0, 7));
    } catch (caught) {
      setMessage("");
      setError(ledgerErrorMessage(caught));
    } finally {
      setSaving(false);
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
    <ScreenFrame title="Depósitos a la lotería">
      {canViewBalances && summary ? (
        <Card>
          <Text className="font-sans text-[24px] font-semibold text-navy">Lotería</Text>
          <Text className="mt-3 text-sm text-muted">Saldo a pagar</Text>
          <View className="mt-1">
            <MoneyText cents={summary.owedCents} size="lg" tone="navy" />
          </View>
          <View className="mt-4">
            <KeyValueList
              rows={[
                { label: "Saldo anterior", value: <MoneyText cents={summary.openingCents} /> },
                { label: "A depositar del mes", value: <MoneyText cents={summary.amountToDepositCents} /> },
                { label: "Depósitos", value: <MoneyText cents={summary.depositsCents} /> },
              ]}
            />
          </View>
        </Card>
      ) : (
        <Card>
          <Text className="text-base text-ink">El saldo a pagar lo ve el dueño de la agencia.</Text>
        </Card>
      )}

      <Card>
        <View className="gap-4">
          <Field label="Fecha">
            <DateField value={date} onChange={setDate} />
          </Field>
          <Field label="Monto">
            <AmountField value={amount} onChangeText={setAmount} />
          </Field>
          <Feedback error={error} message={message} />
          <PrimaryButton label={editingId ? "Guardar cambios" : "Registrar depósito"} onPress={() => void onSave()} />
          {editingId ? <SecondaryButton label="Cancelar" onPress={cancelEdit} /> : null}
        </View>
      </Card>

      <SectionTitle title={`Movimientos de ${monthTitle(viewMonth)}`} />
      <DataTable
        columns={[
          { key: "date", header: "Fecha", compact: true, render: (row) => formatIsoDate(row.date) },
          { key: "amount", header: "Monto", align: "right", compact: true, cents: (row) => row.amountCents },
          {
            key: "actions",
            header: "",
            compact: true,
            align: "right",
            minWidth: 160,
            node: (row) => <RowActions onEdit={() => startEdit(row)} onRemove={() => setPendingRemoveId(row.id)} />,
          },
        ]}
        rows={deposits}
      />
      <ConfirmDialog visible={pendingRemoveId !== null} onCancel={() => setPendingRemoveId(null)} onConfirm={() => void confirmRemove()} />
    </ScreenFrame>
  );
}
