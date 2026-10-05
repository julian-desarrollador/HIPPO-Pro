import { type ReactNode, type RefObject, useEffect, useRef } from "react";
import { Platform, Text, useWindowDimensions, View, type TextStyle, type ViewStyle } from "react-native";

import { MoneyText } from "@/components/stat-card";
import { wideLayout } from "@/constants/layout";

export type TableColumn<Row> = {
  key: string;
  header: string;
  align?: "left" | "right";
  compact?: boolean;
  /** The cell uses as many lines as the text needs. */
  wrap?: boolean;
  /** Width the column does not go under. On a single-line column it also stays at that width. */
  minWidth?: number;
  /** Extra space before the header and the cell, on the wide table. */
  padStart?: number;
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
  const scroller = useRef<View>(null);
  useHorizontalWheel(scroller, wide && rows.length > 0);

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
                <View
                  key={column.key}
                  className={`flex-row justify-between gap-3 py-0.5 ${column.wrap ? "items-start" : "items-center"}`}
                >
                  <Text className="shrink text-[15px] font-semibold uppercase text-muted" numberOfLines={1}>
                    {column.header}
                  </Text>
                  <View className={column.wrap ? "min-w-0 flex-1" : "shrink-0"}>
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
    <View ref={scroller} className="table-scroll" style={tableScroll}>
      <View className="overflow-hidden rounded-[14px] border border-line bg-card" style={{ width: tableWidth(columns), minWidth: "100%" }}>
        <View className="flex-row border-b border-line bg-canvas px-3.5 py-2" style={tableRow}>
          {columns.map((column) => (
            <View key={column.key} className="px-1" style={columnBox(column)}>
              <Text numberOfLines={1} style={columnText(column)} className="text-[15px] font-semibold uppercase text-muted">
                {column.header}
              </Text>
            </View>
          ))}
        </View>
        {rows.map((row, index) => (
          <View key={row.id} className={`flex-row px-3.5 py-2 ${index < rows.length - 1 ? "border-b border-line" : ""}`} style={tableRow}>
            {columns.map((column) => (
              <View key={column.key} className="px-1" style={columnBox(column)}>
                <Cell column={column} row={row} />
              </View>
            ))}
          </View>
        ))}
        {footer ? (
          <View className="flex-row border-t border-line px-3.5 py-2" style={tableRow}>
            {columns.map((column) => (
              <View key={column.key} className="px-1" style={columnBox(column)}>
                <FooterCell column={column} footer={footer} />
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const tableScroll: ViewStyle = { width: "100%", maxWidth: "100%", minWidth: 0, overflowX: "auto" };

function useHorizontalWheel(scroller: RefObject<View | null>, enabled: boolean) {
  useEffect(() => {
    if (!enabled || Platform.OS !== "web") {
      return;
    }
    const node = scroller.current as unknown as HTMLElement | null;
    if (!node?.addEventListener) {
      return;
    }
    const onWheel = (event: WheelEvent) => {
      if (node.scrollWidth <= node.clientWidth + 1) {
        return;
      }
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
        return;
      }
      const line = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? node.clientWidth : 1;
      node.scrollLeft += event.deltaY * line;
      event.preventDefault();
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [enabled, scroller]);
}
const tableRow: ViewStyle = { width: "100%" };

function columnMinWidth<Row>(column: TableColumn<Row>): number {
  if (column.node) {
    return 148;
  }
  if (column.cents) {
    return 168;
  }
  return 120;
}

function columnPad<Row>(column: TableColumn<Row>): number {
  return column.padStart ?? 0;
}

function columnFloor<Row>(column: TableColumn<Row>): number {
  if (column.wrap) {
    return 200 + columnPad(column);
  }
  return (column.minWidth ?? columnMinWidth(column)) + columnPad(column);
}

function columnBox<Row>(column: TableColumn<Row>): ViewStyle {
  const fixed = column.minWidth !== undefined && !column.wrap;
  const pad = columnPad(column);
  return {
    flexGrow: fixed ? 0 : 1,
    flexShrink: fixed ? 0 : 1,
    flexBasis: fixed ? (column.minWidth ?? 0) + pad : 0,
    minWidth: columnFloor(column),
    paddingLeft: pad,
    overflow: column.wrap ? "visible" : "hidden",
  };
}

function columnText<Row>(column: TableColumn<Row>): TextStyle {
  return { width: "100%", textAlign: column.align === "right" ? "right" : "left" };
}

function tableWidth<Row>(columns: readonly TableColumn<Row>[]): number {
  return columns.reduce((total, column) => total + columnFloor(column) + 8, 28);
}

function Cell<Row>({ column, row }: { column: TableColumn<Row>; row: Row }) {
  if (column.node) {
    return <View className={column.align === "right" ? "items-end" : "items-start"}>{column.node(row)}</View>;
  }
  if (column.cents) {
    return <MoneyText cents={column.cents(row)} fill />;
  }
    return (
    <Text
      numberOfLines={column.wrap ? undefined : 1}
      style={columnText(column)}
      className="text-[17px] text-ink"
    >
      {column.render ? column.render(row) : ""}
    </Text>
  );
}

function FooterCell<Row>({ column, footer }: { column: TableColumn<Row>; footer: TableFooter }) {
  const cell = footer.values[column.key];
  if (cell?.cents !== undefined) {
    return <MoneyText cents={cell.cents} tone="navy" fill />;
  }
  return (
    <Text numberOfLines={1} style={columnText(column)} className="text-[17px] font-semibold text-navy tabular-nums">
      {cell?.text ?? ""}
    </Text>
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
