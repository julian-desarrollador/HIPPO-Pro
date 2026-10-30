import { useEffect, useState } from "react";
import { Image } from "expo-image";
import { Pressable, Text, useWindowDimensions, View } from "react-native";

import { openingDate } from "@/components/calendar-grid";
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
  uploadPreviewHeight,
} from "@/components/form-controls";
import { Card, ScreenFrame, SectionTitle } from "@/components/screen-frame";
import { MoneyText } from "@/components/stat-card";
import {
  categoryHasExpenses,
  chooseImageFile,
  formatAmountInput,
  ledgerErrorMessage,
  readAmount,
  useExpensePhotos,
  useLedger,
  type DayPhotoFile,
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
    readOnly,
  } = useLedger();
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
  const [categoryId, setCategoryId] = useState(DEFAULT_CATEGORY_ID);
  const [detail, setDetail] = useState("");
  const [amount, setAmount] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (!editingId) {
      setPaidOn(openingDate(viewMonth));
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
  }, [photos, snapshot.expenses]);

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

  function startEdit(row: ExpenseRow) {
    setEditingId(row.id);
    setPaidOn(row.paidOn);
    setCategoryId(row.categoryId);
    setDetail(row.detail);
    setAmount(formatAmountInput(row.amountCents));
    clearPhotoChoice();
    setError("");
    setMessage("");
  }

  function cancelEdit() {
    setEditingId(null);
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
      let expenseId = editingId;
      if (editingId) {
        await updateExpense({ id: editingId, paidOn, categoryId, detail, amountCents });
        setEditingId(null);
        setMessage("Gasto actualizado.");
      } else {
        const created = await recordExpense({ paidOn, categoryId, detail, amountCents, month: viewMonth });
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
      {readOnly ? null : <Card>
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
          <Feedback error={formOpen || manageOpen ? "" : error} message={formOpen || manageOpen ? "" : message} />
          <PrimaryButton label={editingId ? "Guardar cambios" : "Registrar gasto"} onPress={onSave} />
          {editingId ? <SecondaryButton label="Cancelar" onPress={cancelEdit} /> : null}
        </View>
      </Card>}

      <ExpenseTable
        title="Gastos de la agencia"
        total={summary.agencyExpenseCents}
        rows={agency}
        onEdit={startEdit}
        onRemove={setPendingRemoveExpenseId}
        editable={!readOnly}
        photoIds={photos ? photoIds : undefined}
        onOpenPhoto={photos ? (id) => void openPhoto(id) : undefined}
      />
      <ExpenseTable
        title="Adelantos y retiros"
        total={summary.partnerWithdrawalCents}
        rows={partners}
        onEdit={startEdit}
        onRemove={setPendingRemoveExpenseId}
        editable={!readOnly}
        photoIds={photos ? photoIds : undefined}
        onOpenPhoto={photos ? (id) => void openPhoto(id) : undefined}
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
                <Text className="flex-1 text-[17px] font-semibold text-navy">{category.label}</Text>
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
              {inUse ? <Text className="text-[15px] text-muted">Tiene gastos. Quitá esos movimientos antes.</Text> : null}
            </View>
          );
        })}
        <SecondaryButton label="Cerrar" onPress={() => setManageOpen(false)} />
      </Dialog>
      <ConfirmDialog visible={pendingRemoveExpenseId !== null} onCancel={() => setPendingRemoveExpenseId(null)} onConfirm={() => void confirmRemoveExpense()} />
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
  editable = true,
  photoIds,
  onOpenPhoto,
}: {
  title: string;
  total: number;
  rows: ExpenseRow[];
  onEdit: (row: ExpenseRow) => void;
  onRemove: (id: string) => void;
  editable?: boolean;
  photoIds?: ReadonlySet<string>;
  onOpenPhoto?: (id: string) => void;
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
          ...(editable
            ? [
          ...(photoIds && onOpenPhoto
            ? [
          {
            key: "file",
            header: "Archivo",
            compact: true,
            minWidth: 160,
            padStart: 32,
            node: (row: ExpenseRow) =>
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
            align: "right" as const,
            node: (row: ExpenseRow) => <RowActions onEdit={() => onEdit(row)} onRemove={() => onRemove(row.id)} />,
          },
            ]
            : []),
        ]}
        rows={rows}
      />
    </>
  );
}
