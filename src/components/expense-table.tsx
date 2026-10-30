import { Pressable, Text } from "react-native";

import { DataTable } from "@/components/data-table";
import { formatIsoDate } from "@/components/format-date";
import { RowActions } from "@/components/form-controls";
import { SectionTitle } from "@/components/screen-frame";
import { MoneyText } from "@/components/stat-card";
import { totalAmounts } from "@/modules/ledger";

export type ExpenseRow = {
  id: string;
  paidOn: string;
  categoryId: string;
  categoryLabel: string;
  detail: string;
  amountCents: number;
};

export function ExpenseTable({
  title,
  total,
  rows,
  onEdit,
  onRemove,
  editable = true,
  photoIds,
  onOpenPhoto,
}: {
  title: string;
  total: number;
  rows: ExpenseRow[];
  onEdit: (row: ExpenseRow) => void;
  onRemove: (id: string) => void;
  editable?: boolean;
  photoIds?: ReadonlySet<string>;
  onOpenPhoto?: (id: string) => void;
}) {
  return (
    <>
      <SectionTitle title={title} trailing={<MoneyText cents={total} size="lg" tone="navy" />} />
      <DataTable
        columns={[
          { key: "date", header: "Fecha", compact: true, render: (row) => formatIsoDate(row.paidOn) },
          { key: "category", header: "Categoría", compact: true, render: (row) => row.categoryLabel },
          { key: "detail", header: "Detalle", render: (row) => row.detail || "—" },
          { key: "amount", header: "Monto", align: "right", compact: true, cents: (row) => row.amountCents },
          ...(editable
            ? [
          ...(photoIds && onOpenPhoto
            ? [
          {
            key: "file",
            header: "Archivo",
            compact: true,
            minWidth: 160,
            padStart: 32,
            node: (row: ExpenseRow) =>
              photoIds.has(row.id) ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Ver imagen"
                  onPress={() => onOpenPhoto(row.id)}
                  className="cursor-pointer"
                >
                  <Text className="text-[17px] font-semibold text-accent">Ver imagen</Text>
                </Pressable>
              ) : null,
          },
            ]
            : []),
          {
            key: "actions",
            header: "",
            compact: true,
            align: "right" as const,
            node: (row: ExpenseRow) => <RowActions onEdit={() => onEdit(row)} onRemove={() => onRemove(row.id)} />,
          },
            ]
            : []),
        ]}
        rows={rows}
        footer={{ values: { date: { text: "Total" }, amount: { cents: totalAmounts(rows) } } }}
      />
    </>
  );
}
