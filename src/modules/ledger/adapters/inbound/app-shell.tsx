import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";

import { NewPasswordScreen, SessionNotice, SignInScreen } from "@/components/sign-in-screen";
import { OperatorAdminProvider } from "@/modules/identity/operator-admin";
import type { ViewerRole } from "../../domain/types";
import { openAgencyLedger } from "../outbound/agency-ledger";
import { PREVIEW_AGENCY_ID } from "../outbound/august-2026-seed";
import { createSupabaseLedgerRemote } from "../outbound/supabase-ledger-remote";
import { readSupabaseConfig, type SupabaseConfig } from "../outbound/supabase-config";
import { LedgerProvider } from "./ledger-provider";

type Phase =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "recovery" }
  | { status: "unassigned" }
  | { status: "error" }
  | { status: "ready"; role: ViewerRole; displayName: string; repository: Awaited<ReturnType<typeof openAgencyLedger>> };

function isViewerRole(value: unknown): value is ViewerRole {
  return value === "owner" || value === "operator";
}

function isChoosingPassword(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const here = `${window.location.hash}${window.location.search}`;
  return here.includes("type=recovery") || here.includes("type=invite");
}

function passwordStillPending(session: Session): boolean {
  const metadata: unknown = session.user.user_metadata;
  return Boolean(metadata && typeof metadata === "object" && "password_pending" in metadata && metadata.password_pending === true);
}

function clearPasswordLink(): void {
  if (typeof window === "undefined") {
    return;
  }
  const url = new URL(window.location.href);
  url.hash = "";
  url.searchParams.delete("type");
  window.history.replaceState(null, "", `${url.pathname}${url.search}`);
}

function signInProblem(message: string): string {
  if (/invalid login/i.test(message)) {
    return "El correo o la contraseña no son correctos.";
  }
  if (/email not confirmed/i.test(message)) {
    return "Falta confirmar el correo.";
  }
  return "No se pudo entrar. Revisá la conexión.";
}

function createAgencyClient(config: SupabaseConfig): SupabaseClient {
  return createClient(config.url, config.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

async function loadProfile(client: SupabaseClient, userId: string): Promise<{ agencyId: string; role: ViewerRole; displayName: string } | null> {
  const { data, error } = await client.from("profiles").select("agency_id, role, display_name").eq("user_id", userId).maybeSingle();
  if (error || !data || typeof data.agency_id !== "string" || !isViewerRole(data.role)) {
    return null;
  }
  return {
    agencyId: data.agency_id,
    role: data.role,
    displayName: typeof data.display_name === "string" ? data.display_name : "",
  };
}

export function AppShell({ children }: { children: ReactNode }) {
  const config = readSupabaseConfig();
  if (config === "incomplete") {
    return (
      <SessionNotice
        title="Falta conectar la base"
        detail="Están a medias la dirección y la clave pública. Hasta completarlas, el libro no se abre."
      />
    );
  }
  if (!config) {
    return <LedgerProvider>{children}</LedgerProvider>;
  }
  if (config.publicAccess) {
    return <PublicLedger config={config}>{children}</PublicLedger>;
  }
  return <RemoteShell config={config}>{children}</RemoteShell>;
}

function PublicLedger({ config, children }: { config: SupabaseConfig; children: ReactNode }) {
  const clientRef = useRef<SupabaseClient | null>(null);
  if (!clientRef.current) {
    clientRef.current = createAgencyClient(config);
  }
  const client = clientRef.current;
  const [phase, setPhase] = useState<
    { status: "loading" } | { status: "error" } | { status: "ready"; repository: Awaited<ReturnType<typeof openAgencyLedger>> }
  >({ status: "loading" });

  const open = useCallback(() => {
    setPhase({ status: "loading" });
    void openAgencyLedger(createSupabaseLedgerRemote(client), PREVIEW_AGENCY_ID)
      .then((repository) => {
        setPhase({ status: "ready", repository });
      })
      .catch(() => {
        setPhase({ status: "error" });
      });
  }, [client]);

  useEffect(() => {
    open();
  }, [open]);

  if (phase.status === "loading") {
    return <SessionNotice title="Cargando el libro…" />;
  }
  if (phase.status === "error") {
    return (
      <SessionNotice
        title="No se pudo abrir el libro"
        detail="Revisá la conexión e intentá de nuevo."
        actionLabel="Reintentar"
        onAction={open}
      />
    );
  }

  return (
    <LedgerProvider repository={phase.repository} persistence="agency">
      {children}
    </LedgerProvider>
  );
}

function RemoteShell({ config, children }: { config: SupabaseConfig; children: ReactNode }) {
  const choosingPassword = useRef<boolean | null>(null);
  const passwordChosen = useRef(false);
  if (choosingPassword.current === null) {
    choosingPassword.current = isChoosingPassword();
  }
  const clientRef = useRef<SupabaseClient | null>(null);
  if (!clientRef.current) {
    clientRef.current = createAgencyClient(config);
  }
  const client = clientRef.current;
  const [phase, setPhase] = useState<Phase>({ status: "loading" });
  const request = useRef(0);

  async function adopt(session: Session | null) {
    const id = ++request.current;
    if (!session) {
      setPhase({ status: "signed-out" });
      return;
    }
    if (!passwordChosen.current && (choosingPassword.current || isChoosingPassword() || passwordStillPending(session))) {
      choosingPassword.current = true;
      setPhase({ status: "recovery" });
      return;
    }
    const profile = await loadProfile(client, session.user.id);
    if (id !== request.current) {
      return;
    }
    if (!profile) {
      setPhase({ status: "unassigned" });
      return;
    }
    try {
      const repository = await openAgencyLedger(createSupabaseLedgerRemote(client), profile.agencyId);
      if (id !== request.current) {
        return;
      }
      setPhase({ status: "ready", role: profile.role, displayName: profile.displayName, repository });
    } catch {
      if (id !== request.current) {
        return;
      }
      setPhase({ status: "error" });
    }
  }

  useEffect(() => {
    let alive = true;
    const start = setTimeout(() => {
      if (!alive) {
        return;
      }
      void client.auth.getSession().then(({ data }) => {
        if (alive) {
          void adopt(data.session);
        }
      });
    }, 0);
    const { data } = client.auth.onAuthStateChange((event, session) => {
      if (!alive || event === "INITIAL_SESSION") {
        return;
      }
      if (event === "PASSWORD_RECOVERY") {
        setPhase({ status: "recovery" });
        return;
      }
      setTimeout(() => {
        if (alive) {
          void adopt(session);
        }
      }, 0);
    });
    return () => {
      alive = false;
      clearTimeout(start);
      data.subscription.unsubscribe();
    };
  }, [client]);

  async function signIn(email: string, password: string): Promise<string | null> {
    const { error } = await client.auth.signInWithPassword({ email, password });
    return error ? signInProblem(error.message) : null;
  }

  async function resetPassword(email: string): Promise<string | null> {
    const redirectTo = typeof window === "undefined" ? undefined : window.location.origin;
    const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
    return error ? "No se pudo enviar el correo. Revisá la conexión." : null;
  }

  async function savePassword(password: string): Promise<string | null> {
    const { error } = await client.auth.updateUser({ password, data: { password_pending: false } });
    if (error) {
      return "No se pudo guardar la contraseña. Revisá la conexión.";
    }
    choosingPassword.current = false;
    passwordChosen.current = true;
    clearPasswordLink();
    const { data } = await client.auth.getSession();
    await adopt(data.session);
    return null;
  }

  function signOut() {
    void client.auth.signOut();
  }

  if (phase.status === "loading") {
    return <SessionNotice title="Cargando el libro…" />;
  }
  if (phase.status === "signed-out") {
    return <SignInScreen onSubmit={signIn} onResetPassword={resetPassword} />;
  }
  if (phase.status === "recovery") {
    return <NewPasswordScreen onSubmit={savePassword} />;
  }
  if (phase.status === "unassigned") {
    return (
      <SessionNotice
        title="Esta cuenta no está habilitada"
        detail="El correo entra, pero todavía no pertenece a la agencia."
        actionLabel="Salir"
        onAction={signOut}
      />
    );
  }
  if (phase.status === "error") {
    return (
      <SessionNotice
        title="No se pudo abrir el libro"
        detail="Revisá la conexión e intentá de nuevo."
        actionLabel="Reintentar"
        onAction={() => {
          setPhase({ status: "loading" });
          void client.auth.getSession().then(({ data }) => adopt(data.session));
        }}
      />
    );
  }

  return (
    <LedgerProvider
      repository={phase.repository}
      role={phase.role}
      displayName={phase.displayName}
      persistence="agency"
      signOut={signOut}
    >
      <OperatorAdminProvider client={client}>{children}</OperatorAdminProvider>
    </LedgerProvider>
  );
}
