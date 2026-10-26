import { useEffect, useRef, useState } from "react";
import { Text, useWindowDimensions, View } from "react-native";
import { router, useLocalSearchParams, type Href } from "expo-router";

import { AmountField } from "@/components/amount-field";
import { openingDate } from "@/components/calendar-grid";
import { DateField } from "@/components/date-field";
import { ChoiceChips, Feedback, Field, PrimaryButton } from "@/components/form-controls";
import { Card, ScreenFrame } from "@/components/screen-frame";
import { MoneyText } from "@/components/stat-card";
import { wideLayout } from "@/constants/layout";
import {
  HIPICA_GAME_ID,
  TERMINAL_IDS,
  formatAmountInput,
  ledgerErrorMessage,
  readAmount,
  terminalServices,
  useLedger,
  useLottery,
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

export default function CombinedLoadScreen() {
  const { viewMonth, snapshot, setTerminalServices, canViewBalances, readOnly, agencyMode } = useLedger();
  const lottery = useLottery();
  const wide = useWindowDimensions().width >= wideLayout;
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
  const loadedKey = useRef("");
  const started = useRef(false);

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
    if (!fecha || !isTerminal(terminalParam) || lottery.status !== "active") {
      return;
    }
    const key = `${fecha}|${terminalParam}`;
    if (loadedKey.current === key) {
      return;
    }
    loadedKey.current = key;
    setEditing({ date: fecha, terminalId: terminalParam });
    setDate(fecha);
    setTerminalId(terminalParam);
    const row = lottery.agencyDays.find((day) => day.date === fecha && day.terminalId === terminalParam);
    const next: Record<string, Amounts> = {};
    for (const game of lottery.games) {
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
    setAmounts(next);
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
  const preview = valid && lottery.status === "active"
    ? lottery.previewAgency({ date, terminalId, amounts: lotteryAmounts, tracks: [] }, editing ?? undefined)
    : null;

  function clearForm() {
    setAmounts({});
    setEditing(null);
    loadedKey.current = "";
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
      setMessage(editing ? "Día actualizado." : "Día cargado.");
      clearForm();
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
          <View className={wide ? "mt-3 flex-row gap-4" : "mt-3 gap-3"}>
            <View className="flex-1">
              <Field label="Apuestas">
                <AmountField value={amounts[game.id]?.sold ?? ""} onChangeText={(value) => setField(game.id, "sold", value)} />
              </Field>
            </View>
            <View className="flex-1">
              <Field label="Pago premios">
                <AmountField value={amounts[game.id]?.prizes ?? ""} onChangeText={(value) => setField(game.id, "prizes", value)} />
              </Field>
            </View>
            <View className="flex-1">
              <Field label="Anulaciones">
                <AmountField value={amounts[game.id]?.cancelled ?? ""} onChangeText={(value) => setField(game.id, "cancelled", value)} />
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

      <Feedback message={message} error={error} />
      <PrimaryButton label={saving ? "Guardando…" : editing ? "Guardar cambios" : "Cargar día"} onPress={() => void onSave()} />
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
