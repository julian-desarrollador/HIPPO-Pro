import { useState } from "react";
import { Text, useWindowDimensions, View } from "react-native";

import { DataTable } from "@/components/data-table";
import {
  ConfirmDialog,
  Dialog,
  Feedback,
  Field,
  PrimaryButton,
  RowActions,
  SecondaryButton,
  TextField,
} from "@/components/form-controls";
import { Card, ScreenFrame, SectionTitle } from "@/components/screen-frame";
import { StatCard } from "@/components/stat-card";
import { wideLayout } from "@/constants/layout";
import {
  currentCommissionBasisPoints,
  formatPercentInput,
  ledgerErrorMessage,
  parsePercentToBasisPoints,
  racetrackHasMovements,
  useLedger,
} from "@/modules/ledger";

export default function HomeScreen() {
  const { canViewBalances, summary, reset, persistence, snapshot, racetracks, addRacetrack, updateRacetrack, removeRacetrack } = useLedger();
  const wide = useWindowDimensions().width >= wideLayout;
  const [name, setName] = useState("");
  const [commission, setCommission] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);
  const [blockedRemove, setBlockedRemove] = useState(false);

  const rows = summary.racetracks.map((track) => ({
    id: track.racetrackId,
    ...track,
  }));

  function openAdd() {
    setEditingId(null);
    setName("");
    setCommission("");
    setError("");
    setMessage("");
    setFormOpen(true);
  }

  function startEdit(id: string) {
    const track = racetracks.find((item) => item.id === id);
    if (!track) {
      return;
    }
    setManageOpen(false);
    setEditingId(id);
    setName(track.name);
    setCommission(formatPercentInput(currentCommissionBasisPoints(id, snapshot.commissions, snapshot)));
    setError("");
    setMessage("");
    setFormOpen(true);
  }

  function closeForm() {
    if (saving) {
      return;
    }
    setFormOpen(false);
    setEditingId(null);
    setName("");
    setCommission("");
    setError("");
  }

  async function onSave() {
    if (saving) {
      return;
    }
    const commissionBasisPoints = parsePercentToBasisPoints(commission);
    const existing = editingId ? racetracks.find((item) => item.id === editingId) : null;
    const depositAdjustmentBasisPoints = existing?.depositAdjustmentBasisPoints ?? 0;
    if (!name.trim()) {
      setMessage("");
      setError("Escribí el nombre del hipódromo.");
      return;
    }
    if (commissionBasisPoints === null) {
      setMessage("");
      setError("El porcentaje tiene que estar entre 0 y 100.");
      return;
    }
    setSaving(true);
    setMessage("Guardando…");
    setError("");
    try {
      if (editingId) {
        await updateRacetrack({ id: editingId, name, commissionBasisPoints, depositAdjustmentBasisPoints });
        setMessage("Hipódromo actualizado.");
      } else {
        await addRacetrack({ name, commissionBasisPoints, depositAdjustmentBasisPoints });
        setMessage("Hipódromo agregado.");
      }
      setName("");
      setCommission("");
      setEditingId(null);
      setFormOpen(false);
    } catch (caught) {
      setMessage("");
      setError(ledgerErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  async function confirmRemove() {
    if (!pendingRemoveId) {
      return;
    }
    const id = pendingRemoveId;
    setPendingRemoveId(null);
    try {
      await removeRacetrack(id);
      setManageOpen(false);
      setMessage("Hipódromo quitado.");
      setError("");
    } catch (caught) {
      setMessage("");
      setError(ledgerErrorMessage(caught));
    }
  }

  return (
    <ScreenFrame title="Inicio">
      <Card>
        <Text className="font-sans text-[24px] font-semibold text-navy">Bienvenido a HippoPro</Text>
      </Card>
      {canViewBalances ? (
        <>
          <View className={wide ? "flex-row flex-wrap gap-4" : "gap-4"}>
            <StatCard label="Venta neta" cents={summary.netCents} />
            <StatCard label="Comisión" cents={summary.billingCents} />
            <StatCard label="Total a pagar a los hipódromos" cents={summary.owedCents} emphasis />
          </View>
          <SectionTitle title="Por hipódromo" />
          <DataTable
            columns={[
              { key: "name", header: "Hipódromo", compact: true, render: (row) => row.name },
              { key: "meetings", header: "Reuniones", align: "right", compact: true, render: (row) => String(row.meetingCount) },
              { key: "net", header: "Venta neta", align: "right", compact: true, cents: (row) => row.netCents },
              { key: "commission", header: "Comisión", align: "right", compact: true, cents: (row) => row.commissionCents },
              { key: "owed", header: "Saldo a pagar", align: "right", compact: true, cents: (row) => row.owedCents },
            ]}
            rows={rows}
            footer={{
              values: {
                name: { text: "Total" },
                meetings: { text: String(summary.meetingCount) },
                net: { cents: summary.netCents },
                commission: { cents: summary.billingCents },
                owed: { cents: summary.owedCents },
              },
            }}
          />
          <View className="flex-row flex-wrap items-center gap-4">
            <SecondaryButton className="self-start" label="Agregar hipódromo" onPress={openAdd} />
            {racetracks.length > 0 ? (
              <SecondaryButton
                className="self-start"
                label="Editar o quitar"
                onPress={() => {
                  setError("");
                  setMessage("");
                  setManageOpen(true);
                }}
              />
            ) : null}
          </View>
          <Feedback error={formOpen || manageOpen ? "" : error} message={message} />
          <Dialog visible={formOpen} title={editingId ? "Editar hipódromo" : "Nuevo hipódromo"} onClose={closeForm}>
            <Field label="Nombre">
              <TextField value={name} onChangeText={setName} placeholder="Nombre" accessibilityLabel="Nombre del hipódromo" />
            </Field>
            <Field label="Comisión">
              <TextField
                value={commission}
                onChangeText={setCommission}
                keyboardType="decimal-pad"
                placeholder="15"
                accessibilityLabel="Comisión del hipódromo"
              />
            </Field>
            <Text className="text-[15px] leading-5 text-muted">
              Vale para los días que se carguen después. Los ya cargados conservan su porcentaje.
            </Text>
            <Feedback error={error} />
            <PrimaryButton
              label={saving ? "Guardando…" : editingId ? "Guardar" : "Agregar hipódromo"}
              onPress={() => void onSave()}
            />
            <SecondaryButton label="Cancelar" onPress={closeForm} />
          </Dialog>
          <Dialog visible={manageOpen} title="Hipódromos" onClose={() => setManageOpen(false)}>
            {racetracks.map((track) => {
              const inUse = racetrackHasMovements(snapshot, track.id);
              return (
                <View key={track.id} className="flex-row items-center justify-between gap-3">
                  <Text className="flex-1 text-[17px] font-semibold text-navy">{track.name}</Text>
                  <RowActions
                    onEdit={() => startEdit(track.id)}
                    onRemove={() => {
                      if (inUse) {
                        setBlockedRemove(true);
                        return;
                      }
                      setManageOpen(false);
                      setPendingRemoveId(track.id);
                    }}
                  />
                </View>
              );
            })}
            <SecondaryButton label="Cerrar" onPress={() => setManageOpen(false)} />
          </Dialog>
          <Dialog visible={blockedRemove} title="No se puede quitar" onClose={() => setBlockedRemove(false)}>
            <Text className="text-base leading-6 text-ink">Tiene días o depósitos. Quitá esos movimientos antes.</Text>
            <SecondaryButton label="Entendido" onPress={() => setBlockedRemove(false)} />
          </Dialog>
          <ConfirmDialog
            visible={pendingRemoveId !== null}
            title="¿Quitar este hipódromo?"
            onCancel={() => setPendingRemoveId(null)}
            onConfirm={() => void confirmRemove()}
          />
        </>
      ) : (
        <Card>
          <Text className="text-base leading-6 text-ink">
            Estás viendo la agencia como operador. Podés cargar el día, los depósitos, los gastos y las cuentas corrientes. El resultado queda para el dueño.
          </Text>
        </Card>
      )}
      {persistence === "browser" ? <SecondaryButton label="Volver a los datos de agosto" onPress={() => void reset()} /> : null}
    </ScreenFrame>
  );
}
