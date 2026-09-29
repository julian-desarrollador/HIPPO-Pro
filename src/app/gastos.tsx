import { useEffect, useState } from "react";
import { View } from "react-native";

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
import { EXPENSE_CATEGORIES, formatAmountInput, ledgerErrorMessage, readAmount, useLedger } from "@/modules/ledger";

type ExpenseRow = {
  id: string;
  paidOn: string;
  categoryId: string;
  categoryLabel: string;
  detail: string;
  amountCents: number;
};

export default function GastosScreen() {
  const { snapshot, summary, recordExpense, updateExpense, removeExpense, viewMonth } = useLedger();
  const [paidOn, setPaidOn] = useState(`${viewMonth}-01`);
  const [categoryId, setCategoryId] = useState(EXPENSE_CATEGORIES[0].id);
  const [detail, setDetail] = useState("");
  const [amount, setAmount] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (!editingId) {
      setPaidOn(`${viewMonth}-01`);
    }
  }, [editingId, viewMonth]);
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const expenses = snapshot.expenses
    .filter((expense) => expense.month === viewMonth)
    .slice()
    .sort((left, right) => left.paidOn.localeCompare(right.paidOn))
    .map((expense) => ({
      ...expense,
      categoryLabel: EXPENSE_CATEGORIES.find((category) => category.id === expense.categoryId)?.label ?? expense.categoryId,
    }));
  const agency = expenses.filter((expense) => expense.kind === "agency");
  const partners = expenses.filter((expense) => expense.kind === "partner-withdrawal");

  function startEdit(row: ExpenseRow) {
    setEditingId(row.id);
    setPaidOn(row.paidOn);
    setCategoryId(row.categoryId);
    setDetail(row.detail);
    setAmount(formatAmountInput(row.amountCents));
    setError("");
    setMessage("");
  }

  function cancelEdit() {
    setEditingId(null);
    setAmount("");
    setDetail("");
    setError("");
    setMessage("");
  }

  async function onSave() {
    const amountCents = readAmount(amount, false);
    if (amountCents === null) {
      setError("Revisá el importe. Usá 1234,50.");
      setMessage("");
      return;
    }

    setMessage("Guardando…");
    setError("");
    try {
      if (editingId) {
        await updateExpense({ id: editingId, paidOn, categoryId, detail, amountCents });
        setEditingId(null);
        setMessage("Gasto actualizado.");
      } else {
        await recordExpense({ paidOn, categoryId, detail, amountCents, month: viewMonth });
        setMessage("Gasto cargado.");
      }
      setAmount("");
      setDetail("");
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
    <ScreenFrame title="Gastos">
      <Card>
        <View className="gap-4">
          <Field label="Fecha de pago">
            <DateField value={paidOn} onChange={setPaidOn} />
          </Field>
          <Field label="Categoría">
            <ChoiceChips options={EXPENSE_CATEGORIES} value={categoryId} onChange={setCategoryId} />
          </Field>
          <Field label="Detalle">
            <TextField value={detail} onChangeText={setDetail} placeholder="Opcional" />
          </Field>
          <Field label="Monto">
            <TextField value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0,00" />
          </Field>
          <Feedback error={error} message={message} />
          <PrimaryButton label={editingId ? "Guardar cambios" : "Registrar gasto"} onPress={onSave} />
          {editingId ? <SecondaryButton label="Cancelar" onPress={cancelEdit} /> : null}
        </View>
      </Card>

      <ExpenseTable
        title="Gastos de la agencia"
        total={summary.agencyExpenseCents}
        rows={agency}
        onEdit={startEdit}
        onRemove={setPendingRemoveId}
      />
      <ExpenseTable
        title="Adelantos y retiros"
        total={summary.partnerWithdrawalCents}
        rows={partners}
        onEdit={startEdit}
        onRemove={setPendingRemoveId}
      />
      <ConfirmDialog visible={pendingRemoveId !== null} onCancel={() => setPendingRemoveId(null)} onConfirm={confirmRemove} />
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
  rows: ExpenseRow[];
  onEdit: (row: ExpenseRow) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <>
      <SectionTitle title={title} trailing={<MoneyText cents={total} size="lg" tone="navy" />} />
      <DataTable
        columns={[
          { key: "date", header: "Fecha", compact: true, render: (row) => formatIsoDate(row.paidOn) },
          { key: "category", header: "Categoría", compact: true, render: (row) => row.categoryLabel },
          { key: "detail", header: "Detalle", render: (row) => row.detail || "—" },
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
