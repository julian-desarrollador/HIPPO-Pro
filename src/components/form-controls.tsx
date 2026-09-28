import { type ReactNode } from "react";
import { Pressable, ScrollView, Text, TextInput, type TextInputProps, View } from "react-native";

import { palette } from "@/constants/palette";

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View className="gap-1.5">
      <Text className="text-sm text-muted">{label}</Text>
      {children}
    </View>
  );
}

export function TextField(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={palette.placeholder}
      className="rounded-xl border border-line bg-card px-4 py-3 text-base text-ink"
      {...props}
    />
  );
}

export function ChoiceChips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {options.map((option) => {
        const selected = option.id === value;
        return (
          <Pressable
            key={option.id}
            accessibilityRole="button"
            onPress={() => onChange(option.id)}
            className={selected ? "rounded-full bg-tint px-4 py-2" : "rounded-full border border-line bg-card px-4 py-2"}>
            <Text className={selected ? "text-sm font-semibold text-navy" : "text-sm text-muted"}>{option.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function PrimaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} className="items-center rounded-xl bg-navy px-5 py-3">
      <Text className="text-base font-semibold text-white">{label}</Text>
    </Pressable>
  );
}

export function SecondaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="items-center rounded-xl border border-navy bg-card px-5 py-3">
      <Text className="text-base font-semibold text-navy">{label}</Text>
    </Pressable>
  );
}

export function Feedback({ error, message }: { error?: string; message?: string }) {
  if (error) {
    return <Text className="text-sm text-negative">{error}</Text>;
  }
  if (message) {
    return <Text className="text-sm text-navy">{message}</Text>;
  }
  return null;
}
