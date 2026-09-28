import { useState } from "react";
import { Text, View } from "react-native";

import { DataTable, KeyValueList } from "@/components/data-table";
import { formatIsoDate } from "@/components/format-date";
import { ChoiceChips, Feedback, Field, PrimaryButton, TextField } from "@/components/form-controls";
import { Card, ScreenFrame, SectionTitle } from "@/components/screen-frame";
import { MoneyText } from "@/components/stat-card";
import { RACETRACKS, ledgerErrorMessage, readAmount, useLedger, type RacetrackId } from "@/modules/ledger";

export default function DepositosScreen() {
  const { snapshot, summary, canViewBalances, recordDeposit } = useLedger();
  const [date, setDate] = useState("2026-08-16");
  const [racetrackId, setRacetrackId] = useState<RacetrackId>("san-isidro");
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const deposits = snapshot.deposits
    .filter((deposit) => deposit.date.startsWith(snapshot.month))
    .slice()
    .sort((left, right) => left.date.localeCompare(right.date) || left.racetrackId.localeCompare(right.racetrackId))
    .map((deposit) => ({
      ...deposit,
      racetrackName: RACETRACKS.find((track) => track.id === deposit.racetrackId)?.name ?? deposit.racetrackId,
    }));

  function onSave() {
    const amountCents = readAmount(amount, false);
    if (amountCents === null) {
      setError("Revisá el importe. Usá 1234,50.");
      setMessage("");
      return;
    }

    try {
      recordDeposit({ date, racetrackId, amountCents });
      setAmount("");
      setError("");
      setMessage("Depósito cargado.");
    } catch (caught) {
      setMessage("");
      setError(ledgerErrorMessage(caught));
    }
  }

  return (
    <ScreenFrame title="Depósitos" subtitle="Lo que la agencia le transfiere a cada hipódromo. Resta del saldo a pagar.">
      {canViewBalances ? (
        summary.racetracks.map((track) => (
          <Card key={track.racetrackId}>
            <Text className="text-lg font-semibold text-ink">{track.name}</Text>
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
          <Field label="Monto">
            <TextField value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0,00" />
          </Field>
          <Feedback error={error} message={message} />
          <PrimaryButton label="Registrar depósito" onPress={onSave} />
        </View>
      </Card>

      <SectionTitle title="Movimientos de agosto" />
      <DataTable
        columns={[
          { key: "date", header: "Fecha", compact: true, render: (row) => formatIsoDate(row.date) },
          { key: "track", header: "Hipódromo", compact: true, render: (row) => row.racetrackName },
          { key: "amount", header: "Monto", align: "right", compact: true, cents: (row) => row.amountCents },
        ]}
        rows={deposits}
      />
    </ScreenFrame>
  );
}
