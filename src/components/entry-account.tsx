import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Pressable, Text, View } from "react-native";

import { Feedback, Field, PrimaryButton, SecondaryButton, TextField } from "@/components/form-controls";
import { Card } from "@/components/screen-frame";
import { SignInScreen } from "@/components/sign-in-screen";
import { lotterySignupProblem } from "@/modules/identity/agency-invite";
import { readFunctionMessage } from "@/modules/identity/operator-admin";
import { readSupabaseConfig } from "@/modules/ledger/adapters/outbound/supabase-config";

export function EntryAccount({
  panel,
  onClose,
}: {
  panel: "sign-in" | "lottery";
  onClose: () => void;
}) {
  return (
    <Card>
      <View className="gap-4">
        <View className="flex-row items-center justify-between gap-3">
          <Text className="font-sans text-[24px] font-semibold text-navy">
            {panel === "lottery" ? "Agencia de lotería" : "Entrar"}
          </Text>
          <SecondaryButton label="Cerrar" onPress={onClose} />
        </View>
        {panel === "lottery" ? <LotterySignup /> : <LandingSignIn />}
      </View>
    </Card>
  );
}

export function AccountLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      <Text className="text-center text-[16px] font-semibold text-deep">{label}</Text>
    </Pressable>
  );
}

function LandingSignIn() {
  const config = readSupabaseConfig();
  if (!config || config === "incomplete") {
    return <Text className="text-[17px] leading-6 text-ink">El ingreso abre cuando el sitio está conectado.</Text>;
  }
  const client = createClient(config.url, config.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });

  return (
    <SignInScreen
      onSubmit={async (email, password) => {
        const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
        if (!error) {
          return null;
        }
        return /invalid login/i.test(error.message)
          ? "El correo o la contraseña no son correctos."
          : "No se pudo entrar. Revisá la conexión.";
      }}
      onResetPassword={async (email) => {
        const redirectTo = typeof window === "undefined" ? undefined : window.location.origin;
        const { error } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo });
        return error ? "No se pudo enviar el correo. Revisá la conexión." : null;
      }}
    />
  );
}

function LotterySignup() {
  const [agencyName, setAgencyName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy) {
      return;
    }
    const problem = lotterySignupProblem(agencyName, ownerName, email, password);
    if (problem) {
      setError(problem);
      setMessage("");
      return;
    }
    const config = readSupabaseConfig();
    if (!config || config === "incomplete") {
      setError("El alta abre cuando el sitio está conectado.");
      return;
    }
    setBusy(true);
    setMessage("Creando la agencia…");
    setError("");
    const client = createClient(config.url, config.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    });
    const { data, error: invokeError } = await client.functions.invoke("signup-lottery", {
      body: {
        agencyName: agencyName.trim(),
        ownerName: ownerName.trim(),
        ownerEmail: email.trim(),
        password,
      },
    });
    if (invokeError) {
      setBusy(false);
      setMessage("");
      setError(await readFunctionMessage(invokeError, data));
      return;
    }
    const { error: signError } = await client.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (signError) {
      setBusy(false);
      setMessage("");
      setError("La agencia quedó creada. Entrá con Ya tengo cuenta.");
    }
  }

  return (
    <View className="gap-4">
      <Text className="text-[17px] leading-6 text-ink">
        Elegí el nombre de la agencia, el tuyo y una contraseña. Entrás a la quiniela con el libro vacío.
      </Text>
      <Field label="Nombre de la agencia">
        <TextField value={agencyName} onChangeText={setAgencyName} placeholder="Agencia Norte" accessibilityLabel="Nombre de la agencia" />
      </Field>
      <Field label="Tu nombre">
        <TextField value={ownerName} onChangeText={setOwnerName} placeholder="Nombre" accessibilityLabel="Tu nombre" />
      </Field>
      <Field label="Correo">
        <TextField
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          placeholder="correo@agencia.com"
          accessibilityLabel="Correo"
        />
      </Field>
      <Field label="Contraseña">
        <TextField
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="Al menos 6 caracteres"
          accessibilityLabel="Contraseña"
        />
      </Field>
      <Feedback error={error} message={message} />
      <PrimaryButton label={busy ? "Creando…" : "Empezar"} onPress={() => void submit()} />
    </View>
  );
}
