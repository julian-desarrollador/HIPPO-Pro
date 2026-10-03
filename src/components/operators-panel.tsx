import { useEffect, useState } from "react";
import { Pressable, Text, useWindowDimensions, View } from "react-native";

import { ChoiceChips, ConfirmDialog, Dialog, Feedback, Field, PrimaryButton, TextField } from "@/components/form-controls";
import { SectionTitle } from "@/components/screen-frame";
import { wideLayout } from "@/constants/layout";
import { useOperatorAdmin, type AgencyOperator, type AgencyOwner } from "@/modules/identity/operator-admin";

type PendingRemoval = { kind: "operator" | "owner"; person: AgencyOperator };

export function OperatorsPanel({
  visible,
  onClose,
  canInviteOwners,
  userId,
}: {
  visible: boolean;
  onClose: () => void;
  canInviteOwners: boolean;
  userId: string;
}) {
  const admin = useOperatorAdmin();
  const [operators, setOperators] = useState<AgencyOperator[]>([]);
  const [owners, setOwners] = useState<AgencyOwner[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [grantInvite, setGrantInvite] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingRemoval | null>(null);

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
        const ownerRows = canInviteOwners ? await directory.listOwners() : [];
        if (alive) {
          setOperators(rows);
          setOwners(ownerRows);
          setLoading(false);
        }
      } catch {
        if (alive) {
          setOperators([]);
          setOwners([]);
          setError("No se pudo cargar la lista.");
          setLoading(false);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [admin, canInviteOwners, visible]);

  const wide = useWindowDimensions().width >= wideLayout;

  if (!admin) {
    return null;
  }
  const directory = admin;

  function close() {
    setDisplayName("");
    setEmail("");
    setOwnerName("");
    setOwnerEmail("");
    setGrantInvite(false);
    setError("");
    setMessage("");
    setPending(null);
    onClose();
  }

  async function inviteOperator() {
    if (busy) {
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    const problem = await directory.invite(displayName, email, "operator");
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

  async function inviteOwner() {
    if (busy) {
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    const problem = await directory.invite(ownerName, ownerEmail, "owner", grantInvite);
    if (problem) {
      setError(problem);
      setBusy(false);
      return;
    }
    setOwnerName("");
    setOwnerEmail("");
    setGrantInvite(false);
    setMessage("Le enviamos un correo para que elija su contraseña.");
    try {
      setOwners(await directory.listOwners());
    } catch {
      setError("No se pudo cargar la lista.");
    }
    setBusy(false);
  }

  async function confirmRemove() {
    if (!pending || busy) {
      return;
    }
    const removal = pending;
    setBusy(true);
    setError("");
    setMessage("");
    const problem = await directory.remove(removal.person.userId);
    setPending(null);
    if (problem) {
      setError(problem);
      setBusy(false);
      return;
    }
    if (removal.kind === "owner") {
      setOwners((current) => current.filter((owner) => owner.userId !== removal.person.userId));
    } else {
      setOperators((current) => current.filter((operator) => operator.userId !== removal.person.userId));
    }
    setBusy(false);
  }

  return (
    <>
      <Dialog visible={visible && pending === null} title="Operadores" onClose={close} wide={wide}>
        <View className={wide && canInviteOwners ? "flex-row items-start gap-6" : "gap-4"}>
          <View className="min-w-0 flex-1 gap-4">
            {loading ? <Text className="text-[17px] text-ink">Cargando…</Text> : null}
            {!loading && operators.length === 0 ? (
              <Text className="text-[17px] text-ink">Todavía no hay operadores.</Text>
            ) : null}
            {operators.map((operator) => (
              <PersonRow
                key={operator.userId}
                person={operator}
                onRemove={() => setPending({ kind: "operator", person: operator })}
              />
            ))}
            <SectionTitle title="Invitar" />
            <NameEmailFields
              wide={wide}
              name={displayName}
              email={email}
              onName={setDisplayName}
              onEmail={setEmail}
              nameLabel="Nombre del operador"
              emailLabel="Correo del operador"
            />
            <PrimaryButton label={busy ? "Enviando…" : "Invitar"} onPress={() => void inviteOperator()} />
          </View>
          {canInviteOwners ? (
            <View className="min-w-0 flex-1 gap-4">
              <Text className="text-[17px] font-semibold text-navy">Dueños</Text>
              {!loading && owners.length === 0 ? <Text className="text-[17px] text-ink">Todavía no hay dueños.</Text> : null}
              {owners.map((owner) => (
                <PersonRow
                  key={owner.userId}
                  person={owner}
                  note={owner.canInviteOwners ? "Puede crear dueños" : undefined}
                  onRemove={owner.userId === userId ? undefined : () => setPending({ kind: "owner", person: owner })}
                />
              ))}
              <SectionTitle title="Invitar dueño" />
              <NameEmailFields
                wide={wide}
                name={ownerName}
                email={ownerEmail}
                onName={setOwnerName}
                onEmail={setOwnerEmail}
                nameLabel="Nombre del dueño"
                emailLabel="Correo del dueño"
              />
              <Field label="Puede crear dueños">
                <ChoiceChips
                  options={[
                    { id: "no", label: "No" },
                    { id: "yes", label: "Sí" },
                  ]}
                  value={grantInvite ? "yes" : "no"}
                  onChange={(id) => setGrantInvite(id === "yes")}
                />
              </Field>
              <PrimaryButton label={busy ? "Enviando…" : "Invitar dueño"} onPress={() => void inviteOwner()} />
            </View>
          ) : null}
        </View>
        <Feedback error={error} message={message} />
      </Dialog>
      <ConfirmDialog
        visible={pending !== null}
        title={pending?.kind === "owner" ? "¿Quitar este dueño?" : "¿Quitar este operador?"}
        onCancel={() => setPending(null)}
        onConfirm={() => void confirmRemove()}
      />
    </>
  );
}

function NameEmailFields({
  wide,
  name,
  email,
  onName,
  onEmail,
  nameLabel,
  emailLabel,
}: {
  wide: boolean;
  name: string;
  email: string;
  onName: (value: string) => void;
  onEmail: (value: string) => void;
  nameLabel: string;
  emailLabel: string;
}) {
  return (
    <View className={wide ? "flex-row gap-3" : "gap-4"}>
      <View className={wide ? "min-w-0 flex-1" : ""}>
        <Field label="Nombre">
          <TextField value={name} onChangeText={onName} placeholder="Nombre" accessibilityLabel={nameLabel} />
        </Field>
      </View>
      <View className={wide ? "min-w-0 flex-1" : ""}>
        <Field label="Correo">
          <TextField
            value={email}
            onChangeText={onEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            placeholder="correo@agencia.com"
            accessibilityLabel={emailLabel}
          />
        </Field>
      </View>
    </View>
  );
}

function PersonRow({
  person,
  note,
  onRemove,
}: {
  person: AgencyOperator;
  note?: string;
  onRemove?: () => void;
}) {
  return (
    <View className="flex-row items-center gap-3 rounded-[14px] border border-line px-4 py-3">
      <View className="min-w-0 flex-1 gap-1">
        <View className="flex-row flex-wrap items-center gap-x-3 gap-y-1">
          <Text className="text-[17px] font-semibold text-navy" numberOfLines={1}>
            {person.displayName || person.email}
          </Text>
          {note ? <Text className="text-[15px] text-muted">{note}</Text> : null}
        </View>
        {person.email ? (
          <Text className="text-[15px] text-muted" numberOfLines={1}>
            {person.email}
          </Text>
        ) : null}
      </View>
      {onRemove ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Quitar a ${person.displayName || person.email}`}
          onPress={onRemove}
          className="cursor-pointer"
        >
          <Text className="text-[17px] font-semibold text-negative">Quitar</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
