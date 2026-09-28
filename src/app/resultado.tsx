import { Linking, Text, View } from "react-native";

import { DataTable, KeyValueList } from "@/components/data-table";
import { PrimaryButton } from "@/components/form-controls";
import { Card, ScreenFrame, SectionTitle } from "@/components/screen-frame";
import { MoneyText } from "@/components/stat-card";
import { useLedger } from "@/modules/ledger";

export default function ResultadoScreen() {
  const { canViewBalances, summary, reportText } = useLedger();

  if (!canViewBalances) {
    return (
      <ScreenFrame title="Resultado" subtitle="Agosto 2026 · Agencia Dolores">
        <Card>
          <Text className="text-base leading-6 text-ink">
            El resultado y el saldo de la agencia los ve el dueño. Cambiá a Dueño en la barra de arriba para verlos.
          </Text>
        </Card>
      </ScreenFrame>
    );
  }

  return (
    <ScreenFrame title="Resultado" subtitle="Agosto 2026 · Agencia Dolores. Facturación menos salidas.">
      <View className="rounded-2xl bg-navy p-6">
        <Text className="text-sm text-white">Saldo del mes</Text>
        <View className="mt-2">
          <MoneyText cents={summary.balanceCents} size="xl" tone="white" fill />
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
      <PrimaryButton
        label="Compartir por WhatsApp"
        onPress={() => {
          Linking.openURL(`https://wa.me/?text=${encodeURIComponent(reportText)}`);
        }}
      />
    </ScreenFrame>
  );
}
