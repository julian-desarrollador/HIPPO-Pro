import { Text, View } from "react-native";

import { formatCents } from "@/modules/ledger";

export function MoneyText({
  cents,
  size = "sm",
  tone = "auto",
  fill = false,
}: {
  cents: number;
  size?: "sm" | "lg" | "xl";
  tone?: "auto" | "ink" | "navy" | "white";
  fill?: boolean;
}) {
  const negative = cents < 0;
  const color =
    tone === "white" ? "text-white" : tone === "navy" ? "text-navy" : negative ? "text-negative" : "text-ink";
  const scale = size === "xl" ? "text-4xl" : size === "lg" ? "text-2xl" : "text-sm";

  return (
    <Text
      className={`text-right font-semibold tabular-nums ${scale} ${color}`}
      style={fill ? { width: "100%" } : undefined}>
      {formatCents(cents)}
    </Text>
  );
}

export function StatCard({ label, cents, emphasis }: { label: string; cents: number; emphasis?: boolean }) {
  return (
    <View className={`min-w-[180px] flex-1 rounded-2xl border bg-card p-4 ${emphasis ? "border-navy" : "border-line"}`}>
      <Text className="text-sm text-muted">{label}</Text>
      <View className="mt-2">
        <MoneyText cents={cents} size="lg" tone={emphasis ? "navy" : "auto"} />
      </View>
    </View>
  );
}
