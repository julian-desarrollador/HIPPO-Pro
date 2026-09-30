import { useEffect, useState } from "react";
import { Text, View } from "react-native";

import { DataTable } from "@/components/data-table";
import { formatIsoDate } from "@/components/format-date";
import { AmountField } from "@/components/amount-field";
import { DateField } from "@/components/date-field";
import {
  ChoiceChips,
  ConfirmDialog,
  Dialog,
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
  categoryHasExpenses,
  formatAmountInput,
  ledgerErrorMessage,
  readAmount,
  useLedger,
} from "@/modules/ledger";

const DEFAULT_CATEGORY_ID = "sueldo";

type ExpenseRow = {
  id: string;
  paidOn: string;
  categoryId: string;
  categoryLabel: string;
  detail: string;
  amountCents: number;
};

export default function GastosScreen() {
  const {
    snapshot,
    summary,
    expenseCategories,
    recordExpense,
    updateExpense,
    removeExpense,
    addExpenseCategory,
    updateExpenseCategory,
    removeExpenseCategory,
    viewMonth,
  } = useLedger();
  const [paidOn, setPaidOn] = useState(`${viewMonth}-01`);
  const [categoryId, setCategoryId] = useState(DEFAULT_CATEGORY_ID);
  const [detail, setDetail] = useState("");
  const [amount, setAmount] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (!editingId) {
      setPaidOn(`${viewMonth}-01`);
    }
  }, [editingId, viewMonth]);

  useEffect(() => {
    if (!expenseCategories.some((category) => category.id === categoryId)) {
      setCategoryId(expenseCategories[0]?.id ?? DEFAULT_CATEGORY_ID);
    }
  }, [categoryId, expenseCategories]);

  const [pendingRemoveExpenseId, setPendingRemoveExpenseId] = useState<string | null>(null);
  const [pendingRemoveCategoryId, setPendingRemoveCategoryId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [categoryLabel, setCategoryLabel] = useState("");
  const [categoryError, setCategoryError] = useState("");
  const [categorySaving, setCategorySaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);

  const expenses = snapshot.expenses
    .filter((expense) => expense.month === viewMonth)
    .slice()
    .sort((left, right) => left.paidOn.localeCompare(right.paidOn))
    .map((expense) => ({
      ...expense,
      categoryLabel: expenseCategories.find((category) => category.id === expense.categoryId)?.label ?? expense.categoryId,
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

  function openAddCategory() {
    setEditingCategoryId(null);
    setCategoryLabel("");
    setCategoryError("");
    setMessage("");
    setError("");
    setFormOpen(true);
  }

  function startCategoryEdit(id: string) {
    const category = expenseCategories.find((item) => item.id === id);
    if (!category) {
      return;
    }
    setManageOpen(false);
    setEditingCategoryId(id);
    setCategoryLabel(category.label);
    setCategoryError("");
    setMessage("");
    setError("");
    setFormOpen(true);
  }

  function closeCategoryForm() {
    if (categorySaving) {
      return;
    }
    setFormOpen(false);
    setEditingCategoryId(null);
    setCategoryLabel("");
    setCategoryError("");
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

  async function onSaveCategory() {
    if (categorySaving) {
      return;
    }
    if (!categoryLabel.trim()) {
      setCategoryError("Escribí el nombre.");
      return;
    }

    setCategorySaving(true);
    setCategoryError("");
    try {
      if (editingCategoryId) {
        await updateExpenseCategory({ id: editingCategoryId, label: categoryLabel });
        setMessage("Categoría actualizada.");
      } else {
        await addExpenseCategory({ label: categoryLabel });
        setMessage("Categoría agregada.");
      }
      setError("");
      setCategoryLabel("");
      setEditingCategoryId(null);
      setFormOpen(false);
    } catch (caught) {
      setCategoryError(ledgerErrorMessage(caught));
    } finally {
      setCategorySaving(false);
    }
  }

  async function confirmRemoveExpense() {
    if (!pendingRemoveExpenseId) {
      return;
    }
    const id = pendingRemoveExpenseId;
    setPendingRemoveExpenseId(null);
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

  async function confirmRemoveCategory() {
    if (!pendingRemoveCategoryId) {
      return;
    }
    const id = pendingRemoveCategoryId;
    setPendingRemoveCategoryId(null);
    try {
      await removeExpenseCategory(id);
      setManageOpen(false);
      setMessage("Categoría quitada.");
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
            <ChoiceChips searchable options={expenseCategories} value={categoryId} onChange={setCategoryId} />
          </Field>
          <View className="flex-row flex-wrap items-center gap-4">
            <SecondaryButton className="self-start" label="Agregar categoría" onPress={openAddCategory} />
            {expenseCategories.length > 0 ? (
              <SecondaryButton
                className="self-start"
                label="Editar o quitar"
                onPress={() => {
                  setError("");
                  setMessage("");
                  setManageOpen(true);
                }}
              />
            ) : null}
          </View>
          <Field label="Detalle">
            <TextField value={detail} onChangeText={setDetail} placeholder="Opcional" />
          </Field>
          <Field label="Monto">
            <AmountField value={amount} onChangeText={setAmount} />
          </Field>
          <Feedback error={formOpen || manageOpen ? "" : error} message={formOpen || manageOpen ? "" : message} />
          <PrimaryButton label={editingId ? "Guardar cambios" : "Registrar gasto"} onPress={onSave} />
          {editingId ? <SecondaryButton label="Cancelar" onPress={cancelEdit} /> : null}
        </View>
      </Card>

      <ExpenseTable
        title="Gastos de la agencia"
        total={summary.agencyExpenseCents}
        rows={agency}
        onEdit={startEdit}
        onRemove={setPendingRemoveExpenseId}
      />
      <ExpenseTable
        title="Adelantos y retiros"
        total={summary.partnerWithdrawalCents}
        rows={partners}
        onEdit={startEdit}
        onRemove={setPendingRemoveExpenseId}
      />
      <Dialog visible={formOpen} title={editingCategoryId ? "Editar categoría" : "Nueva categoría"} onClose={closeCategoryForm}>
        <Field label="Nombre">
          <TextField value={categoryLabel} onChangeText={setCategoryLabel} placeholder="Nombre" accessibilityLabel="Nombre de la categoría" />
        </Field>
        <Feedback error={categoryError} />
        <PrimaryButton
          label={categorySaving ? "Guardando…" : editingCategoryId ? "Guardar" : "Agregar categoría"}
          onPress={() => void onSaveCategory()}
        />
        <SecondaryButton label="Cancelar" onPress={closeCategoryForm} />
      </Dialog>
      <Dialog visible={manageOpen} title="Categorías" onClose={() => setManageOpen(false)}>
        {expenseCategories.map((category) => {
          const inUse = categoryHasExpenses(snapshot, category.id);
          return (
            <View key={category.id} className="gap-1">
              <View className="flex-row items-center justify-between gap-3">
                <Text className="flex-1 text-[15px] font-semibold text-navy">{category.label}</Text>
                <RowActions
                  onEdit={() => startCategoryEdit(category.id)}
                  onRemove={
                    inUse
                      ? undefined
                      : () => {
                          setManageOpen(false);
                          setPendingRemoveCategoryId(category.id);
                        }
                  }
                />
              </View>
              {inUse ? <Text className="text-[13px] text-muted">Tiene gastos. Quitá esos movimientos antes.</Text> : null}
            </View>
          );
        })}
        <SecondaryButton label="Cerrar" onPress={() => setManageOpen(false)} />
      </Dialog>
      <ConfirmDialog visible={pendingRemoveExpenseId !== null} onCancel={() => setPendingRemoveExpenseId(null)} onConfirm={() => void confirmRemoveExpense()} />
      <ConfirmDialog
        visible={pendingRemoveCategoryId !== null}
        title="¿Quitar esta categoría?"
        onCancel={() => setPendingRemoveCategoryId(null)}
        onConfirm={() => void confirmRemoveCategory()}
      />
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
