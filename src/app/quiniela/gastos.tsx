import { useState } from "react";
import { View } from "react-native";

import { AmountField } from "@/components/amount-field";
import { openingDate } from "@/components/calendar-grid";
import { DataTable } from "@/components/data-table";
import { DateField } from "@/components/date-field";
import { formatIsoDate } from "@/components/format-date";
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
import { LotteryGate } from "@/components/lottery-gate";
import { Card, ScreenFrame, SectionTitle } from "@/components/screen-frame";
import { MoneyText } from "@/components/stat-card";
import {
  formatAmountInput,
  ledgerErrorMessage,
  readAmount,
  useLedger,
  useLottery,
  type LotteryExpense,
} from "@/modules/ledger";

type Kind = LotteryExpense["kind"];

const kindOptions: readonly { id: Kind; label: string }[] = [
  { id: "agency", label: "Gasto de la agencia" },
  { id: "partner-withdrawal", label: "Adelanto o retiro" },
];

export default function LotteryExpensesScreen() {
  return (
    <LotteryGate title="Gastos de quiniela">
      <LotteryExpenses />
    </LotteryGate>
  );
}

function LotteryExpenses() {
  const { viewMonth } = useLedger();
  const { snapshot, summary, recordExpense, updateExpense, removeExpense } = useLottery();
  const [paidOn, setPaidOn] = useState(() => openingDate(viewMonth));
  const [kind, setKind] = useState<Kind>("agency");
  const [detail, setDetail] = useState("");
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
      setPaidOn(openingDate(viewMonth));
    }
  }

  const expenses = (snapshot?.expenses ?? [])
    .filter((expense) => expense.month === viewMonth)
    .slice()
    .sort((left, right) => left.paidOn.localeCompare(right.paidOn));
  const agency = expenses.filter((expense) => expense.kind === "agency");
  const partners = expenses.filter((expense) => expense.kind === "partner-withdrawal");

  function startEdit(row: LotteryExpense) {
    setEditingId(row.id);
    setPaidOn(row.paidOn);
    setKind(row.kind);
    setDetail(row.detail);
    setAmount(formatAmountInput(row.amountCents));
    setError("");
    setMessage("");
  }

  function cancelEdit() {
    setEditingId(null);
    setPaidOn(openingDate(viewMonth));
    setAmount("");
    setDetail("");
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
        await updateExpense({ id: editingId, paidOn, kind, detail, amountCents });
        setEditingId(null);
        setPaidOn(openingDate(viewMonth));
        setMessage("Gasto actualizado.");
      } else {
        await recordExpense({ month: viewMonth, paidOn, kind, detail, amountCents });
        setMessage("Gasto cargado.");
      }
      setAmount("");
      setDetail("");
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
      await removeExpense(id);
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
    <ScreenFrame title="Gastos de quiniela">
      <Card>
        <View className="gap-4">
          <Field label="Fecha de pago">
            <DateField value={paidOn} onChange={setPaidOn} />
          </Field>
          <Field label="Tipo">
            <ChoiceChips options={kindOptions} value={kind} onChange={setKind} />
          </Field>
          <Field label="Detalle">
            <TextField value={detail} onChangeText={setDetail} placeholder="Opcional" />
          </Field>
          <Field label="Monto">
            <AmountField value={amount} onChangeText={setAmount} />
          </Field>
          <Feedback error={error} message={message} />
          <PrimaryButton label={editingId ? "Guardar cambios" : "Registrar gasto"} onPress={() => void onSave()} />
          {editingId ? <SecondaryButton label="Cancelar" onPress={cancelEdit} /> : null}
        </View>
      </Card>

      <ExpenseTable
        title="Gastos de la agencia"
        total={summary?.agencyExpenseCents ?? 0}
        rows={agency}
        onEdit={startEdit}
        onRemove={setPendingRemoveId}
      />
      <ExpenseTable
        title="Adelantos y retiros"
        total={summary?.partnerWithdrawalCents ?? 0}
        rows={partners}
        onEdit={startEdit}
        onRemove={setPendingRemoveId}
      />
      <ConfirmDialog visible={pendingRemoveId !== null} onCancel={() => setPendingRemoveId(null)} onConfirm={() => void confirmRemove()} />
    </ScreenFrame>
  );
}

function ExpenseTable({
  title,
  total,
  rows,
  onEdit,
  onRemove,
}: {
  title: string;
  total: number;
  rows: LotteryExpense[];
  onEdit: (row: LotteryExpense) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <>
      <SectionTitle title={title} trailing={<MoneyText cents={total} size="lg" tone="navy" />} />
      <DataTable
        columns={[
          { key: "date", header: "Fecha", compact: true, render: (row) => formatIsoDate(row.paidOn) },
          { key: "detail", header: "Detalle", compact: true, render: (row) => row.detail || "—" },
          { key: "amount", header: "Monto", align: "right", compact: true, cents: (row) => row.amountCents },
          {
            key: "actions",
            header: "",
            compact: true,
            align: "right",
            node: (row) => <RowActions onEdit={() => onEdit(row)} onRemove={() => onRemove(row.id)} />,
          },
        ]}
        rows={rows}
      />
    </>
  );
}
