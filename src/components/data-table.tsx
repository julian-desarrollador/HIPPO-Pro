import { type ReactNode } from "react";
import { ScrollView, Text, useWindowDimensions, View } from "react-native";

import { MoneyText } from "@/components/stat-card";
import { wideLayout } from "@/constants/layout";

export type TableColumn<Row> = {
  key: string;
  header: string;
  align?: "left" | "right";
  compact?: boolean;
  render?: (row: Row) => string;
  cents?: (row: Row) => number;
  node?: (row: Row) => ReactNode;
};

export type TableFooterCell = {
  text?: string;
  cents?: number;
};

export type TableFooter = {
  values: Record<string, TableFooterCell>;
};

export function DataTable<Row extends { id: string }>({
  columns,
  rows,
  footer,
  empty = "Sin movimientos.",
}: {
  columns: readonly TableColumn<Row>[];
  rows: readonly Row[];
  footer?: TableFooter;
  empty?: string;
}) {
  const wide = useWindowDimensions().width >= wideLayout;

  if (rows.length === 0) {
    return <Text className="text-[15px] text-muted">{empty}</Text>;
  }

  if (!wide) {
    const compact = columns.filter((column) => column.compact);
    const visible = compact.length > 0 ? compact : columns.slice(0, 3);
    return (
      <View className="gap-2">
        {rows.map((row) => (
          <View key={row.id} className="rounded-[14px] border border-line bg-card px-4 py-3">
            {visible.map((column) =>
              column.node && !column.header ? (
                <View key={column.key} className="mt-1 flex-row justify-end">
                  {column.node(row)}
                </View>
              ) : (
                <View key={column.key} className="flex-row items-center justify-between gap-3 py-0.5">
                  <Text className="shrink text-[15px] font-semibold uppercase text-muted" numberOfLines={1}>
                    {column.header}
                  </Text>
                  <View className="shrink-0">
                    <Cell column={column} row={row} />
                  </View>
                </View>
              ),
            )}
          </View>
        ))}
        {footer ? (
          <View className="rounded-[14px] border border-line bg-card px-4 py-3">
            {visible.map((column) => (
              <View key={column.key} className="flex-row items-center justify-between gap-3 py-0.5">
                <Text className="shrink text-[15px] font-semibold uppercase text-muted" numberOfLines={1}>
                  {column.header}
                </Text>
                <View className="shrink-0">
                  <FooterCell column={column} footer={footer} />
                </View>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ width: "100%" }} contentContainerStyle={{ flexGrow: 1 }}>
      <View
        className="overflow-hidden rounded-[14px] border border-line bg-card"
        style={{ flexGrow: 1, width: "100%", minWidth: columns.length * 128 }}>
        <View className="flex-row border-b border-line bg-canvas px-3.5 py-2">
          {columns.map((column) => (
            <Text
              key={column.key}
              className={`flex-1 px-1 text-[15px] font-semibold uppercase text-muted ${column.align === "right" ? "text-right" : "text-left"}`}>
              {column.header}
            </Text>
          ))}
        </View>
        {rows.map((row, index) => (
          <View key={row.id} className={`flex-row px-3.5 py-2 ${index < rows.length - 1 ? "border-b border-line" : ""}`}>
            {columns.map((column) => (
              <View key={column.key} className="flex-1 px-1">
                <Cell column={column} row={row} />
              </View>
            ))}
          </View>
        ))}
        {footer ? (
          <View className="flex-row border-t border-line px-3.5 py-2">
            {columns.map((column) => (
              <View key={column.key} className="flex-1 px-1">
                <FooterCell column={column} footer={footer} />
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

function Cell<Row>({ column, row }: { column: TableColumn<Row>; row: Row }) {
  if (column.node) {
    return <View className={column.align === "right" ? "items-end" : "items-start"}>{column.node(row)}</View>;
  }
  if (column.cents) {
    return <MoneyText cents={column.cents(row)} fill />;
  }
  return (
    <Text className={`text-[17px] text-ink ${column.align === "right" ? "text-right" : "text-left"}`}>
      {column.render ? column.render(row) : ""}
    </Text>
  );
}

function FooterCell<Row>({ column, footer }: { column: TableColumn<Row>; footer: TableFooter }) {
  const cell = footer.values[column.key];
  const align = column.align === "right" ? "text-right" : "text-left";
  if (cell?.cents !== undefined) {
    return <MoneyText cents={cell.cents} tone="navy" fill />;
  }
  return (
    <Text className={`text-[17px] font-semibold text-navy tabular-nums ${align}`}>{cell?.text ?? ""}</Text>
  );
}

export function KeyValueList({ rows }: { rows: { label: string; value: ReactNode }[] }) {
  return (
    <View className="gap-2">
      {rows.map((row) => (
        <View key={row.label} className="flex-row items-center justify-between gap-3">
          <Text className="text-[15px] text-muted">{row.label}</Text>
          {row.value}
        </View>
      ))}
    </View>
  );
}
