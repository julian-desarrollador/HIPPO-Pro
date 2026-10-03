import { useEffect, useState } from "react";
import { Text, useWindowDimensions, View } from "react-native";

import { Dialog, Feedback, Field, PrimaryButton, TextField } from "@/components/form-controls";
import { SectionTitle } from "@/components/screen-frame";
import { wideLayout } from "@/constants/layout";
import { useAgencyAdmin, type AgencyEntry } from "@/modules/identity/agency-admin";

export function AgenciesPanel({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const admin = useAgencyAdmin();
  const [agencies, setAgencies] = useState<AgencyEntry[]>([]);
  const [agencyName, setAgencyName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const wide = useWindowDimensions().width >= wideLayout;

  useEffect(() => {
    if (!visible || !admin) {
      return;
    }
    let alive = true;
    setLoading(true);
    setError("");
    const directory = admin;
    void (async () => {
      try {
        const rows = await directory.list();
        if (alive) {
          setAgencies(rows);
          setLoading(false);
        }
      } catch {
        if (alive) {
          setAgencies([]);
          setError("No se pudo cargar la lista.");
          setLoading(false);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [admin, visible]);

  if (!admin) {
    return null;
  }
  const directory = admin;

  function close() {
    setAgencyName("");
    setOwnerName("");
    setOwnerEmail("");
    setError("");
    setMessage("");
    onClose();
  }

  async function create() {
    if (busy) {
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    const problem = await directory.create(agencyName, ownerName, ownerEmail);
    if (problem) {
      setError(problem);
      setBusy(false);
      return;
    }
    const created = agencyName.trim();
    setAgencyName("");
    setOwnerName("");
    setOwnerEmail("");
    setMessage(`${created} quedó creada. Le enviamos al dueño un correo para que elija su contraseña.`);
    try {
      setAgencies(await directory.list());
    } catch {
      setError("No se pudo cargar la lista.");
    }
    setBusy(false);
  }

  return (
    <Dialog visible={visible} title="Nueva agencia" onClose={close} wide={wide}>
      <View className={wide ? "flex-row items-start gap-6" : "gap-4"}>
        <View className="min-w-0 flex-1 gap-4">
          <Text className="text-[17px] leading-6 text-ink">
            El dueño recibe un correo, elige su contraseña y entra a un libro vacío. Vos no quedás en esa agencia.
          </Text>
          <Field label="Nombre de la agencia">
            <TextField
              value={agencyName}
              onChangeText={setAgencyName}
              placeholder="Agencia Norte"
              accessibilityLabel="Nombre de la agencia"
            />
          </Field>
          <Field label="Nombre del dueño">
            <TextField value={ownerName} onChangeText={setOwnerName} placeholder="Nombre" accessibilityLabel="Nombre del dueño" />
          </Field>
          <Field label="Correo del dueño">
            <TextField
              value={ownerEmail}
              onChangeText={setOwnerEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              placeholder="correo@agencia.com"
              accessibilityLabel="Correo del dueño"
            />
          </Field>
          <PrimaryButton label={busy ? "Enviando…" : "Crear e invitar"} onPress={() => void create()} />
          <Feedback error={error} message={message} />
        </View>
        <View className="min-w-0 flex-1 gap-3">
          <SectionTitle title="Agencias" />
          {loading ? <Text className="text-[17px] text-ink">Cargando…</Text> : null}
          {agencies.map((agency) => (
            <View key={agency.agencyId} className="rounded-[14px] border border-line px-4 py-3">
              <Text className="text-[17px] font-semibold text-navy" numberOfLines={1}>
                {agency.name}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </Dialog>
  );
}
