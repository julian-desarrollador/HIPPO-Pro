import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { ConfirmDialog, Dialog, Feedback, Field, PrimaryButton, TextField } from "@/components/form-controls";
import { useOperatorAdmin, type AgencyOperator } from "@/modules/identity/operator-admin";

export function OperatorsPanel({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const admin = useOperatorAdmin();
  const [operators, setOperators] = useState<AgencyOperator[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<AgencyOperator | null>(null);

  useEffect(() => {
    if (!visible || !admin) {
      return;
    }
    let alive = true;
    setLoading(true);
    setError("");
    void admin
      .list()
      .then((rows) => {
        if (alive) {
          setOperators(rows);
          setLoading(false);
        }
      })
      .catch(() => {
        if (alive) {
          setOperators([]);
          setError("No se pudo cargar la lista.");
          setLoading(false);
        }
      });
    return () => {
      alive = false;
    };
  }, [admin, visible]);

  if (!admin) {
    return null;
  }
  const directory = admin;

  function close() {
    setDisplayName("");
    setEmail("");
    setError("");
    setMessage("");
    setPending(null);
    onClose();
  }

  async function invite() {
    if (busy) {
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    const problem = await directory.invite(displayName, email);
    if (problem) {
      setError(problem);
      setBusy(false);
      return;
    }
    setDisplayName("");
    setEmail("");
    setMessage("Le enviamos un correo para que elija su contraseña.");
    try {
      setOperators(await directory.list());
    } catch {
      setError("No se pudo cargar la lista.");
    }
    setBusy(false);
  }

  async function confirmRemove() {
    if (!pending || busy) {
      return;
    }
    const userId = pending.userId;
    setBusy(true);
    setError("");
    setMessage("");
    const problem = await directory.remove(userId);
    setPending(null);
    if (problem) {
      setError(problem);
      setBusy(false);
      return;
    }
    setOperators((current) => current.filter((operator) => operator.userId !== userId));
    setBusy(false);
  }

  return (
    <>
      <Dialog visible={visible && pending === null} title="Operadores" onClose={close}>
        {loading ? <Text className="text-[17px] text-ink">Cargando…</Text> : null}
        {!loading && operators.length === 0 ? (
          <Text className="text-[17px] text-ink">Todavía no hay operadores.</Text>
        ) : null}
        {operators.map((operator) => (
          <View key={operator.userId} className="flex-row items-center justify-between gap-3">
            <View className="min-w-0 flex-1">
              <Text className="text-[17px] font-semibold text-navy" numberOfLines={1}>
                {operator.displayName || operator.email}
              </Text>
              {operator.email ? (
                <Text className="text-[15px] text-muted" numberOfLines={1}>
                  {operator.email}
                </Text>
              ) : null}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Quitar a ${operator.displayName || operator.email}`}
              onPress={() => setPending(operator)}
              className="cursor-pointer"
            >
              <Text className="text-[17px] font-semibold text-negative">Quitar</Text>
            </Pressable>
          </View>
        ))}
        <Field label="Nombre">
          <TextField
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Nombre"
            accessibilityLabel="Nombre del operador"
          />
        </Field>
        <Field label="Correo">
          <TextField
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            placeholder="correo@agencia.com"
            accessibilityLabel="Correo del operador"
          />
        </Field>
        <Feedback error={error} message={message} />
        <PrimaryButton label={busy ? "Enviando…" : "Invitar"} onPress={() => void invite()} />
      </Dialog>
      <ConfirmDialog
        visible={pending !== null}
        title="¿Quitar este operador?"
        onCancel={() => setPending(null)}
        onConfirm={() => void confirmRemove()}
      />
    </>
  );
}
