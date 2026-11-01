import Ionicons from "@expo/vector-icons/Ionicons";
import type { Href } from "expo-router";
import { router } from "expo-router";
import type { ComponentProps } from "react";
import { useState } from "react";
import { Pressable, Text, useWindowDimensions, View } from "react-native";

import { monthTitle, shiftMonth } from "@/components/calendar-grid";
import { Feedback, PrimaryButton, SecondaryButton } from "@/components/form-controls";
import {
  BalanceFields,
  draftFromCents,
  OpeningSummary,
  readSignedAmount,
  type BalanceDraft,
} from "@/components/starting-balances";
import { MoneyText } from "@/components/stat-card";
import { usePalette } from "@/constants/palette";
import { ledgerErrorMessage, type MonthStart } from "@/modules/ledger";

function monthName(month: string): string {
  return monthTitle(month).toLocaleLowerCase("es").split(" ")[0] ?? month;
}

function sideText(cents: number): string {
  return cents < 0 ? "Te debe" : cents > 0 ? "Le debés" : "Sin saldo";
}

export function monthStartTitle(month: string): string {
  return `Empezar ${monthName(month)}`;
}

type NextStep = { icon: ComponentProps<typeof Ionicons>["name"]; title: string; detail: string; onPress: () => void };

/** Balance with each racetrack on the 1st of the month. The owner can write the real one. */
export function MonthStartForm({
  start,
  wide = false,
  onSubmit,
  onClose,
}: {
  start: MonthStart;
  /** Computer: racetracks in a grid, total and buttons in a column to the right. */
  wide?: boolean;
  onSubmit: (balances: { racetrackId: string; amountCents: number | null }[]) => Promise<void>;
  onClose: () => void;
}) {
  const colors = usePalette();
  const [drafts, setDrafts] = useState<Record<string, BalanceDraft>>(() =>
    Object.fromEntries(start.lines.map((line) => [line.racetrackId, draftFromCents(line.openingCents)])),
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  // Height of the racetrack cards, to warn when some are below the fold (Dialog shows up to 85% of the window).
  const [cardsHeight, setCardsHeight] = useState(0);
  const windowHeight = useWindowDimensions().height;
  const cardsOverflow = wide && cardsHeight > Math.floor(windowHeight * 0.85) - 96 - 60;
  const previous = monthName(shiftMonth(start.month, -1));
  const name = monthName(start.month);

  const liveLines = start.lines.map((line) => ({
    key: line.racetrackId,
    name: line.name,
    cents: readSignedAmount(drafts[line.racetrackId]) ?? 0,
  }));
  const liveTotal = liveLines.reduce((total, line) => total + line.cents, 0);

  async function save() {
    if (saving) {
      return;
    }
    const balances: { racetrackId: string; amountCents: number | null }[] = [];
    for (const line of start.lines) {
      const cents = readSignedAmount(drafts[line.racetrackId]);
      if (cents === null) {
        setError(`Revisá el monto de ${line.name}.`);
        return;
      }
      balances.push({ racetrackId: line.racetrackId, amountCents: !start.firstMonth && cents === line.carriedCents ? null : cents });
    }
    setSaving(true);
    setError("");
    try {
      await onSubmit(balances);
      setSaved(true);
    } catch (caught) {
      setError(ledgerErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  if (saved) {
    const steps: NextStep[] = [
      {
        icon: "create-outline",
        title: "Cargá el primer día",
        detail: `Lo vendido en ${name} se suma a este saldo.`,
        onPress: () => {
          onClose();
          router.push("/carga" as Href);
        },
      },
      {
        icon: "cash-outline",
        title: "Registrá un depósito",
        detail: "El saldo con cada hipódromo baja al instante.",
        onPress: () => {
          onClose();
          router.push("/depositos" as Href);
        },
      },
      {
        icon: "home-outline",
        title: "Mirá tu Inicio",
        detail: "El total a pagar ya arranca con estos saldos.",
        onPress: onClose,
      },
    ];
    return (
      <View className="gap-4">
        <View className="flex-row items-center gap-3">
          <View className="h-11 w-11 items-center justify-center rounded-full bg-accent">
            <Ionicons name="checkmark" size={26} color={colors.card} />
          </View>
          <Text className="flex-1 font-serif text-[24px] text-navy">¡Listo! {monthTitle(start.month)} ya arrancó.</Text>
        </View>
        <View className={wide ? "flex-row gap-3" : "gap-3"}>
        {steps.map((step, index) => (
          <Pressable
            key={step.title}
            accessibilityRole="button"
            onPress={step.onPress}
            style={wide ? { flex: 1 } : undefined}
            className={`cursor-pointer gap-1.5 rounded-[14px] border p-4 ${index === 0 ? "border-accent bg-tint" : "border-line bg-card"}`}
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Ionicons name={step.icon} size={22} color={colors.accent} />
                <Text className="text-[17px] font-semibold text-navy">{step.title}</Text>
              </View>
              <Ionicons name="arrow-forward" size={18} color={colors.accent} />
            </View>
            <Text className="text-[15px] leading-5 text-muted">{step.detail}</Text>
          </Pressable>
        ))}
        </View>
      </View>
    );
  }

  const intro = (
    <Text className="text-[16px] leading-6 text-ink">
      {start.firstMonth
        ? `Es el primer mes de la cuenta. Anotá lo que había con cada hipódromo el 1 de ${name}.`
        : `Así arranca ${name} con cada hipódromo. Si no coincide con lo que tenés, anotá el saldo real. No lleva comisión.`}
    </Text>
  );

  const cards = start.lines.map((line) => {
    const draft = drafts[line.racetrackId];
    const typed = readSignedAmount(draft);
    const differs = !start.firstMonth && typed !== null && typed !== line.carriedCents;
    const change = (next: BalanceDraft) => setDrafts((current) => ({ ...current, [line.racetrackId]: next }));
    const revert = () => setDrafts((current) => ({ ...current, [line.racetrackId]: draftFromCents(line.carriedCents) }));
    return (
      <View
        key={line.racetrackId}
        className="gap-3 rounded-[14px] border border-line bg-card p-4"
        style={wide ? { flexGrow: 1, flexBasis: 280, maxWidth: start.lines.length > 1 ? undefined : 420 } : undefined}
      >
        <View className="gap-1">
          <Text className="text-[17px] font-semibold text-navy">{line.name}</Text>
          {start.firstMonth ? null : (
            <View className="flex-row flex-wrap items-center gap-1">
              <Text className="text-[15px] text-muted">Viene de {previous}: {sideText(line.carriedCents)}</Text>
              {line.carriedCents === 0 ? null : <MoneyText cents={Math.abs(line.carriedCents)} />}
            </View>
          )}
        </View>
        <BalanceFields
          value={draft}
          onChange={change}
          label={`Saldo al empezar ${name} con ${line.name}`}
        />
        {differs ? (
          <Pressable
            accessibilityRole="button"
            onPress={revert}
            className="cursor-pointer self-start"
          >
            <Text className="text-[15px] font-semibold text-accent">Volver a lo que venía</Text>
          </Pressable>
        ) : null}
      </View>
    );
  });

  const side = (
    <>
      {start.lines.length > 0 ? (
        <OpeningSummary
          title={`Así arranca ${name}`}
          lines={liveLines}
          totalLabel="Total a pagar a los hipódromos"
          totalCents={liveTotal}
        />
      ) : null}
      {cardsOverflow ? (
        <View className="flex-row items-center gap-2">
          <Ionicons name="arrow-down-circle" size={22} color={colors.accent} />
          <Text className="flex-1 text-[15px] font-semibold text-accent">Bajá para ver los {start.lines.length} hipódromos</Text>
        </View>
      ) : null}
      <Feedback error={error} />
      {start.lines.length > 0 ? (
        <PrimaryButton label={saving ? "Guardando…" : "Guardar saldos"} onPress={() => void save()} />
      ) : null}
      <SecondaryButton label="Cancelar" onPress={onClose} />
    </>
  );

  if (start.lines.length === 0) {
    return (
      <View className="gap-5">
        {intro}
        <Text className="text-[16px] leading-6 text-muted">Todavía no hay hipódromos. Agregá uno desde Inicio.</Text>
        <SecondaryButton label="Cancelar" onPress={onClose} />
      </View>
    );
  }

  if (wide) {
    return (
      <View className="gap-5">
        {intro}
        <View className="flex-row items-start gap-6">
          <View
            className="flex-1 flex-row flex-wrap gap-4"
            onLayout={(event) => setCardsHeight(event.nativeEvent.layout.height)}
          >
            {cards}
          </View>
          <View className="gap-4" style={{ width: 340 }}>
            {side}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className="gap-5">
      {intro}
      {cards}
      {side}
    </View>
  );
}
