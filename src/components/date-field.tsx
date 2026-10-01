import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { buildMonthGrid, monthTitle, shiftMonth, WEEKDAYS } from "@/components/calendar-grid";
import { formatIsoDate } from "@/components/format-date";
import { palette } from "@/constants/palette";

export function DateField({
  value,
  onChange,
}: {
  value: string;
  onChange: (iso: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(value.slice(0, 7));

  useEffect(() => {
    if (open) {
      setVisibleMonth(value.slice(0, 7));
    }
  }, [open, value]);

  const cells = buildMonthGrid(visibleMonth);

  function pick(iso: string) {
    onChange(iso);
    setOpen(false);
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Fecha ${formatIsoDate(value)}`}
        accessibilityHint="Abre el calendario"
        onPress={() => setOpen(true)}
        className="cursor-pointer flex-row items-center justify-between rounded-[10px] border border-line bg-card px-3 py-2.5">
        <Text pointerEvents="none" className="text-[17px] text-ink">
          {formatIsoDate(value)}
        </Text>
        <View pointerEvents="none">
          <Ionicons name="calendar" size={20} color={palette.navy} />
        </View>
      </Pressable>
      <Modal transparent animationType="fade" visible={open} onRequestClose={() => setOpen(false)}>
        <View style={styles.frame} pointerEvents="box-none">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cerrar calendario"
            onPress={() => setOpen(false)}
            style={styles.dim}
          />
          <View className="rounded-[14px] border border-line bg-card p-5" pointerEvents="auto" style={styles.card}>
            <View className="flex-row items-center justify-between">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Mes anterior"
                onPress={() => setVisibleMonth(shiftMonth(visibleMonth, -1))}
                className="h-10 w-10 cursor-pointer items-center justify-center">
                <Ionicons name="chevron-back" size={22} color={palette.accent} />
              </Pressable>
              <Text className="text-[17px] font-semibold text-navy">{monthTitle(visibleMonth)}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Mes siguiente"
                onPress={() => setVisibleMonth(shiftMonth(visibleMonth, 1))}
                className="h-10 w-10 cursor-pointer items-center justify-center">
                <Ionicons name="chevron-forward" size={22} color={palette.accent} />
              </Pressable>
            </View>
            <View className="mt-4 flex-row">
              {WEEKDAYS.map((label, index) => (
                <Text key={index} className="flex-1 text-center text-[14px] font-semibold uppercase text-muted">
                  {label}
                </Text>
              ))}
            </View>
            <View className="mt-2">
              {Array.from({ length: 6 }, (_, week) => (
                <View key={week} className="flex-row">
                  {cells.slice(week * 7, week * 7 + 7).map((cell) => {
                    const selected = cell.iso === value;
                    return (
                      <Pressable
                        key={cell.iso}
                        accessibilityRole="button"
                        accessibilityLabel={formatIsoDate(cell.iso)}
                        accessibilityState={{ selected }}
                        onPress={() => pick(cell.iso)}
                        className="h-10 flex-1 items-center justify-center">
                        <View className={`h-9 w-9 items-center justify-center rounded-full ${selected ? "bg-accent" : ""}`}>
                          <Text
                            className={`text-[17px] ${
                              selected ? "font-semibold text-white" : cell.inMonth ? "text-ink" : "text-muted"
                            }`}>
                            {cell.day}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cerrar"
              onPress={() => setOpen(false)}
              className="mt-4 cursor-pointer items-center py-2">
              <Text className="text-[16px] font-semibold text-accent">Cerrar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
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
