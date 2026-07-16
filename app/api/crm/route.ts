import { and, desc, eq, or } from "drizzle-orm";
import { getDb } from "../../../db";
import { events, leads, messageTemplates } from "../../../db/schema";

const defaultTemplates = [
  { name: "Primer contacto · WhatsApp", channel: "WhatsApp", stage: "Pendiente", body: "Hola, ¿cómo estás? Vi el trabajo de {{negocio}} y quería consultarte si hoy tienen procesos que les gustaría automatizar. En Sincro AI ayudamos a ordenar tareas repetitivas y seguimiento comercial. ¿Te puedo contar una idea puntual?" },
  { name: "Primer contacto · Email", channel: "Email", stage: "Pendiente", body: "Asunto: Una idea para optimizar {{negocio}}\n\nHola, ¿cómo estás? Estuve viendo {{negocio}} y detecté una oportunidad para ahorrar tiempo en tareas operativas. En Sincro AI armamos automatizaciones a medida. ¿Te parece si te envío un ejemplo breve?" },
  { name: "Seguimiento sin respuesta", channel: "WhatsApp", stage: "No respondió", body: "Hola, retomo este mensaje por si se te pasó. Tengo una idea concreta para simplificar parte de la operación de {{negocio}}. Si te sirve, te la resumo en dos minutos por acá." },
  { name: "Envío de propuesta", channel: "Email", stage: "Propuesta enviada", body: "Hola, te comparto la propuesta que conversamos. Resume el alcance, los tiempos y el impacto esperado. Si te parece, coordinamos una llamada breve para revisar dudas y próximos pasos." },
];

function id(prefix: string) { return `${prefix}_${crypto.randomUUID()}`; }
function actorFrom(request: Request) {
  const email = request.headers.get("oai-authenticated-user-email");
  const host = new URL(request.url).hostname;
  if (email) return email;
  if (host === "localhost" || host === "127.0.0.1") return "Franco · Vista local";
  return null;
}
function eventType(status: string) {
  return ({ Contactado: "contacted", "Respondió": "replied", "Propuesta enviada": "proposal", "Reunión agendada": "meeting", Cerrado: "closed", "No respondió": "no_reply", "No interesado": "not_interested", Perdido: "lost" } as Record<string, string>)[status] ?? "stage_changed";
}

async function seed(includeDemo: boolean) {
  const db = getDb();
  const existingTemplates = await db.select({ id: messageTemplates.id }).from(messageTemplates).limit(1);
  if (!existingTemplates.length) {
    const now = new Date().toISOString();
    await db.insert(messageTemplates).values(defaultTemplates.map((t, i) => ({ id: `tpl_${i + 1}`, ...t, active: true, createdAt: now })));
  }
  if (!includeDemo) return;
  const existing = await db.select({ id: leads.id }).from(leads).limit(1);
  if (existing.length) return;
  const now = Date.now();
  const days = (n: number) => new Date(now - n * 86400000).toISOString();
  const sample = [
    ["Nexo Hogar", "hola@nexohogar.com", "5491142339012", "Muebles", "Franco", "Reunión agendada", "Alta", "Tanda 1", 5],
    ["Estudio Norte", "contacto@estudionorte.com", "5491158812203", "Arquitectura", "Equipo 2", "Propuesta enviada", "Alta", "Tanda 1", 4],
    ["Casa Mía Deco", "info@casamiadeco.com", "5491164321188", "Decoración", "Equipo 3", "Respondió", "Media", "Tanda 2", 3],
    ["Borneo Café", "hola@borneocafe.com", "", "Gastronomía", "Franco", "Contactado", "Media", "Tanda 2", 2],
    ["Lumen Arquitectura", "estudio@lumenarq.com", "5491147781120", "Arquitectura", "Equipo 2", "Cerrado", "Alta", "Tanda 1", 6],
    ["Marea Objetos", "ventas@mareaobjetos.com", "5491132198870", "Retail", "Equipo 3", "No respondió", "Baja", "Tanda 3", 7],
    ["Taller Sur", "", "5491167780911", "Construcción", "Franco", "Pendiente", "Media", "Tanda 3", 1],
    ["Prisma Estudio", "hola@prismaestudio.com", "5491159921200", "Arquitectura", "Equipo 2", "Propuesta enviada", "Alta", "Tanda 2", 1],
  ];
  const leadRows = sample.map((r, index) => ({ id: `demo_${index + 1}`, businessName: String(r[0]), email: String(r[1]), phone: String(r[2]), segment: String(r[3]), owner: String(r[4]), status: String(r[5]), priority: String(r[6]), batch: String(r[7]), notes: "", nextFollowUp: index < 4 ? days(-index - 1) : null, source: "Ejemplo", createdAt: days(Number(r[8]) + 2), updatedAt: days(Number(r[8])) }));
  await db.insert(leads).values(leadRows);
  const eventRows = leadRows.flatMap((lead, index) => {
    const rows = [{ id: id("evt"), leadId: lead.id, type: "contacted", fromStatus: "Pendiente", toStatus: "Contactado", actor: lead.owner, note: "Primer contacto", createdAt: days(Number(sample[index][8])) }];
    const progression = ["Respondió", "Propuesta enviada", "Reunión agendada", "Cerrado"];
    const target = progression.indexOf(lead.status);
    for (let i = 0; i <= target; i++) rows.push({ id: id("evt"), leadId: lead.id, type: eventType(progression[i]), fromStatus: i ? progression[i - 1] : "Contactado", toStatus: progression[i], actor: lead.owner, note: "", createdAt: days(Math.max(0, Number(sample[index][8]) - i - 1)) });
    if (lead.status === "No respondió") rows.push({ id: id("evt"), leadId: lead.id, type: "no_reply", fromStatus: "Contactado", toStatus: "No respondió", actor: lead.owner, note: "", createdAt: days(5) });
    return rows;
  });
  await db.insert(events).values(eventRows);
}

export async function GET(request: Request) {
  const actor = actorFrom(request);
  if (!actor) return Response.json({ error: "No autorizado" }, { status: 401 });
  try {
    const host = new URL(request.url).hostname;
    await seed(host === "localhost" || host === "127.0.0.1");
    const db = getDb();
    const [leadRows, eventRows, templateRows] = await Promise.all([
      db.select().from(leads).orderBy(desc(leads.updatedAt)),
      db.select().from(events).orderBy(desc(events.createdAt)).limit(2000),
      db.select().from(messageTemplates).orderBy(desc(messageTemplates.createdAt)),
    ]);
    return Response.json({ leads: leadRows, events: eventRows, templates: templateRows, actor });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Error de base de datos" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const actor = actorFrom(request);
  if (!actor) return Response.json({ error: "No autorizado" }, { status: 401 });
  try {
    const payload = await request.json() as Record<string, any>;
    const db = getDb();
    const now = new Date().toISOString();

    if (payload.action === "create") {
      const input = payload.lead ?? {};
      if (!String(input.businessName ?? "").trim() || (!String(input.email ?? "").trim() && !String(input.phone ?? "").trim())) return Response.json({ error: "Ingresá el negocio y al menos un email o teléfono." }, { status: 400 });
      const lead = { id: id("lead"), businessName: String(input.businessName).trim(), email: String(input.email ?? "").trim().toLowerCase(), phone: String(input.phone ?? "").replace(/\D/g, ""), segment: String(input.segment ?? "General"), owner: String(input.owner ?? actor), status: String(input.status ?? "Pendiente"), priority: String(input.priority ?? "Media"), batch: String(input.batch ?? ""), notes: String(input.notes ?? ""), nextFollowUp: input.nextFollowUp || null, source: "Manual", createdAt: now, updatedAt: now };
      await db.insert(leads).values(lead);
      await db.insert(events).values({ id: id("evt"), leadId: lead.id, type: "created", fromStatus: null, toStatus: lead.status, actor, note: "Prospecto creado", createdAt: now });
      return Response.json({ lead }, { status: 201 });
    }

    if (payload.action === "updateStage") {
      const [current] = await db.select().from(leads).where(eq(leads.id, String(payload.leadId))).limit(1);
      if (!current) return Response.json({ error: "Prospecto no encontrado" }, { status: 404 });
      const status = String(payload.status);
      await db.update(leads).set({ status, updatedAt: now }).where(eq(leads.id, current.id));
      const event = { id: id("evt"), leadId: current.id, type: eventType(status), fromStatus: current.status, toStatus: status, actor, note: String(payload.note ?? ""), createdAt: now };
      await db.insert(events).values(event);
      return Response.json({ lead: { ...current, status, updatedAt: now }, event });
    }

    if (payload.action === "import") {
      const incoming = Array.isArray(payload.leads) ? payload.leads.slice(0, 2000) : [];
      const existing = await db.select({ email: leads.email, phone: leads.phone }).from(leads);
      const keys = new Set(existing.flatMap((r) => [r.email && `e:${r.email.toLowerCase()}`, r.phone && `p:${r.phone}`]).filter(Boolean));
      const accepted: any[] = [];
      let skipped = 0;
      for (const item of incoming) {
        const businessName = String(item.businessName ?? "").trim();
        const email = String(item.email ?? "").trim().toLowerCase();
        const phone = String(item.phone ?? "").replace(/\D/g, "");
        if (!businessName || (!email && !phone) || (email && keys.has(`e:${email}`)) || (phone && keys.has(`p:${phone}`))) { skipped++; continue; }
        if (email) keys.add(`e:${email}`); if (phone) keys.add(`p:${phone}`);
        accepted.push({ id: id("lead"), businessName, email, phone, segment: String(item.segment ?? "General"), owner: String(item.owner ?? actor), status: String(item.status ?? "Pendiente"), priority: String(item.priority ?? "Media"), batch: String(item.batch ?? ""), notes: String(item.notes ?? ""), nextFollowUp: null, source: "Excel", createdAt: now, updatedAt: now });
      }
      if (accepted.length) {
        await db.insert(leads).values(accepted);
        await db.insert(events).values(accepted.map((lead) => ({ id: id("evt"), leadId: lead.id, type: "created", fromStatus: null, toStatus: lead.status, actor, note: "Importado desde Excel", createdAt: now })));
      }
      return Response.json({ added: accepted.length, skipped });
    }

    if (payload.action === "saveTemplate") {
      const template = { id: id("tpl"), name: String(payload.template?.name ?? "Nueva plantilla"), channel: String(payload.template?.channel ?? "WhatsApp"), stage: String(payload.template?.stage ?? "Pendiente"), body: String(payload.template?.body ?? ""), active: true, createdAt: now };
      await db.insert(messageTemplates).values(template);
      return Response.json({ template }, { status: 201 });
    }

    return Response.json({ error: "Acción no válida" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Error inesperado" }, { status: 500 });
  }
}
