import { useEffect, useState } from "react";
import { Redirect } from "expo-router";
import { Linking, Pressable, Text, useWindowDimensions, View } from "react-native";

import { buildMonthGrid, monthTitle } from "@/components/calendar-grid";
import { Dialog, Feedback, Field, PrimaryButton, SecondaryButton } from "@/components/form-controls";
import { MultiChoiceChips } from "@/components/form-controls";
import { Card, ScreenFrame, SectionTitle } from "@/components/screen-frame";
import { wideLayout } from "@/constants/layout";
import { useOperatorAdmin } from "@/modules/identity/operator-admin";
import {
  buildScheduleReport,
  cashAndScheduleEnabled,
  emptyScheduleReportMessage,
  ledgerErrorMessage,
  listRacetracks,
  useLedger,
  type ScheduleDay,
} from "@/modules/ledger";

type PersonOption = { id: string; name: string };

export default function CalendarioScreen() {
  const ledger = useLedger();
  const admin = useOperatorAdmin();
  const wide = useWindowDimensions().width >= wideLayout;
  const [accounts, setAccounts] = useState<PersonOption[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [racetrackIds, setRacetrackIds] = useState<string[]>([]);
  const [personIds, setPersonIds] = useState<string[]>([]);
  const [inactive, setInactive] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!admin || ledger.role !== "owner") {
      return;
    }
    let alive = true;
    void Promise.all([admin.list(), admin.listOwners().catch(() => [])]).then(([operators, owners]) => {
      if (!alive) {
        return;
      }
      setAccounts([
        ...owners.map((owner) => ({ id: `owner:${owner.userId}`, name: owner.displayName })),
        ...operators.map((operator) => ({ id: `operator:${operator.userId}`, name: operator.displayName })),
      ]);
    });
    return () => {
      alive = false;
    };
  }, [admin, ledger.role]);

  if (!cashAndScheduleEnabled(ledger.snapshot.agencyId)) {
    return <Redirect href="/" />;
  }

  const tracks = listRacetracks(ledger.snapshot);
  const people: PersonOption[] = [
    ...accounts,
    ...(ledger.snapshot.staff ?? [])
      .filter((member) => member.agencyId === ledger.snapshot.agencyId)
      .map((member) => ({ id: member.id, name: member.name })),
  ];
  const days = (ledger.snapshot.schedule ?? []).filter(
    (day) => day.agencyId === ledger.snapshot.agencyId && day.date.startsWith(`${ledger.viewMonth}-`),
  );
  const byDate = new Map(days.map((day) => [day.date, day]));
  const grid = buildMonthGrid(ledger.viewMonth);
  const cells = wide ? grid : grid.filter((cell) => cell.inMonth);
  const canEdit = ledger.role === "owner" && !ledger.readOnly;

  function openDay(date: string) {
    if (!canEdit) {
      return;
    }
    const current = byDate.get(date);
    setSelectedDate(date);
    setRacetrackIds(current?.racetrackIds ?? []);
    setPersonIds(current?.people.map((person) => person.id) ?? []);
    setInactive(current?.inactive ?? false);
    setError("");
  }

  async function onSave() {
    if (!selectedDate) {
      return;
    }
    setError("");
    try {
      await ledger.saveScheduleDay({
        date: selectedDate,
        inactive,
        racetrackIds: inactive ? [] : racetrackIds,
        people: inactive ? [] : people.filter((person) => personIds.includes(person.id)),
      });
      setMessage("Día guardado.");
      setSelectedDate(null);
    } catch (caught) {
      setError(ledgerErrorMessage(caught));
    }
  }

  async function onShare() {
    const report = buildScheduleReport(ledger.snapshot, ledger.viewMonth, ledger.agencyName);
    if (!report) {
      setError(emptyScheduleReportMessage);
      return;
    }
    setError("");
    await Linking.openURL(`https://wa.me/?text=${encodeURIComponent(report)}`);
  }

  return (
    <ScreenFrame title="Calendario">
      <Card>
        <SectionTitle title={monthTitle(ledger.viewMonth)} />
        <Text className="mt-2 text-[15px] text-muted">
          {canEdit ? "Tocá un día para elegir hipódromos y personas." : "El dueño arma el mes. Vos lo ves y lo podés compartir."}
        </Text>
        {wide ? (
          <View className="mt-4">
            <View className="flex-row">
              {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((label) => (
                <Text key={label} className="w-[14.28%] text-center text-[13px] font-semibold text-muted">{label}</Text>
              ))}
            </View>
            <View className="flex-row flex-wrap">
              {cells.map((cell) => (
                <DayCell
                  key={cell.iso}
                  date={cell.iso}
                  day={cell.day}
                  inMonth={cell.inMonth}
                  saved={byDate.get(cell.iso)}
                  tracks={tracks}
                  wide
                  onPress={() => cell.inMonth && openDay(cell.iso)}
                />
              ))}
            </View>
          </View>
        ) : (
          <View className="mt-4 gap-2">
            {cells.map((cell) => (
              <DayCell key={cell.iso} date={cell.iso} day={cell.day} inMonth saved={byDate.get(cell.iso)} tracks={tracks} onPress={() => openDay(cell.iso)} />
            ))}
          </View>
        )}
        <View className="mt-4">
          <PrimaryButton label="Compartir por WhatsApp" onPress={() => void onShare()} />
        </View>
      </Card>
      <Feedback error={error} message={message} />
      <Dialog visible={selectedDate !== null} title={selectedDate ? `Día ${selectedDate.slice(8)}` : ""} onClose={() => setSelectedDate(null)}>
        <View className="gap-4">
          <SecondaryButton label={inactive ? "Con actividad" : "Sin actividad"} onPress={() => setInactive((current) => !current)} />
          {inactive ? (
            <Text className="text-[15px] text-muted">Este día queda marcado sin actividad.</Text>
          ) : (
            <>
              <Field label="Hipódromos">
                <MultiChoiceChips
                  options={tracks.map((track) => ({ id: track.id, label: track.name }))}
                  values={racetrackIds}
                  onChange={setRacetrackIds}
                />
              </Field>
              <Field label="Personas">
                {people.length === 0 ? (
                  <Text className="text-[15px] text-muted">Agregá personas en Operadores, en el bloque Sin cuenta.</Text>
                ) : (
                  <MultiChoiceChips options={people.map((person) => ({ id: person.id, label: person.name }))} values={personIds} onChange={setPersonIds} />
                )}
              </Field>
            </>
          )}
          <PrimaryButton label="Guardar día" onPress={() => void onSave()} />
        </View>
      </Dialog>
    </ScreenFrame>
  );
}

function DayCell({
  date,
  day,
  inMonth,
  saved,
  tracks,
  wide = false,
  onPress,
}: {
  date: string;
  day: number;
  inMonth: boolean;
  saved: ScheduleDay | undefined;
  tracks: readonly { id: string; name: string }[];
  wide?: boolean;
  onPress: () => void;
}) {
  const caption = saved
    ? saved.inactive
      ? "Sin actividad"
      : [...saved.racetrackIds.map((id) => tracks.find((track) => track.id === id)?.name ?? ""), ...saved.people.map((person) => person.name)]
          .filter(Boolean)
          .join(" · ")
    : "";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={date}
      onPress={onPress}
      className={wide ? "w-[14.28%] border border-line p-2" : "rounded-[14px] border border-line px-3 py-2"}
      style={inMonth ? undefined : { opacity: 0.4 }}
    >
      <Text className="text-[15px] font-semibold text-navy">{day}</Text>
      {caption ? <Text className="text-[13px] text-ink">{caption}</Text> : null}
    </Pressable>
  );
}
