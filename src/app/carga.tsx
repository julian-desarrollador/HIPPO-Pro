import { useState } from "react";
import { Text, useWindowDimensions, View } from "react-native";

import { DataTable, KeyValueList } from "@/components/data-table";
import { formatIsoDate } from "@/components/format-date";
import { ChoiceChips, Feedback, Field, PrimaryButton, TextField } from "@/components/form-controls";
import { Card, ScreenFrame, SectionTitle } from "@/components/screen-frame";
import { MoneyText } from "@/components/stat-card";
import { wideLayout } from "@/constants/layout";
import {
  RACETRACKS,
  ledgerErrorMessage,
  readAmount,
  settleDay,
  useLedger,
  type RacetrackId,
} from "@/modules/ledger";

export default function CargaScreen() {
  const { days, recordDay } = useLedger();
  const wide = useWindowDimensions().width >= wideLayout;
  const [date, setDate] = useState("2026-08-16");
  const [racetrackId, setRacetrackId] = useState<RacetrackId>("san-isidro");
  const [sold, setSold] = useState("");
  const [cancelled, setCancelled] = useState("");
  const [paid, setPaid] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const soldCents = readAmount(sold, true);
  const cancelledCents = readAmount(cancelled, true);
  const paidCents = readAmount(paid, true);
  const preview =
    soldCents !== null && cancelledCents !== null && paidCents !== null
      ? settleDay({ racetrackId, soldCents, cancelledCents, paidCents })
      : null;

  function onSave() {
    if (soldCents === null || cancelledCents === null || paidCents === null) {
      setError("Revisá los importes. Usá 1234,50.");
      setMessage("");
      return;
    }

    try {
      recordDay({ date, racetrackId, soldCents, cancelledCents, paidCents });
      setSold("");
      setCancelled("");
      setPaid("");
      setError("");
      setMessage("Día cargado.");
    } catch (caught) {
      setMessage("");
      setError(ledgerErrorMessage(caught));
    }
  }

  return (
    <ScreenFrame
      title="Carga del día"
      subtitle="Un hipódromo por día, como en la planilla. El neto, la comisión y lo a depositar se calculan solos.">
      <View className={wide ? "flex-row items-start gap-4" : "gap-4"}>
        <View className="flex-1">
          <Card>
            <View className="gap-4">
              <Field label="Fecha">
                <TextField value={date} onChangeText={setDate} autoCapitalize="none" placeholder="2026-08-16" />
              </Field>
              <Field label="Hipódromo">
                <ChoiceChips
                  options={RACETRACKS.map((track) => ({ id: track.id, label: track.name }))}
                  value={racetrackId}
                  onChange={setRacetrackId}
                />
              </Field>
              <Field label="Vendido">
                <TextField value={sold} onChangeText={setSold} keyboardType="decimal-pad" placeholder="0,00" />
              </Field>
              <Field label="Cancelados">
                <TextField value={cancelled} onChangeText={setCancelled} keyboardType="decimal-pad" placeholder="0,00" />
              </Field>
              <Field label="Pagado">
                <TextField value={paid} onChangeText={setPaid} keyboardType="decimal-pad" placeholder="0,00" />
              </Field>
              <Feedback error={error} message={message} />
              <PrimaryButton label="Cargar día" onPress={onSave} />
            </View>
          </Card>
        </View>
        <View className={wide ? "w-80" : ""}>
          <Card>
            <Text className="text-sm text-muted">Cálculo del día</Text>
            {preview ? (
              <View className="mt-3">
                <KeyValueList
                  rows={[
                    { label: "Neto", value: <MoneyText cents={preview.netCents} size="lg" /> },
                    { label: "Comisión", value: <MoneyText cents={preview.commissionCents} /> },
                    { label: "A depositar", value: <MoneyText cents={preview.amountToDepositCents} size="lg" tone="navy" /> },
                  ]}
                />
              </View>
            ) : (
              <Text className="mt-3 text-sm text-negative">Revisá los importes. Usá 1234,50.</Text>
            )}
          </Card>
        </View>
      </View>

      <SectionTitle title="Agosto 2026" />
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
        ]}
        rows={days}
        empty="Todavía no hay días cargados."
      />
    </ScreenFrame>
  );
}
