import { useEffect, useRef, useState } from "react";
import { Image } from "expo-image";
import { Pressable, Text, useWindowDimensions, View } from "react-native";
import { router, useLocalSearchParams, type Href } from "expo-router";

import { AmountField } from "@/components/amount-field";
import { monthTitle, openingDate } from "@/components/calendar-grid";
import { DataTable } from "@/components/data-table";
import { DateField } from "@/components/date-field";
import { formatIsoDate } from "@/components/format-date";
import { ChoiceChips, ConfirmDialog, Dialog, Feedback, Field, PrimaryButton, RowActions, SecondaryButton } from "@/components/form-controls";
import { Card, ScreenFrame, SectionTitle } from "@/components/screen-frame";
import { MoneyText } from "@/components/stat-card";
import { wideLayout } from "@/constants/layout";
import {
  HIPICA_GAME_ID,
  TERMINAL_IDS,
  chooseImageFile,
  formatAmountInput,
  ledgerErrorMessage,
  readAmount,
  terminalServices,
  useDayPhotos,
  useLedger,
  useLottery,
  type AgencyDayRow,
  type DayPhotoFile,
  type LotteryAmount,
  type TerminalId,
} from "@/modules/ledger";

const terminalOptions = TERMINAL_IDS.map((id) => ({ id, label: `Terminal ${id}` }));

type Amounts = { sold: string; prizes: string; cancelled: string };

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function isTerminal(value: string | undefined): value is TerminalId {
  return value === "1" || value === "2" || value === "3" || value === "4";
}

function blank(): Amounts {
  return { sold: "", prizes: "", cancelled: "" };
}

function sumCents(values: Record<string, number> | undefined): number {
  return Object.values(values ?? {}).reduce((total, value) => total + value, 0);
}

function commissionInput(preview: { lines: readonly { gameId: string; commissionCents: number }[] } | null, gameId: string): string {
  const line = preview?.lines.find((item) => item.gameId === gameId);
  if (!line) {
    return "";
  }
  return formatAmountInput(line.commissionCents);
}

/** Keeps the commission visible while a comma is still being typed. */
function typedCents(raw: string): number {
  const cents = readAmount(raw, true);
  if (cents !== null) {
    return cents;
  }
  return readAmount(raw.trim().replace(/,+$/, ""), true) ?? 0;
}

function dayPhotoId(date: string, terminalId: string): string {
  return `${date}-${terminalId}`;
}

function amountsFromDay(games: readonly { id: string }[], row: AgencyDayRow | undefined): Record<string, Amounts> {
  const next: Record<string, Amounts> = {};
  for (const game of games) {
    const sold = row?.soldByGame[game.id] ?? 0;
    const prizes = row?.prizesByGame[game.id] ?? 0;
    const cancelled = row?.cancelledByGame[game.id] ?? 0;
    if (sold || prizes || cancelled) {
      next[game.id] = {
        sold: sold ? formatAmountInput(sold) : "",
        prizes: prizes ? formatAmountInput(prizes) : "",
        cancelled: cancelled ? formatAmountInput(cancelled) : "",
      };
    }
  }
  return next;
}

export default function CombinedLoadScreen() {
  const { viewMonth, setViewMonth, snapshot, setTerminalServices, canViewBalances, readOnly, agencyMode } = useLedger();
  const lottery = useLottery();
  const photos = useDayPhotos();
  const window = useWindowDimensions();
  const wide = window.width >= wideLayout;
  const params = useLocalSearchParams<{ fecha?: string | string[]; terminal?: string | string[] }>();
  const fecha = one(params.fecha);
  const terminalParam = one(params.terminal);
  const [date, setDate] = useState(() => openingDate(viewMonth));
  const [terminalId, setTerminalId] = useState<TerminalId>("1");
  const [month, setMonth] = useState(viewMonth);
  const [amounts, setAmounts] = useState<Record<string, Amounts>>({});
  const [editing, setEditing] = useState<{ date: string; terminalId: TerminalId } | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState<AgencyDayRow | null>(null);
  const [photoIds, setPhotoIds] = useState<ReadonlySet<string>>(new Set());
  const [pendingPhoto, setPendingPhoto] = useState<DayPhotoFile | null>(null);
  const [photoDraft, setPhotoDraft] = useState<DayPhotoFile | null>(null);
  const [photoDraftUrl, setPhotoDraftUrl] = useState<string | null>(null);
  const [dropPhoto, setDropPhoto] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [viewingUrl, setViewingUrl] = useState<string | null | undefined>(undefined);
  const loadedKey = useRef("");
  const started = useRef(false);
  const editingId = editing ? dayPhotoId(editing.date, editing.terminalId) : null;

  if (month !== viewMonth && !fecha) {
    setMonth(viewMonth);
    if (!editing) {
      setDate(openingDate(viewMonth));
    }
  }

  const services = terminalServices(snapshot, terminalId);
  const games = lottery.games.filter((game) => {
    if (game.id === HIPICA_GAME_ID) {
      return agencyMode === "both" && services.racing;
    }
    return agencyMode === "lottery" || services.lottery;
  });

  useEffect(() => {
    if (!canViewBalances || lottery.status !== "inactive" || started.current || readOnly) {
      return;
    }
    started.current = true;
    void lottery.activate().catch((caught) => {
      setError(ledgerErrorMessage(caught));
    });
  }, [canViewBalances, lottery, readOnly]);

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
  }, [photos, lottery.agencyDays]);

  useEffect(() => {
    if (!fecha || !isTerminal(terminalParam) || lottery.status !== "active") {
      return;
    }
    const key = `${fecha}|${terminalParam}`;
    if (loadedKey.current === key) {
      return;
    }
    loadedKey.current = key;
    const row = lottery.agencyDays.find((day) => day.date === fecha && day.terminalId === terminalParam);
    setEditing({ date: fecha, terminalId: terminalParam });
    setDate(fecha);
    setTerminalId(terminalParam);
    setAmounts(amountsFromDay(lottery.games, row));
    setError("");
    setMessage("");
  }, [fecha, lottery.agencyDays, lottery.games, lottery.status, terminalParam]);

  function toggle(service: "racing" | "lottery") {
    const next = { ...services, [service]: !services[service] };
    if ((!next.racing && !next.lottery) || readOnly) {
      return;
    }
    void setTerminalServices({ terminalId, racing: next.racing, lottery: next.lottery });
  }

  function setField(gameId: string, field: keyof Amounts, value: string) {
    setAmounts((current) => ({ ...current, [gameId]: { ...blank(), ...current[gameId], [field]: value } }));
  }

  const parsed = games.map((game) => {
    const row = amounts[game.id] ?? blank();
    return {
      gameId: game.id,
      soldCents: readAmount(row.sold, true),
      prizesCents: readAmount(row.prizes, true),
      cancelledCents: readAmount(row.cancelled, true),
    };
  });
  const valid = parsed.every((amount) => amount.soldCents !== null && amount.prizesCents !== null && amount.cancelledCents !== null);
  const lotteryAmounts: LotteryAmount[] = parsed.map((amount) => ({
    gameId: amount.gameId,
    soldCents: amount.soldCents ?? 0,
    prizesCents: amount.prizesCents ?? 0,
    cancelledCents: amount.cancelledCents ?? 0,
  }));
  const livePreview =
    lottery.status === "active"
      ? lottery.previewAgency(
          {
            date,
            terminalId,
            amounts: games.map((game) => {
              const row = amounts[game.id] ?? blank();
              return {
                gameId: game.id,
                soldCents: typedCents(row.sold),
                prizesCents: typedCents(row.prizes),
                cancelledCents: typedCents(row.cancelled),
              };
            }),
            tracks: [],
          },
          editing ?? undefined,
        )
      : null;
  const preview = valid ? livePreview : null;

  function fillDay(row: AgencyDayRow) {
    loadedKey.current = `${row.date}|${row.terminalId}`;
    setEditing({ date: row.date, terminalId: row.terminalId });
    setDate(row.date);
    setTerminalId(row.terminalId);
    setAmounts(amountsFromDay(lottery.games, row));
    setPendingPhoto(null);
    setDropPhoto(false);
    setError("");
    setMessage("");
  }

  function clearForm() {
    setAmounts({});
    setEditing(null);
    setPendingPhoto(null);
    setDropPhoto(false);
    loadedKey.current = "";
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
    if (!photos || readOnly) {
      return;
    }
    setViewingId(dayId);
    setViewingUrl(undefined);
    const url = await photos.url(dayId);
    setViewingUrl(url);
  }

  async function keepPhoto(dayId: string) {
    if (!photos) {
      return null;
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

  async function confirmRemove() {
    if (!pending || readOnly) {
      return;
    }
    const row = pending;
    setPending(null);
    try {
      await lottery.removeAgencyDay({ date: row.date, terminalId: row.terminalId });
      let photoWarning = "";
      if (photos) {
        try {
          await photos.remove(dayPhotoId(row.date, row.terminalId));
          setPhotoIds(await photos.list());
        } catch {
          photoWarning = "El día se quitó, pero la imagen no.";
        }
      }
      if (editing?.date === row.date && editing.terminalId === row.terminalId) {
        clearForm();
      }
      setMessage("Día quitado.");
      setError(photoWarning);
    } catch (caught) {
      setError(ledgerErrorMessage(caught));
    }
  }

  async function onSave() {
    if (saving || readOnly) {
      return;
    }
    if (!valid) {
      setError("Revisá los importes. Usá 2.908.511,00.");
      setMessage("");
      return;
    }
    setSaving(true);
    setMessage("Guardando…");
    setError("");
    try {
      await lottery.saveAgencyDay(
        { date, terminalId, amounts: lotteryAmounts, tracks: null },
        editing ?? undefined,
      );
      const photoError = await keepPhoto(dayPhotoId(date, terminalId));
      setMessage(editing ? "Día actualizado." : "Día cargado.");
      clearForm();
      setViewMonth(date.slice(0, 7));
      if (photoError) {
        setError(photoError);
      }
      if (fecha) {
        router.replace("/carga-dia" as Href);
      }
    } catch (caught) {
      setMessage("");
      setError(ledgerErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  if (lottery.status === "inactive" && !canViewBalances) {
    return (
      <ScreenFrame title="Carga del día">
        <Card>
          <Text className="text-base text-ink">La quiniela la activa el dueño.</Text>
        </Card>
      </ScreenFrame>
    );
  }

  return (
    <ScreenFrame title="Carga del día">
      <Card>
        <View className={wide ? "flex-row gap-4" : "gap-4"}>
          <View className="flex-1">
            <Field label="Fecha">
              <DateField value={date} onChange={setDate} />
            </Field>
          </View>
          <View className="flex-1">
            <Field label="Terminal">
              <ChoiceChips options={terminalOptions} value={terminalId} onChange={(id) => setTerminalId(id as TerminalId)} />
            </Field>
          </View>
        </View>
        {agencyMode === "both" ? (
          <View className="mt-4 flex-row gap-2">
            <PrimaryButton label={services.lottery ? "Lotería: sí" : "Lotería: no"} onPress={() => toggle("lottery")} />
            <PrimaryButton label={services.racing ? "Hípica: sí" : "Hípica: no"} onPress={() => toggle("racing")} />
          </View>
        ) : null}
      </Card>

      {games.map((game) => (
        <Card key={game.id}>
          <Text className="font-semibold text-ink">{game.name}</Text>
          <View className={wide ? "mt-3 flex-row flex-wrap gap-4" : "mt-3 gap-3"}>
            <View className="flex-1" style={wide ? { minWidth: 140 } : undefined}>
              <Field label="Apuestas">
                <AmountField value={amounts[game.id]?.sold ?? ""} onChangeText={(value) => setField(game.id, "sold", value)} />
              </Field>
            </View>
            <View className="flex-1" style={wide ? { minWidth: 140 } : undefined}>
              <Field label="Pago premios">
                <AmountField value={amounts[game.id]?.prizes ?? ""} onChangeText={(value) => setField(game.id, "prizes", value)} />
              </Field>
            </View>
            <View className="flex-1" style={wide ? { minWidth: 140 } : undefined}>
              <Field label="Anulaciones">
                <AmountField value={amounts[game.id]?.cancelled ?? ""} onChangeText={(value) => setField(game.id, "cancelled", value)} />
              </Field>
            </View>
            <View className="flex-1" style={wide ? { minWidth: 140 } : undefined}>
              <Field label="Comisión">
                <AmountField readOnly accessibilityLabel="Comisión" value={commissionInput(livePreview, game.id)} />
              </Field>
            </View>
          </View>
        </Card>
      ))}

      {preview ? (
        <Card>
          <Text className="font-semibold text-ink">Cálculo del día</Text>
          <View className="mt-3 gap-2">
            <MoneyLine label="Comisión" cents={preview.commissionCents} />
            <MoneyLine label="A depositar" cents={preview.amountToDepositCents} />
          </View>
        </Card>
      ) : null}

      {photos && !readOnly ? (
        <Card>
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
        </Card>
      ) : null}

      <Feedback message={message} error={error} />
      <PrimaryButton label={saving ? "Guardando…" : editing ? "Guardar cambios" : "Cargar día"} onPress={() => void onSave()} />

      <SectionTitle title={monthTitle(viewMonth)} />
      <DataTable
        empty="Todavía no hay días cargados."
        columns={[
          { key: "date", header: "Fecha", compact: true, render: (row: AgencyDayRow) => formatIsoDate(row.date) },
          { key: "terminal", header: "Terminal", compact: true, render: (row: AgencyDayRow) => `Terminal ${row.terminalId}` },
          { key: "sold", header: "Apuestas", align: "right" as const, compact: true, cents: (row: AgencyDayRow) => row.soldCents },
          { key: "prizes", header: "Premios", align: "right" as const, compact: true, cents: (row: AgencyDayRow) => sumCents(row.prizesByGame) },
          { key: "cancelled", header: "Anulaciones", align: "right" as const, compact: true, cents: (row: AgencyDayRow) => sumCents(row.cancelledByGame) },
          { key: "commission", header: "Comisión", align: "right" as const, cents: (row: AgencyDayRow) => row.commissionCents },
          { key: "deposit", header: "A depositar", align: "right" as const, cents: (row: AgencyDayRow) => row.amountToDepositCents },
          ...(readOnly
            ? []
            : [
                {
                  key: "file",
                  header: "Archivo",
                  compact: true,
                  minWidth: 160,
                  padStart: 32,
                  node: (row: AgencyDayRow) =>
                    photoIds.has(dayPhotoId(row.date, row.terminalId)) ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Ver imagen"
                        onPress={() => void openPhoto(dayPhotoId(row.date, row.terminalId))}
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
                  node: (row: AgencyDayRow) => <RowActions onEdit={() => fillDay(row)} onRemove={() => setPending(row)} />,
                },
              ]),
        ]}
        rows={lottery.agencyDays}
      />
      <ConfirmDialog
        visible={pending !== null}
        title="¿Quitar el día?"
        detail="Se quita lo cargado de esa terminal. No se puede deshacer."
        onCancel={() => setPending(null)}
        onConfirm={() => void confirmRemove()}
      />
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
        {editingId ? null : <Text className="text-[15px] text-muted">Se sube al cargar el día.</Text>}
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

function MoneyLine({ label, cents }: { label: string; cents: number }) {
  return (
    <View className="flex-row items-center justify-between">
      <Text className="text-ink-soft">{label}</Text>
      <MoneyText cents={cents} />
    </View>
  );
}
