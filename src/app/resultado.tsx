import { useEffect, useState } from "react";
import { Linking, Text, View } from "react-native";

import { DataTable, KeyValueList } from "@/components/data-table";
import { Field, PrimaryButton, SecondaryButton, TextField } from "@/components/form-controls";
import { Card, ScreenFrame, SectionTitle } from "@/components/screen-frame";
import { MoneyText } from "@/components/stat-card";
import {
  RACETRACKS,
  currentCommissionBasisPoints,
  formatPercentInput,
  ledgerErrorMessage,
  parsePercentToBasisPoints,
  useLedger,
  type RacetrackId,
} from "@/modules/ledger";

export default function ResultadoScreen() {
  const { canViewBalances, summary, reportText } = useLedger();

  if (!canViewBalances) {
    return (
      <ScreenFrame title="Resultado">
        <Card>
          <Text className="text-base leading-6 text-ink">
            El resultado y el saldo de la agencia los ve el dueño. Cambiá a Dueño para verlos.
          </Text>
        </Card>
      </ScreenFrame>
    );
  }

  return (
    <ScreenFrame title="Resultado">
      <View className="items-center rounded-[14px] border border-line bg-card p-6">
        <Text className="text-[12px] uppercase text-muted" style={{ letterSpacing: 0.5 }}>
          Saldo del mes
        </Text>
        <View className="mt-2 w-full">
          <MoneyText cents={summary.balanceCents} size="md" tone="navy" align="center" fill />
        </View>
      </View>
      <Card>
        <KeyValueList
          rows={[
            { label: "Facturación", value: <MoneyText cents={summary.billingCents} /> },
            { label: "Gastos de la agencia", value: <MoneyText cents={summary.agencyExpenseCents} /> },
            { label: "Adelantos y retiros", value: <MoneyText cents={summary.partnerWithdrawalCents} /> },
            { label: "Salidas", value: <MoneyText cents={summary.outflowCents} /> },
          ]}
        />
      </Card>
      <SectionTitle title="Comisión por hipódromo" />
      <DataTable
        columns={[
          { key: "name", header: "Hipódromo", compact: true, render: (row) => row.name },
          { key: "commission", header: "Comisión", align: "right", compact: true, cents: (row) => row.commissionCents },
        ]}
        rows={summary.racetracks.map((track) => ({ id: track.racetrackId, name: track.name, commissionCents: track.commissionCents }))}
      />
      <CommissionCard />
      <PrimaryButton
        label="Compartir por WhatsApp"
        onPress={() => {
          Linking.openURL(`https://wa.me/?text=${encodeURIComponent(reportText)}`);
        }}
      />
    </ScreenFrame>
  );
}

function commissionDrafts(commissions: ReturnType<typeof useLedger>["snapshot"]["commissions"]): Record<RacetrackId, string> {
  return {
    "san-isidro": formatPercentInput(currentCommissionBasisPoints("san-isidro", commissions)),
    palermo: formatPercentInput(currentCommissionBasisPoints("palermo", commissions)),
    "la-plata": formatPercentInput(currentCommissionBasisPoints("la-plata", commissions)),
  };
}

function CommissionCard() {
  const { snapshot, updateCommission } = useLedger();
  const [drafts, setDrafts] = useState(() => commissionDrafts(snapshot.commissions));
  const [savedId, setSavedId] = useState<RacetrackId | null>(null);
  const [savedLabel, setSavedLabel] = useState("");
  const [errorId, setErrorId] = useState<RacetrackId | null>(null);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState<RacetrackId | null>(null);
  const saved = RACETRACKS.map((track) => currentCommissionBasisPoints(track.id, snapshot.commissions)).join(",");

  useEffect(() => {
    setDrafts(commissionDrafts(snapshot.commissions));
  }, [saved, snapshot.commissions]);

  function editDraft(racetrackId: RacetrackId, value: string) {
    setDrafts((current) => ({ ...current, [racetrackId]: value }));
    if (savedId === racetrackId) {
      setSavedId(null);
    }
    if (errorId === racetrackId) {
      setErrorId(null);
      setError("");
    }
  }

  async function save(racetrackId: RacetrackId) {
    if (savingId) {
      return;
    }
    const basisPoints = parsePercentToBasisPoints(drafts[racetrackId]);
    if (basisPoints === null) {
      setSavedId(null);
      setErrorId(racetrackId);
      setError("El porcentaje tiene que estar entre 0 y 100.");
      return;
    }

    setSavingId(racetrackId);
    setSavedId(null);
    setErrorId(null);
    setError("");
    try {
      await updateCommission(racetrackId, basisPoints);
      setSavedId(racetrackId);
      setSavedLabel(formatPercentInput(basisPoints));
    } catch (caught) {
      setSavedId(null);
      setErrorId(racetrackId);
      setError(ledgerErrorMessage(caught));
    } finally {
      setSavingId(null);
    }
  }

  return (
    <Card>
      <Text className="font-sans text-[22px] font-semibold text-navy">Comisión</Text>
      <Text className="mt-1 text-[13px] text-muted">
        Vale para los días que se carguen después. Los ya cargados conservan su porcentaje.
      </Text>
      <View className="mt-4 gap-4">
        {RACETRACKS.map((track) => {
          const justSaved = savedId === track.id;
          return (
            <View key={track.id} className="gap-2">
              <Field label={track.name}>
                <View className="flex-row items-center gap-2">
                  <View className="flex-1">
                    <TextField
                      value={drafts[track.id]}
                      onChangeText={(value) => editDraft(track.id, value)}
                      keyboardType="decimal-pad"
                      placeholder="0"
                      accessibilityLabel={`Comisión de ${track.name}`}
                    />
                  </View>
                  <View className="w-32">
                    {savingId === track.id ? (
                      <PrimaryButton className="w-full" label="Guardando…" onPress={() => undefined} />
                    ) : justSaved ? (
                      <SecondaryButton className="w-full" label="Guardado" onPress={() => void save(track.id)} />
                    ) : (
                      <PrimaryButton className="w-full" label="Guardar" onPress={() => void save(track.id)} />
                    )}
                  </View>
                </View>
              </Field>
              {justSaved ? (
                <View className="rounded-[10px] bg-tint px-3 py-2">
                  <Text className="text-[14px] font-semibold text-navy">
                    {track.name} quedó en {savedLabel} %
                  </Text>
                  <Text className="mt-0.5 text-[13px] text-ink">Vale para los días que se carguen después.</Text>
                </View>
              ) : null}
              {errorId === track.id ? <Text className="text-[13px] text-negative">{error}</Text> : null}
            </View>
          );
        })}
      </View>
    </Card>
  );
}
