import { useEffect, useState } from "react";
import { Image } from "expo-image";
import { router, type Href } from "expo-router";
import { Linking, Text, useWindowDimensions, View } from "react-native";

import { KeyValueList } from "@/components/data-table";
import { ExpenseTable, type ExpenseRow } from "@/components/expense-table";
import { ConfirmDialog, Dialog, Feedback, PrimaryButton } from "@/components/form-controls";
import { Card, ScreenFrame } from "@/components/screen-frame";
import { MoneyText } from "@/components/stat-card";
import { ledgerErrorMessage, useExpensePhotos, useLedger } from "@/modules/ledger";

export default function ResultadoScreen() {
  const { canViewBalances, summary, reportText, snapshot, expenseCategories, removeExpense, viewMonth, readOnly } = useLedger();
  const photos = useExpensePhotos();
  const window = useWindowDimensions();
  const [photoIds, setPhotoIds] = useState<ReadonlySet<string>>(new Set());
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [viewingUrl, setViewingUrl] = useState<string | null | undefined>(undefined);
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const partners: ExpenseRow[] = snapshot.expenses
    .filter((expense) => expense.month === viewMonth && expense.kind === "partner-withdrawal")
    .slice()
    .sort((left, right) => left.paidOn.localeCompare(right.paidOn))
    .map((expense) => ({
      ...expense,
      categoryLabel: expenseCategories.find((category) => category.id === expense.categoryId)?.label ?? expense.categoryId,
    }));

  useEffect(() => {
    if (!photos || !canViewBalances) {
      return;
    }
    let alive = true;
    void photos.list().then((ids) => {
      if (alive) {
        setPhotoIds(ids);
      }
    });
    return () => {
      alive = false;
    };
  }, [photos, canViewBalances, snapshot.expenses]);

  async function openPhoto(expenseId: string) {
    if (!photos) {
      return;
    }
    setViewingId(expenseId);
    setViewingUrl(undefined);
    setViewingUrl(await photos.url(expenseId));
  }

  async function confirmRemove() {
    if (!pendingRemoveId) {
      return;
    }
    const id = pendingRemoveId;
    setPendingRemoveId(null);
    try {
      await removeExpense(id);
      let photoWarning = "";
      if (photos) {
        try {
          await photos.remove(id);
          setPhotoIds(await photos.list());
        } catch {
          photoWarning = "El movimiento se quitó, pero la imagen no.";
        }
      }
      setError(photoWarning);
    } catch (caught) {
      setError(ledgerErrorMessage(caught));
    }
  }

  if (!canViewBalances) {
    return (
      <ScreenFrame title="Resultado">
        <Card>
          <Text className="text-base leading-6 text-ink">
            El resultado y el saldo de la agencia los ve el dueño. Cambiá a Dueño para verlos.
          </Text>
        </Card>
      </ScreenFrame>
    );
  }

  return (
    <ScreenFrame title="Resultado">
      <View className="items-center rounded-[14px] border border-line bg-card p-6">
        <Text className="text-[14px] uppercase text-muted" style={{ letterSpacing: 0.5 }}>
          Saldo del mes
        </Text>
        <View className="mt-2 w-full">
          <MoneyText cents={summary.balanceCents} size="md" tone="navy" align="center" fill />
        </View>
      </View>
      <Card>
        <KeyValueList
          rows={[
            { label: "Venta neta", value: <MoneyText cents={summary.netCents} /> },
            { label: "Ganancia de la agencia", value: <MoneyText cents={summary.billingCents} /> },
            { label: "Gastos de la agencia", value: <MoneyText cents={summary.agencyExpenseCents} /> },
            { label: "Retiros", value: <MoneyText cents={summary.partnerWithdrawalCents} /> },
          ]}
        />
      </Card>
      <Feedback error={error} />
      <ExpenseTable
        title="Adelantos y retiros"
        total={summary.partnerWithdrawalCents}
        rows={partners}
        onEdit={(row) => router.push(`/gastos?edit=${row.id}` as Href)}
        onRemove={setPendingRemoveId}
        editable={!readOnly}
        photoIds={photos ? photoIds : undefined}
        onOpenPhoto={photos ? (id) => void openPhoto(id) : undefined}
      />
      <PrimaryButton
        label="Compartir por WhatsApp"
        onPress={() => {
          Linking.openURL(`https://wa.me/?text=${encodeURIComponent(reportText)}`);
        }}
      />
      <ConfirmDialog visible={pendingRemoveId !== null} onCancel={() => setPendingRemoveId(null)} onConfirm={() => void confirmRemove()} />
      <Dialog
        wide
        visible={viewingId !== null}
        title="Imagen"
        contentMaxHeight={Math.max(320, window.height - 180)}
        onClose={() => {
          setViewingId(null);
          setViewingUrl(undefined);
        }}
      >
        {viewingUrl ? (
          <Image
            source={{ uri: viewingUrl }}
            contentFit="contain"
            accessibilityLabel="Imagen del gasto"
            style={{ width: "100%", height: Math.max(280, window.height - 240) }}
          />
        ) : (
          <Text className="text-[15px] text-muted">{viewingUrl === null ? "No se pudo abrir la imagen." : "Abriendo la imagen…"}</Text>
        )}
      </Dialog>
    </ScreenFrame>
  );
}
