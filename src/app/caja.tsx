import { useEffect, useState } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Redirect, router, type Href } from "expo-router";
import { Pressable, Text, useWindowDimensions, View } from "react-native";

import { openingDate } from "@/components/calendar-grid";
import { AmountField } from "@/components/amount-field";
import { DateField } from "@/components/date-field";
import { formatIsoDate } from "@/components/format-date";
import {
  ChoiceChips,
  ConfirmDialog,
  Dialog,
  Feedback,
  Field,
  PrimaryButton,
  SecondaryButton,
  TextField,
} from "@/components/form-controls";
import { Card, ScreenFrame, SectionTitle } from "@/components/screen-frame";
import { MoneyText } from "@/components/stat-card";
import { wideLayout } from "@/constants/layout";
import { palette } from "@/constants/palette";
import {
  cashAndScheduleEnabled,
  chooseImageFile,
  formatAmountInput,
  incomeKindLabel,
  ledgerErrorMessage,
  readAmount,
  summarizeCashDay,
  useCashPhotos,
  type CashDayDraft,
  useLedger,
  type CashIncome,
  type CashIncomeKind,
  type DayPhotoFile,
} from "@/modules/ledger";

type ManualKey = "opening" | "commission" | "otherSales" | "salesTax" | "otherPayments" | "bankOut" | "withdrawal";

type ExpenseDraft = { id: string; detail: string; amountCents: number; photo?: DayPhotoFile | null };

const manualByLine: Record<string, ManualKey | undefined> = {
  opening: "opening",
  commission: "commission",
  "other-sales": "otherSales",
  "sales-tax": "salesTax",
  "other-payments": "otherPayments",
  "bank-out": "bankOut",
  withdrawal: "withdrawal",
};

const incomeOptions: { id: CashIncomeKind; label: string }[] = [
  { id: "bank", label: "Banco" },
  { id: "partner", label: "Personal" },
  { id: "other", label: "Otro" },
];

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function draftId(prefix: string): string {
  return `${prefix}-${globalThis.crypto.randomUUID()}`;
}

export default function CajaScreen() {
  const {
    snapshot,
    displayName,
    viewMonth,
    setViewMonth,
    saveCashDay,
    readOnly,
  } = useLedger();
  const photos = useCashPhotos();
  const wide = useWindowDimensions().width >= wideLayout;
  const [date, setDate] = useState(() => openingDate(viewMonth));
  const [manual, setManual] = useState<Record<ManualKey, string>>({
    opening: "",
    commission: "",
    otherSales: "",
    salesTax: "",
    otherPayments: "",
    bankOut: "",
    withdrawal: "",
  });
  const [counted, setCounted] = useState("");
  const [incomes, setIncomes] = useState<CashIncome[]>([]);
  const [expenses, setExpenses] = useState<ExpenseDraft[]>([]);
  const [incomeKind, setIncomeKind] = useState<CashIncomeKind>("bank");
  const [incomeDetail, setIncomeDetail] = useState("");
  const [incomeAmount, setIncomeAmount] = useState("");
  const [expenseDetail, setExpenseDetail] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [editingIncomeId, setEditingIncomeId] = useState<string | null>(null);
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);
  const [photoIds, setPhotoIds] = useState<ReadonlySet<string>>(new Set());
  const [openLine, setOpenLine] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const summary = summarizeCashDay(snapshot, date, cashDraft(manual, counted, incomes, expenses));
  const saved = snapshot.cashDays?.find((day) => day.agencyId === snapshot.agencyId && day.date === date);
  const savedKey = saved ? `${saved.id}:${saved.incomes.map((item) => item.updatedAt ?? item.createdAt).join()}:${saved.expenses.length}` : "new";

  useEffect(() => {
    const day = snapshot.cashDays?.find((item) => item.agencyId === snapshot.agencyId && item.date === date);
    const opening = day?.openingCents ?? summarizeCashDay(snapshot, date).suggestedOpeningCents ?? 0;
    setManual({
      opening: formatAmountInput(opening),
      commission: formatAmountInput(day?.commissionCents ?? 0),
      otherSales: formatAmountInput(day?.otherSalesCents ?? 0),
      salesTax: formatAmountInput(day?.salesTaxCents ?? 0),
      otherPayments: formatAmountInput(day?.otherPaymentsCents ?? 0),
      bankOut: formatAmountInput(day?.bankOutCents ?? 0),
      withdrawal: formatAmountInput(day?.personalWithdrawalCents ?? 0),
    });
    setCounted(day?.countedCents === undefined ? "" : formatAmountInput(day.countedCents));
    setIncomes(day?.incomes ?? []);
    setExpenses((day?.expenses ?? []).map((expense) => ({ ...expense, photo: null })));
    setEditingIncomeId(null);
    setIncomeDetail("");
    setIncomeAmount("");
  }, [date, savedKey]);

  useEffect(() => {
    if (!photos) {
      return;
    }
    let alive = true;
    void photos.list().then((ids) => {
      if (alive) {
        setPhotoIds(ids);
      }
    }).catch(() => {
      if (alive) {
        setPhotoIds(new Set());
      }
    });
    return () => {
      alive = false;
    };
  }, [photos, savedKey]);

  if (!cashAndScheduleEnabled(snapshot.agencyId)) {
    return <Redirect href="/" />;
  }

  function addIncome() {
    const amountCents = readAmount(incomeAmount, false);
    if (amountCents === null) {
      setError("Revisá el importe del efectivo.");
      return;
    }
    setError("");
    if (editingIncomeId) {
      setIncomes((current) =>
        current.map((income) =>
          income.id === editingIncomeId
            ? { ...income, kind: incomeKind, detail: incomeDetail.trim(), amountCents }
            : income,
        ),
      );
      setEditingIncomeId(null);
    } else {
      setIncomes((current) => [
        ...current,
        {
          id: draftId("cash-in"),
          kind: incomeKind,
          detail: incomeDetail.trim(),
          amountCents,
          createdBy: displayName.trim() || "Dueño",
          createdAt: new Date().toISOString(),
        },
      ]);
    }
    setIncomeDetail("");
    setIncomeAmount("");
  }

  function addExpense() {
    const amountCents = readAmount(expenseAmount, false);
    const detail = expenseDetail.trim();
    if (!detail || amountCents === null) {
      setError("El gasto necesita un detalle y un importe.");
      return;
    }
    setError("");
    setExpenses((current) => [...current, { id: draftId("cash-out"), detail, amountCents, photo: null }]);
    setExpenseDetail("");
    setExpenseAmount("");
  }

  async function attachPhoto(expenseId: string) {
    const chosen = await chooseImageFile();
    if (!chosen || typeof chosen === "string") {
      if (typeof chosen === "string") {
        setError(chosen);
      }
      return;
    }
    setExpenses((current) => current.map((expense) => (expense.id === expenseId ? { ...expense, photo: chosen } : expense)));
    setError("");
  }

  async function onSave() {
    const openingCents = readAmount(manual.opening, true);
    const commissionCents = readAmount(manual.commission, true);
    const otherSalesCents = readAmount(manual.otherSales, true);
    const salesTaxCents = readAmount(manual.salesTax, true);
    const otherPaymentsCents = readAmount(manual.otherPayments, true);
    const bankOutCents = readAmount(manual.bankOut, true);
    const personalWithdrawalCents = readAmount(manual.withdrawal, true);
    const countedCents = counted.trim() ? readAmount(counted, false) : null;
    if (
      openingCents === null ||
      commissionCents === null ||
      otherSalesCents === null ||
      salesTaxCents === null ||
      otherPaymentsCents === null ||
      bankOutCents === null ||
      personalWithdrawalCents === null ||
      countedCents === null && counted.trim()
    ) {
      setError("Revisá los importes. Usá 2.908.511,00.");
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const savedDay = await saveCashDay({
        date,
        actorName: displayName.trim() || "Dueño",
        at: new Date().toISOString(),
        openingCents,
        commissionCents,
        otherSalesCents,
        salesTaxCents,
        otherPaymentsCents,
        bankOutCents,
        personalWithdrawalCents,
        countedCents,
        incomes: incomes.map(({ id, kind, detail, amountCents }) => ({ id, kind, detail, amountCents })),
        expenses: expenses.map(({ id, detail, amountCents }) => ({ id, detail, amountCents })),
      });
      if (photos) {
        for (const expense of expenses) {
          if (expense.photo) {
            const stored = savedDay.expenses.find((item) => item.id === expense.id) ?? savedDay.expenses.find((item) => item.detail === expense.detail);
            if (stored) {
              await photos.upload(stored.id, expense.photo);
            }
          }
        }
        setPhotoIds(await photos.list());
      }
      setMessage("Caja guardada.");
    } catch (caught) {
      setError(ledgerErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  const onManual = (key: ManualKey, value: string) => setManual((current) => ({ ...current, [key]: value }));
  const goToCarga = () => {
    setOpenLine(null);
    setViewMonth(date.slice(0, 7));
    router.push(`/carga?fecha=${date}` as Href);
  };
  const openBettor = (bettorId: string) => {
    setOpenLine(null);
    router.push(`/cuentas/${bettorId}` as Href);
  };

  return (
    <ScreenFrame title="Caja del día">
      <Card>
        <View className="gap-3">
          <Field label="Fecha">
            <DateField value={date} onChange={setDate} />
          </Field>
          <Text className="text-[15px] text-muted">
            {summary.saved ? "Caja guardada." : "Sin guardar. El inicio propone el total anterior."}
          </Text>
        </View>
      </Card>

      <View className="mt-4">
        <CashSheet
          wide={wide}
          plus={summary.plus}
          minus={summary.minus}
          plusCents={summary.plusCents}
          minusCents={summary.minusCents}
          manual={manual}
          readOnly={readOnly}
          onManual={onManual}
          onOpen={setOpenLine}
        />
      </View>

      <View className="mt-4">
        <CashClose
          totalCents={summary.totalCents}
          counted={counted}
          differenceCents={summary.differenceCents}
          readOnly={readOnly}
          saving={saving}
          error={error}
          message={message}
          onCounted={setCounted}
          onSave={() => void onSave()}
        />
      </View>

      <View className="mt-4">
        <Card>
          <SectionTitle title="Efectivo que entró" />
          <Text className="mt-2 text-[15px] text-muted">Cada fila es plata en efectivo. Queda quién la cargó y a qué hora.</Text>
          {readOnly ? null : (
            <View className="mt-4 gap-3">
              <Field label="Tipo">
                <ChoiceChips options={incomeOptions} value={incomeKind} onChange={setIncomeKind} />
              </Field>
              <Field label="Detalle">
                <TextField value={incomeDetail} onChangeText={setIncomeDetail} placeholder="Opcional" accessibilityLabel="Detalle del efectivo" />
              </Field>
              <Field label="Monto">
                <AmountField value={incomeAmount} onChangeText={setIncomeAmount} />
              </Field>
              <SecondaryButton label={editingIncomeId ? "Guardar efectivo" : "Ingresar efectivo"} onPress={addIncome} />
            </View>
          )}
          <View className="mt-4 gap-2">
            {incomes.length === 0 ? <Text className="text-[15px] text-muted">Todavía no entró efectivo.</Text> : null}
            {incomes.map((income) => (
              <View key={income.id} className="rounded-[14px] border border-line px-4 py-3">
                <Text className="text-[17px] font-semibold text-navy">{incomeKindLabel(income.kind)}</Text>
                {income.detail ? <Text className="text-[15px] text-ink">{income.detail}</Text> : null}
                <MoneyText cents={income.amountCents} size="sm" />
                <Text className="text-[15px] text-muted">Cargó {income.createdBy} a las {formatWhen(income.createdAt)}</Text>
                {income.updatedBy && income.updatedAt ? (
                  <Text className="text-[15px] text-muted">Cambió {income.updatedBy} a las {formatWhen(income.updatedAt)}</Text>
                ) : null}
                {readOnly ? null : (
                  <View className="mt-2 flex-row gap-4">
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => {
                        setEditingIncomeId(income.id);
                        setIncomeKind(income.kind);
                        setIncomeDetail(income.detail);
                        setIncomeAmount(formatAmountInput(income.amountCents));
                      }}
                    >
                      <Text className="text-[16px] font-semibold text-accent">Editar</Text>
                    </Pressable>
                    <Pressable accessibilityRole="button" onPress={() => setPendingRemoveId(income.id)}>
                      <Text className="text-[16px] font-semibold text-negative">Quitar</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            ))}
            <View className="flex-row items-center justify-between border-t border-line pt-2">
              <Text className="text-[15px] font-semibold text-navy">Total de efectivo</Text>
              <MoneyText cents={summary.incomeTotalCents} size="sm" tone="navy" />
            </View>
          </View>
        </Card>
      </View>

      <View className={wide ? "mt-4 flex-row items-start gap-4" : "mt-4 gap-4"}>
        <View className={wide ? "min-w-0 flex-1" : ""}>
          <PersonList title="Cobros" empty="No hay cobros de cuentas en este día." rows={summary.collections} />
        </View>
        <View className={wide ? "min-w-0 flex-1" : ""}>
          <PersonList title="Deudas del día" empty="No hay deudas de cuentas en este día." rows={summary.debts} />
        </View>
      </View>
      <View className="mt-4">
        <Card>
          <SectionTitle title="Gastos" />
          {readOnly ? null : (
            <View className="mt-3 gap-3">
              <Field label="Detalle">
                <TextField value={expenseDetail} onChangeText={setExpenseDetail} placeholder="Almuerzo" accessibilityLabel="Detalle del gasto" />
              </Field>
              <Field label="Monto">
                <AmountField value={expenseAmount} onChangeText={setExpenseAmount} />
              </Field>
              <SecondaryButton label="Agregar gasto" onPress={addExpense} />
            </View>
          )}
          <View className="mt-3 gap-2">
            {expenses.length === 0 ? <Text className="text-[15px] text-muted">Sin gastos de caja.</Text> : null}
            {expenses.map((expense) => (
              <View key={expense.id} className="gap-1">
                <Text className="text-[17px] text-ink">{expense.detail}</Text>
                <MoneyText cents={expense.amountCents} size="sm" />
                {photos && !readOnly ? (
                  <SecondaryButton label={expense.photo || photoIds.has(expense.id) ? "Cambiar foto" : "Subir imagen"} onPress={() => void attachPhoto(expense.id)} />
                ) : null}
              </View>
            ))}
          </View>
        </Card>
      </View>
      <CashLineDetail
        lineKey={openLine}
        summary={summary}
        onClose={() => setOpenLine(null)}
        onGoToCarga={goToCarga}
        onOpenBettor={openBettor}
      />
      <ConfirmDialog
        visible={pendingRemoveId !== null}
        title="¿Quitar este efectivo?"
        detail="Queda anotado en el historial."
        onCancel={() => setPendingRemoveId(null)}
        onConfirm={() => {
          setIncomes((current) => current.filter((income) => income.id !== pendingRemoveId));
          setPendingRemoveId(null);
        }}
      />
    </ScreenFrame>
  );
}

function cashDraft(
  manual: Record<ManualKey, string>,
  counted: string,
  incomes: CashIncome[],
  expenses: ExpenseDraft[],
): CashDayDraft {
  const cents = (raw: string) => readAmount(raw, true) ?? 0;
  return {
    openingCents: cents(manual.opening),
    commissionCents: cents(manual.commission),
    otherSalesCents: cents(manual.otherSales),
    salesTaxCents: cents(manual.salesTax),
    otherPaymentsCents: cents(manual.otherPayments),
    bankOutCents: cents(manual.bankOut),
    personalWithdrawalCents: cents(manual.withdrawal),
    countedCents: counted.trim() ? readAmount(counted, false) : null,
    incomes,
    expenses,
  };
}

function lineExplanation(key: string, date: string): string {
  const day = formatIsoDate(date);
  if (key === "sold") {
    return `Suma lo vendido en Carga del ${day}.`;
  }
  if (key === "paid") {
    return `Suma lo pagado en Carga del ${day}.`;
  }
  if (key === "cancelled") {
    return `Suma los cancelados de Carga del ${day}.`;
  }
  if (key === "collections") {
    return `Suma los pagos de Cuentas corrientes del ${day}.`;
  }
  if (key === "debts") {
    return `Suma lo apostado en Cuentas corrientes del ${day}.`;
  }
  if (key === "bank-in") {
    return "Suma el efectivo del banco cargado en esta caja.";
  }
  if (key === "partner-in") {
    return "Suma el efectivo de un socio cargado en esta caja.";
  }
  if (key === "other-in") {
    return "Suma el otro efectivo cargado en esta caja.";
  }
  return "Suma los gastos de esta caja.";
}

function CashLineDetail({
  lineKey,
  summary,
  onClose,
  onGoToCarga,
  onOpenBettor,
}: {
  lineKey: string | null;
  summary: ReturnType<typeof summarizeCashDay>;
  onClose: () => void;
  onGoToCarga: () => void;
  onOpenBettor: (bettorId: string) => void;
}) {
  const line = [...summary.plus, ...summary.minus].find((item) => item.key === lineKey);
  const machineAmount =
    lineKey === "sold" ? "soldCents" : lineKey === "paid" ? "paidCents" : lineKey === "cancelled" ? "cancelledCents" : null;
  const people = lineKey === "collections" ? summary.collections : lineKey === "debts" ? summary.debts : null;
  const incomeKind = lineKey === "bank-in" ? "bank" : lineKey === "partner-in" ? "partner" : lineKey === "other-in" ? "other" : null;
  const incomes = incomeKind ? summary.incomes.filter((income) => income.kind === incomeKind) : null;
  return (
    <Dialog visible={line !== undefined} title={line?.label ?? ""} onClose={onClose}>
      {line ? <Text className="text-[15px] text-ink">{lineExplanation(line.key, summary.date)}</Text> : null}
      {machineAmount ? (
        summary.machine.length === 0 ? (
          <Text className="text-[15px] text-muted">Todavía no hay Carga de este día.</Text>
        ) : (
          <View>
            {summary.machine.map((row, index) => (
              <View key={row.id} className={`flex-row items-center justify-between gap-3 py-2 ${index === 0 ? "" : "border-t border-line"}`}>
                <Text className="min-w-0 flex-1 text-[15px] text-ink">
                  {row.racetrackName}
                  {row.terminalId ? ` · Terminal ${row.terminalId}` : ""}
                </Text>
                <MoneyText cents={row[machineAmount]} size="sm" />
              </View>
            ))}
          </View>
        )
      ) : null}
      {machineAmount ? <PrimaryButton label="Ir a Carga" onPress={onGoToCarga} /> : null}
      {people ? (
        people.length === 0 ? (
          <Text className="text-[15px] text-muted">No hay movimientos de cuentas en este día.</Text>
        ) : (
          <View>
            {people.map((row, index) => (
              <Pressable
                key={row.id}
                accessibilityRole="link"
                accessibilityLabel={`Abrir la carpeta de ${row.name}`}
                onPress={() => onOpenBettor(row.bettorId)}
                className={`flex-row items-center justify-between gap-3 py-2 ${index === 0 ? "" : "border-t border-line"}`}
              >
                <Text className="min-w-0 flex-1 text-[15px] text-ink">{row.name}</Text>
                <View className="flex-row items-center gap-1">
                  <MoneyText cents={row.cents} size="sm" />
                  <Ionicons name="chevron-forward" size={16} color={palette.accent} />
                </View>
              </Pressable>
            ))}
          </View>
        )
      ) : null}
      {incomes ? (
        incomes.length === 0 ? (
          <Text className="text-[15px] text-muted">Todavía no hay efectivo de este tipo.</Text>
        ) : (
          <View>
            {incomes.map((income, index) => (
              <View key={income.id} className={`gap-1 py-2 ${index === 0 ? "" : "border-t border-line"}`}>
                <View className="flex-row items-center justify-between gap-3">
                  <Text className="min-w-0 flex-1 text-[15px] text-ink">{income.detail || incomeKindLabel(income.kind)}</Text>
                  <MoneyText cents={income.amountCents} size="sm" />
                </View>
                <Text className="text-[13px] text-muted">Lo cargó {income.createdBy}</Text>
              </View>
            ))}
          </View>
        )
      ) : null}
      {incomes ? <Text className="text-[15px] text-muted">Se carga en Efectivo que entró, más abajo.</Text> : null}
      {lineKey === "expenses" ? (
        summary.expenses.length === 0 ? (
          <Text className="text-[15px] text-muted">Todavía no hay gastos en esta caja.</Text>
        ) : (
          <View>
            {summary.expenses.map((expense, index) => (
              <View key={expense.id} className={`flex-row items-center justify-between gap-3 py-2 ${index === 0 ? "" : "border-t border-line"}`}>
                <Text className="min-w-0 flex-1 text-[15px] text-ink">{expense.detail}</Text>
                <MoneyText cents={expense.amountCents} size="sm" />
              </View>
            ))}
          </View>
        )
      ) : null}
      {lineKey === "expenses" ? <Text className="text-[15px] text-muted">Se cargan en Gastos, más abajo.</Text> : null}
    </Dialog>
  );
}

function CashSheet({
  wide,
  plus,
  minus,
  plusCents,
  minusCents,
  manual,
  readOnly,
  onManual,
  onOpen,
}: {
  wide: boolean;
  plus: { key: string; label: string; cents: number; source: string }[];
  minus: { key: string; label: string; cents: number; source: string }[];
  plusCents: number;
  minusCents: number;
  manual: Record<ManualKey, string>;
  readOnly: boolean;
  onManual: (key: ManualKey, value: string) => void;
  onOpen: (key: string) => void;
}) {
  return (
    <Card>
      <View className={wide ? "flex-row items-start gap-6" : "gap-6"}>
        <View className={wide ? "min-w-0 flex-1" : ""}>
          <CashColumn title="Suma" lines={plus} subtotal={plusCents} manual={manual} readOnly={readOnly} onManual={onManual} onOpen={onOpen} />
        </View>
        <View className={wide ? "min-w-0 flex-1" : ""}>
          <CashColumn title="Resta" lines={minus} subtotal={minusCents} manual={manual} readOnly={readOnly} onManual={onManual} onOpen={onOpen} />
        </View>
      </View>
    </Card>
  );
}

function CashColumn({
  title,
  lines,
  subtotal,
  manual,
  readOnly,
  onManual,
  onOpen,
}: {
  title: string;
  lines: { key: string; label: string; cents: number; source: string }[];
  subtotal: number;
  manual: Record<ManualKey, string>;
  readOnly: boolean;
  onManual: (key: ManualKey, value: string) => void;
  onOpen: (key: string) => void;
}) {
  return (
    <View>
      <SectionTitle title={title} />
      <View className="mt-2">
        {lines.map((line, index) => {
          const key = manualByLine[line.key];
          const row = (
            <>
              <View className="min-w-0 flex-1">
                <Text className="text-[15px] text-ink">{line.label}</Text>
                {line.source ? <Text className="text-[13px] text-muted">{line.source}</Text> : null}
              </View>
              {key && !readOnly ? (
                <AmountField compact value={manual[key]} onChangeText={(value) => onManual(key, value)} />
              ) : (
                <View className="flex-row items-center gap-1">
                  <MoneyText cents={line.cents} size="sm" />
                  {line.source ? <Ionicons name="chevron-forward" size={16} color={palette.accent} /> : null}
                </View>
              )}
            </>
          );
          const rowClass = `flex-row items-center justify-between gap-3 py-2 ${index === 0 ? "" : "border-t border-line"}`;
          if (!line.source) {
            return (
              <View key={line.key} className={rowClass}>
                {row}
              </View>
            );
          }
          return (
            <Pressable
              key={line.key}
              accessibilityRole="button"
              accessibilityLabel={`${line.label}, ${line.source}`}
              onPress={() => onOpen(line.key)}
              className={rowClass}
            >
              {row}
            </Pressable>
          );
        })}
      </View>
      <View className="flex-row items-center justify-between border-t border-line pt-2">
        <Text className="text-[15px] font-semibold text-navy">Subtotal</Text>
        <MoneyText cents={subtotal} size="sm" tone="navy" />
      </View>
    </View>
  );
}

function CashClose({
  totalCents,
  counted,
  differenceCents,
  readOnly,
  saving,
  error,
  message,
  onCounted,
  onSave,
}: {
  totalCents: number;
  counted: string;
  differenceCents: number | null;
  readOnly: boolean;
  saving: boolean;
  error: string;
  message: string;
  onCounted: (value: string) => void;
  onSave: () => void;
}) {
  const differenceTone = differenceCents === null || differenceCents === 0 ? "navy" : differenceCents > 0 ? "positive" : "negative";
  return (
    <Card>
      <View className="flex-row items-center justify-between gap-3">
        <Text className="font-sans text-[24px] font-semibold text-navy">Total</Text>
        <MoneyText cents={totalCents} size="md" tone="navy" />
      </View>
      <View className="mt-3 gap-2 border-t border-line pt-3">
        <View className="flex-row items-center justify-between gap-3">
          <Text className="text-[15px] text-ink">Efectivo contado</Text>
          {readOnly ? (
            <MoneyText cents={readAmount(counted, true) ?? 0} size="sm" />
          ) : (
            <AmountField compact value={counted} onChangeText={onCounted} />
          )}
        </View>
        {differenceCents === null ? (
          <Text className="text-[15px] text-muted">Si contás el efectivo, acá se ve la diferencia con el total.</Text>
        ) : (
          <View className="flex-row items-center justify-between gap-3">
            <Text className="text-[15px] text-ink">Diferencia</Text>
            <MoneyText cents={differenceCents} size="sm" tone={differenceTone} />
          </View>
        )}
      </View>
      {readOnly ? null : (
        <View className="mt-4">
          <PrimaryButton label={saving ? "Guardando…" : "Guardar caja"} onPress={onSave} />
        </View>
      )}
      <Feedback error={error} message={message} />
    </Card>
  );
}

function PersonList({ title, empty, rows }: { title: string; empty: string; rows: { id: string; name: string; cents: number }[] }) {
  return (
    <Card>
      <SectionTitle title={title} />
      <View className="mt-3 gap-2">
        {rows.length === 0 ? <Text className="text-[15px] text-muted">{empty}</Text> : null}
        {rows.map((row) => (
          <View key={row.id} className="flex-row items-center justify-between gap-3">
            <Text className="text-[17px] text-ink">{row.name}</Text>
            <MoneyText cents={row.cents} size="sm" />
          </View>
        ))}
      </View>
    </Card>
  );
}
