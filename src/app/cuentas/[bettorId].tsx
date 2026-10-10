import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { router, useLocalSearchParams, type Href } from "expo-router";

import { AmountField } from "@/components/amount-field";
import { DataTable } from "@/components/data-table";
import { DateField } from "@/components/date-field";
import { formatIsoDate } from "@/components/format-date";
import {
  ConfirmDialog,
  Feedback,
  Field,
  PrimaryButton,
  RowActions,
  SecondaryButton,
} from "@/components/form-controls";
import { Card, ScreenFrame, SectionTitle } from "@/components/screen-frame";
import { MoneyText } from "@/components/stat-card";
import { formatAmountInput, ledgerErrorMessage, readAmount, shownBettorBalanceCents, useLedger, type BettorAccount } from "@/modules/ledger";

type PendingRemove = { kind: "play" | "payment"; id: string };

function MoneyOrDash({ cents, debt = false, gain = false }: { cents: number | null; debt?: boolean; gain?: boolean }) {
  if (cents === null) {
    return <Text className="text-right font-sans text-[17px] font-semibold text-ink">—</Text>;
  }
  const shown = debt && cents > 0 ? -cents : cents;
  const tone = gain && cents > 0 ? "positive" : "auto";
  return <MoneyText cents={shown} tone={tone} fill />;
}

export function BettorFolder({ bettorId, onBack }: { bettorId: string; onBack: () => void }) {
  const {
    bettorAccounts,
    viewMonth,
    recordBettorPlay,
    updateBettorPlay,
    removeBettorPlay,
    recordBettorPayment,
    updateBettorPayment,
    removeBettorPayment,
    readOnly,
  } = useLedger();
  const account = bettorAccounts.find((item) => item.id === bettorId);

  const [playDate, setPlayDate] = useState(`${viewMonth}-01`);
  const [playAmount, setPlayAmount] = useState("");
  const [payoutAmount, setPayoutAmount] = useState("");
  const [editingPlayId, setEditingPlayId] = useState<string | null>(null);
  const [playMessage, setPlayMessage] = useState("");
  const [playError, setPlayError] = useState("");

  const [paymentDate, setPaymentDate] = useState(`${viewMonth}-01`);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [paymentMessage, setPaymentMessage] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [pendingRemove, setPendingRemove] = useState<PendingRemove | null>(null);

  useEffect(() => {
    if (!editingPlayId) {
      setPlayDate(`${viewMonth}-01`);
    }
    if (!editingPaymentId) {
      setPaymentDate(`${viewMonth}-01`);
    }
  }, [editingPaymentId, editingPlayId, viewMonth]);

  if (!account) {
    return (
      <ScreenFrame title="Cuentas corrientes">
        <Card>
          <Text className="text-base leading-6 text-ink">Ese apostador no está.</Text>
          <View className="mt-4">
            <SecondaryButton label="Volver a las cuentas" onPress={onBack} />
          </View>
        </Card>
      </ScreenFrame>
    );
  }

  function cancelPlayEdit() {
    setEditingPlayId(null);
    setPlayAmount("");
    setPayoutAmount("");
    setPlayError("");
    setPlayMessage("");
  }

  function cancelPaymentEdit() {
    setEditingPaymentId(null);
    setPaymentAmount("");
    setPaymentError("");
    setPaymentMessage("");
  }

  async function onSavePlay() {
    const amountCents = readAmount(playAmount, false);
    const payoutCents = readAmount(payoutAmount, true);
    if (amountCents === null || payoutCents === null) {
      setPlayError("Revisá el importe. Usá 2.908.511,00.");
      setPlayMessage("");
      return;
    }

    setPlayMessage("Guardando…");
    setPlayError("");
    try {
      if (editingPlayId) {
        await updateBettorPlay({ id: editingPlayId, bettorId, date: playDate, amountCents, payoutCents });
        setEditingPlayId(null);
        setPlayMessage("Día actualizado.");
      } else {
        await recordBettorPlay({ bettorId, date: playDate, amountCents, payoutCents });
        setPlayMessage("Día cargado.");
      }
      setPlayAmount("");
      setPayoutAmount("");
    } catch (caught) {
      setPlayMessage("");
      setPlayError(ledgerErrorMessage(caught));
    }
  }

  async function onSavePayment() {
    const amountCents = readAmount(paymentAmount, false);
    if (amountCents === null) {
      setPaymentError("Revisá el importe. Usá 2.908.511,00.");
      setPaymentMessage("");
      return;
    }

    setPaymentMessage("Guardando…");
    setPaymentError("");
    try {
      if (editingPaymentId) {
        await updateBettorPayment({ id: editingPaymentId, bettorId, date: paymentDate, amountCents });
        setEditingPaymentId(null);
        setPaymentMessage("Pago actualizado.");
      } else {
        await recordBettorPayment({ bettorId, date: paymentDate, amountCents });
        setPaymentMessage("Pago cargado.");
      }
      setPaymentAmount("");
    } catch (caught) {
      setPaymentMessage("");
      setPaymentError(ledgerErrorMessage(caught));
    }
  }

  async function confirmRemove() {
    if (!pendingRemove) {
      return;
    }
    const current = pendingRemove;
    setPendingRemove(null);
    try {
      if (current.kind === "play") {
        await removeBettorPlay(current.id);
        if (editingPlayId === current.id) {
          cancelPlayEdit();
        }
        setPlayMessage("Movimiento quitado.");
        setPlayError("");
      } else {
        await removeBettorPayment(current.id);
        if (editingPaymentId === current.id) {
          cancelPaymentEdit();
        }
        setPaymentMessage("Movimiento quitado.");
        setPaymentError("");
      }
    } catch (caught) {
      if (current.kind === "play") {
        setPlayMessage("");
        setPlayError(ledgerErrorMessage(caught));
      } else {
        setPaymentMessage("");
        setPaymentError(ledgerErrorMessage(caught));
      }
    }
  }

  return (
    <ScreenFrame title={account.name}>
      <SecondaryButton className="self-start" label="Volver a las cuentas" onPress={onBack} />
      <View className="items-center rounded-[14px] border border-line bg-card p-6">
        <Text className="font-sans text-[24px] font-semibold text-navy">{account.name}</Text>
        <Text className="mt-2 text-[14px] uppercase text-muted" style={{ letterSpacing: 0.5 }}>
          {account.statusLabel}
        </Text>
        <View className="mt-2 w-full">
          <MoneyText
            cents={shownBettorBalanceCents(account.balanceCents)}
            size="md"
            tone={account.balanceCents < 0 ? "positive" : "auto"}
            align="center"
            fill
          />
        </View>
      </View>
      {readOnly ? null : <><SectionTitle title="Día" />
      <Card>
        <View className="gap-4">
          <Field label="Fecha">
            <DateField value={playDate} onChange={setPlayDate} />
          </Field>
          <Field label="Lo que apostó">
            <AmountField debt value={playAmount} onChangeText={setPlayAmount} />
          </Field>
          <Field label="Lo que cobró">
            <AmountField gain value={payoutAmount} onChangeText={setPayoutAmount} />
          </Field>
          <Text className="text-[15px] leading-5 text-muted">
            Lo que cobró es el dividendo del ticket. Si no cobró, dejalo vacío.
          </Text>
          <Feedback error={playError} message={playMessage} />
          <PrimaryButton label={editingPlayId ? "Guardar cambios" : "Registrar día"} onPress={() => void onSavePlay()} />
          {editingPlayId ? <SecondaryButton label="Cancelar" onPress={cancelPlayEdit} /> : null}
        </View>
      </Card>
      <Card>
        <View className="gap-4">
          <Field label="Fecha del pago">
            <DateField value={paymentDate} onChange={setPaymentDate} />
          </Field>
          <Field label="Monto">
            <AmountField value={paymentAmount} onChangeText={setPaymentAmount} />
          </Field>
          <Feedback error={paymentError} message={paymentMessage} />
          <PrimaryButton label={editingPaymentId ? "Guardar cambios" : "Registrar pago"} onPress={() => void onSavePayment()} />
          {editingPaymentId ? <SecondaryButton label="Cancelar" onPress={cancelPaymentEdit} /> : null}
        </View>
      </Card></>}
      <SectionTitle title="Movimientos" />
      <DataTable
        columns={[
          { key: "date", header: "Fecha", compact: true, render: (row) => formatIsoDate(row.date) },
          { key: "kind", header: "Movimiento", compact: true, render: (row) => row.kindLabel },
          {
            key: "stake",
            header: "Apostó",
            align: "right",
            compact: true,
            node: (row) => <MoneyOrDash debt cents={row.kind === "play" ? (row.stakeCents ?? 0) : null} />,
          },
          {
            key: "payout",
            header: "Cobró",
            align: "right",
            compact: true,
            node: (row) => <MoneyOrDash gain cents={row.kind === "play" ? (row.payoutCents ?? 0) : null} />,
          },
          {
            key: "payment",
            header: "Pago",
            align: "right",
            compact: true,
            node: (row) => <MoneyOrDash cents={row.kind === "payment" ? (row.amountCents ?? 0) : null} />,
          },
          ...(readOnly
            ? []
            : [
          {
            key: "actions",
            header: "",
            compact: true,
            align: "right" as const,
            node: (row: BettorAccount["movements"][number]) => (
              <RowActions
                onEdit={() => {
                  if (row.kind === "play") {
                    setEditingPlayId(row.id);
                    setPlayDate(row.date);
                    setPlayAmount(row.stakeCents ? formatAmountInput(row.stakeCents) : "");
                    setPayoutAmount(row.payoutCents ? formatAmountInput(row.payoutCents) : "");
                    setPlayError("");
                    setPlayMessage("");
                    cancelPaymentEdit();
                  } else {
                    setEditingPaymentId(row.id);
                    setPaymentDate(row.date);
                    setPaymentAmount(formatAmountInput(row.amountCents ?? 0));
                    setPaymentError("");
                    setPaymentMessage("");
                    cancelPlayEdit();
                  }
                }}
                onRemove={() => setPendingRemove({ kind: row.kind, id: row.id })}
              />
            ),
          },
            ]),
        ]}
        rows={account.movements}
      />
      <ConfirmDialog visible={pendingRemove !== null} onCancel={() => setPendingRemove(null)} onConfirm={() => void confirmRemove()} />
    </ScreenFrame>
  );
}

export default function BettorFolderScreen() {
  const params = useLocalSearchParams<{ bettorId: string }>();
  const folderId = typeof params.bettorId === "string" ? params.bettorId : "";
  return <BettorFolder bettorId={folderId} onBack={() => router.push("/cuentas" as Href)} />;
}
