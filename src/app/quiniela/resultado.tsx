import { Text, useWindowDimensions, View } from "react-native";

import { KeyValueList } from "@/components/data-table";
import { LotteryGate } from "@/components/lottery-gate";
import { Card, ScreenFrame } from "@/components/screen-frame";
import { MoneyText } from "@/components/stat-card";
import { wideLayout } from "@/constants/layout";
import { useLedger, useLottery, type BusinessMonth } from "@/modules/ledger";

export default function LotteryResultScreen() {
  return (
    <LotteryGate title="Resultado de la agencia">
      <LotteryResult />
    </LotteryGate>
  );
}

function LotteryResult() {
  const { canViewBalances, agencyMode } = useLedger();
  const { agencyMonth } = useLottery();
  const wide = useWindowDimensions().width >= wideLayout;
  const lotteryOnly = agencyMode === "lottery";

  if (!canViewBalances || !agencyMonth) {
    return (
      <ScreenFrame title="Resultado de la agencia">
        <Card>
          <Text className="text-base leading-6 text-ink">El resultado de la agencia lo ve el dueño.</Text>
        </Card>
      </ScreenFrame>
    );
  }

  return (
    <ScreenFrame title="Resultado de la agencia">
      <View className="items-center rounded-[14px] border border-line bg-card p-6">
        <Text className="text-[14px] uppercase text-muted" style={{ letterSpacing: 0.5 }}>
          Saldo del mes de la agencia
        </Text>
        <View className="mt-2 w-full">
          <MoneyText cents={lotteryOnly ? agencyMonth.lottery.balanceCents : agencyMonth.total.balanceCents} size="md" tone="navy" align="center" fill />
        </View>
      </View>
      <View className={wide && !lotteryOnly ? "flex-row items-start gap-4" : "gap-4"}>
        <BusinessCard title="Quiniela" month={agencyMonth.lottery} />
        {lotteryOnly ? null : <BusinessCard title="Hípica" month={agencyMonth.racing} />}
        {lotteryOnly ? null : <BusinessCard title="Total" month={agencyMonth.total} />}
      </View>
    </ScreenFrame>
  );
}

function BusinessCard({ title, month }: { title: string; month: BusinessMonth }) {
  return (
    <View className="min-w-0 flex-1">
      <Card>
        <Text className="font-sans text-[24px] font-semibold text-navy">{title}</Text>
        <View className="mt-3">
          <KeyValueList
            rows={[
              { label: "Ganancia", value: <MoneyText cents={month.earningsCents} /> },
              { label: "Gastos", value: <MoneyText cents={month.agencyExpenseCents} /> },
              { label: "Retiros", value: <MoneyText cents={month.partnerWithdrawalCents} /> },
              { label: "Saldo del mes", value: <MoneyText cents={month.balanceCents} tone="navy" /> },
            ]}
          />
        </View>
      </Card>
    </View>
  );
}
