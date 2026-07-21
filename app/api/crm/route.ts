type LeadStatus =
  | "Pendiente"
  | "Contactado"
  | "Respondi\u00f3"
  | "Propuesta enviada"
  | "Reuni\u00f3n agendada"
  | "Cerrado"
  | "No respondi\u00f3"
  | "No interesado"
  | "N\u00famero incorrecto"
  | "Perdido";

type DbLead = {
  id: string;
  business_name: string;
  email: string;
  phone: string;
  segment: string;
  owner: string;
  status: string;
  priority: string;
  batch: string;
  notes: string;
  next_follow_up: string | null;
  source: string;
  created_at: string;
  updated_at: string;
};

type DbEvent = {
  id: string;
  lead_id: string;
  type: string;
  from_status: string | null;
  to_status: string | null;
  actor: string;
  note: string;
  created_at: string;
};

type DbTemplate = {
  id: string;
  name: string;
  channel: string;
  stage: string;
  body: string;
  active: boolean;
  created_at: string;
};

type LeadInput = {
  businessName?: unknown;
  email?: unknown;
  phone?: unknown;
  segment?: unknown;
  owner?: unknown;
  status?: unknown;
  priority?: unknown;
  batch?: unknown;
  notes?: unknown;
  nextFollowUp?: unknown;
};

const responsibleOwners = ["Franco", "Trezza", "Laucha"];

function env(name: string) {
  return process.env[name]?.trim() ?? "";
}

function supabaseConfig() {
  const url = env("SUPABASE_URL") || env("NEXT_PUBLIC_SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en las variables de entorno.");
  return { url: url.replace(/\/$/, ""), key };
}

async function supabase<T>(path: string, init: RequestInit = {}) {
  const { url, key } = supabaseConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = body?.message ?? body?.hint ?? response.statusText;
    throw new Error(`Supabase ${response.status}: ${message}`);
  }
  return body as T;
}

function id(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function cleanStatus(value: unknown): LeadStatus {
  const raw = String(value ?? "Pendiente").trim();
  const normalized = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const statuses: Record<string, LeadStatus> = {
    pendiente: "Pendiente",
    contactado: "Contactado",
    respondio: "Respondi\u00f3",
    "propuesta enviada": "Propuesta enviada",
    "reunion agendada": "Reuni\u00f3n agendada",
    cerrado: "Cerrado",
    "no respondio": "No respondi\u00f3",
    "no interesado": "No interesado",
    "numero incorrecto": "N\u00famero incorrecto",
    perdido: "Perdido",
  };
  return statuses[normalized] ?? "Pendiente";
}

function cleanOwner(value: unknown, fallback: string) {
  const raw = String(value ?? "").trim();
  const normalized = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const matched = responsibleOwners.find((owner) => owner.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() === normalized);
  if (matched) return matched;
  return responsibleOwners.includes(fallback) ? fallback : responsibleOwners[0];
}

function eventType(status: string) {
  return ({
    Contactado: "contacted",
    ["Respondi\u00f3"]: "replied",
    "Propuesta enviada": "proposal",
    ["Reuni\u00f3n agendada"]: "meeting",
    Cerrado: "closed",
    ["No respondi\u00f3"]: "no_reply",
    "No interesado": "not_interested",
    ["N\u00famero incorrecto"]: "wrong_number",
    Perdido: "lost",
  } as Record<string, string>)[status] ?? "stage_changed";
}

function actorFrom(request: Request) {
  const email = request.headers.get("oai-authenticated-user-email");
  const host = new URL(request.url).hostname;
  if (email) return email;
  if (host === "localhost" || host === "127.0.0.1") return "Franco - Vista local";
  return env("CRM_DEFAULT_ACTOR") || "Equipo Sincro";
}

function fromLead(row: DbLead) {
  return {
    id: row.id,
    businessName: row.business_name,
    email: row.email,
    phone: row.phone,
    segment: row.segment,
    owner: row.owner,
    status: row.status,
    priority: row.priority,
    batch: row.batch,
    notes: row.notes,
    nextFollowUp: row.next_follow_up,
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function fromEvent(row: DbEvent) {
  return {
    id: row.id,
    leadId: row.lead_id,
    type: row.type,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    actor: row.actor,
    note: row.note,
    createdAt: row.created_at,
  };
}

function fromTemplate(row: DbTemplate) {
  return {
    id: row.id,
    name: row.name,
    channel: row.channel,
    stage: row.stage,
    body: row.body,
    active: row.active,
    createdAt: row.created_at,
  };
}

function toLead(input: LeadInput, actor: string, source: "Manual" | "Excel", now: string) {
  const businessName = String(input.businessName ?? "").trim();
  const email = String(input.email ?? "").trim().toLowerCase();
  const phone = String(input.phone ?? "").replace(/\D/g, "");
  if (!businessName || (!email && !phone)) return null;
  return {
    id: id("lead"),
    business_name: businessName,
    email,
    phone,
    segment: String(input.segment ?? "General").trim() || "General",
    owner: cleanOwner(input.owner, actor),
    status: cleanStatus(input.status),
    priority: String(input.priority ?? "Media").trim() || "Media",
    batch: String(input.batch ?? "").trim(),
    notes: String(input.notes ?? "").trim(),
    next_follow_up: input.nextFollowUp ? String(input.nextFollowUp) : null,
    source,
    created_at: now,
    updated_at: now,
  };
}

export async function GET(request: Request) {
  try {
    const actor = actorFrom(request);
    const [leadRows, eventRows, templateRows] = await Promise.all([
      supabase<DbLead[]>("leads?select=*&order=updated_at.desc"),
      supabase<DbEvent[]>("events?select=*&order=created_at.desc&limit=2000"),
      supabase<DbTemplate[]>("message_templates?select=*&order=created_at.desc"),
    ]);
    return Response.json({
      leads: leadRows.map(fromLead),
      events: eventRows.map(fromEvent),
      templates: templateRows.map(fromTemplate),
      actor,
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Error de base de datos" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const actor = actorFrom(request);
    const payload = await request.json() as Record<string, any>;
    const now = new Date().toISOString();

    if (payload.action === "create") {
      const lead = toLead(payload.lead ?? {}, actor, "Manual", now);
      if (!lead) return Response.json({ error: "Ingresa el negocio y al menos un email o telefono." }, { status: 400 });
      const [created] = await supabase<DbLead[]>("leads", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(lead),
      });
      await supabase("events", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ id: id("evt"), lead_id: created.id, type: "created", from_status: null, to_status: created.status, actor, note: "Prospecto creado", created_at: now }),
      });
      return Response.json({ lead: fromLead(created) }, { status: 201 });
    }

    if (payload.action === "updateStage") {
      const leadId = String(payload.leadId ?? "");
      const params = new URLSearchParams({ select: "*", id: `eq.${leadId}`, limit: "1" });
      const [current] = await supabase<DbLead[]>(`leads?${params.toString()}`);
      if (!current) return Response.json({ error: "Prospecto no encontrado" }, { status: 404 });
      const status = cleanStatus(payload.status);
      const updateParams = new URLSearchParams({ id: `eq.${leadId}` });
      const [updated] = await supabase<DbLead[]>(`leads?${updateParams.toString()}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ status, updated_at: now }),
      });
      const event = { id: id("evt"), lead_id: current.id, type: eventType(status), from_status: current.status, to_status: status, actor, note: String(payload.note ?? ""), created_at: now };
      const [createdEvent] = await supabase<DbEvent[]>("events", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(event),
      });
      return Response.json({ lead: fromLead(updated), event: fromEvent(createdEvent) });
    }

    if (payload.action === "updateOwner") {
      const leadIds = Array.isArray(payload.leadIds) ? payload.leadIds.map(String).filter(Boolean).slice(0, 500) : [];
      const owner = cleanOwner(payload.owner, actor);
      if (!leadIds.length) return Response.json({ error: "Selecciona al menos un prospecto." }, { status: 400 });
      const params = new URLSearchParams({ id: `in.(${leadIds.join(",")})` });
      const updated = await supabase<DbLead[]>(`leads?${params.toString()}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ owner, updated_at: now }),
      });
      return Response.json({ leads: updated.map(fromLead) });
    }

    if (payload.action === "deleteLead") {
      const leadId = String(payload.leadId ?? "");
      if (!leadId) return Response.json({ error: "Prospecto no encontrado" }, { status: 404 });
      const eventParams = new URLSearchParams({ lead_id: `eq.${leadId}` });
      await supabase(`events?${eventParams.toString()}`, {
        method: "DELETE",
        headers: { Prefer: "return=minimal" },
      });
      const leadParams = new URLSearchParams({ id: `eq.${leadId}` });
      await supabase(`leads?${leadParams.toString()}`, {
        method: "DELETE",
        headers: { Prefer: "return=minimal" },
      });
      return Response.json({ ok: true });
    }

    if (payload.action === "import") {
      const incoming = Array.isArray(payload.leads) ? payload.leads.slice(0, 2000) : [];
      const existing = await supabase<Array<{ email: string; phone: string }>>("leads?select=email,phone");
      const keys = new Set(existing.flatMap((row) => [row.email && `e:${row.email.toLowerCase()}`, row.phone && `p:${row.phone}`]).filter(Boolean));
      const accepted = [];
      let skipped = 0;
      for (const item of incoming) {
        const lead = toLead(item, actor, "Excel", now);
        if (!lead || (lead.email && keys.has(`e:${lead.email}`)) || (lead.phone && keys.has(`p:${lead.phone}`))) {
          skipped++;
          continue;
        }
        if (lead.email) keys.add(`e:${lead.email}`);
        if (lead.phone) keys.add(`p:${lead.phone}`);
        accepted.push(lead);
      }
      if (accepted.length) {
        await supabase("leads", {
          method: "POST",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify(accepted),
        });
        await supabase("events", {
          method: "POST",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify(accepted.map((lead) => ({ id: id("evt"), lead_id: lead.id, type: "created", from_status: null, to_status: lead.status, actor, note: "Importado desde Excel", created_at: now }))),
        });
      }
      return Response.json({ added: accepted.length, skipped });
    }

    if (payload.action === "saveTemplate") {
      const name = String(payload.template?.name ?? "").trim();
      const body = String(payload.template?.body ?? "").trim();
      if (!name || !body) return Response.json({ error: "Completa el nombre y el mensaje." }, { status: 400 });
      const template = {
        id: id("tpl"),
        name,
        channel: payload.template?.channel === "Email" ? "Email" : "WhatsApp",
        stage: cleanStatus(payload.template?.stage),
        body,
        active: true,
        created_at: now,
      };
      const [created] = await supabase<DbTemplate[]>("message_templates", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(template),
      });
      return Response.json({ template: fromTemplate(created) }, { status: 201 });
    }

    if (payload.action === "updateTemplate") {
      const templateId = String(payload.templateId ?? "").trim();
      const name = String(payload.template?.name ?? "").trim();
      const body = String(payload.template?.body ?? "").trim();
      if (!templateId) return Response.json({ error: "Plantilla no encontrada." }, { status: 404 });
      if (!name || !body) return Response.json({ error: "Completa el nombre y el mensaje." }, { status: 400 });
      const params = new URLSearchParams({ id: `eq.${templateId}` });
      const [updated] = await supabase<DbTemplate[]>(`message_templates?${params.toString()}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ name, channel: payload.template?.channel === "Email" ? "Email" : "WhatsApp", stage: cleanStatus(payload.template?.stage), body }),
      });
      if (!updated) return Response.json({ error: "Plantilla no encontrada." }, { status: 404 });
      return Response.json({ template: fromTemplate(updated) });
    }

    if (payload.action === "deleteTemplate") {
      const templateId = String(payload.templateId ?? "").trim();
      if (!templateId) return Response.json({ error: "Plantilla no encontrada." }, { status: 404 });
      const params = new URLSearchParams({ id: `eq.${templateId}` });
      await supabase(`message_templates?${params.toString()}`, {
        method: "DELETE",
        headers: { Prefer: "return=minimal" },
      });
      return Response.json({ ok: true });
    }

    return Response.json({ error: "Accion no valida" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Error inesperado" }, { status: 500 });
  }
}
