import { type ReactNode, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, type TextInputProps, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { palette } from "@/constants/palette";
import { choiceQueryMatchesAny, filterChoiceOptions } from "@/components/choice-filter";

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

const dialogStyles = StyleSheet.create({
  card: {
    width: 420,
    maxWidth: "100%",
    maxHeight: "85%",
    zIndex: 1,
  },
  wideCard: {
    width: "100%",
    maxWidth: 1400,
    maxHeight: "85%",
    zIndex: 1,
  },
});

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View className="gap-1.5">
      <Text className="text-[15px] font-medium text-muted">{label}</Text>
      {children}
    </View>
  );
}

export function TextField(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={palette.placeholder}
      className="rounded-[10px] border border-line bg-card px-3 py-2.5 text-[17px] text-ink"
      {...props}
    />
  );
}

export function ChoiceChips<T extends string>({
  options,
  value,
  onChange,
  searchable = false,
}: {
  options: readonly { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
  searchable?: boolean;
}) {
  const [search, setSearch] = useState("");
  const visible = filterChoiceOptions(options, search, value);
  const hasMatches = choiceQueryMatchesAny(options, search);

  return (
    <View className="w-full gap-1.5">
      {searchable ? (
        <TextField value={search} onChangeText={setSearch} placeholder="Buscar" accessibilityLabel="Buscar categoría" />
      ) : null}
      {searchable && !hasMatches ? <Text className="text-[15px] text-muted">No hay categorías con ese nombre.</Text> : null}
      <View className="w-full flex-row flex-wrap gap-1.5">
        {visible.map((option) => {
          const selected = option.id === value;
          return (
            <Pressable
              key={option.id}
              accessibilityRole="button"
              onPress={() => {
                onChange(option.id);
                setSearch("");
              }}
              className={selected ? "rounded-full border border-accent bg-tint px-3 py-1.5" : "rounded-full border border-line bg-card px-3 py-1.5"}>
              <Text className={selected ? "text-[15px] font-semibold text-navy" : "text-[15px] text-muted"}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function PrimaryButton({ label, onPress, className = "" }: { label: string; onPress: () => void; className?: string }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} className={`cursor-pointer items-center rounded-[10px] bg-accent px-5 py-2.5 ${className}`}>
      <Text className="text-[16px] font-semibold text-white">{label}</Text>
    </Pressable>
  );
}

export function SecondaryButton({ label, onPress, className = "" }: { label: string; onPress: () => void; className?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className={`cursor-pointer items-center rounded-[10px] border border-accent bg-card px-5 py-2.5 ${className}`}>
      <Text className="text-[16px] font-semibold text-accent">{label}</Text>
    </Pressable>
  );
}

export function RowActions({
  onEdit,
  onRemove,
  onImage,
}: {
  onEdit: () => void;
  onRemove?: () => void;
  onImage?: () => void;
}) {
  return (
    <View className="flex-row items-center gap-3">
      {onImage ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Ver imagen" onPress={onImage} className="cursor-pointer">
          <Text className="text-[17px] font-semibold text-accent">Ver imagen</Text>
        </Pressable>
      ) : null}
      <Pressable accessibilityRole="button" accessibilityLabel="Editar" onPress={onEdit} className="cursor-pointer">
        <Text className="text-[17px] font-semibold text-accent">Editar</Text>
      </Pressable>
      {onRemove ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Quitar" onPress={onRemove} className="cursor-pointer">
          <Text className="text-[17px] font-semibold text-negative">Quitar</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function ConfirmDialog({
  visible,
  title = "¿Quitar este movimiento?",
  confirmLabel = "Quitar",
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  title?: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!visible) {
    return null;
  }
  const removing = confirmLabel === "Quitar";

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onCancel}>
      <View style={confirmStyles.frame} pointerEvents="box-none">
        <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" onPress={onCancel} style={confirmStyles.dim} />
        <View className="rounded-[14px] border border-line bg-card p-5" style={confirmStyles.card}>
          <Text className="text-[18px] font-semibold text-navy">{title}</Text>
          <View className="mt-4 gap-2">
            <SecondaryButton label="Cancelar" onPress={onCancel} />
            {removing ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Confirmar quitar"
                onPress={onConfirm}
                className="cursor-pointer items-center rounded-[10px] bg-negative px-5 py-2.5">
                <Text className="text-[16px] font-semibold text-white">Quitar</Text>
              </Pressable>
            ) : (
              <PrimaryButton label={confirmLabel} onPress={onConfirm} />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function Dialog({
  visible,
  title,
  onClose,
  children,
  wide = false,
  contentMaxHeight = 480,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  contentMaxHeight?: number;
}) {
  if (!visible) {
    return null;
  }

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <View style={confirmStyles.frame} pointerEvents="box-none">
        <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" onPress={onClose} style={confirmStyles.dim} />
        <View className="rounded-[14px] border border-line bg-card p-5" style={wide ? dialogStyles.wideCard : dialogStyles.card}>
          <View className="flex-row items-start justify-between gap-3">
            <Text className="min-w-0 flex-1 font-sans text-[24px] font-semibold text-navy">{title}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cerrar"
              onPress={onClose}
              className="h-8 w-8 cursor-pointer items-center justify-center">
              <Ionicons name="close" size={26} color={palette.navy} />
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: contentMaxHeight }}>
            <View className="mt-4 gap-4">{children}</View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export function Feedback({ error, message }: { error?: string; message?: string }) {
  if (error) {
    return <Text className="text-[15px] text-negative">{error}</Text>;
  }
  if (message) {
    return <Text className="text-[15px] text-navy">{message}</Text>;
  }
  return null;
}
