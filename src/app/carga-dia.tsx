import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";

import { LotteryDayEntry } from "@/app/quiniela/carga";
import { openingDate } from "@/components/calendar-grid";
import { DateField } from "@/components/date-field";
import { ChoiceChips, Field, SecondaryButton } from "@/components/form-controls";
import { RacingDayEntry } from "@/components/racing-day-entry";
import { Card, ScreenFrame } from "@/components/screen-frame";
import {
  TERMINAL_IDS,
  ledgerErrorMessage,
  terminalServices,
  useLedger,
  useLottery,
  type TerminalId,
} from "@/modules/ledger";

const terminalOptions = TERMINAL_IDS.map((id) => ({ id, label: `Terminal ${id}` }));

export default function CombinedLoadScreen() {
  const { viewMonth, snapshot, setTerminalServices, canViewBalances, readOnly } = useLedger();
  const [date, setDate] = useState(() => openingDate(viewMonth));
  const [terminalId, setTerminalId] = useState<TerminalId>("1");
  const [month, setMonth] = useState(viewMonth);
  if (month !== viewMonth) {
    setMonth(viewMonth);
    setDate(openingDate(viewMonth));
  }
  const services = terminalServices(snapshot, terminalId);

  function toggle(service: "racing" | "lottery") {
    const next = { ...services, [service]: !services[service] };
    if (!next.racing && !next.lottery || readOnly) {
      return;
    }
    void setTerminalServices({ terminalId, racing: next.racing, lottery: next.lottery });
  }

  return (
    <ScreenFrame title="Carga del día">
      <Card>
        <View className="gap-4">
          <Field label="Fecha">
            <DateField value={date} onChange={setDate} />
          </Field>
          <Field label="Terminal">
            <ChoiceChips options={terminalOptions} value={terminalId} onChange={setTerminalId} />
          </Field>
          {canViewBalances && !readOnly ? (
            <Field label="Qué carga esta terminal">
              <View className="flex-row flex-wrap gap-2">
                <SecondaryButton label={services.racing ? "Hípica: sí" : "Hípica: no"} onPress={() => toggle("racing")} />
                <SecondaryButton label={services.lottery ? "Lotería: sí" : "Lotería: no"} onPress={() => toggle("lottery")} />
              </View>
            </Field>
          ) : null}
        </View>
      </Card>
      {services.racing ? <RacingDayEntry embedded lockedDate={date} lockedTerminal={terminalId} /> : null}
      {services.lottery ? <LotteryBlock date={date} terminalId={terminalId} /> : null}
    </ScreenFrame>
  );
}

function LotteryBlock({ date, terminalId }: { date: string; terminalId: TerminalId }) {
  const lottery = useLottery();
  const { canViewBalances } = useLedger();
  const [error, setError] = useState("");
  const started = useRef(false);

  useEffect(() => {
    if (!canViewBalances || lottery.status !== "inactive" || started.current) {
      return;
    }
    started.current = true;
    void lottery.activate().catch((caught) => {
      setError(ledgerErrorMessage(caught));
    });
  }, [canViewBalances, lottery]);

  if (lottery.status !== "active") {
    return (
      <Card>
        <Text className="text-[17px] leading-6 text-ink">
          {error || (canViewBalances ? "Abriendo la quiniela…" : "La quiniela la activa el dueño.")}
        </Text>
      </Card>
    );
  }

  return <LotteryDayEntry embedded lockedDate={date} lockedTerminal={terminalId} />;
}
