import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useEffect, useState, type ReactNode } from "react";
import { Platform, Pressable, Text, useWindowDimensions, View, type ViewStyle } from "react-native";

import { AmountField } from "@/components/amount-field";
import { monthTitle, shiftMonth } from "@/components/calendar-grid";
import { CommissionModeField } from "@/components/commission-mode-field";
import {
  ChoiceChips,
  Feedback,
  Field,
  PrimaryButton,
  SecondaryButton,
  TextField,
} from "@/components/form-controls";
import { MoneyText, StatCard } from "@/components/stat-card";
import { scrollToEditForm } from "@/components/scroll-to-edit-form";
import { WELCOME_TOP_ID, WelcomeHero } from "@/components/welcome-hero";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { mobileTabBarHeight, wideLayout } from "@/constants/layout";
import { usePalette } from "@/constants/palette";
import {
  commissionModeOf,
  formatAmountInput,
  formatPercentInput,
  ledgerErrorMessage,
  parsePercentToBasisPoints,
  parseSignedPercentToBasisPoints,
  racetrackRates,
  readAmount,
  sumStartingBalances,
  type CommissionMode,
  type StartingRacetrackInput,
} from "@/modules/ledger";

type Side = "owe" | "owed";

const sideOptions: readonly { id: Side; label: string }[] = [
  { id: "owe", label: "Le debo" },
  { id: "owed", label: "Me debe" },
];

export type BalanceDraft = { side: Side; amount: string };


/** The "Así arrancás" panel goes beside the cards only from this width; below, the total bar. */
const SUMMARY_BESIDE_WIDTH = 920;

/** How far back the welcome offers to start. */
const START_MONTHS_BACK = 12;

/** The month the book was opened and the eleven before it, newest first. */
function startMonthOptions(openedMonth: string): { id: string; label: string }[] {
  return Array.from({ length: START_MONTHS_BACK }, (_, index) => {
    const month = shiftMonth(openedMonth, -index);
    return { id: month, label: monthTitle(month) };
  });
}

function firstOfMonth(month: string): string {
  const [name, year] = monthTitle(month).toLocaleLowerCase("es").split(" ");
  return `1 de ${name} de ${year}`;
}

function percentText(basisPoints: number): string {
  return `${formatPercentInput(basisPoints)} %`;
}

/** Reads "Le debo / Me debe" and the amount. Empty is zero. Null when the amount is wrong. */
export function readSignedAmount(draft: BalanceDraft): number | null {
  const amount = readAmount(draft.amount, true);
  if (amount === null) {
    return null;
  }
  return draft.side === "owed" ? -amount : amount;
}

export function draftFromCents(cents: number): BalanceDraft {
  return { side: cents < 0 ? "owed" : "owe", amount: cents === 0 ? "" : formatAmountInput(Math.abs(cents)) };
}

export function BalanceFields({
  value,
  onChange,
  label,
}: {
  value: BalanceDraft;
  onChange: (next: BalanceDraft) => void;
  label: string;
}) {
  return (
    <View className="gap-3">
      <ChoiceChips options={sideOptions} value={value.side} onChange={(side) => onChange({ ...value, side })} />
      <AmountField value={value.amount} onChangeText={(amount) => onChange({ ...value, amount })} accessibilityLabel={label} />
    </View>
  );
}

function useBusy() {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function run(action: () => void | Promise<void>) {
    if (saving) {
      return;
    }
    setSaving(true);
    setError("");
    try {
      await action();
    } catch (caught) {
      setError(ledgerErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  return { error, setError, saving, run };
}

function StepCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <View className="gap-5 rounded-[18px] border border-line bg-card p-5">
      <View className="gap-1.5">
        <Text className="font-sans text-[24px] font-semibold text-navy">{title}</Text>
        {subtitle ? <Text className="text-[16px] leading-6 text-muted">{subtitle}</Text> : null}
      </View>
      {children}
    </View>
  );
}

/** One step of the bar. It paints from left to right when reached and empties when going back. */
function StepSegment({ filled }: { filled: boolean }) {
  const colors = usePalette();
  const progress = useSharedValue(filled ? 1 : 0);
  useEffect(() => {
    progress.value = withTiming(filled ? 1 : 0, { duration: 450, easing: Easing.out(Easing.cubic) });
  }, [filled, progress]);
  const fill = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));
  return (
    <View className="flex-1 overflow-hidden rounded-full bg-line" style={{ height: 3 }}>
      <Animated.View style={[{ height: "100%", borderRadius: 999, backgroundColor: colors.navy }, fill]} />
    </View>
  );
}

/** Back pill, "Paso X de Y" and one segment per step, above each step card. */
function StepProgress({ step, total, onBack }: { step: number; total: number; onBack: () => void }) {
  const colors = usePalette();
  return (
    <View nativeID={WELCOME_TOP_ID} collapsable={false} className="gap-3">
      <View className="flex-row items-center justify-between gap-3" style={{ minHeight: 40 }}>
        {step > 0 ? (
          <Pressable
            accessibilityRole="button"
            onPress={onBack}
            className="cursor-pointer flex-row items-center gap-1.5 rounded-full border border-accent bg-card px-4 py-2"
          >
            <Ionicons name="arrow-back" size={16} color={colors.accent} />
            <Text className="text-[15px] font-semibold text-accent">Volver</Text>
          </Pressable>
        ) : (
          <View />
        )}
        <Text className="text-[15px] text-muted">
          Paso{" "}
          <Text className="font-serif text-navy" style={{ fontSize: 24 }}>
            {step + 1}
          </Text>{" "}
          de {total}
        </Text>
      </View>
      <View className="w-full flex-row gap-1.5 self-end" style={{ maxWidth: 240 }}>
        {Array.from({ length: total }, (_, index) => (
          <StepSegment key={index} filled={index <= step} />
        ))}
      </View>
    </View>
  );
}

function StepNav({
  onNext,
  nextLabel,
  busy = false,
  final = false,
}: {
  onNext: () => void;
  nextLabel: string;
  /** While saving: the label changes and the arrow hides. */
  busy?: boolean;
  /** The last step: a bigger button, full width on the phone. */
  final?: boolean;
}) {
  const colors = usePalette();
  const wide = useWindowDimensions().width >= wideLayout;
  return (
    <View className={final && !wide ? "" : "items-end"}>
      <Pressable
        accessibilityRole="button"
        onPress={onNext}
        className={`cursor-pointer flex-row items-center justify-center gap-2 bg-accent ${
          final ? `rounded-[12px] px-8 py-4 ${wide ? "" : "w-full"}` : "rounded-[10px] px-7 py-3"
        }`}
      >
        <Text className={`${final ? "text-[18px]" : "text-[16px]"} font-semibold text-white`}>{nextLabel}</Text>
        {busy ? null : <Ionicons name="arrow-forward" size={final ? 18 : 16} color={colors.card} />}
      </Pressable>
    </View>
  );
}

function PostponeLink({ onPress }: { onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} className="cursor-pointer self-end">
      <Text className="text-[15px] text-muted underline">Prefiero mirar la app primero</Text>
    </Pressable>
  );
}

/** When the summary panel does not fit beside the cards, the total stays in view while the owner types. */
function LiveTotalBar({ label, cents }: { label: string; cents: number }) {
  // On the phone the bottom tab bar is fixed; on a narrow desktop there is none.
  const phone = useWindowDimensions().width < wideLayout;
  const sticky =
    Platform.OS === "web"
      ? ({ position: "sticky", bottom: phone ? mobileTabBarHeight + 8 : 16, zIndex: 5 } as unknown as ViewStyle)
      : undefined;
  return (
    <View style={sticky}>
      <View className="flex-row items-center justify-between gap-3 rounded-[14px] border border-accent bg-card px-4 py-3">
        <Text className="flex-1 text-[13px] font-semibold uppercase text-muted" style={{ letterSpacing: 0.8 }}>
          {label}
        </Text>
        <MoneyText cents={cents} size="md" tone="navy" />
      </View>
    </View>
  );
}

/** Keeps what the owner typed while they visit another screen. A reload starts over. */
const welcomeDrafts = new Map<string, unknown>();

function useWelcomeDraft<T>(key: string, initial: () => T): [T, (next: T | ((current: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => (welcomeDrafts.has(key) ? (welcomeDrafts.get(key) as T) : initial()));
  useEffect(() => {
    welcomeDrafts.set(key, value);
  }, [key, value]);
  return [value, setValue];
}

function clearWelcomeDrafts(prefix: string) {
  for (const key of [...welcomeDrafts.keys()]) {
    if (key.startsWith(prefix)) {
      welcomeDrafts.delete(key);
    }
  }
}

function IconBadge({ name }: { name: "horse-variant" | "ticket-confirmation" }) {
  const colors = usePalette();
  return (
    <View className="h-11 w-11 items-center justify-center rounded-[12px] bg-navy">
      <MaterialCommunityIcons name={name} size={24} color={colors.celeste} />
    </View>
  );
}

function StartMonthStep({
  openedMonth,
  value,
  onChange,
}: {
  openedMonth: string;
  value: string;
  onChange: (month: string) => void;
}) {
  return (
    <StepCard
      title="¿Desde qué mes vas a cargar?"
      subtitle="Si vas a pasar planillas viejas, elegí el primer mes. El saldo inicial es el del día 1."
    >
      <ChoiceChips options={startMonthOptions(openedMonth)} value={value} onChange={onChange} />
      <Text className="text-[15px] text-muted">Tu cuenta arranca el {firstOfMonth(value)}.</Text>
    </StepCard>
  );
}

type SummaryLine = { key: string | number; name: string; detail?: string; cents: number };

/** One line per account and the total, as Inicio will show it. */
export function OpeningSummary({
  title,
  lines,
  totalLabel,
  totalCents,
}: {
  title: string;
  lines: SummaryLine[];
  totalLabel: string;
  totalCents: number;
}) {
  return (
    <View className="gap-3 rounded-[14px] border border-line bg-canvas p-4">
      <Text className="text-[13px] font-semibold uppercase text-muted" style={{ letterSpacing: 1.2 }}>
        {title}
      </Text>
      {lines.map((line) => (
        <View key={line.key} className="flex-row items-center justify-between gap-3">
          <View className="flex-1">
            <Text className="text-[16px] font-semibold text-navy" numberOfLines={1}>
              {line.name}
            </Text>
            <Text className="text-[14px] text-muted">
              {line.detail ? `${line.detail} · ` : ""}
              {line.cents < 0 ? "Te debe" : line.cents > 0 ? "Le debés" : "Sin saldo"}
            </Text>
          </View>
          <MoneyText cents={Math.abs(line.cents)} tone="navy" />
        </View>
      ))}
      <StatCard label={totalLabel} cents={totalCents} emphasis />
    </View>
  );
}

type RacetrackDraft = BalanceDraft & { key: number; name: string; mode: CommissionMode; commission: string; adjustment: string };

function emptyRacetrack(key: number): RacetrackDraft {
  return { key, name: "", mode: "fixed", commission: "", adjustment: "", ...draftFromCents(0) };
}

function readRacetracks(rows: readonly RacetrackDraft[]): StartingRacetrackInput[] | string {
  const racetracks: StartingRacetrackInput[] = [];
  for (const row of rows) {
    const name = row.name.trim();
    if (!name) {
      return "Escribí el nombre de cada hipódromo.";
    }
    const commissionBasisPoints = parsePercentToBasisPoints(row.commission);
    if (commissionBasisPoints === null) {
      return `La comisión de ${name} tiene que estar entre 0 y 100.`;
    }
    const typedAdjustment = row.mode === "fixed" && row.adjustment.trim() ? parseSignedPercentToBasisPoints(row.adjustment) : 0;
    if (typedAdjustment === null) {
      return `El ajuste de ${name} tiene que estar entre -100 y 100.`;
    }
    const { depositAdjustmentBasisPoints } = racetrackRates(row.mode, commissionBasisPoints, typedAdjustment);
    const openingCents = readSignedAmount(row);
    if (openingCents === null) {
      return `Revisá el saldo de ${name}. Usá 1.000.000,00.`;
    }
    racetracks.push({ name, commissionBasisPoints, depositAdjustmentBasisPoints, openingCents });
  }
  if (racetracks.length === 0) {
    return "Agregá al menos un hipódromo.";
  }
  return racetracks;
}

function RacetrackCard({
  row,
  index,
  removable,
  onChange,
  onRemove,
}: {
  row: RacetrackDraft;
  index: number;
  removable: boolean;
  onChange: (change: Partial<RacetrackDraft>) => void;
  onRemove: () => void;
}) {
  return (
    <View
      className="gap-4 rounded-[14px] border border-line bg-canvas p-4"
    >
      <View className="flex-row items-center gap-3">
        <IconBadge name="horse-variant" />
        <Text className="flex-1 text-[18px] font-semibold text-navy" numberOfLines={1}>
          {row.name.trim() || `Hipódromo ${index + 1}`}
        </Text>
        {removable ? (
          <Pressable accessibilityRole="button" onPress={onRemove} className="cursor-pointer">
            <Text className="text-[15px] font-semibold text-negative">Quitar</Text>
          </Pressable>
        ) : null}
      </View>
      <Field label="Nombre">
        <TextField
          value={row.name}
          onChangeText={(name) => onChange({ name })}
          placeholder="Ej.: San Isidro"
          accessibilityLabel="Nombre del hipódromo"
        />
      </Field>
      <CommissionModeField
        mode={row.mode}
        onModeChange={(mode) => onChange({ mode })}
        commission={row.commission}
        onCommissionChange={(commission) => onChange({ commission })}
        adjustment={row.adjustment}
        onAdjustmentChange={(adjustment) => onChange({ adjustment })}
      />
      <Field label="Saldo inicial">
        <BalanceFields value={row} onChange={(next) => onChange(next)} label="Saldo inicial con el hipódromo" />
      </Field>
    </View>
  );
}

export function RacingWelcome({
  agencyName,
  openedMonth,
  onStart,
  onPostpone,
}: {
  agencyName: string;
  openedMonth: string;
  onStart: (racetracks: StartingRacetrackInput[], startMonth: string) => Promise<void>;
  onPostpone: () => Promise<void>;
}) {
  const [stepWidth, setStepWidth] = useState(0);
  const sideBySide = stepWidth >= SUMMARY_BESIDE_WIDTH;
  const prefix = `racing:${agencyName}:${openedMonth}:`;
  const [step, setStep] = useWelcomeDraft(`${prefix}step`, () => 0);
  const [startMonth, setStartMonth] = useWelcomeDraft(`${prefix}month`, () => openedMonth);
  const [rows, setRows] = useWelcomeDraft<RacetrackDraft[]>(`${prefix}rows`, () => [emptyRacetrack(0)]);
  const [nextKey, setNextKey] = useWelcomeDraft(`${prefix}key`, () => 1);
  const [ready, setReady] = useWelcomeDraft<StartingRacetrackInput[]>(`${prefix}ready`, () => []);
  const { error, setError, saving, run } = useBusy();
  const agency = agencyName.trim() || "tu agencia";

  function go(next: number) {
    setError("");
    setStep(next);
    scrollToEditForm(WELCOME_TOP_ID);
  }

  function changeRow(key: number, change: Partial<RacetrackDraft>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...change } : row)));
  }

  function toSummary() {
    const racetracks = readRacetracks(rows);
    if (typeof racetracks === "string") {
      setError(racetracks);
      return;
    }
    setReady(racetracks);
    go(2);
  }

  const liveLines: SummaryLine[] = rows.map((row, index) => ({
    key: row.key,
    name: row.name.trim() || `Hipódromo ${index + 1}`,
    cents: readSignedAmount(row) ?? 0,
  }));
  const liveTotal = sumStartingBalances(liveLines.map((line) => ({ openingCents: line.cents })));

  return (
    <View className="gap-4">
      {step === 0 ? <WelcomeHero kind="racing" agencyName={agencyName} onPostpone={() => void run(onPostpone)} /> : null}
      <StepProgress step={step} total={3} onBack={() => go(Math.max(0, step - 1))} />

      {step === 0 ? (
        <>
          <StartMonthStep openedMonth={openedMonth} value={startMonth} onChange={setStartMonth} />
          <StepNav onNext={() => go(1)} nextLabel="Continuar" />
        </>
      ) : null}

      {step === 1 ? (
        <>
          <View
            className={sideBySide ? "flex-row items-start gap-4" : "gap-4"}
            onLayout={(event) => setStepWidth(event.nativeEvent.layout.width)}
          >
            <View className="flex-1">
              <StepCard
                title="Tus hipódromos"
                subtitle={`Con quién trabajás y cómo estaba la cuenta con cada uno el ${firstOfMonth(startMonth)}. El saldo no lleva comisión. El ajuste se suma o se resta del neto al depositar; si no tenés, dejalo vacío.`}
              >
                {rows.map((row, index) => (
                  <RacetrackCard
                    key={row.key}
                    row={row}
                    index={index}
                    removable={rows.length > 1}
                    onChange={(change) => changeRow(row.key, change)}
                    onRemove={() => setRows((current) => current.filter((item) => item.key !== row.key))}
                  />
                ))}
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setRows((current) => [...current, emptyRacetrack(nextKey)]);
                    setNextKey((key) => key + 1);
                  }}
                  className="cursor-pointer items-center rounded-[14px] border-2 border-dashed border-line p-5"
                >
                  <Text className="text-[17px] font-semibold text-accent">＋ Agregar otro hipódromo</Text>
                </Pressable>
              </StepCard>
            </View>
            {sideBySide ? (
              <View style={{ width: 300 }}>
                <OpeningSummary title="Así arrancás" lines={liveLines} totalLabel="Total a pagar a los hipódromos" totalCents={liveTotal} />
              </View>
            ) : null}
          </View>
          {sideBySide ? null : <LiveTotalBar label="Total a pagar a los hipódromos" cents={liveTotal} />}
          <Feedback error={error} />
          <StepNav onNext={toSummary} nextLabel="Continuar" />
        </>
      ) : null}

      {step === 2 ? (
        <>
          <StepCard
            title={`Así arranca ${agency}`}
            subtitle={`Desde el ${firstOfMonth(startMonth)}. Después lo podés cambiar en Inicio, en «Editar o quitar».`}
          >
            <OpeningSummary
              title="Estado de cuenta inicial"
              lines={ready.map((racetrack) => ({
                key: racetrack.name,
                name: racetrack.name,
                detail:
                  commissionModeOf(racetrack) === "retained"
                    ? `${percentText(racetrack.commissionBasisPoints)} de la venta neta, descontado del depósito`
                    : `Comisión ${percentText(racetrack.commissionBasisPoints)}${
                        racetrack.depositAdjustmentBasisPoints === 0 ? "" : ` · Ajuste ${percentText(racetrack.depositAdjustmentBasisPoints)}`
                      }`,
                cents: racetrack.openingCents,
              }))}
              totalLabel="Total a pagar a los hipódromos"
              totalCents={sumStartingBalances(ready)}
            />
          </StepCard>
          <Feedback error={error} />
          <StepNav
            onNext={() =>
              void run(async () => {
                await onStart(ready, startMonth);
                clearWelcomeDrafts(prefix);
              })
            }
            nextLabel={saving ? "Guardando…" : "Empezar con HippoPro"}
            busy={saving}
            final
          />
        </>
      ) : null}
      {step > 0 ? <PostponeLink onPress={() => void run(onPostpone)} /> : null}
    </View>
  );
}

export function LotteryWelcome({
  agencyName,
  openedMonth,
  onStart,
  onPostpone,
}: {
  agencyName: string;
  openedMonth: string;
  onStart: (openingCents: number, startMonth: string) => Promise<void>;
  onPostpone: () => Promise<void>;
}) {
  const prefix = `lottery:${agencyName}:${openedMonth}:`;
  const [step, setStep] = useWelcomeDraft(`${prefix}step`, () => 0);
  const [startMonth, setStartMonth] = useWelcomeDraft(`${prefix}month`, () => openedMonth);
  const [draft, setDraft] = useWelcomeDraft<BalanceDraft>(`${prefix}balance`, () => draftFromCents(0));
  const [ready, setReady] = useWelcomeDraft(`${prefix}ready`, () => 0);
  const { error, setError, saving, run } = useBusy();
  const agency = agencyName.trim() || "tu agencia";

  function go(next: number) {
    setError("");
    setStep(next);
    scrollToEditForm(WELCOME_TOP_ID);
  }

  function toSummary() {
    const openingCents = readSignedAmount(draft);
    if (openingCents === null) {
      setError("Revisá el saldo. Usá 1.000.000,00.");
      return;
    }
    setReady(openingCents);
    go(2);
  }

  return (
    <View className="gap-4">
      {step === 0 ? <WelcomeHero kind="lottery" agencyName={agencyName} onPostpone={() => void run(onPostpone)} /> : null}
      <StepProgress step={step} total={3} onBack={() => go(Math.max(0, step - 1))} />

      {step === 0 ? (
        <>
          <StartMonthStep openedMonth={openedMonth} value={startMonth} onChange={setStartMonth} />
          <StepNav onNext={() => go(1)} nextLabel="Continuar" />
        </>
      ) : null}

      {step === 1 ? (
        <>
          <StepCard
            title="Tu saldo con la lotería"
            subtitle={`Cómo estaba la cuenta con la lotería el ${firstOfMonth(startMonth)}. No lleva comisión.`}
          >
            <View className="gap-4 rounded-[14px] border border-line bg-canvas p-4">
              <View className="flex-row items-center gap-3">
                <IconBadge name="ticket-confirmation" />
                <Text className="flex-1 text-[18px] font-semibold text-navy">Lotería</Text>
              </View>
              <BalanceFields value={draft} onChange={setDraft} label="Saldo inicial con la lotería" />
            </View>
            <StatCard label="Total a pagar a la lotería" cents={readSignedAmount(draft) ?? 0} emphasis />
          </StepCard>
          <Feedback error={error} />
          <StepNav onNext={toSummary} nextLabel="Continuar" />
        </>
      ) : null}

      {step === 2 ? (
        <>
          <StepCard
            title={`Así arranca ${agency}`}
            subtitle={`Desde el ${firstOfMonth(startMonth)}. Después lo podés cambiar en Inicio, en «Editar saldo inicial».`}
          >
            <OpeningSummary
              title="Estado de cuenta inicial"
              lines={[{ key: "lottery", name: "Lotería", cents: ready }]}
              totalLabel="Total a pagar a la lotería"
              totalCents={ready}
            />
          </StepCard>
          <Feedback error={error} />
          <StepNav
            onNext={() =>
              void run(async () => {
                await onStart(ready, startMonth);
                clearWelcomeDrafts(prefix);
              })
            }
            nextLabel={saving ? "Guardando…" : "Empezar con HippoPro"}
            busy={saving}
            final
          />
        </>
      ) : null}
      {step > 0 ? <PostponeLink onPress={() => void run(onPostpone)} /> : null}
    </View>
  );
}

/** "Le debo / Me debe" and the amount with the lottery, to edit it later from Inicio. */
export function LotteryOpeningForm({
  initialCents,
  primaryLabel,
  onSubmit,
  secondaryLabel,
  onSecondary,
}: {
  initialCents: number;
  primaryLabel: string;
  onSubmit: (openingCents: number) => Promise<void>;
  secondaryLabel: string;
  onSecondary: () => void | Promise<void>;
}) {
  const [draft, setDraft] = useState<BalanceDraft>(() => draftFromCents(initialCents));
  const { error, setError, saving, run } = useBusy();

  function submit() {
    const openingCents = readSignedAmount(draft);
    if (openingCents === null) {
      setError("Revisá el saldo. Usá 1.000.000,00.");
      return;
    }
    void run(() => onSubmit(openingCents));
  }

  return (
    <View className="gap-4">
      <Field label="Saldo con la lotería">
        <BalanceFields value={draft} onChange={setDraft} label="Saldo inicial con la lotería" />
      </Field>
      <Feedback error={error} />
      <PrimaryButton label={saving ? "Guardando…" : primaryLabel} onPress={submit} />
      <SecondaryButton label={secondaryLabel} onPress={() => void run(onSecondary)} />
    </View>
  );
}
