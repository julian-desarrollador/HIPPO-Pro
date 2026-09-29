import { Text, useWindowDimensions, View } from "react-native";

import { DataTable } from "@/components/data-table";
import { SecondaryButton } from "@/components/form-controls";
import { Card, ScreenFrame, SectionTitle } from "@/components/screen-frame";
import { StatCard } from "@/components/stat-card";
import { wideLayout } from "@/constants/layout";
import { useLedger } from "@/modules/ledger";

export default function HomeScreen() {
  const { canViewBalances, summary, reset } = useLedger();
  const wide = useWindowDimensions().width >= wideLayout;

  return (
    <ScreenFrame title="Inicio" subtitle="Agosto 2026 · Agencia Dolores. Ventas, depósitos, gastos y resultado.">
      {canViewBalances ? (
        <>
          <View className={wide ? "flex-row gap-3" : "gap-3"}>
            <StatCard label="Venta total" cents={summary.billingCents} />
            <StatCard label="Ganancia bruta" cents={summary.outflowCents} />
            <StatCard label="Saldo del mes" cents={summary.balanceCents} emphasis />
          </View>
          <SectionTitle title="Por hipódromo" />
          <DataTable
            columns={[
              { key: "name", header: "Hipódromo", compact: true, render: (row) => row.name },
              { key: "net", header: "Neto", align: "right", compact: true, cents: (row) => row.netCents },
              { key: "commission", header: "Comisión", align: "right", compact: true, cents: (row) => row.commissionCents },
              { key: "owed", header: "Saldo a pagar", align: "right", compact: true, cents: (row) => row.owedCents },
            ]}
            rows={summary.racetracks.map((track) => ({ id: track.racetrackId, ...track }))}
          />
        </>
      ) : (
        <Card>
          <Text className="text-base leading-6 text-ink">
            Estás viendo la agencia como operador. Podés cargar el día, los depósitos y los gastos. El resultado queda para el dueño.
          </Text>
        </Card>
      )}
      <SecondaryButton label="Volver a los datos de agosto" onPress={reset} />
    </ScreenFrame>
  );
}
