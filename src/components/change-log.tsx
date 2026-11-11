import Ionicons from "@expo/vector-icons/Ionicons";
import { Text, useWindowDimensions, View } from "react-native";

import { changeKind, groupByDay, timeLabel, whenLabel, whoLabel, type ChangeEntry } from "@/components/change-log-format";
import { DataTable } from "@/components/data-table";
import { SectionTitle } from "@/components/screen-frame";
import { wideLayout } from "@/constants/layout";
import { usePalette } from "@/constants/palette";

const KIND_ICONS = {
  added: "add-circle",
  removed: "remove-circle",
  edited: "create",
} as const;

/**
 * A Historial. On a computer, the table. On a phone, a list by day: what
 * changed first, then the hour and who did it. Give the entries newest first.
 */
export function ChangeLog({ entries, empty }: { entries: readonly ChangeEntry[]; empty: string }) {
  const wide = useWindowDimensions().width >= wideLayout;
  const palette = usePalette();

  if (wide || entries.length === 0) {
    return (
      <DataTable
        empty={empty}
        columns={[
          { key: "at", header: "Fecha", compact: true, minWidth: 200, render: (row) => whenLabel(row.at) },
          { key: "actor", header: "Quién", compact: true, minWidth: 180, render: (row) => whoLabel(row.actor, row.actorName) },
          { key: "summary", header: "Qué cambió", compact: true, wrap: true, render: (row) => row.summary },
        ]}
        rows={entries.map((entry) => ({ ...entry }))}
      />
    );
  }

  const kindColor = { added: palette.accent, removed: palette.negative, edited: palette.muted };

  return (
    <View className="gap-4">
      {groupByDay(entries).map((day) => (
        <View key={day.key || day.label} className="gap-2">
          <SectionTitle title={day.label} />
          <View className="overflow-hidden rounded-[14px] border border-line bg-card">
            {day.entries.map((entry, index) => {
              const kind = changeKind(entry.summary);
              return (
                <View
                  key={entry.id}
                  className={index === 0 ? "flex-row gap-3 px-4 py-3" : "flex-row gap-3 border-t border-line px-4 py-3"}
                >
                  <View style={{ paddingTop: 2 }}>
                    <Ionicons name={KIND_ICONS[kind]} size={20} color={kindColor[kind]} />
                  </View>
                  <View className="min-w-0 flex-1 gap-1">
                    <Text className="text-[17px] leading-6 text-ink">{entry.summary}</Text>
                    <Text className="text-[15px] text-muted">
                      {timeLabel(entry.at)} · {whoLabel(entry.actor, entry.actorName)}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}
