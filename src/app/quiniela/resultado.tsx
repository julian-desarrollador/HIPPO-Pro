import { Text, View } from "react-native";

import { KeyValueList } from "@/components/data-table";
import { LotteryGate } from "@/components/lottery-gate";
import { Card, ScreenFrame } from "@/components/screen-frame";
import { MoneyText } from "@/components/stat-card";
import { useLedger, useLottery } from "@/modules/ledger";

export default function LotteryResultScreen() {
  return (
    <LotteryGate title="Resultado">
      <LotteryResult />
    </LotteryGate>
  );
}

function LotteryResult() {
  const { canViewBalances } = useLedger();
  const { account } = useLottery();

  if (!canViewBalances || !account) {
    return (
      <ScreenFrame title="Resultado">
        <Card>
          <Text className="text-base leading-6 text-ink">El resultado de la agencia lo ve el dueño.</Text>
        </Card>
      </ScreenFrame>
    );
  }

  return (
    <ScreenFrame title="Resultado">
      <View className="items-center rounded-[14px] border border-line bg-card p-6">
        <Text className="text-[14px] uppercase text-muted" style={{ letterSpacing: 0.5 }}>
          Saldo del mes
        </Text>
        <View className="mt-2 w-full">
          <MoneyText cents={account.balanceCents} size="md" tone="navy" align="center" fill />
        </View>
      </View>
      <Card>
        <View className="mt-1">
          <KeyValueList
            rows={[
              { label: "Ganancia", value: <MoneyText cents={account.commissionCents} /> },
              { label: "Gastos", value: <MoneyText cents={account.agencyExpenseCents} /> },
              { label: "Retiros", value: <MoneyText cents={account.partnerWithdrawalCents} /> },
              { label: "Saldo del mes", value: <MoneyText cents={account.balanceCents} tone="navy" /> },
            ]}
          />
        </View>
      </Card>
    </ScreenFrame>
  );
}
