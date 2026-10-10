// Creates an agency with an empty book and invites its first owner.
// Only a profile with can_create_agencies may call it. The caller gets no
// profile in the new agency, and "list" returns names only, never a book.
// Runs with the service role inside Supabase.
// The app calls it with the caller's session and the anon key only.
// Keep the Spanish messages aligned with src/modules/identity/agency-invite.ts.

import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const publishedOrigin = "https://hippopro.com.ar";
const legacyOrigin = "https://hippo-pro.vercel.app";

const agencyNameMaxLength = 80;

const doloresRacetrackIds = ["san-isidro", "palermo", "la-plata"];
const doloresPartnerCategoryIds = ["adelanto-fede", "adelanto-mati", "retiro-sag-fede", "retiro-sag-mati"];

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function agencyIdFromName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
    .replace(/-+$/g, "");
}

function newAgencyProblem(agencyName: string, ownerName: string, ownerEmail: string): string | null {
  const name = agencyName.trim();
  if (!name) {
    return "Escribí el nombre de la agencia.";
  }
  if (name.length > agencyNameMaxLength) {
    return "El nombre de la agencia es muy largo.";
  }
  if (!agencyIdFromName(name)) {
    return "El nombre de la agencia necesita letras o números.";
  }
  if (!ownerName.trim()) {
    return "Escribí el nombre del dueño.";
  }
  const cleanEmail = ownerEmail.trim();
  if (!cleanEmail) {
    return "Escribí el correo.";
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return "El correo no es válido.";
  }
  return null;
}

function currentMonth(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  return `${year}-${month}`;
}

/** Keep aligned with createEmptyAgencySnapshot in src/modules/ledger/adapters/outbound/starting-snapshot.ts. */
function emptyAgencySnapshot(agencyId: string): Record<string, unknown> {
  return {
    agencyId,
    month: currentMonth(),
    days: [],
    deposits: [],
    expenses: [],
    openingBalances: [],
    hiddenRacetrackIds: doloresRacetrackIds,
    hiddenCategoryIds: doloresPartnerCategoryIds,
  };
}

function allowedRedirect(value: unknown): string {
  if (typeof value !== "string") {
    return publishedOrigin;
  }
  try {
    const url = new URL(value);
    if (url.origin === publishedOrigin || url.origin === legacyOrigin) {
      return url.origin;
    }
    if (url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1")) {
      return url.origin;
    }
  } catch {
    // A bad redirect falls back to the published site.
  }
  return publishedOrigin;
}

function alreadyRegistered(message: string): boolean {
  return /already|registered|exists/i.test(message);
}

function readText(body: object, key: string): string {
  const value = (body as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

async function removeAgency(admin: SupabaseClient, agencyId: string): Promise<void> {
  await admin.from("ledgers").delete().eq("agency_id", agencyId);
  await admin.from("agencies").delete().eq("agency_id", agencyId);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json(405, { message: "No se pudo completar." });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return json(500, { message: "No se pudo completar." });
  }

  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) {
    return json(401, { message: "Tenés que entrar para hacer esto." });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await admin.auth.getUser(jwt);
  const callerId = userData.user?.id;
  if (userError || !callerId) {
    return json(401, { message: "Tenés que entrar para hacer esto." });
  }

  const { data: caller, error: callerError } = await admin
    .from("profiles")
    .select("can_create_agencies")
    .eq("user_id", callerId)
    .maybeSingle();

  if (callerError || !caller || caller.can_create_agencies !== true) {
    return json(403, { message: "Esta cuenta no puede crear agencias." });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json(400, { message: "No se pudo completar." });
  }
  if (!body || typeof body !== "object") {
    return json(400, { message: "No se pudo completar." });
  }

  const action = "action" in body ? body.action : null;

  if (action === "read") {
    const agencyId = readText(body, "agencyId");
    if (!agencyId) {
      return json(400, { message: "No se pudo abrir la agencia." });
    }
    const { data: agency, error: agencyError } = await admin
      .from("agencies")
      .select("name")
      .eq("agency_id", agencyId)
      .maybeSingle();
    if (agencyError || !agency || typeof agency.name !== "string" || !agency.name.trim()) {
      return json(400, { message: "No se pudo abrir la agencia." });
    }
    const { data: ledger, error: ledgerError } = await admin
      .from("ledgers")
      .select("snapshot")
      .eq("agency_id", agencyId)
      .maybeSingle();
    if (ledgerError || !ledger || ledger.snapshot === null || typeof ledger.snapshot !== "object") {
      return json(400, { message: "No se pudo abrir la agencia." });
    }
    return json(200, { name: agency.name.trim(), snapshot: ledger.snapshot });
  }

  if (action === "list") {
    const { data, error } = await admin.from("agencies").select("agency_id, name").order("created_at");
    if (error || !data) {
      return json(400, { message: "No se pudo cargar la lista." });
    }
    return json(200, { agencies: data.map((row) => ({ agencyId: row.agency_id, name: row.name })) });
  }

  if (action === "create") {
    const agencyName = readText(body, "agencyName");
    const ownerName = readText(body, "ownerName");
    const ownerEmail = readText(body, "ownerEmail");
    const problem = newAgencyProblem(agencyName, ownerName, ownerEmail);
    if (problem) {
      return json(400, { message: problem });
    }

    const name = agencyName.trim().replace(/\s+/g, " ");
    const agencyId = agencyIdFromName(name);
    const cleanOwner = ownerName.trim();
    const cleanEmail = ownerEmail.trim().toLowerCase();

    const { error: agencyError } = await admin.from("agencies").insert({ agency_id: agencyId, name });
    if (agencyError) {
      return agencyError.code === "23505"
        ? json(409, { message: "Ya hay una agencia con ese nombre." })
        : json(400, { message: "No se pudo crear la agencia." });
    }

    const { error: ledgerError } = await admin
      .from("ledgers")
      .insert({ agency_id: agencyId, snapshot: emptyAgencySnapshot(agencyId) });
    if (ledgerError) {
      await removeAgency(admin, agencyId);
      return json(400, { message: "No se pudo crear la agencia." });
    }

    const redirectTo = allowedRedirect(readText(body, "redirectTo") || null);
    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(cleanEmail, {
      redirectTo,
      data: { password_pending: true },
    });
    if (inviteError || !invited.user) {
      await removeAgency(admin, agencyId);
      const message = inviteError?.message ?? "";
      return json(alreadyRegistered(message) ? 409 : 400, {
        message: alreadyRegistered(message) ? "Ese correo ya tiene una cuenta." : "No se pudo enviar la invitación.",
      });
    }

    const { error: profileError } = await admin.from("profiles").insert({
      user_id: invited.user.id,
      agency_id: agencyId,
      role: "owner",
      display_name: cleanOwner,
      email: cleanEmail,
      can_invite_owners: true,
      can_create_agencies: false,
    });
    if (profileError) {
      await admin.auth.admin.deleteUser(invited.user.id);
      await removeAgency(admin, agencyId);
      return json(400, { message: "No se pudo crear el dueño." });
    }

    return json(200, { ok: true, agencyId });
  }

  return json(400, { message: "No se pudo completar." });
});
