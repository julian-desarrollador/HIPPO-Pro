// Invites or removes an operator, and an owner when the caller may invite owners.
// add-service lets that owner turn on the missing book (racing or lottery).
// remove-service turns one off only when both are on, and leaves the books.
// The target is agencyId: an agency where the caller is owner, or a personal test
// agency they own. One account can be in several agencies (multi-agency.sql); an
// older app that sends no agencyId works while the caller is in only one.
// Inviting an email that already has an account adds the agency to it, once the
// owner confirms: without confirmExisting it answers code existing-account.
// Keep that rule aligned with withService and withoutService in
// src/modules/ledger/domain/features.ts.
// Runs with the service role inside Supabase.
// The app calls it with the owner's session and the anon key only.
// Keep the Spanish messages aligned with src/modules/identity/operator-invite.ts.

import { createClient } from "jsr:@supabase/supabase-js@2";

import { addPersonToAgency, hasFullAccess, isRealActiveAgency, removePersonFromAgency } from "../_shared/memberships.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const publishedOrigin = "https://hippopro.com.ar";
const legacyOrigin = "https://hippo-pro.vercel.app";

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function inviteProblem(displayName: string, email: string): string | null {
  if (!displayName.trim()) {
    return "Escribí el nombre.";
  }
  const cleanEmail = email.trim();
  if (!cleanEmail) {
    return "Escribí el correo.";
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return "El correo no es válido.";
  }
  return null;
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

  // One row per agency the caller is in. "*" reads can_access_all_agencies when it exists.
  const { data: callerRows, error: callerError } = await admin
    .from("profiles")
    .select("*")
    .eq("user_id", callerId);
  if (callerError || !callerRows) {
    return json(403, { message: "Solo un dueño puede hacer esto." });
  }
  const sentId = "agencyId" in body && typeof body.agencyId === "string" ? body.agencyId : "";
  const targetAgencyId = sentId || (callerRows.length === 1 && typeof callerRows[0].agency_id === "string" ? callerRows[0].agency_id : "");
  if (!targetAgencyId) {
    return json(403, { message: "Solo un dueño puede hacer esto." });
  }
  const { data: home, error: homeError } = await admin
    .from("agencies")
    .select("archived_at, product_mode, personal_user_id")
    .eq("agency_id", targetAgencyId)
    .maybeSingle();
  if (homeError || !home || home.archived_at != null) {
    return json(403, { message: "Esta agencia ya no está en HippoPro." });
  }
  // Full access works as an owner who may invite owners, in every real agency.
  const caller =
    callerRows.find((row) => row.agency_id === targetAgencyId && row.role === "owner") ??
    (hasFullAccess(callerRows) && isRealActiveAgency(home) ? { role: "owner", can_invite_owners: true } : null);
  // A test agency has no owner rows: whoever made it may change its services.
  const ownsPersonal = home.personal_user_id === callerId;
  if (!caller && !(ownsPersonal && (action === "add-service" || action === "remove-service"))) {
    return json(403, { message: "Solo un dueño puede hacer esto." });
  }
  const callerCanInviteOwners = caller?.can_invite_owners === true;

  if (action === "invite") {
    const displayName = "displayName" in body && typeof body.displayName === "string" ? body.displayName : "";
    const email = "email" in body && typeof body.email === "string" ? body.email : "";
    const problem = inviteProblem(displayName, email);
    if (problem) {
      return json(400, { message: problem });
    }
    const role = "role" in body && body.role === "owner" ? "owner" : "operator";
    if (role === "owner" && !callerCanInviteOwners) {
      return json(403, { message: "Solo un dueño habilitado puede invitar dueños." });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = displayName.trim();
    const grantInvite = role === "owner" && callerCanInviteOwners && "canInviteOwners" in body && body.canInviteOwners === true;
    const redirectTo = allowedRedirect("redirectTo" in body ? body.redirectTo : null);
    const joined = await addPersonToAgency(admin, {
      email: cleanEmail,
      agencyId: targetAgencyId,
      role,
      displayName: cleanName,
      canInviteOwners: grantInvite,
      redirectTo,
      confirmExisting: "confirmExisting" in body && body.confirmExisting === true,
    });
    if (joined.kind === "error") {
      return json(joined.status, { message: joined.message });
    }
    if (joined.kind === "already-in") {
      return json(409, { message: "Ese correo ya está en esta agencia.", code: "already-in" });
    }
    if (joined.kind === "needs-confirmation") {
      return json(409, { message: "Ese correo ya tiene una cuenta.", code: "existing-account" });
    }
    return json(200, {
      ok: true,
      outcome: joined.kind,
      passwordLinkSent: joined.kind === "existing" && joined.passwordLinkSent,
    });
  }

  if (action === "remove") {
    const userId = "userId" in body && typeof body.userId === "string" ? body.userId : "";
    if (!userId) {
      return json(400, { message: "No se pudo quitar." });
    }
    if (userId === callerId) {
      return json(403, { message: "No te podés quitar." });
    }

    const { data: target, error: targetError } = await admin
      .from("profiles")
      .select("agency_id, role, can_invite_owners")
      .eq("user_id", userId)
      .eq("agency_id", targetAgencyId)
      .maybeSingle();

    if (targetError || !target) {
      return json(403, { message: "Esa persona no está en la agencia." });
    }
    if (target.role === "owner") {
      if (!callerCanInviteOwners) {
        return json(403, { message: "No se puede quitar a un dueño." });
      }
      const { data: owners, error: ownersError } = await admin
        .from("profiles")
        .select("user_id, can_invite_owners")
        .eq("agency_id", targetAgencyId)
        .eq("role", "owner");
      if (ownersError || !owners) {
        return json(400, { message: "No se pudo quitar." });
      }
      if (owners.length <= 1) {
        return json(403, { message: "Tiene que quedar un dueño." });
      }
      const flagged = owners.filter((owner) => owner.can_invite_owners === true);
      if (target.can_invite_owners === true && flagged.length <= 1) {
        return json(403, { message: "Tiene que quedar alguien que pueda crear dueños." });
      }
    } else if (target.role !== "operator") {
      return json(403, { message: "No se pudo quitar." });
    }

    // Out of this agency only. The account goes when no other agency is left.
    if (!await removePersonFromAgency(admin, userId, targetAgencyId)) {
      return json(400, { message: "No se pudo quitar." });
    }
    return json(200, { ok: true });
  }

  if (action === "add-service") {
    const service = "service" in body && (body.service === "racing" || body.service === "lottery") ? body.service : null;
    if (!service) {
      return json(400, { message: "No se pudo ampliar." });
    }
    const requestedId = targetAgencyId;
    const current = home.product_mode === "lottery" || home.product_mode === "both" ? home.product_mode : "racing";
    const expands =
      (service === "lottery" && current === "racing") || (service === "racing" && current === "lottery");
    const next = expands ? "both" : null;
    if (!next) {
      return json(400, { message: "La agencia ya usa ese servicio." });
    }
    const { error: updateError } = await admin
      .from("agencies")
      .update({ product_mode: next })
      .eq("agency_id", requestedId);
    if (updateError) {
      return json(400, { message: "No se pudo ampliar." });
    }
    return json(200, { productMode: next });
  }

  if (action === "remove-service") {
    const service = "service" in body && (body.service === "racing" || body.service === "lottery") ? body.service : null;
    if (!service) {
      return json(400, { message: "No se pudo quitar." });
    }
    const requestedId = targetAgencyId;
    if (home.product_mode !== "both") {
      return json(400, { message: "Tiene que quedar un servicio." });
    }
    const next = service === "lottery" ? "racing" : "lottery";
    const { error: updateError } = await admin
      .from("agencies")
      .update({ product_mode: next })
      .eq("agency_id", requestedId);
    if (updateError) {
      return json(400, { message: "No se pudo quitar." });
    }
    return json(200, { productMode: next });
  }

  return json(400, { message: "No se pudo completar." });
});
