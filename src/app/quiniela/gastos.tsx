import { useEffect, useState } from "react";
import { Image } from "expo-image";
import { Pressable, Text, useWindowDimensions, View } from "react-native";

import { AmountField } from "@/components/amount-field";
import { openingDate } from "@/components/calendar-grid";
import { DataTable } from "@/components/data-table";
import { DateField } from "@/components/date-field";
import { formatIsoDate } from "@/components/format-date";
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
  uploadPreviewHeight,
} from "@/components/form-controls";
import { LotteryGate } from "@/components/lottery-gate";
import { Card, ScreenFrame, SectionTitle } from "@/components/screen-frame";
import { MoneyText } from "@/components/stat-card";
import {
  chooseImageFile,
  formatAmountInput,
  ledgerErrorMessage,
  readAmount,
  useExpensePhotos,
  useLedger,
  useLottery,
  type DayPhotoFile,
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
  const photos = useExpensePhotos();
  const window = useWindowDimensions();
  const [photoIds, setPhotoIds] = useState<ReadonlySet<string>>(new Set());
  const [pendingPhoto, setPendingPhoto] = useState<DayPhotoFile | null>(null);
  const [photoDraft, setPhotoDraft] = useState<DayPhotoFile | null>(null);
  const [photoDraftUrl, setPhotoDraftUrl] = useState<string | null>(null);
  const [dropPhoto, setDropPhoto] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [viewingUrl, setViewingUrl] = useState<string | null | undefined>(undefined);
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

  useEffect(() => {
    if (!photos) {
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
  }, [photos, snapshot?.expenses]);

  function clearPhotoChoice() {
    setPendingPhoto(null);
    setDropPhoto(false);
  }

  function closePreview() {
    if (photoDraftUrl) {
      URL.revokeObjectURL(photoDraftUrl);
    }
    setPhotoDraft(null);
    setPhotoDraftUrl(null);
  }

  function startEdit(row: LotteryExpense) {
    setEditingId(row.id);
    setPaidOn(row.paidOn);
    setKind(row.kind);
    setDetail(row.detail);
    setAmount(formatAmountInput(row.amountCents));
    clearPhotoChoice();
    setError("");
    setMessage("");
  }

  function cancelEdit() {
    setEditingId(null);
    setPaidOn(openingDate(viewMonth));
    setAmount("");
    setDetail("");
    clearPhotoChoice();
    closePreview();
    setError("");
    setMessage("");
  }

  async function choosePhoto() {
    const chosen = await chooseImageFile();
    if (typeof chosen === "string") {
      setError(chosen);
      setMessage("");
      return;
    }
    if (!chosen) {
      return;
    }
    if (photoDraftUrl) {
      URL.revokeObjectURL(photoDraftUrl);
    }
    setPhotoDraft(chosen);
    setPhotoDraftUrl(URL.createObjectURL(new Blob([chosen.bytes], { type: chosen.contentType || "image/jpeg" })));
    setError("");
  }

  async function confirmPreview() {
    if (!photoDraft) {
      return;
    }
    if (editingId && photos) {
      try {
        await photos.upload(editingId, photoDraft);
        setPhotoIds(await photos.list());
        setPendingPhoto(null);
        setDropPhoto(false);
        setMessage("Imagen subida.");
        setError("");
        closePreview();
      } catch {
        setMessage("");
        setError("No se pudo subir la imagen.");
      }
      return;
    }
    setPendingPhoto(photoDraft);
    setDropPhoto(false);
    setError("");
    closePreview();
  }

  async function openPhoto(expenseId: string) {
    if (!photos) {
      return;
    }
    setViewingId(expenseId);
    setViewingUrl(undefined);
    const url = await photos.url(expenseId);
    setViewingUrl(url);
  }

  async function keepPhoto(expenseId: string) {
    if (!photos) {
      return null;
    }
    try {
      if (pendingPhoto) {
        await photos.upload(expenseId, pendingPhoto);
      } else if (dropPhoto) {
        await photos.remove(expenseId);
      }
      setPhotoIds(await photos.list());
      return null;
    } catch {
      return "El gasto quedó guardado, pero la imagen no.";
    }
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
      let expenseId = editingId;
      if (editingId) {
        await updateExpense({ id: editingId, paidOn, kind, detail, amountCents });
        setEditingId(null);
        setPaidOn(openingDate(viewMonth));
        setMessage("Gasto actualizado.");
      } else {
        const created = await recordExpense({ month: viewMonth, paidOn, kind, detail, amountCents });
        expenseId = created.id;
        setMessage("Gasto cargado.");
      }
      const photoError = expenseId ? await keepPhoto(expenseId) : null;
      setAmount("");
      setDetail("");
      clearPhotoChoice();
      if (photoError) {
        setError(photoError);
      }
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
      let photoWarning = "";
      if (photos) {
        try {
          await photos.remove(id);
          setPhotoIds(await photos.list());
        } catch {
          photoWarning = "El movimiento se quitó, pero la imagen no.";
        }
      }
      if (editingId === id) {
        cancelEdit();
      }
      setMessage("Movimiento quitado.");
      setError(photoWarning);
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
          {photos ? (
            <Field label="Imagen">
              <View className="gap-2">
                <Text className="text-[15px] text-muted">
                  {pendingPhoto
                    ? pendingPhoto.name
                    : editingId && photoIds.has(editingId) && !dropPhoto
                      ? "Hay una imagen guardada."
                      : "Opcional."}
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  <SecondaryButton label="Subir imagen" onPress={() => void choosePhoto()} />
                  {pendingPhoto || (editingId && photoIds.has(editingId) && !dropPhoto) ? (
                    <SecondaryButton
                      label="Quitar imagen"
                      onPress={() => {
                        setPendingPhoto(null);
                        setDropPhoto(true);
                      }}
                    />
                  ) : null}
                </View>
              </View>
            </Field>
          ) : null}
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
        photoIds={photos ? photoIds : undefined}
        onOpenPhoto={photos ? (id) => void openPhoto(id) : undefined}
      />
      <ExpenseTable
        title="Adelantos y retiros"
        total={summary?.partnerWithdrawalCents ?? 0}
        rows={partners}
        onEdit={startEdit}
        onRemove={setPendingRemoveId}
        photoIds={photos ? photoIds : undefined}
        onOpenPhoto={photos ? (id) => void openPhoto(id) : undefined}
      />
      <ConfirmDialog visible={pendingRemoveId !== null} onCancel={() => setPendingRemoveId(null)} onConfirm={() => void confirmRemove()} />
      <Dialog
        wide
        visible={photoDraft !== null}
        title="Subir imagen"
        contentMaxHeight={Math.max(320, window.height - 180)}
        onClose={closePreview}
        footer={
          <>
            {editingId ? null : <Text className="text-[15px] text-muted">Se sube al registrar el gasto.</Text>}
            <PrimaryButton label="Confirmar" onPress={() => void confirmPreview()} />
          </>
        }
      >
        {photoDraftUrl ? (
          <Image
            source={{ uri: photoDraftUrl }}
            contentFit="contain"
            accessibilityLabel="Vista previa"
            style={{ width: "100%", height: uploadPreviewHeight(window.height) }}
          />
        ) : null}
      </Dialog>
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

function ExpenseTable({
  title,
  total,
  rows,
  onEdit,
  onRemove,
  photoIds,
  onOpenPhoto,
}: {
  title: string;
  total: number;
  rows: LotteryExpense[];
  onEdit: (row: LotteryExpense) => void;
  onRemove: (id: string) => void;
  photoIds?: ReadonlySet<string>;
  onOpenPhoto?: (id: string) => void;
}) {
  return (
    <>
      <SectionTitle title={title} trailing={<MoneyText cents={total} size="lg" tone="navy" />} />
      <DataTable
        columns={[
          { key: "date", header: "Fecha", compact: true, render: (row) => formatIsoDate(row.paidOn) },
          { key: "detail", header: "Detalle", compact: true, render: (row) => row.detail || "—" },
          { key: "amount", header: "Monto", align: "right", compact: true, cents: (row) => row.amountCents },
          ...(photoIds && onOpenPhoto
            ? [
                {
                  key: "file",
                  header: "Archivo",
                  compact: true,
                  minWidth: 160,
                  padStart: 32,
                  node: (row: LotteryExpense) =>
                    photoIds.has(row.id) ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Ver imagen"
                        onPress={() => onOpenPhoto(row.id)}
                        className="cursor-pointer"
                      >
                        <Text className="text-[17px] font-semibold text-accent">Ver imagen</Text>
                      </Pressable>
                    ) : null,
                },
              ]
            : []),
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
