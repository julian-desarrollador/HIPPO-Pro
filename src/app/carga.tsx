import { useEffect, useState } from "react";
import { Image } from "expo-image";
import { Linking, Pressable, Text, useWindowDimensions, View } from "react-native";

import { monthTitle } from "@/components/calendar-grid";
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
} from "@/components/form-controls";
import { Card, NoRacetracksCard, ScreenFrame, SectionTitle } from "@/components/screen-frame";
import { MoneyText } from "@/components/stat-card";
import { wideLayout } from "@/constants/layout";
import {
  buildDayReport,
  currentCommissionBasisPoints,
  emptyDayReportMessage,
  formatAmountInput,
  formatSignedPercent,
  ledgerErrorMessage,
  readAmount,
  dayPhotoProblem,
  settleDay,
  useDayPhotos,
  useLedger,
  type DayPhotoFile,
  type DaySettlement,
  type RacetrackId,
  type SettledDay,
} from "@/modules/ledger";

export default function CargaScreen() {
  const { racetracks } = useLedger();
  if (racetracks.length === 0) {
    return (
      <ScreenFrame title="Carga del día">
        <NoRacetracksCard />
      </ScreenFrame>
    );
  }
  return <DayEntryScreen />;
}

function DayEntryScreen() {
  const { agencyName, days, recordDay, updateDay, removeDay, snapshot, racetracks, viewMonth, setViewMonth } = useLedger();
  const photos = useDayPhotos();
  const window = useWindowDimensions();
  const wide = window.width >= wideLayout;
  const [photoIds, setPhotoIds] = useState<ReadonlySet<string>>(new Set());
  const [pendingPhoto, setPendingPhoto] = useState<DayPhotoFile | null>(null);
  const [photoDraft, setPhotoDraft] = useState<DayPhotoFile | null>(null);
  const [photoDraftUrl, setPhotoDraftUrl] = useState<string | null>(null);
  const [dropPhoto, setDropPhoto] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [viewingUrl, setViewingUrl] = useState<string | null | undefined>(undefined);
  const [date, setDate] = useState(`${viewMonth}-01`);
  const [racetrackId, setRacetrackId] = useState<RacetrackId>("san-isidro");
  const [sold, setSold] = useState("");
  const [cancelled, setCancelled] = useState("");
  const [paid, setPaid] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (!editingId) {
      setDate(`${viewMonth}-01`);
    }
  }, [editingId, viewMonth]);

  useEffect(() => {
    if (!racetracks.some((track) => track.id === racetrackId)) {
      setRacetrackId(racetracks[0]?.id ?? "san-isidro");
    }
  }, [racetrackId, racetracks, snapshot.racetracks]);
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [shareNotice, setShareNotice] = useState("");

  const soldCents = readAmount(sold, true);
  const cancelledCents = readAmount(cancelled, true);
  const paidCents = readAmount(paid, true);
  const editingDay = editingId ? days.find((day) => day.id === editingId) : undefined;
  const selected = racetracks.find((track) => track.id === racetrackId) ?? racetracks[0];
  const previewCommission =
    editingDay && editingDay.racetrackId === selected.id
      ? editingDay.commissionBasisPoints
      : currentCommissionBasisPoints(selected.id, snapshot.commissions, snapshot);
  const previewAdjustment =
    editingDay && editingDay.racetrackId === selected.id
      ? editingDay.depositAdjustmentBasisPoints
      : selected.depositAdjustmentBasisPoints;
  const preview =
    soldCents !== null && cancelledCents !== null && paidCents !== null
      ? settleDay({
          racetrackId: selected.id,
          soldCents,
          cancelledCents,
          paidCents,
          commissionBasisPoints: previewCommission,
          depositAdjustmentBasisPoints: previewAdjustment,
        })
      : null;

  useEffect(() => {
    setShareNotice("");
  }, [date]);

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
  }, [photos, days]);

  function shareDay() {
    const report = buildDayReport(days, date, agencyName);
    if (!report) {
      setShareNotice(emptyDayReportMessage);
      return;
    }
    setShareNotice("");
    Linking.openURL(`https://wa.me/?text=${encodeURIComponent(report)}`);
  }

  function clearAmounts() {
    setSold("");
    setCancelled("");
    setPaid("");
    setPendingPhoto(null);
    setDropPhoto(false);
  }

  function startEdit(row: SettledDay) {
    setEditingId(row.id);
    setDate(row.date);
    setRacetrackId(row.racetrackId);
    setSold(formatAmountInput(row.soldCents));
    setCancelled(formatAmountInput(row.cancelledCents));
    setPaid(formatAmountInput(row.paidCents));
    setPendingPhoto(null);
    setDropPhoto(false);
    setError("");
    setMessage("");
  }

  function cancelEdit() {
    setEditingId(null);
    clearAmounts();
    closePreview();
    setError("");
    setMessage("");
  }

  function closePreview() {
    if (photoDraftUrl) {
      URL.revokeObjectURL(photoDraftUrl);
    }
    setPhotoDraft(null);
    setPhotoDraftUrl(null);
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

  async function openPhoto(dayId: string) {
    if (!photos) {
      return;
    }
    setViewingId(dayId);
    setViewingUrl(undefined);
    const url = await photos.url(dayId);
    setViewingUrl(url);
  }

  async function keepPhoto(dayId: string) {
    if (!photos) {
      return;
    }
    try {
      if (pendingPhoto) {
        await photos.upload(dayId, pendingPhoto);
      } else if (dropPhoto) {
        await photos.remove(dayId);
      }
      setPhotoIds(await photos.list());
      return null;
    } catch {
      return "El día quedó guardado, pero la imagen no.";
    }
  }

  async function onSave() {
    if (soldCents === null || cancelledCents === null || paidCents === null) {
      setError("Revisá los importes. Usá 2.908.511,00.");
      setMessage("");
      return;
    }

    setMessage("Guardando…");
    setError("");
    try {
      let dayId = editingId;
      if (editingId) {
        await updateDay({ id: editingId, date, racetrackId: selected.id, soldCents, cancelledCents, paidCents });
        setEditingId(null);
        setMessage("Día actualizado.");
      } else {
        const created = await recordDay({ date, racetrackId: selected.id, soldCents, cancelledCents, paidCents });
        dayId = created.id;
        setMessage("Día cargado.");
      }
      const photoError = dayId ? await keepPhoto(dayId) : null;
      clearAmounts();
      setViewMonth(date.slice(0, 7));
      if (photoError) {
        setError(photoError);
      }
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
      await removeDay(id);
      let photoWarning = "";
      if (photos) {
        try {
          await photos.remove(id);
          setPhotoIds(await photos.list());
        } catch {
          photoWarning = "El día se quitó, pero la imagen no.";
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
    <ScreenFrame title="Carga del día">
      <View className={wide ? "flex-row items-start gap-4" : "gap-4"}>
        <View className="flex-1">
          <Card>
            <View className="gap-4">
              <Field label="Fecha">
                <DateField value={date} onChange={setDate} />
              </Field>
              <Field label="Hipódromo">
                <ChoiceChips
                  options={racetracks.map((track) => ({ id: track.id, label: track.name }))}
                  value={selected.id}
                  onChange={setRacetrackId}
                />
              </Field>
              <Field label="Vendido">
                <AmountField value={sold} onChangeText={setSold} />
              </Field>
              <Field label="Cancelados">
                <AmountField value={cancelled} onChangeText={setCancelled} />
              </Field>
              <Field label="Pagado">
                <AmountField value={paid} onChangeText={setPaid} />
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
              <PrimaryButton label={editingId ? "Guardar cambios" : "Cargar día"} onPress={onSave} />
              {editingId ? <SecondaryButton label="Cancelar" onPress={cancelEdit} /> : null}
            </View>
          </Card>
        </View>
        <View className={wide ? "w-96" : ""}>
          <Card>
            <Text className="font-sans text-[24px] font-semibold text-navy">Cálculo del día</Text>
            <Text className="mt-1 text-[15px] text-muted">
              {selected.name}
            </Text>
            {preview && soldCents !== null && cancelledCents !== null && paidCents !== null ? (
              <View className="mt-3">
                <DayBreakdown soldCents={soldCents} cancelledCents={cancelledCents} paidCents={paidCents} settlement={preview} />
              </View>
            ) : (
              <Text className="mt-3 text-[15px] text-negative">Revisá los importes. Usá 2.908.511,00.</Text>
            )}
          </Card>
          <View className="mt-4">
            <PrimaryButton label="Compartir por WhatsApp" onPress={shareDay} />
            {shareNotice ? <Text className="mt-2 text-[15px] text-negative">{shareNotice}</Text> : null}
          </View>
        </View>
      </View>

      <SectionTitle title={monthTitle(viewMonth)} />
      <DataTable
        columns={[
          { key: "date", header: "Fecha", compact: true, render: (row) => formatIsoDate(row.date) },
          { key: "track", header: "Hipódromo", compact: true, render: (row) => row.racetrackName },
          { key: "sold", header: "Vendido", align: "right", cents: (row) => row.soldCents },
          { key: "cancelled", header: "Cancelados", align: "right", cents: (row) => row.cancelledCents },
          { key: "paid", header: "Pagado", align: "right", cents: (row) => row.paidCents },
          { key: "net", header: "Neto", align: "right", compact: true, cents: (row) => row.netCents },
          { key: "commission", header: "Comisión", align: "right", cents: (row) => row.commissionCents },
          { key: "deposit", header: "A depositar", align: "right", compact: true, cents: (row) => row.amountToDepositCents },
          {
            key: "file",
            header: "Archivo",
            compact: true,
            minWidth: 160,
            padStart: 32,
            node: (row) =>
              photoIds.has(row.id) ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Ver imagen"
                  onPress={() => void openPhoto(row.id)}
                  className="cursor-pointer"
                >
                  <Text className="text-[17px] font-semibold text-accent">Ver imagen</Text>
                </Pressable>
              ) : null,
          },
          {
            key: "actions",
            header: "",
            compact: true,
            align: "right",
            minWidth: 160,
            node: (row) => (
              <RowActions onEdit={() => startEdit(row)} onRemove={() => setPendingRemoveId(row.id)} />
            ),
          },
        ]}
        rows={days}
        empty="Todavía no hay días cargados."
      />
      <ConfirmDialog visible={pendingRemoveId !== null} onCancel={() => setPendingRemoveId(null)} onConfirm={confirmRemove} />
      <Dialog
        wide
        visible={photoDraft !== null}
        title="Subir imagen"
        contentMaxHeight={Math.max(320, window.height - 180)}
        onClose={closePreview}
      >
        {photoDraftUrl ? (
          <Image
            source={{ uri: photoDraftUrl }}
            contentFit="contain"
            accessibilityLabel="Vista previa"
            style={{ width: "100%", height: Math.max(280, window.height - 320) }}
          />
        ) : null}
        {editingId ? null : (
          <Text className="text-[15px] text-muted">Se sube al cargar el día.</Text>
        )}
        <PrimaryButton label="Confirmar" onPress={() => void confirmPreview()} />
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
            accessibilityLabel="Imagen del día"
            style={{ width: "100%", height: Math.max(280, window.height - 240) }}
          />
        ) : (
          <Text className="text-[15px] text-muted">
            {viewingUrl === null ? "No se pudo abrir la imagen." : "Abriendo la imagen…"}
          </Text>
        )}
      </Dialog>
    </ScreenFrame>
  );
}

function DayBreakdown({
  soldCents,
  cancelledCents,
  paidCents,
  settlement,
}: {
  soldCents: number;
  cancelledCents: number;
  paidCents: number;
  settlement: DaySettlement;
}) {
  const commissionLabel = `Comisión (${formatSignedPercent(settlement.commissionBasisPoints)})`;

  return (
    <View>
      <BreakdownLine label="Vendido" cents={soldCents} />
      <BreakdownLine label="− Cancelados" cents={cancelledCents} />
      <View className="my-2 h-px bg-line" />
      <BreakdownLine label="Neto" cents={settlement.netCents} size="md" />
      <View className="mt-2">
        <BreakdownLine label={commissionLabel} cents={settlement.commissionCents} />
      </View>
      <BreakdownLine label="− Pagado" cents={paidCents} />
      <View className="my-2 h-px bg-line" />
      <BreakdownLine label="A depositar" cents={settlement.amountToDepositCents} size="md" tone="navy" />
    </View>
  );
}

const photoLongestSide = 1600;
const photoJpegQuality = 0.82;

function jpegName(name: string): string {
  const stem = name.replace(/\.[^.]+$/, "");
  return `${stem || "foto"}.jpg`;
}

/** Shrinks a chosen photo to a jpeg the dialog can show. Returns a Spanish problem when it cannot. */
async function shrinkDayPhoto(file: File): Promise<DayPhotoFile | string> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return "No se pudo preparar la imagen.";
  }
  const longest = Math.max(bitmap.width, bitmap.height);
  const scale = longest > photoLongestSide ? photoLongestSide / longest : 1;
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    return "No se pudo preparar la imagen.";
  }
  context.fillStyle = "white";
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", photoJpegQuality);
  });
  if (!blob) {
    return "No se pudo preparar la imagen.";
  }
  const name = jpegName(file.name);
  const problem = dayPhotoProblem({ size: blob.size, contentType: "image/jpeg", name });
  if (problem) {
    return problem;
  }
  return { name, bytes: await blob.arrayBuffer(), contentType: "image/jpeg" };
}

function chooseImageFile(): Promise<DayPhotoFile | string | null> {
  return new Promise((resolve) => {
    if (typeof document === "undefined") {
      resolve(null);
      return;
    }
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/webp";
    let settled = false;
    const finish = (value: DayPhotoFile | string | null) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(value);
    };
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        finish(null);
        return;
      }
      if (file.size <= 0) {
        finish("La imagen está vacía.");
        return;
      }
      const typeProblem = dayPhotoProblem({ size: 1, contentType: file.type, name: file.name });
      if (typeProblem) {
        finish(typeProblem);
        return;
      }
      settled = true;
      void shrinkDayPhoto(file).then(resolve);
    };
    window.addEventListener(
      "focus",
      () => {
        setTimeout(() => finish(null), 400);
      },
      { once: true },
    );
    input.click();
  });
}

function BreakdownLine({
  label,
  cents,
  size = "sm",
  tone,
}: {
  label: string;
  cents: number;
  size?: "sm" | "md";
  tone?: "auto" | "navy";
}) {
  return (
    <View className="flex-row items-center justify-between gap-3 py-0.5">
      <Text className="shrink text-[15px] text-muted">{label}</Text>
      <MoneyText cents={cents} size={size} tone={tone} />
    </View>
  );
}
