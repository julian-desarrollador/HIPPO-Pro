import { useState } from "react";
import { Pressable, Text, View } from "react-native";

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
import { ScreenFrame } from "@/components/screen-frame";
import { BettorFolder } from "@/app/cuentas/[bettorId]";
import { bettorHasMovements, ledgerErrorMessage, useLedger } from "@/modules/ledger";

export default function CuentasScreen() {
  const { snapshot, bettorAccounts, addBettor, updateBettor, removeBettor } = useLedger();
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  function openAdd() {
    setEditingId(null);
    setName("");
    setError("");
    setMessage("");
    setFormOpen(true);
  }

  function startEdit(id: string) {
    const bettor = snapshot.bettors?.find((item) => item.id === id);
    if (!bettor) {
      return;
    }
    setManageOpen(false);
    setEditingId(id);
    setName(bettor.name);
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
    setError("");
  }

  async function onSave() {
    if (saving) {
      return;
    }
    if (!name.trim()) {
      setMessage("");
      setError("Escribí el nombre.");
      return;
    }

    setSaving(true);
    setMessage("Guardando…");
    setError("");
    try {
      if (editingId) {
        await updateBettor({ id: editingId, name });
        setMessage("Apostador actualizado.");
      } else {
        await addBettor({ name });
        setMessage("Apostador agregado.");
      }
      setName("");
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
      await removeBettor(id);
      setManageOpen(false);
      setMessage("Apostador quitado.");
      setError("");
    } catch (caught) {
      setMessage("");
      setError(ledgerErrorMessage(caught));
    }
  }

  function openFolder(id: string) {
    setOpenId(id);
  }

  if (openId) {
    return <BettorFolder bettorId={openId} onBack={() => setOpenId(null)} />;
  }

  return (
    <ScreenFrame title="Cuentas corrientes">
      <View className="flex-row flex-wrap items-center gap-4">
        <SecondaryButton className="self-start" label="Agregar apostador" onPress={openAdd} />
        {bettorAccounts.length > 0 ? (
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
      {bettorAccounts.length > 0 ? (
        <Text className="text-[13px] text-muted">Abrí la carpeta para cargar lo que apostó, lo que cobró y los pagos.</Text>
      ) : null}
      <DataTable
        empty="Todavía no hay apostadores cargados."
        columns={[
          {
            key: "name",
            header: "Apostador",
            compact: true,
            node: (row) => (
              <View className="flex-row flex-wrap items-center gap-3">
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel={`Abrir carpeta de ${row.name}`}
                  onPress={() => openFolder(row.id)}
                  className="cursor-pointer">
                  <Text className="text-[15px] font-semibold text-accent">{row.name}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel={`Abrir ${row.name}`}
                  onPress={() => openFolder(row.id)}
                  className="cursor-pointer">
                  <Text className="text-[15px] font-semibold text-accent">Abrir</Text>
                </Pressable>
              </View>
            ),
          },
          { key: "status", header: "Estado", compact: true, render: (row) => row.statusLabel },
          { key: "balance", header: "Saldo", align: "right", compact: true, cents: (row) => row.balanceCents },
        ]}
        rows={bettorAccounts}
      />
      <Dialog visible={formOpen} title={editingId ? "Editar apostador" : "Nuevo apostador"} onClose={closeForm}>
        <Field label="Nombre">
          <TextField value={name} onChangeText={setName} placeholder="Nombre" accessibilityLabel="Nombre del apostador" />
        </Field>
        <Feedback error={error} />
        <PrimaryButton
          label={saving ? "Guardando…" : editingId ? "Guardar" : "Agregar apostador"}
          onPress={() => void onSave()}
        />
        <SecondaryButton label="Cancelar" onPress={closeForm} />
      </Dialog>
      <Dialog visible={manageOpen} title="Apostadores" onClose={() => setManageOpen(false)}>
        {bettorAccounts.map((account) => {
          const inUse = bettorHasMovements(snapshot, account.id);
          return (
            <View key={account.id} className="gap-1">
              <View className="flex-row items-center justify-between gap-3">
                <Text className="flex-1 text-[15px] font-semibold text-navy">{account.name}</Text>
                <RowActions
                  onEdit={() => startEdit(account.id)}
                  onRemove={
                    inUse
                      ? undefined
                      : () => {
                          setManageOpen(false);
                          setPendingRemoveId(account.id);
                        }
                  }
                />
              </View>
              {inUse ? <Text className="text-[13px] text-muted">Tiene días o pagos. Quitá esos movimientos antes.</Text> : null}
            </View>
          );
        })}
        <SecondaryButton label="Cerrar" onPress={() => setManageOpen(false)} />
      </Dialog>
      <ConfirmDialog
        visible={pendingRemoveId !== null}
        title="¿Quitar este apostador?"
        onCancel={() => setPendingRemoveId(null)}
        onConfirm={() => void confirmRemove()}
      />
    </ScreenFrame>
  );
}
