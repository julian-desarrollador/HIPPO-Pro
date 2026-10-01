import { Text, View } from "react-native";

import { formatCents } from "@/modules/ledger";

export function MoneyText({
  cents,
  size = "sm",
  tone = "auto",
  fill = false,
  align = "right",
  serif = false,
}: {
  cents: number;
  size?: "sm" | "md" | "lg" | "xl";
  tone?: "auto" | "ink" | "navy" | "white" | "positive";
  fill?: boolean;
  align?: "left" | "right" | "center";
  serif?: boolean;
}) {
  const negative = cents < 0;
  const color =
    tone === "white" ? "text-white" : tone === "navy" ? "text-navy" : tone === "positive" ? "text-positive" : negative ? "text-negative" : "text-ink";
  const scale =
    size === "xl" ? "text-4xl" : size === "lg" ? "text-[32px]" : size === "md" ? "text-[26px]" : "text-[17px]";
  const alignment = align === "left" ? "text-left" : align === "center" ? "text-center" : "text-right";

  return (
    <Text
      className={`${serif ? "font-serif" : "font-sans"} font-semibold tabular-nums ${scale} ${color} ${alignment}`}
      style={fill ? { width: "100%" } : undefined}>
      {formatCents(cents)}
    </Text>
  );
}

export function StatCard({ label, cents, emphasis }: { label: string; cents: number; emphasis?: boolean }) {
  return (
    <View
      className={`min-w-[160px] flex-1 items-center rounded-[12px] border bg-card p-4 ${emphasis ? "border-accent" : "border-line"}`}>
      <Text className="text-[14px] uppercase text-muted" style={{ letterSpacing: 0.5 }}>
        {label}
      </Text>
      <View className="mt-1 w-full">
        <MoneyText cents={cents} size="md" tone="navy" align="center" fill />
      </View>
    </View>
  );
}
