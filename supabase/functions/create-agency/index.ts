// Creates an agency with an empty book and invites its first owner.
// read returns another agency's racing book and, if it has one, its lottery
// book, for a read-only visit.
// create-personal makes an empty book for the caller only, with no invite
// and no change to the caller's profile. list hides other people's personal
// agencies. archive removes a real agency from the list and from sign-in, and
// keeps its books, people and photos. Its name can be used again by a new
// agency with the next free id. Only a profile with can_create_agencies
// may call it.
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

function personalAgencyNameProblem(agencyName: string): string | null {
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
  return null;
}

function personalAgencyId(name: string): string {
  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 6);
  return `${agencyIdFromName(name)}-${suffix}`;
}

function newAgencyProblem(agencyName: string, ownerName: string, ownerEmail: string): string | null {
  const nameProblem = personalAgencyNameProblem(agencyName);
  if (nameProblem) {
    return nameProblem;
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

function productModeOf(value: unknown): "racing" | "lottery" | "both" {
  return value === "lottery" || value === "both" ? value : "racing";
}

/** A new agency starts with one service. Both is added later by the owner. */
function startingModeOf(value: unknown): "racing" | "lottery" {
  return value === "lottery" ? "lottery" : "racing";
}

/** Keep aligned with removalNameMatches in src/modules/identity/agency-invite.ts. */
function removalNameMatches(typed: string, name: string): boolean {
  const clean = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase("es-AR");
  return clean(typed).length > 0 && clean(typed) === clean(name);
}

function readText(body: object, key: string): string {
  const value = (body as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

async function removePhotoFolder(admin: SupabaseClient, bucket: string, agencyId: string): Promise<boolean> {
  const { data, error } = await admin.storage.from(bucket).list(agencyId, { limit: 1000 });
  if (error) {
    return false;
  }
  const paths = (data ?? [])
    .map((file) => file.name)
    .filter((name) => name.length > 0)
    .map((name) => `${agencyId}/${name}`);
  if (paths.length === 0) {
    return true;
  }
  const { error: removeError } = await admin.storage.from(bucket).remove(paths);
  return !removeError;
}

async function removeAgency(admin: SupabaseClient, agencyId: string): Promise<void> {
  await admin.from("ledgers").delete().eq("agency_id", agencyId);
  await admin.from("agencies").delete().eq("agency_id", agencyId);
}

type AgencyInsert = { agencyId: string } | { status: number; message: string };

/**
 * A live agency keeps its name to itself. A removed one keeps its id and its
 * data, so a new agency with the same name gets the next free id (-2, -3...).
 * An id held by an agency with another name is skipped the same way.
 */
async function insertAgency(
  admin: SupabaseClient,
  baseId: string,
  name: string,
  productMode: string,
): Promise<AgencyInsert> {
  for (let attempt = 1; attempt <= 20; attempt += 1) {
    const agencyId = attempt === 1 ? baseId : `${baseId}-${attempt}`;
    const { error } = await admin.from("agencies").insert({ agency_id: agencyId, name, product_mode: productMode });
    if (!error) {
      return { agencyId };
    }
    if (error.code !== "23505") {
      return { status: 400, message: "No se pudo crear la agencia." };
    }
    const { data: existing } = await admin
      .from("agencies")
      .select("name, archived_at")
      .eq("agency_id", agencyId)
      .maybeSingle();
    // "Lavalle 1442 2" also owns lavalle-1442-2, but it is another name: skip it.
    const sameName = typeof existing?.name === "string" && agencyIdFromName(existing.name) === baseId;
    if (existing?.archived_at == null && sameName) {
      return { status: 409, message: "Ya hay una agencia con ese nombre." };
    }
  }
  return { status: 400, message: "No se pudo crear la agencia." };
}

/**
 * An owner of a removed agency who never got in is deleted, so the same email
 * can be invited again. Never got in: no sign-in at all (the invite expired),
 * or the invite link was opened but the password was never saved
 * (password_pending). Opening the link alone sets last_sign_in_at.
 * Anyone else is kept. Returns false only when that deletion fails.
 */
async function releaseUnusedOwner(admin: SupabaseClient, email: string): Promise<boolean> {
  const { data: profiles, error } = await admin
    .from("profiles")
    .select("user_id, agency_id")
    .eq("email", email);
  if (error || !profiles || profiles.length !== 1) {
    return true;
  }
  const profile = profiles[0];
  const { data: agency } = await admin
    .from("agencies")
    .select("archived_at")
    .eq("agency_id", profile.agency_id)
    .maybeSingle();
  if (agency?.archived_at == null) {
    return true;
  }
  const { data: userData, error: userError } = await admin.auth.admin.getUserById(profile.user_id);
  if (userError || !userData.user) {
    return true;
  }
  const passwordPending = userData.user.user_metadata?.password_pending === true;
  if (userData.user.last_sign_in_at && !passwordPending) {
    return true;
  }
  const { error: deleteError } = await admin.auth.admin.deleteUser(profile.user_id);
  return !deleteError;
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
    .select("can_create_agencies, agency_id")
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
      .select("name, personal_user_id, product_mode, archived_at")
      .eq("agency_id", agencyId)
      .maybeSingle();
    if (agencyError || !agency || agency.archived_at != null || typeof agency.name !== "string" || !agency.name.trim()) {
      return json(400, { message: "No se pudo abrir la agencia." });
    }
    if (typeof agency.personal_user_id === "string" && agency.personal_user_id !== callerId) {
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
    // The lottery book is in its own table. Its policy only lets an agency read its own row,
    // so a visit gets it here, with the service role, like the racing book. No row: null.
    const { data: lottery, error: lotteryError } = await admin
      .from("lottery_ledgers")
      .select("snapshot")
      .eq("agency_id", agencyId)
      .maybeSingle();
    if (lotteryError) {
      return json(400, { message: "No se pudo abrir la agencia." });
    }
    const lotterySnapshot = lottery && lottery.snapshot !== null && typeof lottery.snapshot === "object" ? lottery.snapshot : null;
    return json(200, {
      name: agency.name.trim(),
      productMode: productModeOf(agency.product_mode),
      snapshot: ledger.snapshot,
      lotterySnapshot,
    });
  }

  if (action === "list") {
    const homeId = typeof caller.agency_id === "string" ? caller.agency_id : "";
    const { data, error } = await admin
      .from("agencies")
      .select("agency_id, name, personal_user_id, product_mode")
      .is("archived_at", null)
      .order("created_at");
    if (error || !data) {
      return json(400, { message: "No se pudo cargar la lista." });
    }
    const agencies = data
      .filter((row) => row.personal_user_id == null || row.personal_user_id === callerId)
      .map((row) => ({
        agencyId: row.agency_id,
        name: row.name,
        kind: row.agency_id === homeId ? "home" : row.personal_user_id === callerId ? "personal" : "other",
        productMode: productModeOf(row.product_mode),
      }));
    return json(200, { agencies });
  }

  if (action === "create-personal") {
    const agencyName = readText(body, "agencyName");
    const problem = personalAgencyNameProblem(agencyName);
    if (problem) {
      return json(400, { message: problem });
    }
    const name = agencyName.trim().replace(/\s+/g, " ");
    const productMode = startingModeOf(readText(body, "productMode"));
    let agencyId = "";
    let created = false;
    for (let attempt = 0; attempt < 3 && !created; attempt += 1) {
      agencyId = personalAgencyId(name);
      const { error: agencyError } = await admin.from("agencies").insert({
        agency_id: agencyId,
        name,
        personal_user_id: callerId,
        product_mode: productMode,
      });
      if (!agencyError) {
        created = true;
        break;
      }
      if (agencyError.code !== "23505") {
        return json(400, { message: "No se pudo crear la agencia." });
      }
    }
    if (!created) {
      return json(400, { message: "No se pudo crear la agencia." });
    }
    const { error: ledgerError } = await admin
      .from("ledgers")
      .insert({ agency_id: agencyId, snapshot: emptyAgencySnapshot(agencyId) });
    if (ledgerError) {
      await removeAgency(admin, agencyId);
      return json(400, { message: "No se pudo crear la agencia." });
    }
    return json(200, { agencyId, name, productMode });
  }

  if (action === "delete-personal") {
    const agencyId = readText(body, "agencyId");
    if (!agencyId) {
      return json(400, { message: "No se pudo quitar la agencia." });
    }
    const { data: agency, error: agencyError } = await admin
      .from("agencies")
      .select("personal_user_id")
      .eq("agency_id", agencyId)
      .maybeSingle();
    if (agencyError || !agency || agency.personal_user_id !== callerId) {
      return json(400, { message: "No se pudo quitar la agencia." });
    }
    const { count, error: profileError } = await admin
      .from("profiles")
      .select("user_id", { count: "exact", head: true })
      .eq("agency_id", agencyId);
    if (profileError || (count ?? 0) > 0) {
      return json(400, { message: "No se pudo quitar la agencia." });
    }
    const photosRemoved = await removePhotoFolder(admin, "day-photos", agencyId)
      && await removePhotoFolder(admin, "deposit-photos", agencyId)
      && await removePhotoFolder(admin, "expense-photos", agencyId);
    if (!photosRemoved) {
      return json(400, { message: "No se pudo quitar la agencia." });
    }
    await removeAgency(admin, agencyId);
    return json(200, { ok: true });
  }

  if (action === "archive") {
    const agencyId = readText(body, "agencyId");
    const confirmName = readText(body, "confirmName");
    if (!agencyId) {
      return json(400, { message: "No se pudo quitar la agencia." });
    }
    const { data: agency, error: agencyError } = await admin
      .from("agencies")
      .select("name, personal_user_id, archived_at")
      .eq("agency_id", agencyId)
      .maybeSingle();
    if (agencyError || !agency || agency.archived_at != null || agency.personal_user_id != null) {
      return json(400, { message: "No se pudo quitar la agencia." });
    }
    if (agencyId === caller.agency_id || agencyId === "agencia-dolores") {
      return json(400, { message: "Esta agencia no se puede quitar." });
    }
    if (typeof agency.name !== "string" || !removalNameMatches(confirmName, agency.name)) {
      return json(400, { message: "El nombre no coincide." });
    }
    const { error: archiveError } = await admin
      .from("agencies")
      .update({ archived_at: new Date().toISOString(), archived_by: callerId })
      .eq("agency_id", agencyId)
      .is("archived_at", null);
    if (archiveError) {
      return json(400, { message: "No se pudo quitar la agencia." });
    }
    return json(200, { ok: true });
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
    const productMode = startingModeOf(readText(body, "productMode"));
    const baseId = agencyIdFromName(name);
    const cleanOwner = ownerName.trim();
    const cleanEmail = ownerEmail.trim().toLowerCase();

    const created = await insertAgency(admin, baseId, name, productMode);
    if ("message" in created) {
      return json(created.status, { message: created.message });
    }
    const agencyId = created.agencyId;

    const { error: ledgerError } = await admin
      .from("ledgers")
      .insert({ agency_id: agencyId, snapshot: emptyAgencySnapshot(agencyId) });
    if (ledgerError) {
      await removeAgency(admin, agencyId);
      return json(400, { message: "No se pudo crear la agencia." });
    }

    if (!await releaseUnusedOwner(admin, cleanEmail)) {
      await removeAgency(admin, agencyId);
      return json(400, { message: "No se pudo enviar la invitación." });
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
