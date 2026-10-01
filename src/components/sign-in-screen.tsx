import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";

import { Field, PrimaryButton, TextField } from "@/components/form-controls";

export function SignInScreen({
  onSubmit,
  onResetPassword,
}: {
  onSubmit: (email: string, password: string) => Promise<string | null>;
  onResetPassword: (email: string) => Promise<string | null>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy) {
      return;
    }
    if (!email.trim() || !password) {
      setMessage("");
      setError("Completá el correo y la contraseña.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    const problem = await onSubmit(email.trim(), password);
    if (problem) {
      setError(problem);
    }
    setBusy(false);
  }

  async function resetPassword() {
    if (busy) {
      return;
    }
    if (!email.trim()) {
      setMessage("");
      setError("Escribí el correo para enviarte el enlace.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    const problem = await onResetPassword(email.trim());
    if (problem) {
      setError(problem);
    } else {
      setMessage("Te enviamos un correo para elegir una contraseña nueva.");
    }
    setBusy(false);
  }

  return (
    <View className="flex-1 items-center justify-center bg-canvas px-5">
      <View className="w-full max-w-[400px] gap-4 rounded-[14px] border border-line bg-card p-5">
        <Image
          source={require("../../assets/images/logo-card.png")}
          contentFit="contain"
          accessibilityLabel="HippoPro"
          style={{ width: 240, height: 180, alignSelf: "center" }}
        />
        <Text className="text-[17px] text-ink">Entrá con el correo de la agencia.</Text>
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
            placeholder="Contraseña"
            accessibilityLabel="Contraseña"
          />
        </Field>
        {error ? <Text className="text-[15px] text-negative">{error}</Text> : null}
        {message ? <Text className="text-[15px] text-navy">{message}</Text> : null}
        <PrimaryButton label={busy ? "Entrando…" : "Entrar"} onPress={() => void submit()} />
        <Pressable accessibilityRole="button" onPress={() => void resetPassword()} className="items-center py-1">
          <Text className="text-[16px] font-semibold text-accent">Olvidé mi contraseña</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function NewPasswordScreen({ onSubmit }: { onSubmit: (password: string) => Promise<string | null> }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy) {
      return;
    }
    if (password.length < 6) {
      setError("La contraseña tiene que tener al menos 6 caracteres.");
      return;
    }
    setBusy(true);
    setError("");
    const problem = await onSubmit(password);
    if (problem) {
      setError(problem);
      setBusy(false);
    }
  }

  return (
    <View className="flex-1 items-center justify-center bg-canvas px-5">
      <View className="w-full max-w-[400px] gap-4 rounded-[14px] border border-line bg-card p-5">
        <Text className="font-serif text-[30px] text-navy">Nueva contraseña</Text>
        <Field label="Contraseña">
          <TextField
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="Nueva contraseña"
            accessibilityLabel="Nueva contraseña"
          />
        </Field>
        {error ? <Text className="text-[15px] text-negative">{error}</Text> : null}
        <PrimaryButton label={busy ? "Guardando…" : "Guardar"} onPress={() => void submit()} />
      </View>
    </View>
  );
}

export function SessionNotice({ title, detail, actionLabel, onAction }: { title: string; detail?: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <View className="flex-1 items-center justify-center bg-canvas px-5">
      <View className="w-full max-w-[400px] gap-4 rounded-[14px] border border-line bg-card p-5">
        <Text className="font-sans text-[24px] font-semibold text-navy">{title}</Text>
        {detail ? <Text className="text-[17px] leading-6 text-ink">{detail}</Text> : null}
        {actionLabel && onAction ? <PrimaryButton label={actionLabel} onPress={onAction} /> : null}
      </View>
    </View>
  );
}
