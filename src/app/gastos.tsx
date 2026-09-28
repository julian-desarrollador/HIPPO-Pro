import { useState } from "react";
import { View } from "react-native";

import { DataTable } from "@/components/data-table";
import { formatIsoDate } from "@/components/format-date";
import { ChoiceChips, Feedback, Field, PrimaryButton, TextField } from "@/components/form-controls";
import { Card, ScreenFrame, SectionTitle } from "@/components/screen-frame";
import { MoneyText } from "@/components/stat-card";
import { EXPENSE_CATEGORIES, ledgerErrorMessage, readAmount, useLedger } from "@/modules/ledger";

export default function GastosScreen() {
  const { snapshot, summary, recordExpense } = useLedger();
  const [paidOn, setPaidOn] = useState("2026-08-16");
  const [categoryId, setCategoryId] = useState(EXPENSE_CATEGORIES[0].id);
  const [detail, setDetail] = useState("");
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const expenses = snapshot.expenses
    .filter((expense) => expense.month === snapshot.month)
    .slice()
    .sort((left, right) => left.paidOn.localeCompare(right.paidOn))
    .map((expense) => ({
      ...expense,
      categoryLabel: EXPENSE_CATEGORIES.find((category) => category.id === expense.categoryId)?.label ?? expense.categoryId,
    }));
  const agency = expenses.filter((expense) => expense.kind === "agency");
  const partners = expenses.filter((expense) => expense.kind === "partner-withdrawal");

  function onSave() {
    const amountCents = readAmount(amount, false);
    if (amountCents === null) {
      setError("Revisá el importe. Usá 1234,50.");
      setMessage("");
      return;
    }

    try {
      recordExpense({ paidOn, categoryId, detail, amountCents });
      setAmount("");
      setDetail("");
      setError("");
      setMessage("Gasto cargado.");
    } catch (caught) {
      setMessage("");
      setError(ledgerErrorMessage(caught));
    }
  }

  return (
    <ScreenFrame
      title="Gastos"
      subtitle="Los gastos de la agencia van aparte de los adelantos y retiros de socios. El total de salidas los suma, como la planilla.">
      <Card>
        <View className="gap-4">
          <Field label="Fecha de pago">
            <TextField value={paidOn} onChangeText={setPaidOn} autoCapitalize="none" placeholder="2026-08-16" />
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
          <PrimaryButton label="Registrar gasto" onPress={onSave} />
        </View>
      </Card>

      <ExpenseTable title="Gastos de la agencia" total={summary.agencyExpenseCents} rows={agency} />
      <ExpenseTable title="Adelantos y retiros" total={summary.partnerWithdrawalCents} rows={partners} />
    </ScreenFrame>
  );
}

function ExpenseTable({
  title,
  total,
  rows,
}: {
  title: string;
  total: number;
  rows: { id: string; paidOn: string; categoryLabel: string; detail: string; amountCents: number }[];
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
        ]}
        rows={rows}
      />
    </>
  );
}
