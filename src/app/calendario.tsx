import { useEffect, useState } from "react";
import { Linking, Pressable, Text, useWindowDimensions, View, type TextStyle } from "react-native";

import { buildMonthGrid, monthTitle } from "@/components/calendar-grid";
import { Dialog, Feedback, Field, PrimaryButton, SecondaryButton } from "@/components/form-controls";
import { MultiChoiceChips } from "@/components/form-controls";
import { Card, ScreenFrame, SectionTitle } from "@/components/screen-frame";
import { wideLayout } from "@/constants/layout";
import { useOperatorAdmin } from "@/modules/identity/operator-admin";
import {
  buildScheduleReport,
  emptyScheduleReportMessage,
  ledgerErrorMessage,
  listRacetracks,
  useLedger,
  type ScheduleDay,
} from "@/modules/ledger";

type PersonOption = { id: string; name: string };

type AccountGroup = { people: PersonOption[]; failed: boolean };

const emptyGroup: AccountGroup = { people: [], failed: false };

export default function CalendarioScreen() {
  const ledger = useLedger();
  const admin = useOperatorAdmin();
  const wide = useWindowDimensions().width >= wideLayout;
  const [owners, setOwners] = useState<AccountGroup>(emptyGroup);
  const [operators, setOperators] = useState<AccountGroup>(emptyGroup);
  const [accountsReady, setAccountsReady] = useState(false);
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
    void Promise.allSettled([admin.listOwners(), admin.list()]).then(([ownerResult, operatorResult]) => {
      if (!alive) {
        return;
      }
      setOwners(
        ownerResult.status === "fulfilled"
          ? { people: ownerResult.value.map((owner) => ({ id: `owner:${owner.userId}`, name: owner.displayName })), failed: false }
          : { people: [], failed: true },
      );
      setOperators(
        operatorResult.status === "fulfilled"
          ? {
              people: operatorResult.value.map((operator) => ({ id: `operator:${operator.userId}`, name: operator.displayName })),
              failed: false,
            }
          : { people: [], failed: true },
      );
      setAccountsReady(true);
    });
    return () => {
      alive = false;
    };
  }, [admin, ledger.role]);

  const tracks = listRacetracks(ledger.snapshot);
  const staff: PersonOption[] = (ledger.snapshot.staff ?? [])
    .filter((member) => member.agencyId === ledger.snapshot.agencyId)
    .map((member) => ({ id: member.id, name: member.name }));
  const people: PersonOption[] = [...owners.people, ...operators.people, ...staff];
  const days = (ledger.snapshot.schedule ?? []).filter(
    (day) => day.agencyId === ledger.snapshot.agencyId && day.date.startsWith(`${ledger.viewMonth}-`),
  );
  const byDate = new Map(days.map((day) => [day.date, day]));
  const grid = buildMonthGrid(ledger.viewMonth);
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
      const savedPeople = byDate.get(selectedDate)?.people ?? [];
      const chosen = personIds.flatMap((id) => {
        const loaded = people.find((person) => person.id === id) ?? savedPeople.find((person) => person.id === id);
        return loaded ? [loaded] : [];
      });
      await ledger.saveScheduleDay({
        date: selectedDate,
        inactive,
        racetrackIds: inactive ? [] : racetrackIds,
        people: inactive ? [] : chosen,
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
        {wide ? <SectionTitle title={monthTitle(ledger.viewMonth)} /> : null}
        <Text className={wide ? "mt-2 text-[15px] text-muted" : "text-[15px] text-muted"}>
          {canEdit ? "Tocá un día para elegir hipódromos y personas." : "El dueño arma el mes. Vos lo ves y lo podés compartir."}
        </Text>
        <View className="mt-4">
          <View className="flex-row">
            {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((label) => (
              <Text key={label} className="w-[14.28%] text-center text-[13px] font-semibold text-muted">{label}</Text>
            ))}
          </View>
          <View className="flex-row flex-wrap">
            {grid.map((cell) => (
              <DayCell
                key={cell.iso}
                date={cell.iso}
                day={cell.day}
                inMonth={cell.inMonth}
                saved={byDate.get(cell.iso)}
                tracks={tracks}
                wide={wide}
                onPress={() => cell.inMonth && openDay(cell.iso)}
              />
            ))}
          </View>
        </View>
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
              {admin && ledger.role === "owner" ? (
                accountsReady ? (
                  owners.failed && operators.failed ? (
                    <Text className="text-[15px] text-muted">No se pudieron cargar los dueños ni los operadores.</Text>
                  ) : (
                    <>
                      <PersonChoices
                        label="Dueños"
                        people={owners.people}
                        failed={owners.failed}
                        empty="Todavía no hay dueños."
                        failedText="No se pudieron cargar los dueños."
                        values={personIds}
                        onChange={setPersonIds}
                      />
                      <PersonChoices
                        label="Operadores"
                        people={operators.people}
                        failed={operators.failed}
                        empty="Todavía no hay operadores."
                        failedText="No se pudieron cargar los operadores."
                        values={personIds}
                        onChange={setPersonIds}
                      />
                    </>
                  )
                ) : (
                  <Text className="text-[15px] text-muted">Cargando…</Text>
                )
              ) : null}
              {staff.length > 0 ? (
                <PersonChoices label="Sin cuenta" people={staff} failed={false} empty="" failedText="" values={personIds} onChange={setPersonIds} />
              ) : null}
              {racetrackIds.length > 0 && personIds.length === 0 ? (
                <Text className="text-[15px] text-muted">Elegí quién se hace cargo del hipódromo.</Text>
              ) : null}
            </>
          )}
          <PrimaryButton label="Guardar día" onPress={() => void onSave()} />
        </View>
      </Dialog>
    </ScreenFrame>
  );
}

function PersonChoices({
  label,
  people,
  failed,
  empty,
  failedText,
  values,
  onChange,
}: {
  label: string;
  people: readonly PersonOption[];
  failed: boolean;
  empty: string;
  failedText: string;
  values: readonly string[];
  onChange: (values: string[]) => void;
}) {
  return (
    <Field label={label}>
      {failed ? (
        <Text className="text-[15px] text-muted">{failedText}</Text>
      ) : people.length === 0 ? (
        <Text className="text-[15px] text-muted">{empty}</Text>
      ) : (
        <MultiChoiceChips options={people.map((person) => ({ id: person.id, label: person.name }))} values={values} onChange={onChange} />
      )}
    </Field>
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
      className={wide ? "w-[14.28%] border border-line p-2" : "w-[14.28%] border border-line px-0.5 py-1"}
      style={inMonth ? undefined : { opacity: 0.4 }}
    >
      <Text className={wide ? "text-[15px] font-semibold text-navy" : "text-center text-[13px] font-semibold text-navy"}>{day}</Text>
      {caption ? (
        <Text
          className={wide ? "text-[13px] text-ink" : "text-center text-[10px] leading-3 text-ink"}
          numberOfLines={wide ? undefined : 3}
          style={wide ? undefined : ({ overflowWrap: "normal" } as TextStyle)}
        >
          {caption}
        </Text>
      ) : null}
    </Pressable>
  );
}
