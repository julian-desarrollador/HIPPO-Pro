import { type ReactNode } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, type TextInputProps, View } from "react-native";

import { palette } from "@/constants/palette";

const confirmStyles = StyleSheet.create({
  frame: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  dim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: palette.navy,
    opacity: 0.4,
  },
  card: {
    width: 320,
    maxWidth: "100%",
    zIndex: 1,
  },
});

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View className="gap-1.5">
      <Text className="text-[13px] font-medium text-muted">{label}</Text>
      {children}
    </View>
  );
}

export function TextField(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={palette.placeholder}
      className="rounded-[10px] border border-line bg-card px-3 py-2.5 text-[15px] text-ink"
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
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
      {options.map((option) => {
        const selected = option.id === value;
        return (
          <Pressable
            key={option.id}
            accessibilityRole="button"
            onPress={() => onChange(option.id)}
            className={selected ? "rounded-full bg-tint px-3 py-1.5" : "rounded-full border border-line bg-card px-3 py-1.5"}>
            <Text className={selected ? "text-[13px] font-semibold text-navy" : "text-[13px] text-muted"}>{option.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function PrimaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} className="cursor-pointer items-center rounded-[10px] bg-navy px-5 py-2.5">
      <Text className="text-[14px] font-semibold text-white">{label}</Text>
    </Pressable>
  );
}

export function SecondaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="cursor-pointer items-center rounded-[10px] border border-navy bg-card px-5 py-2.5">
      <Text className="text-[14px] font-semibold text-navy">{label}</Text>
    </Pressable>
  );
}

export function RowActions({ onEdit, onRemove }: { onEdit: () => void; onRemove: () => void }) {
  return (
    <View className="flex-row items-center gap-3">
      <Pressable accessibilityRole="button" accessibilityLabel="Editar" onPress={onEdit} className="cursor-pointer">
        <Text className="text-[15px] font-semibold text-navy">Editar</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Quitar" onPress={onRemove} className="cursor-pointer">
        <Text className="text-[15px] font-semibold text-negative">Quitar</Text>
      </Pressable>
    </View>
  );
}

export function ConfirmDialog({
  visible,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!visible) {
    return null;
  }

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onCancel}>
      <View style={confirmStyles.frame} pointerEvents="box-none">
        <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" onPress={onCancel} style={confirmStyles.dim} />
        <View className="rounded-[14px] border border-line bg-card p-5" style={confirmStyles.card}>
          <Text className="text-[16px] font-semibold text-navy">¿Quitar este movimiento?</Text>
          <View className="mt-4 gap-2">
            <SecondaryButton label="Cancelar" onPress={onCancel} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Confirmar quitar"
              onPress={onConfirm}
              className="cursor-pointer items-center rounded-[10px] bg-negative px-5 py-2.5">
              <Text className="text-[14px] font-semibold text-white">Quitar</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function Feedback({ error, message }: { error?: string; message?: string }) {
  if (error) {
    return <Text className="text-[13px] text-negative">{error}</Text>;
  }
  if (message) {
    return <Text className="text-[13px] text-navy">{message}</Text>;
  }
  return null;
}
