import { useEffect, useState } from "react";
import { Image } from "expo-image";
import { Linking, Pressable, Text, useWindowDimensions, View } from "react-native";

import { monthTitle, toIsoDate } from "@/components/calendar-grid";
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
  chooseImageFile,
  ledgerErrorMessage,
  readAmount,
  settleDay,
  useDayPhotos,
  useLedger,
  type DayPhotoFile,
  type DaySettlement,
  type RacetrackId,
  type SettledDay,
} from "@/modules/ledger";

/** The day the form opens on: today when that month is on screen, otherwise the 1st. */
function openingDate(viewMonth: string, now = new Date()): string {
  const today = toIsoDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
  return today.startsWith(`${viewMonth}-`) ? today : `${viewMonth}-01`;
}

const terminalOptions = [
  { id: "1", label: "Terminal 1" },
  { id: "2", label: "Terminal 2" },
  { id: "3", label: "Terminal 3" },
  { id: "4", label: "Terminal 4" },
];

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
  const { agencyName, days, recordDay, updateDay, removeDay, snapshot, racetracks, viewMonth, setViewMonth, readOnly } = useLedger();
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
  const [date, setDate] = useState(() => openingDate(viewMonth));
  const [racetrackId, setRacetrackId] = useState<RacetrackId>("san-isidro");
  const [terminalId, setTerminalId] = useState("1");
  const [sold, setSold] = useState("");
  const [cancelled, setCancelled] = useState("");
  const [paid, setPaid] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    setTerminalId("1");
    if (!editingId) {
      setDate(openingDate(viewMonth));
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
    setTerminalId("1");
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
    setTerminalId("1");
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
      {readOnly ? (
        <View>
          <PrimaryButton label="Compartir por WhatsApp" onPress={shareDay} />
          {shareNotice ? <Text className="mt-2 text-[15px] text-negative">{shareNotice}</Text> : null}
        </View>
      ) : (
      <View className={wide ? "flex-row items-start gap-4" : "gap-4"}>
        <View className="flex-1">
          <Card>
            <View className="gap-4">
              <Field label="Fecha">
                <DateField value={date} onChange={setDate} />
              </Field>
              <View className={wide ? "flex-row items-start gap-4" : "gap-4"}>
                <View className="min-w-0 flex-1">
                  <Field label="Hipódromo">
                    <ChoiceChips
                      options={racetracks.map((track) => ({ id: track.id, label: track.name }))}
                      value={selected.id}
                      onChange={setRacetrackId}
                    />
                  </Field>
                </View>
                <Field label="Terminal">
                  <ChoiceChips
                    options={terminalOptions}
                    value={terminalId}
                    onChange={setTerminalId}
                  />
                </Field>
              </View>
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
      )}

      <SectionTitle title={monthTitle(viewMonth)} />
      <DataTable
        columns={[
          { key: "date", header: "Fecha", compact: true, render: (row) => formatIsoDate(row.date) },
          { key: "track", header: "Hipódromo", compact: true, render: (row) => row.racetrackName },
          { key: "sold", header: "Vendido", align: "right", cents: (row) => row.soldCents },
          { key: "cancelled", header: "Cancelados", align: "right", cents: (row) => row.cancelledCents },
          { key: "net", header: "Venta neta", align: "right", compact: true, cents: (row) => row.netCents },
          { key: "paid", header: "Pagado", align: "right", cents: (row) => row.paidCents },
          { key: "commission", header: "Comisión", align: "right", cents: (row) => row.commissionCents },
          { key: "deposit", header: "A depositar", align: "right", compact: true, cents: (row) => row.amountToDepositCents },
          ...(readOnly
            ? []
            : [
          {
            key: "file",
            header: "Archivo",
            compact: true,
            minWidth: 160,
            padStart: 32,
            node: (row: (typeof days)[number]) =>
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
            align: "right" as const,
            minWidth: 160,
            node: (row: (typeof days)[number]) => (
              <RowActions onEdit={() => startEdit(row)} onRemove={() => setPendingRemoveId(row.id)} />
            ),
          },
            ]),
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
