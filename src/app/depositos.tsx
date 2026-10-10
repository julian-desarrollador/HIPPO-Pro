import { useEffect, useState } from "react";
import { Image } from "expo-image";
import { Pressable, Text, useWindowDimensions, View } from "react-native";

import { monthTitle } from "@/components/calendar-grid";
import { DataTable, KeyValueList } from "@/components/data-table";
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
import {
  chooseImageFile,
  formatAmountInput,
  ledgerErrorMessage,
  readAmount,
  useDepositPhotos,
  useLedger,
  type DayPhotoFile,
  type RacetrackId,
} from "@/modules/ledger";

type DepositRow = {
  id: string;
  date: string;
  racetrackId: RacetrackId;
  amountCents: number;
  racetrackName: string;
};

export default function DepositosScreen() {
  const { snapshot, summary, canViewBalances, recordDeposit, updateDeposit, removeDeposit, racetracks, viewMonth, setViewMonth, readOnly } = useLedger();
  const photos = useDepositPhotos();
  const window = useWindowDimensions();
  const [photoIds, setPhotoIds] = useState<ReadonlySet<string>>(new Set());
  const [pendingPhoto, setPendingPhoto] = useState<DayPhotoFile | null>(null);
  const [photoDraft, setPhotoDraft] = useState<DayPhotoFile | null>(null);
  const [photoDraftUrl, setPhotoDraftUrl] = useState<string | null>(null);
  const [dropPhoto, setDropPhoto] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [viewingUrl, setViewingUrl] = useState<string | null | undefined>(undefined);
  const [date, setDate] = useState(`${viewMonth}-01`);
  const [racetrackId, setRacetrackId] = useState<RacetrackId>("san-isidro");
  const [amount, setAmount] = useState("");
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
  const selectedId = racetracks.some((track) => track.id === racetrackId) ? racetrackId : (racetracks[0]?.id ?? "san-isidro");

  const deposits = snapshot.deposits
    .filter((deposit) => deposit.date.startsWith(viewMonth))
    .slice()
    .sort((left, right) => left.date.localeCompare(right.date) || left.racetrackId.localeCompare(right.racetrackId))
    .map((deposit) => ({
      ...deposit,
      racetrackName: racetracks.find((track) => track.id === deposit.racetrackId)?.name ?? deposit.racetrackId,
    }));

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
  }, [photos, snapshot.deposits]);

  function clearPhotoChoice() {
    setPendingPhoto(null);
    setDropPhoto(false);
  }

  function startEdit(row: DepositRow) {
    setEditingId(row.id);
    setDate(row.date);
    setRacetrackId(row.racetrackId);
    setAmount(formatAmountInput(row.amountCents));
    clearPhotoChoice();
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

  function cancelEdit() {
    setEditingId(null);
    setAmount("");
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

  async function openPhoto(depositId: string) {
    if (!photos) {
      return;
    }
    setViewingId(depositId);
    setViewingUrl(undefined);
    const url = await photos.url(depositId);
    setViewingUrl(url);
  }

  async function keepPhoto(depositId: string) {
    if (!photos) {
      return null;
    }
    try {
      if (pendingPhoto) {
        await photos.upload(depositId, pendingPhoto);
      } else if (dropPhoto) {
        await photos.remove(depositId);
      }
      setPhotoIds(await photos.list());
      return null;
    } catch {
      return "El depósito quedó guardado, pero la imagen no.";
    }
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
      let depositId = editingId;
      if (editingId) {
        await updateDeposit({ id: editingId, date, racetrackId: selectedId, amountCents });
        setEditingId(null);
        setMessage("Depósito actualizado.");
      } else {
        const created = await recordDeposit({ date, racetrackId: selectedId, amountCents });
        depositId = created.id;
        setMessage("Depósito cargado.");
      }
      const photoError = depositId ? await keepPhoto(depositId) : null;
      setAmount("");
      clearPhotoChoice();
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
      await removeDeposit(id);
      let photoWarning = "";
      if (photos) {
        try {
          await photos.remove(id);
          setPhotoIds(await photos.list());
        } catch {
          photoWarning = "El depósito se quitó, pero la imagen no.";
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
    <ScreenFrame title="Depósitos">
      {canViewBalances ? (
        summary.racetracks.map((track) => (
          <Card key={track.racetrackId}>
            <Text className="font-sans text-[24px] font-semibold text-navy">{track.name}</Text>
            <Text className="mt-3 text-sm text-muted">Saldo a pagar</Text>
            <View className="mt-1">
              <MoneyText cents={track.owedCents} size="lg" tone="navy" />
            </View>
            <View className="mt-4">
              <KeyValueList
                rows={[
                  { label: "Saldo anterior", value: <MoneyText cents={track.openingCents} /> },
                  { label: "A depositar del mes", value: <MoneyText cents={track.amountToDepositCents} /> },
                  { label: "Depósitos", value: <MoneyText cents={track.depositsCents} /> },
                ]}
              />
            </View>
          </Card>
        ))
      ) : (
        <Card>
          <Text className="text-base text-ink">El saldo a pagar lo ve el dueño de la agencia.</Text>
        </Card>
      )}

      {readOnly ? null : racetracks.length === 0 ? (
        <NoRacetracksCard />
      ) : (
        <Card>
          <View className="gap-4">
            <Field label="Fecha">
              <DateField value={date} onChange={setDate} />
            </Field>
            <Field label="Hipódromo">
              <ChoiceChips
                options={racetracks.map((track) => ({ id: track.id, label: track.name }))}
                value={selectedId}
                onChange={setRacetrackId}
              />
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
            <PrimaryButton label={editingId ? "Guardar cambios" : "Registrar depósito"} onPress={onSave} />
            {editingId ? <SecondaryButton label="Cancelar" onPress={cancelEdit} /> : null}
          </View>
        </Card>
      )}

      <SectionTitle title={`Movimientos de ${monthTitle(viewMonth)}`} />
      <DataTable
        columns={[
          { key: "date", header: "Fecha", compact: true, render: (row) => formatIsoDate(row.date) },
          { key: "track", header: "Hipódromo", compact: true, render: (row) => row.racetrackName },
          { key: "amount", header: "Monto", align: "right", compact: true, cents: (row) => row.amountCents },
          ...(readOnly
            ? []
            : [
          {
            key: "file",
            header: "Archivo",
            compact: true,
            minWidth: 160,
            padStart: 32,
            node: (row: (typeof deposits)[number]) =>
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
            node: (row: (typeof deposits)[number]) => <RowActions onEdit={() => startEdit(row)} onRemove={() => setPendingRemoveId(row.id)} />,
          },
            ]),
        ]}
        rows={deposits}
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
          <Text className="text-[15px] text-muted">Se sube al registrar el depósito.</Text>
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
            accessibilityLabel="Imagen del depósito"
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
