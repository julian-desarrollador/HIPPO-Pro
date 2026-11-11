import { useState } from "react";
import { Text, View } from "react-native";

import { ConfirmDialog, Dialog, Feedback, Field, PasswordField, PrimaryButton, SecondaryButton } from "@/components/form-controls";
import { SectionTitle } from "@/components/screen-frame";
import { newPasswordProblem } from "@/modules/identity/password-rule";
import { useLedger } from "@/modules/ledger";

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="gap-0.5">
      <Text className="text-[15px] text-muted">{label}</Text>
      <Text className="text-[17px] font-semibold text-navy" selectable>
        {value}
      </Text>
    </View>
  );
}

/** Mi cuenta: who is signed in, change the password, and sign out. */
export function AccountPanel({
  visible,
  onClose,
  onBack,
}: {
  visible: boolean;
  onClose: () => void;
  onBack?: () => void;
}) {
  const { displayName, userEmail, role, agencyName, canCreateAgencies, canAccessAll, changePassword, signOut } = useLedger();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmingExit, setConfirmingExit] = useState(false);

  const marks = [
    canCreateAgencies ? "Puede crear agencias" : null,
    canAccessAll ? "Acceso a todas las agencias" : null,
  ].filter((mark): mark is string => mark !== null);

  function close() {
    setCurrent("");
    setNext("");
    setRepeat("");
    setError("");
    setMessage("");
    onClose();
  }

  async function savePassword() {
    if (busy || !changePassword) {
      return;
    }
    setMessage("");
    if (!current) {
      setError("Escribí tu contraseña actual.");
      return;
    }
    const problem = newPasswordProblem(next, repeat, current);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError("");
    const failure = await changePassword(current, next);
    setBusy(false);
    if (failure) {
      setError(failure);
      return;
    }
    setCurrent("");
    setNext("");
    setRepeat("");
    setMessage("Contraseña cambiada. La próxima vez entrá con la nueva.");
  }

  return (
    <>
      <Dialog visible={visible} title="Mi cuenta" onClose={close} onBack={onBack}>
        <View className="gap-3 rounded-[14px] border border-line px-4 py-3">
          <InfoRow label="Nombre" value={displayName.trim() || "Sin nombre"} />
          {userEmail ? <InfoRow label="Correo" value={userEmail} /> : null}
          <InfoRow label="Rol" value={role === "owner" ? "Dueño" : "Operador"} />
          <InfoRow label="Agencia" value={agencyName} />
          {marks.length > 0 ? <InfoRow label="Permisos" value={marks.join(" · ")} /> : null}
        </View>

        {changePassword ? (
          <View className="gap-4">
            <SectionTitle title="Cambiar contraseña" />
            <Field label="Contraseña actual">
              <PasswordField value={current} onChangeText={setCurrent} placeholder="La que usás hoy" accessibilityLabel="Contraseña actual" />
            </Field>
            <Field label="Contraseña nueva">
              <PasswordField
                value={next}
                onChangeText={setNext}
                placeholder="Al menos 10, con letras y números"
                accessibilityLabel="Contraseña nueva"
              />
            </Field>
            <Field label="Repetir la nueva">
              <PasswordField
                value={repeat}
                onChangeText={setRepeat}
                placeholder="La misma contraseña"
                accessibilityLabel="Repetir la contraseña nueva"
                onSubmitEditing={() => void savePassword()}
              />
            </Field>
            <Feedback error={error} message={message} />
            <PrimaryButton label={busy ? "Guardando…" : "Guardar contraseña"} onPress={() => void savePassword()} />
          </View>
        ) : null}

        {signOut ? <SecondaryButton label="Salir" onPress={() => setConfirmingExit(true)} /> : null}
      </Dialog>
      <ConfirmDialog
        visible={confirmingExit}
        title="¿Salir?"
        confirmLabel="Salir"
        onCancel={() => setConfirmingExit(false)}
        onConfirm={() => {
          setConfirmingExit(false);
          close();
          signOut?.();
        }}
      />
    </>
  );
}
