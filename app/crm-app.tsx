"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowDown, ArrowUp, BriefcaseBusiness, CalendarClock, Check, ChevronDown, CircleDollarSign, Clipboard, Clock3, Copy, Download, FileSpreadsheet, Filter, LayoutDashboard, LoaderCircle, Mail, Menu, MessageSquareText, MoreHorizontal, Pencil, Phone, Plus, Search, Sparkles, Target, Trash2, TrendingUp, Upload, Users, X } from "lucide-react";

type Lead = { id: string; businessName: string; email: string; phone: string; segment: string; owner: string; status: string; priority: string; batch: string; notes: string; nextFollowUp: string | null; source: string; createdAt: string; updatedAt: string };
type Event = { id: string; leadId: string; type: string; fromStatus: string | null; toStatus: string | null; actor: string; note: string; createdAt: string };
type Template = { id: string; name: string; channel: string; stage: string; body: string; active: boolean; createdAt: string };
type ApiResponse = { lead?: Lead; leads?: Lead[]; event?: Event | null; template?: Template; added?: number; skipped?: number; total?: number; error?: string; [key: string]: unknown };
type Workspace = "crm" | "obra";
type Page = "resumen" | "pipeline" | "contactos" | "sincro-obra" | "importar" | "mensajes";

const stages = ["Pendiente", "Contactado", "Respondió", "Propuesta enviada", "Reunión agendada", "Cerrado", "No respondió", "No interesado", "Número incorrecto", "Perdido"];
const responsibleOwners = ["Franco", "Trezza", "Laucha"];
const sincroObraSource = "Sincro Obra";
const pipelineStages = stages.slice(0, 6);
const stageMeta: Record<string, { color: string; tint: string }> = {
  Pendiente: { color: "#6E7682", tint: "#ECECE7" }, Contactado: { color: "#2C7E96", tint: "#E5EFF1" }, "Respondió": { color: "#0A2540", tint: "#E6EBF0" }, "Propuesta enviada": { color: "#C25A12", tint: "#F6DCC6" }, "Reunión agendada": { color: "#287665", tint: "#E3F1ED" }, Cerrado: { color: "#2E7D32", tint: "#E5F2E4" }, "No respondió": { color: "#8A6D4A", tint: "#F2ECE4" }, "No interesado": { color: "#B44742", tint: "#F8E8E6" }, "Número incorrecto": { color: "#8C3338", tint: "#F5E5E6" }, Perdido: { color: "#8C3338", tint: "#F5E5E6" },
};
const nav = [
  { id: "resumen" as Page, label: "Resumen", icon: LayoutDashboard }, { id: "pipeline" as Page, label: "Pipeline", icon: TrendingUp }, { id: "contactos" as Page, label: "Prospectos", icon: Users }, { id: "sincro-obra" as Page, label: "Sincro Obra", icon: BriefcaseBusiness }, { id: "importar" as Page, label: "Importar Excel", icon: FileSpreadsheet }, { id: "mensajes" as Page, label: "Mensajes", icon: MessageSquareText },
];
const eventLabels: Record<string, string> = { contacted: "contactó a", replied: "registró respuesta de", proposal: "envió propuesta a", meeting: "agendó reunión con", closed: "cerró a", created: "cargó a", no_reply: "marcó sin respuesta a", wrong_number: "marcó número incorrecto a", stage_changed: "actualizó a" };

const fallbackData = { leads: [] as Lead[], events: [] as Event[], templates: [] as Template[] };
const dailyContactTarget = 100;
const weeklyContactTarget = 500;
const dayMs = 86400000;

function normalizedStatus(value: string | null | undefined) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function matchesLeadSearch(lead: Lead, query: string) {
  const normalizedQuery = normalizedStatus(query).trim();
  if (!normalizedQuery) return true;
  const searchableText = normalizedStatus(`${lead.businessName} ${lead.email} ${lead.segment} ${lead.owner} ${lead.status}`);
  const queryDigits = query.replace(/\D/g, "");
  const phoneDigits = lead.phone.replace(/\D/g, "");
  return searchableText.includes(normalizedQuery) || Boolean(queryDigits && phoneDigits.includes(queryDigits));
}

function isStatus(value: string | null | undefined, status: string) {
  return normalizedStatus(value) === normalizedStatus(status);
}

function movedBetween(event: Event, from: string, to: string) {
  return isStatus(event.fromStatus, from) && isStatus(event.toStatus, to);
}

function reachedStatus(lead: Lead, values: string[]) {
  const current = normalizedStatus(lead.status);
  return values.map(normalizedStatus).includes(current);
}

function isSincroObraLead(lead: Lead) {
  return lead.source === sincroObraSource;
}

export default function CrmApp({ currentUser }: { currentUser: string }) {
  const [page, setPage] = useState<Page>("resumen");
  const [data, setData] = useState(fallbackData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [addWorkspace, setAddWorkspace] = useState<Workspace | null>(null);
  const [period, setPeriod] = useState<"hoy" | "semana" | "mes">("semana");
  const [metricNow] = useState(() => Date.now());

  async function refresh() {
    try {
      const response = await fetch("/api/crm", { cache: "no-store" });
      const json = await response.json() as typeof fallbackData & { error?: string };
      if (!response.ok) throw new Error(json.error || "No se pudo cargar la información");
      setData(json);
      setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "Error de conexión"); }
    finally { setLoading(false); }
  }
  useEffect(() => { const timeout = window.setTimeout(() => void refresh(), 0); return () => window.clearTimeout(timeout); }, []);

  async function api(payload: Record<string, unknown>) {
    const response = await fetch("/api/crm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const json = await response.json() as ApiResponse;
    if (!response.ok) throw new Error(json.error || "No se pudo guardar");
    return json;
  }

  async function moveLead(leadId: string, status: string) {
    const original = data;
    const now = new Date().toISOString();
    const lead = data.leads.find((l) => l.id === leadId);
    if (!lead || lead.status === status) return;
    setData((d) => ({ ...d, leads: d.leads.map((l) => l.id === leadId ? { ...l, status, updatedAt: now } : l), events: [{ id: `temp_${Date.now()}`, leadId, type: ({ Contactado: "contacted", "Respondió": "replied", "Propuesta enviada": "proposal", "Reunión agendada": "meeting", Cerrado: "closed", "Número incorrecto": "wrong_number" } as Record<string,string>)[status] ?? "stage_changed", fromStatus: lead.status, toStatus: status, actor: currentUser, note: "", createdAt: now }, ...d.events] }));
    try {
      const saved = await api({ action: "updateStage", leadId, status });
      setData((d) => ({
        ...d,
        leads: d.leads.map((l) => l.id === leadId ? saved.lead ?? l : l),
        events: saved.event ? [saved.event, ...d.events.filter((e) => !e.id.startsWith("temp_"))] : d.events.filter((e) => !e.id.startsWith("temp_")),
      }));
    }
    catch (e) { setData(original); setError(e instanceof Error ? e.message : "No se pudo actualizar"); }
  }

  async function deleteLead(leadId: string) {
    const lead = data.leads.find((l) => l.id === leadId);
    if (!lead) return;
    if (!window.confirm(`Eliminar "${lead.businessName}" del CRM? Esta accion no se puede deshacer.`)) return;
    const original = data;
    setData((d) => ({ ...d, leads: d.leads.filter((l) => l.id !== leadId), events: d.events.filter((e) => e.leadId !== leadId) }));
    try { await api({ action: "deleteLead", leadId }); }
    catch (e) { setData(original); setError(e instanceof Error ? e.message : "No se pudo eliminar"); }
  }

  async function updateLeadOwner(leadIds: string[], owner: string) {
    if (!leadIds.length || !responsibleOwners.includes(owner)) return;
    const original = data;
    const now = new Date().toISOString();
    setData((d) => ({ ...d, leads: d.leads.map((l) => leadIds.includes(l.id) ? { ...l, owner, updatedAt: now } : l) }));
    try {
      const saved = await api({ action: "updateOwner", leadIds, owner });
      const updatedLeads = saved.leads;
      if (Array.isArray(updatedLeads)) setData((d) => ({ ...d, leads: d.leads.map((l) => updatedLeads.find((u: Lead) => u.id === l.id) ?? l) }));
    } catch (e) { setData(original); setError(e instanceof Error ? e.message : "No se pudo reasignar"); }
  }

  async function updateLead(leadId: string, leadChanges: Partial<Lead>) {
    const original = data;
    const now = new Date().toISOString();
    setData((d) => ({ ...d, leads: d.leads.map((l) => l.id === leadId ? { ...l, ...leadChanges, updatedAt: now } : l) }));
    try {
      const saved = await api({ action: "updateLead", leadId, lead: leadChanges });
      setData((d) => ({
        ...d,
        leads: d.leads.map((l) => l.id === leadId ? saved.lead ?? l : l),
        events: saved.event ? [saved.event, ...d.events] : d.events,
      }));
    } catch (e) {
      setData(original);
      setError(e instanceof Error ? e.message : "No se pudo editar el prospecto");
      throw e;
    }
  }

  const crmLeads = useMemo(() => data.leads.filter((lead) => !isSincroObraLead(lead)), [data.leads]);
  const obraLeads = useMemo(() => data.leads.filter(isSincroObraLead), [data.leads]);
  const crmLeadIds = useMemo(() => new Set(crmLeads.map((lead) => lead.id)), [crmLeads]);
  const crmEvents = useMemo(() => data.events.filter((event) => crmLeadIds.has(event.leadId)), [data.events, crmLeadIds]);

  const contactGoal = useMemo(() => {
    const now = metricNow;
    const contactMoves = crmEvents.filter((event) => movedBetween(event, "Pendiente", "Contactado"));
    const today = contactMoves.filter((event) => new Date(event.createdAt).getTime() >= now - dayMs).length;
    const week = contactMoves.filter((event) => new Date(event.createdAt).getTime() >= now - 7 * dayMs).length;
    return { today, week, progress: Math.min(100, Math.round((week / weeklyContactTarget) * 100)) };
  }, [crmEvents, metricNow]);

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
        <div className="sidebar-brand"><div className="brand-mark small" aria-hidden="true"><span className="logo-node light"/><span className="logo-bridge"/><span className="logo-node clay"/></div><div><div className="brand-wordmark"><strong>Sincro</strong><b>CRM</b></div><small>Pipeline comercial</small></div><button className="icon-button close-menu" onClick={() => setMenuOpen(false)} aria-label="Cerrar menú"><X size={18}/></button></div>
        <nav>{nav.map(({ id, label, icon: Icon }) => <button key={id} className={page === id ? "active" : ""} onClick={() => { setPage(id); setMenuOpen(false); }}><Icon size={18}/><span>{label}</span>{id === "contactos" && <em>{crmLeads.length}</em>}{id === "sincro-obra" && <em>{obraLeads.length}</em>}</button>)}</nav>
        <div className="sidebar-insight"><Sparkles size={18}/><strong>Objetivo semanal</strong><p>{contactGoal.today} contactados hoy · meta {dailyContactTarget}</p><div className="mini-progress"><span style={{ width: `${contactGoal.progress}%` }}/></div><small>{contactGoal.week} de {weeklyContactTarget} contactos</small></div>
        <div className="sidebar-footer"><div className="avatar">{initials(currentUser)}</div><div><strong>{currentUser.split(" · ")[0]}</strong><small>Equipo Sincro AI</small></div><MoreHorizontal size={18}/></div>
      </aside>

      <main className="main-area">
        {page !== "contactos" && page !== "sincro-obra" && <header className="topbar"><button className="icon-button mobile-menu" onClick={() => setMenuOpen(true)} aria-label="Abrir menú"><Menu size={20}/></button><div className="top-actions"><button className="icon-button notification" aria-label="Notificaciones"><Clock3 size={18}/><span/></button><button className="primary-button" onClick={() => setAddWorkspace("crm")}><Plus size={18}/> Nuevo prospecto</button></div></header>}
        {error && <div className="error-banner"><span>{error}</span><button onClick={() => { setError(""); void refresh(); }}>Reintentar</button></div>}
        {loading ? <Loading/> : <>
          {page === "resumen" && <Dashboard leads={crmLeads} events={crmEvents} now={metricNow} period={period} setPeriod={setPeriod} setPage={setPage}/>}
          {page === "pipeline" && <Pipeline leads={crmLeads} moveLead={moveLead}/>}
          {page === "contactos" && <Contacts key="crm-prospects" leads={crmLeads} workspace="crm" openMenu={() => setMenuOpen(true)} moveLead={moveLead} updateLead={updateLead} updateLeadOwner={updateLeadOwner} deleteLead={deleteLead} onAdd={() => setAddWorkspace("crm")}/>}
          {page === "sincro-obra" && <Contacts key="obra-prospects" leads={obraLeads} workspace="obra" openMenu={() => setMenuOpen(true)} moveLead={moveLead} updateLead={updateLead} updateLeadOwner={updateLeadOwner} deleteLead={deleteLead} onAdd={() => setAddWorkspace("obra")} onImport={() => { sessionStorage.setItem("crm-import-workspace", "obra"); setPage("importar"); }}/>}
          {page === "importar" && <Importer api={api} refresh={refresh}/>} 
          {page === "mensajes" && <Messages templates={data.templates} api={api} refresh={refresh}/>} 
        </>}
      </main>
      {addWorkspace && <AddLead currentUser={currentUser} workspace={addWorkspace} api={api} close={() => setAddWorkspace(null)} saved={async () => { setAddWorkspace(null); await refresh(); }}/>}
    </div>
  );
}

function Loading() { return <div className="loading"><LoaderCircle className="spin"/><p>Sincronizando la operación comercial...</p></div>; }

function Dashboard({ leads, events, now, period, setPeriod, setPage }: { leads: Lead[]; events: Event[]; now:number; period: string; setPeriod: (p: "hoy"|"semana"|"mes") => void; setPage: (p: Page) => void }) {
  const cutoff = now - (period === "hoy" ? dayMs : period === "semana" ? 7 * dayMs : 30 * dayMs);
  const periodEvents = events.filter((e) => new Date(e.createdAt).getTime() >= cutoff);
  const safeRate = (n: number, d: number) => d ? Math.round(n / d * 100) : 0;
  const countTransition = (from: string, to: string) => periodEvents.filter((event) => movedBetween(event, from, to)).length;
  const counts = {
    contacted: countTransition("Pendiente", "Contactado"),
    replied: countTransition("Contactado", "Respondió"),
    proposal: countTransition("Respondió", "Propuesta enviada"),
    meeting: countTransition("Propuesta enviada", "Reunión agendada"),
    closed: countTransition("Reunión agendada", "Cerrado"),
  };
  const pendingBase = leads.filter((l) => reachedStatus(l, ["Pendiente"])).length + counts.contacted;
  const bases = {
    contacted: pendingBase,
    replied: counts.contacted + counts.replied,
    proposal: counts.replied + counts.proposal,
    meeting: counts.proposal + counts.meeting,
    closed: counts.meeting + counts.closed,
  };
  const cards = [
    { label: "Contactados", value: counts.contacted, icon: Mail, color: "blue", delta: `${safeRate(counts.contacted, bases.contacted)}% de pendientes` }, { label: "Respondieron", value: counts.replied, icon: MessageSquareText, color: "purple", delta: `${safeRate(counts.replied, bases.replied)}% de contactados` }, { label: "Propuestas", value: counts.proposal, icon: Clipboard, color: "orange", delta: `${safeRate(counts.proposal, bases.proposal)}% de respuestas` }, { label: "Reuniones", value: counts.meeting, icon: CalendarClock, color: "teal", delta: `${safeRate(counts.meeting, bases.meeting)}% de propuestas` }, { label: "Cerrados", value: counts.closed, icon: CircleDollarSign, color: "green", delta: `${safeRate(counts.closed, bases.closed)}% de reuniones` },
  ];
  const funnelMetrics = [
    { label: "Contactados", value: counts.contacted, rate: safeRate(counts.contacted, bases.contacted), base: bases.contacted, color: "#0A2540" },
    { label: "Respondieron", value: counts.replied, rate: safeRate(counts.replied, bases.replied), base: bases.replied, color: "#2C7E96" },
    { label: "Propuesta enviada", value: counts.proposal, rate: safeRate(counts.proposal, bases.proposal), base: bases.proposal, color: "#E9761D" },
    { label: "Reunión agendada", value: counts.meeting, rate: safeRate(counts.meeting, bases.meeting), base: bases.meeting, color: "#287665" },
    { label: "Cliente cerrado", value: counts.closed, rate: safeRate(counts.closed, bases.closed), base: bases.closed, color: "#2E7D32" },
  ] as const;
  const activity = periodEvents.slice(0, 5);
  const leadById = new Map(leads.map((l) => [l.id, l]));
  const ownerFromEvent = (event: Event) => {
    const actor = normalizedStatus(event.actor);
    return responsibleOwners.find((owner) => actor.includes(normalizedStatus(owner))) ?? leadById.get(event.leadId)?.owner ?? "Sin responsable";
  };
  const teamOwners = [...new Set([...responsibleOwners, ...periodEvents.map(ownerFromEvent)])].filter(Boolean);
  const team = teamOwners.map((owner) => {
    const ownerEvents = periodEvents.filter((event) => ownerFromEvent(event) === owner);
    return { owner, contacts: ownerEvents.filter((e) => movedBetween(e, "Pendiente", "Contactado")).length, proposals: ownerEvents.filter((e) => movedBetween(e, "Respondió", "Propuesta enviada")).length, closed: ownerEvents.filter((e) => movedBetween(e, "Reunión agendada", "Cerrado")).length };
  });
  const topBlock = funnelMetrics.slice(1).reduce((prev, curr) => curr.rate < prev.rate ? curr : prev, funnelMetrics[1]);

  return <div className="page-content">
    <div className="page-heading"><div><p className="eyebrow">Centro de control</p><h1>Buen día, equipo <span>👋</span></h1><p>Así viene el rendimiento comercial de Sincro.</p></div><div className="period-control">{(["hoy","semana","mes"] as const).map((p) => <button key={p} className={period === p ? "active" : ""} onClick={() => setPeriod(p)}>{p === "hoy" ? "24 horas" : p === "semana" ? "7 días" : "30 días"}</button>)}</div></div>
    <section className="metric-grid">{cards.map(({ label, value, icon: Icon, color, delta }) => <article className="metric-card" key={label}><div className={`metric-icon ${color}`}><Icon size={19}/></div><div className="metric-copy"><small>{label}</small><strong>{value}</strong><span className={delta.startsWith("+") ? "positive" : ""}>{delta.startsWith("+") && <ArrowUp size={12}/>} {delta}</span></div></article>)}</section>
    <section className="dashboard-grid">
      <article className="panel funnel-panel"><div className="panel-heading"><div><h2>Embudo de conversión</h2><p>Conversión desde la etapa anterior</p></div><button className="text-button" onClick={() => setPage("pipeline")}>Ver pipeline <ArrowDown size={14}/></button></div><div className="funnel">{funnelMetrics.map(({ label, value, rate, base, color }) => <div className="funnel-row" key={label}><div className="funnel-label"><span>{label}</span><strong>{value}</strong></div><div className="funnel-track"><div style={{ width: `${Math.max(rate, value ? 6 : 0)}%`, background: color }}><span>{rate}%</span></div></div><div className="stage-rate">{value} de {base} etapa anterior</div></div>)}</div></article>
      <article className="panel insight-panel"><div className="insight-icon"><Target size={21}/></div><p className="eyebrow">Lectura del embudo</p><h2>La mayor oportunidad está en<br/><span>{topBlock.label}</span></h2><p>Esta etapa concentra la caída más fuerte del período. Revisar el mensaje o material usado acá puede mejorar todo el cierre.</p><div className="insight-stat"><strong>{bases.closed ? Math.max(1, Math.round(bases.closed / Math.max(counts.closed, 1))) : 0}</strong><span>reuniones por cada<br/>cliente cerrado</span></div><button onClick={() => setPage("mensajes")}>Revisar mensajes <ArrowDown size={14}/></button></article>
      <article className="panel activity-panel"><div className="panel-heading"><div><h2>Actividad reciente</h2><p>Últimos movimientos del período</p></div><Activity size={18}/></div><div className="activity-list">{activity.map((event) => { const lead = leadById.get(event.leadId); const owner = ownerFromEvent(event); return <div className="activity-item" key={event.id}><div className="avatar mini">{initials(owner)}</div><div><p><strong>{owner}</strong> {eventLabels[event.type] ?? "actualizó a"} <b>{lead?.businessName ?? "un prospecto"}</b></p><small>{relativeTime(event.createdAt)}</small></div><span className="activity-dot" style={{ background: stageMeta[event.toStatus ?? "Pendiente"]?.color ?? stageMeta.Pendiente.color }}/></div>; })}{!activity.length&&<p className="panel-empty">Sin movimientos en este período.</p>}</div></article>
      <article className="panel team-panel"><div className="panel-heading"><div><h2>Rendimiento del equipo</h2><p>Actividad en el período</p></div><Users size={18}/></div><div className="team-table"><div className="team-row header"><span>Responsable</span><span>Contactos</span><span>Propuestas</span><span>Cierres</span></div>{team.map((m) => <div className="team-row" key={m.owner}><span><div className="avatar tiny">{initials(m.owner)}</div>{m.owner}</span><strong>{m.contacts}</strong><strong>{m.proposals}</strong><strong>{m.closed}</strong></div>)}</div></article>
    </section>
  </div>;
}

function Pipeline({ leads, moveLead }: { leads: Lead[]; moveLead: (id:string,status:string)=>void }) {
  const [dragging, setDragging] = useState<string | null>(null);
  const [filter, setFilter] = useState("Todos");
  const owners = ["Todos", ...new Set(leads.map((l) => l.owner))];
  const visible = filter === "Todos" ? leads : leads.filter((l) => l.owner === filter);
  return <div className="page-content wide"><div className="page-heading"><div><p className="eyebrow">Flujo comercial</p><h1>Pipeline</h1><p>Mové cada oportunidad a medida que avanza.</p></div><label className="select-wrap"><Filter size={15}/><select value={filter} onChange={(e)=>setFilter(e.target.value)}>{owners.map((o)=><option key={o}>{o}</option>)}</select><ChevronDown size={14}/></label></div><div className="pipeline-board">{pipelineStages.map((stage) => { const stageLeads = visible.filter((l) => l.status === stage); return <section className="pipeline-column" key={stage} onDragOver={(e)=>e.preventDefault()} onDrop={()=>{ if(dragging) void moveLead(dragging,stage); setDragging(null); }}><header><div><span className="stage-dot" style={{background:stageMeta[stage].color}}/><strong>{stage}</strong></div><em>{stageLeads.length}</em></header><div className="pipeline-cards">{stageLeads.map((lead)=><article className="lead-card" draggable onDragStart={()=>setDragging(lead.id)} onDragEnd={()=>setDragging(null)} key={lead.id}><div className="lead-card-top"><span className={`priority ${lead.priority.toLowerCase()}`}>{lead.priority}</span><MoreHorizontal size={16}/></div><h3>{lead.businessName}</h3><p>{lead.segment}</p><div className="lead-contact">{lead.email ? <Mail size={14}/> : <Phone size={14}/>}<span>{lead.email || formatPhone(lead.phone)}</span></div><footer><div className="avatar tiny">{initials(lead.owner)}</div><span>{lead.owner}</span><small>{relativeTime(lead.updatedAt)}</small></footer><select aria-label={`Estado de ${lead.businessName}`} value={lead.status} onChange={(e)=>void moveLead(lead.id,e.target.value)}>{stages.map((s)=><option key={s}>{s}</option>)}</select></article>)}</div></section>; })}</div></div>;
}

function Contacts({ leads, workspace, openMenu, moveLead, updateLead, updateLeadOwner, deleteLead, onAdd, onImport }: { leads: Lead[]; workspace:Workspace; openMenu:()=>void; moveLead:(id:string,status:string)=>void; updateLead:(id:string,lead:Partial<Lead>)=>Promise<void>; updateLeadOwner:(ids:string[],owner:string)=>void; deleteLead:(id:string)=>void; onAdd:()=>void; onImport?:()=>void }) {
  const [search, setSearch] = useState(""); const [status, setStatus] = useState("Todos"); const [segmentFilter, setSegmentFilter] = useState("__all__"); const [selected, setSelected] = useState<string[]>([]); const [bulkOwner, setBulkOwner] = useState(responsibleOwners[0]); const [copyMessage, setCopyMessage] = useState(""); const [range, setRange] = useState(""); const [rangeMessage, setRangeMessage] = useState(""); const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const segments = useMemo(() => { const unique = new Map<string,string>(); leads.forEach((lead) => { const label=lead.segment.trim(); if(label&&!unique.has(normalizedStatus(label))) unique.set(normalizedStatus(label),label); }); return [...unique.values()].sort((a,b)=>a.localeCompare(b,"es",{sensitivity:"base"})); }, [leads]);
  const hasUncategorized = leads.some((lead)=>!lead.segment.trim());
  const hasActiveFilters=Boolean(search.trim())||status!=="Todos"||segmentFilter!=="__all__";
  const clearFilters=()=>{setSearch("");setStatus("Todos");setSegmentFilter("__all__");};
  const filtered = leads.filter((l) => (status === "Todos" || l.status === status) && (segmentFilter === "__all__" || (segmentFilter === "__empty__" ? !l.segment.trim() : normalizedStatus(l.segment) === normalizedStatus(segmentFilter))) && matchesLeadSearch(l,search));
  const selectedLeads = filtered.filter((l)=>selected.includes(l.id));
  const selectedWithPhone = selectedLeads.filter((l)=>whatsappNumber(l.phone));
  const allVisibleSelected = filtered.length > 0 && filtered.every((l)=>selected.includes(l.id));
  const toggle = (leadId:string) => setSelected((ids)=>ids.includes(leadId)?ids.filter((id)=>id!==leadId):[...ids,leadId]);
  const selectVisible = () => setSelected((ids)=>allVisibleSelected?ids.filter((id)=>!filtered.some((l)=>l.id===id)):[...new Set([...ids,...filtered.map((l)=>l.id)])]);
  function selectRange(){
    const match=range.trim().match(/^(\d+)\s*[-–—]\s*(\d+)$/);
    if(!match){setRangeMessage("Usá el formato 20-50");return;}
    const start=Number(match[1]); const end=Number(match[2]);
    if(start<1||end<start){setRangeMessage("El segundo número no puede ser menor al primero");return;}
    const rangeIds=filtered.slice(start-1,end).map((l)=>l.id);
    if(!rangeIds.length){setRangeMessage(`No hay prospectos desde el número ${start}`);return;}
    setSelected(rangeIds);
    setRangeMessage(`${rangeIds.length} seleccionados · ${start}-${Math.min(end,filtered.length)}`);
  }
  async function copyText(text:string, message:string){ if(!text){setCopyMessage("No hay teléfonos seleccionados.");return;} try{ await navigator.clipboard.writeText(text); setCopyMessage(message); } catch { const area=document.createElement("textarea"); area.value=text; document.body.appendChild(area); area.select(); document.execCommand("copy"); area.remove(); setCopyMessage(message); } window.setTimeout(()=>setCopyMessage(""),2600); }
  const phoneLines = selectedWithPhone.map((l)=>whatsappNumber(l.phone)).join("\n");
  const downloadWhatsApp = () => downloadText("whatsapp_seleccionados_sincro.txt",phoneLines);
  const obra = workspace === "obra";
  return <div className="contacts-view">
    <div className="contacts-sticky-bar">
      <div className="table-toolbar">
        <button className="icon-button mobile-menu contacts-menu" onClick={openMenu} aria-label="Abrir menú"><Menu size={20}/></button>
        <label className="table-search"><Search size={17}/><input aria-label="Buscar negocio, email o teléfono" value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Buscar negocio, email, teléfono..."/></label>
        <label className="select-wrap"><Filter size={15}/><select aria-label="Filtrar por estado" value={status} onChange={(e)=>setStatus(e.target.value)}><option value="Todos">Todos los estados</option>{stages.map((s)=><option key={s}>{s}</option>)}</select><ChevronDown size={14}/></label>
        <label className="select-wrap"><BriefcaseBusiness size={15}/><select aria-label="Filtrar por rubro" value={segmentFilter} onChange={(e)=>setSegmentFilter(e.target.value)}><option value="__all__">Todos los rubros</option>{hasUncategorized&&<option value="__empty__">Sin rubro</option>}{segments.map((segment)=><option key={segment} value={segment}>{segment}</option>)}</select><ChevronDown size={14}/></label>
        <button className="secondary-button export-button" onClick={()=>downloadCsv(filtered,workspace)}><Download size={16}/> Exportar CSV</button>
      </div>
      <div className="bulk-toolbar">
        <div><strong>{selected.length ? `${selected.length} seleccionados` : "Seleccioná prospectos para trabajar en lote"}</strong><small>{selectedWithPhone.length} con teléfono listo para WhatsApp</small></div>
        <div className="range-selector"><label htmlFor={`contact-range-${workspace}`}>Rango</label><input id={`contact-range-${workspace}`} value={range} onChange={(e)=>{setRange(e.target.value);setRangeMessage("");}} onKeyDown={(e)=>{if(e.key==="Enter")selectRange();}} placeholder="20-50" aria-describedby={`range-help-${workspace}`}/><button className="secondary-button compact" onClick={selectRange}>Seleccionar</button><small id={`range-help-${workspace}`}>Incluye el número final</small>{rangeMessage&&<em>{rangeMessage}</em>}</div>
        <label className="select-wrap bulk-owner"><Users size={14}/><select value={bulkOwner} onChange={(e)=>setBulkOwner(e.target.value)}>{responsibleOwners.map((o)=><option key={o}>{o}</option>)}</select><ChevronDown size={14}/></label>
        <button className="primary-button compact" disabled={!selected.length} onClick={()=>void updateLeadOwner(selected,bulkOwner)}>Asignar responsable</button>
        <button className="secondary-button compact" disabled={!selectedWithPhone.length} onClick={()=>void copyText(phoneLines,`Copiados ${selectedWithPhone.length} números de WhatsApp`)}><Copy size={14}/> Copiar WhatsApp</button>
        <button className="secondary-button compact" disabled={!selectedWithPhone.length} onClick={downloadWhatsApp}><Download size={14}/> TXT</button>
        <button className="text-button clear-selection" disabled={!selected.length} onClick={()=>setSelected([])}>Limpiar</button>
        {copyMessage&&<em>{copyMessage}</em>}
      </div>
    </div>
    <div className="page-content">
    <div className="page-heading">
      <div>
        <p className="eyebrow">{obra ? "Base exclusiva de Franco" : "Base compartida"}</p>
        <h1>{obra ? "Sincro Obra" : "Prospectos"}</h1>
        <p>{obra ? `${leads.length} estudios y profesionales, separados del CRM comercial general.` : `${leads.length} registros disponibles para todo el equipo.`}</p>
      </div>
      <div className="heading-actions">
        {onImport&&<button className="secondary-button" onClick={onImport}><Upload size={16}/> Importar Excel</button>}
        <button className="primary-button" onClick={onAdd}><Plus size={17}/> Nuevo prospecto</button>
      </div>
    </div>
    <section className="panel contacts-panel">
      <div className="table-scroll">
        <table>
          <thead><tr><th className="select-col"><input type="checkbox" aria-label="Seleccionar visibles" checked={allVisibleSelected} onChange={selectVisible}/></th><th className="number-col">#</th><th>Negocio</th><th>Contacto</th><th>Rubro</th><th>Responsable</th><th>Estado</th><th>Próximo paso</th><th>Última actividad</th><th>Acciones</th></tr></thead>
          <tbody>{filtered.map((lead,index)=><tr key={lead.id} className={selected.includes(lead.id)?"selected-row":""}>
            <td className="select-col"><input type="checkbox" aria-label={`Seleccionar ${lead.businessName}`} checked={selected.includes(lead.id)} onChange={()=>toggle(lead.id)}/></td>
            <td className="number-col">{index+1}</td>
            <td><strong>{lead.businessName}</strong>{obra?<small>Sincro Obra · Franco</small>:<small>{lead.source} · {lead.batch || "Sin tanda"}</small>}</td>
            <td><div className="contact-cell">{lead.email&&<span className="contact-line"><Mail size={13}/>{lead.email}</span>}{lead.phone&&<span className="contact-line"><Phone size={13}/>{formatPhone(lead.phone)}</span>}{!lead.email&&!lead.phone&&<span className="muted-dash">Sin contacto</span>}</div></td>
            <td>{lead.segment}</td>
            <td><label className="owner-select"><div className="avatar tiny">{initials(lead.owner)}</div><select value={lead.owner} onChange={(e)=>void updateLeadOwner([lead.id],e.target.value)}>{responsibleOwners.map((o)=><option key={o}>{o}</option>)}</select><ChevronDown size={13}/></label></td>
            <td><label className="status-select" style={{background:stageMeta[lead.status]?.tint,color:stageMeta[lead.status]?.color}}><span className="stage-dot" style={{background:stageMeta[lead.status]?.color}}/><span className="status-select-label">{lead.status}</span><select aria-label={`Estado de ${lead.businessName}`} value={lead.status} onChange={(e)=>void moveLead(lead.id,e.target.value)}>{stages.map((s)=><option key={s}>{s}</option>)}</select><ChevronDown size={13}/></label></td>
            <td><NextStepCell key={`${lead.id}:${lead.nextFollowUp??""}`} lead={lead} save={updateLead}/></td>
            <td>{relativeTime(lead.updatedAt)}</td>
            <td><div className="row-actions"><button className="icon-button row-edit" onClick={() => setEditingLead(lead)} aria-label={`Editar ${lead.businessName}`} title="Editar prospecto"><Pencil size={14}/></button><button className="icon-button row-delete" onClick={() => void deleteLead(lead.id)} aria-label={`Eliminar ${lead.businessName}`} title="Eliminar prospecto"><Trash2 size={14}/></button></div></td>
          </tr>)}</tbody>
        </table>
      </div>
      {!filtered.length&&<div className="empty-state"><Search/><h3>{hasActiveFilters?"No hay coincidencias":"No encontramos prospectos"}</h3><p>{hasActiveFilters?`La base tiene ${leads.length} prospectos. Limpiá la búsqueda o los filtros para volver a verlos.`:"Probá cargando un prospecto nuevo."}</p>{hasActiveFilters&&<button className="secondary-button" onClick={clearFilters}>Limpiar búsqueda y filtros</button>}</div>}
    </section>
    {editingLead&&<EditLead lead={editingLead} simple={obra} close={()=>setEditingLead(null)} saved={async (changes)=>{await updateLead(editingLead.id,changes);setEditingLead(null);}}/>}
    </div>
  </div>;
}

function NextStepCell({ lead, save }: { lead:Lead; save:(id:string,changes:Partial<Lead>)=>Promise<void> }) {
  const [value,setValue]=useState(lead.nextFollowUp??"");
  const [busy,setBusy]=useState(false);
  async function commit(){
    const next=value.trim();
    if(next===(lead.nextFollowUp??""))return;
    setBusy(true);
    try{await save(lead.id,{nextFollowUp:next});}
    catch{setValue(lead.nextFollowUp??"");}
    finally{setBusy(false);}
  }
  return <label className={`next-step-cell ${busy?"saving":""}`}><input aria-label={`Próximo paso de ${lead.businessName}`} value={value} onChange={(e)=>setValue(e.target.value)} onBlur={()=>void commit()} onKeyDown={(e)=>{if(e.key==="Enter")e.currentTarget.blur();}} placeholder="Completar próximo paso..."/><small>{busy?"Guardando...":"Enter o salir para guardar"}</small></label>;
}

function EditLead({ lead, simple = false, close, saved }: { lead:Lead; simple?:boolean; close:()=>void; saved:(changes:Partial<Lead>)=>Promise<void> }) {
  const [form,setForm]=useState({businessName:lead.businessName,email:lead.email,phone:lead.phone,segment:lead.segment,owner:lead.owner,status:lead.status,priority:lead.priority,batch:lead.batch,notes:lead.notes}); const [busy,setBusy]=useState(false); const [error,setError]=useState("");
  async function submit(){setBusy(true);setError("");try{await saved(form);}catch(e){setError(e instanceof Error?e.message:"No se pudo guardar la edición");setBusy(false);}}
  return <div className="modal-backdrop" onMouseDown={()=>!busy&&close()}><div className="modal-card" onMouseDown={(e)=>e.stopPropagation()}><div className="modal-heading"><div><p className="eyebrow">{simple?"Sincro Obra":"Base compartida"}</p><h2>Editar prospecto</h2></div><button className="icon-button" onClick={close} disabled={busy}><X/></button></div><label>Nombre del negocio *<input autoFocus value={form.businessName} onChange={(e)=>setForm({...form,businessName:e.target.value})} placeholder="Ej: Estudio Horizonte"/></label><div className="form-row"><label>Email<input type="email" value={form.email} onChange={(e)=>setForm({...form,email:e.target.value})} placeholder="hola@negocio.com"/></label><label>Teléfono / WhatsApp<input value={form.phone} onChange={(e)=>setForm({...form,phone:e.target.value})} placeholder="54911..."/></label></div><div className="form-row"><label>Rubro<input value={form.segment} onChange={(e)=>setForm({...form,segment:e.target.value})} placeholder="Arquitectura"/></label><label>Responsable<select value={form.owner} onChange={(e)=>setForm({...form,owner:e.target.value})}>{responsibleOwners.map((o)=><option key={o}>{o}</option>)}</select></label></div>{simple?<label>Estado<select value={form.status} onChange={(e)=>setForm({...form,status:e.target.value})}>{stages.map((s)=><option key={s}>{s}</option>)}</select></label>:<><div className="form-row"><label>Estado<select value={form.status} onChange={(e)=>setForm({...form,status:e.target.value})}>{stages.map((s)=><option key={s}>{s}</option>)}</select></label><label>Prioridad<select value={form.priority} onChange={(e)=>setForm({...form,priority:e.target.value})}><option>Alta</option><option>Media</option><option>Baja</option></select></label></div><label>Tanda<input value={form.batch} onChange={(e)=>setForm({...form,batch:e.target.value})} placeholder="Tanda 1"/></label></>}<label>Notas<textarea rows={3} value={form.notes} onChange={(e)=>setForm({...form,notes:e.target.value})} placeholder="Contexto útil para el próximo contacto..."/></label>{error&&<p className="form-error">{error}</p>}<div className="modal-actions"><button className="secondary-button" onClick={close} disabled={busy}>Cancelar</button><button className="primary-button" onClick={()=>void submit()} disabled={busy}>{busy&&<LoaderCircle className="spin" size={16}/>} Guardar cambios</button></div></div></div>;
}

function Importer({ api, refresh }: { api:(p:Record<string,unknown>)=>Promise<ApiResponse>; refresh:()=>Promise<void> }) {
  const [workspace,setWorkspace]=useState<Workspace>("crm");
  const [rows,setRows]=useState<Record<string,string>[]>([]);
  const [name,setName]=useState("");
  const [busy,setBusy]=useState(false);
  const [result,setResult]=useState("");
  const [skipped,setSkipped]=useState(0);
  useEffect(()=>{const timeout=window.setTimeout(()=>{const stored=sessionStorage.getItem("crm-import-workspace");if(stored==="obra"){setWorkspace("obra");sessionStorage.removeItem("crm-import-workspace");}},0);return()=>window.clearTimeout(timeout);},[]);
  const norm=(s:string)=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
  const ownerValue=(v:string)=>workspace==="obra"?"Franco":responsibleOwners.find((o)=>norm(o)===norm(v))||responsibleOwners[0];
  function changeWorkspace(next:Workspace){setWorkspace(next);setRows([]);setName("");setResult("");setSkipped(0);}
  async function readFile(file: File){
    setName(file.name); setResult("Leyendo archivo..."); setRows([]); setSkipped(0);
    try{
      const XLSX=await import("xlsx");
      const data=await file.arrayBuffer();
      const wb=XLSX.read(data,{type:"array"});
      const sheet=wb.Sheets[wb.SheetNames.find((sheetName)=>norm(sheetName)==="contactos")??wb.SheetNames[0]];
      const matrix=XLSX.utils.sheet_to_json<unknown[]>(sheet,{header:1,defval:"",blankrows:false});
      const businessHeaders=["negocio","nombredelnegocio","estudio","empresa","nombre"];
      const contactHeaders=["email","mail","correo","telefono","telefonolimpio","telefonooriginal","celular","whatsapp"];
      const headerIndex=matrix.findIndex((row)=>{const keys=row.map((c)=>norm(String(c??"")));return keys.some((key)=>businessHeaders.includes(key))&&keys.some((key)=>contactHeaders.includes(key));});
      if(headerIndex<0){setResult("No encontré los encabezados. Revisá que exista Negocio, Estudio o Nombre y al menos Email o Teléfono.");return;}
      const headers=matrix[headerIndex].map((c)=>norm(String(c??"")));
      const idx=(keys:string[])=>keys.map((key)=>headers.indexOf(key)).find((index)=>index>=0)??-1;
      const indexes={studio:idx(["negocio","nombredelnegocio","estudio","empresa"]),contactName:idx(["nombre","contacto"]),email:idx(["email","mail","correo"]),phone:idx(["telefonolimpio","telefono","telefonooriginal","celular","whatsapp"]),segment:idx(["rubro","segmento","categoria"]),channel:idx(["canalrecomendado","canal"]),owner:idx(["responsable","owner","usuario"]),status:idx(["estado","status"]),priority:idx(["prioridad"]),batch:idx(["tanda","lote"]),notes:idx(["notas","observaciones"])};
      const val=(row:unknown[],i:number)=>i>=0?String(row[i]??"").trim():"";
      const parsed=matrix.slice(headerIndex+1).map((row)=>{
        const email=val(row,indexes.email).toLowerCase();
        const studio=val(row,indexes.studio);
        const contactName=val(row,indexes.contactName);
        const channel=val(row,indexes.channel);
        const notes=[studio&&contactName?`Contacto: ${contactName}`:"",channel?`Canal recomendado: ${channel}`:"",val(row,indexes.notes)].filter(Boolean).join(" · ");
        return {businessName:studio||contactName||(email?email.split("@")[0]:""),email,phone:val(row,indexes.phone),segment:workspace==="obra"?"Estudio de arquitectura":val(row,indexes.segment)||"General",owner:workspace==="obra"?"Franco":ownerValue(val(row,indexes.owner)),status:val(row,indexes.status)||"Pendiente",priority:workspace==="obra"?"Media":val(row,indexes.priority)||"Media",batch:workspace==="obra"?"":val(row,indexes.batch),notes:workspace==="obra"?"":notes,nextFollowUp:""};
      });
      const usable=parsed.filter((r)=>r.businessName&&(r.email||r.phone));
      const incomplete=parsed.filter((r)=>r.businessName||r.email||r.phone).length-usable.length;
      setRows(usable); setSkipped(Math.max(0,incomplete));
      setResult(usable.length?`${usable.length} filas listas para importar${incomplete?` · ${incomplete} incompletas`:''}. Revisá la vista previa y confirmá.`:"No detecté filas importables. Completá el nombre y al menos un email o teléfono.");
    }catch(e){setResult(e instanceof Error?e.message:"No pude leer el archivo");}
  }
  async function commit(){if(!rows.length)return;setBusy(true);try{const r=await api({action:"import",workspace,leads:rows});setResult(`${Number(r.added??0)} prospectos agregados · ${Number(r.skipped??0) + skipped} omitidos`);setRows([]);setSkipped(0);await refresh();}catch(e){setResult(e instanceof Error?e.message:"No se pudo importar");}finally{setBusy(false);}}
  const obra=workspace==="obra";
  return <div className="page-content"><div className="page-heading"><div><p className="eyebrow">Carga masiva</p><h1>Importar Excel</h1><p>{obra?"Los contactos se guardarán exclusivamente dentro de Sincro Obra.":"Los contactos se sumarán al CRM comercial general."}</p></div>{!obra&&<a className="secondary-button" href="/Plantilla_Prospectos_Sincro_CRM.xlsx" download><Download size={16}/> Descargar plantilla</a>}</div><div className="workspace-tabs" role="tablist" aria-label="Destino de la importación"><button className={!obra?"active":""} onClick={()=>changeWorkspace("crm")}>Sincro CRM</button><button className={obra?"active":""} onClick={()=>changeWorkspace("obra")}>Sincro Obra</button></div><section className="import-grid"><article className="panel instructions"><div className="step-number">01</div><h2>{obra?"Usá la hoja Contactos":"Completá la plantilla"}</h2><p>{obra?"Se leen Estudio, Nombre, Email, Teléfono, Segmento y Estado. Prioridad y Tanda se ignoran para esta base.":"Solo necesitás el nombre del negocio y un email o teléfono. El resto ayuda a ordenar y distribuir el trabajo."}</p><ul><li><Check/> {obra?"Todos quedan asignados a Franco":"Responsables válidos: Franco, Trezza y Laucha"}</li><li><Check/> Un negocio por fila</li><li><Check/> Los duplicados se omiten dentro de cada producto</li></ul>{!obra&&<a href="/Plantilla_Prospectos_Sincro_CRM.xlsx" download><FileSpreadsheet/> Plantilla_Prospectos_Sincro_CRM.xlsx <Download/></a>}</article><article className="panel upload-panel"><div className="step-number">02</div><h2>Subí el archivo completo</h2><label className="dropzone"><Upload size={30}/><strong>{name||"Arrastrá o elegí tu Excel"}</strong><span>Formatos .xlsx, .xls o .csv</span><input type="file" accept=".xlsx,.xls,.csv" onChange={(e)=>e.target.files?.[0]&&void readFile(e.target.files[0])}/></label>{result&&<p className={`import-result ${rows.length?"":"warning"}`}>{result}</p>}{rows.length>0&&<button className="primary-button import-confirm" onClick={()=>void commit()} disabled={busy}>{busy?<LoaderCircle className="spin" size={17}/>:<Upload size={17}/>} Confirmar importación en {obra?"Sincro Obra":"Sincro CRM"}</button>}</article></section>{rows.length>0&&<section className="panel preview-panel"><div className="panel-heading"><div><h2>Vista previa</h2><p>{rows.length} filas detectadas · destino: {obra?"Sincro Obra":"Sincro CRM"}</p></div></div><div className="table-scroll"><table><thead><tr><th>Negocio</th><th>Email</th><th>Teléfono</th><th>Rubro</th><th>Responsable</th><th>Estado</th></tr></thead><tbody>{rows.slice(0,20).map((r,i)=><tr key={i}><td><strong>{r.businessName}</strong></td><td>{r.email||"—"}</td><td>{r.phone||"—"}</td><td>{r.segment||"General"}</td><td>{r.owner}</td><td>{r.status||"Pendiente"}</td></tr>)}</tbody></table></div></section>}</div>;
}

const appointmentFlowBody = `MSJ 1 - apertura simple
Buenas, ¿cómo va? Te hago una consulta rápida.

MSJ 2 - filtro de agenda
¿Hoy los turnos / reservas los toman principalmente por WhatsApp?

SI RESPONDE: "Sí, por WhatsApp"
Perfecto. Justo por eso te escribía. Estamos armando sistemas de agendamiento automático para negocios de {{rubro}}, para que los clientes puedan reservar 24 hs sin que ustedes tengan que estar pendientes del teléfono.

MSJ 3 - resultado concreto
La idea no es sumarles trabajo, sino sacarles mensajes repetidos: horarios disponibles, datos del cliente, confirmaciones y recordatorios. Todo puede quedar conectado a su WhatsApp, a su web actual o a una web nueva si todavía no tienen una buena.

MSJ 4 - pedir microcompromiso
Si te interesa, te puedo mostrar una demo aplicada a {{negocio}}. Son 10/15 minutos y ves exactamente cómo quedaría el flujo antes de decidir nada.

SI RESPONDE: "Me interesa"
Buenísimo. ¿Te queda mejor hoy a la tarde o mañana? Te muestro una demo corta con el sistema aplicado a {{negocio}} y vemos si realmente les ahorra tiempo.

SI RESPONDE: "Mandame info"
Sí, te mando. Para no mandarte algo genérico: ¿hoy qué les molesta más, perder turnos porque responden tarde, contestar siempre lo mismo o tener que ordenar horarios manualmente?

SI RESPONDE: "Se lo paso al dueño / encargado"
Perfecto. ¿Me pasás su WhatsApp o mail? Así le mando una demo corta y concreta, no un texto largo. Si prefiere, también puedo armarle un ejemplo con el nombre de {{negocio}}.

SI RESPONDE: "Ya tengo página web"
Genial, eso ayuda. No buscamos reemplazar la web: podemos integrar el agendamiento dentro de la web que ya tienen, para que el cliente reserve sin tener que escribirles y esperar respuesta.

SI RESPONDE: "Usamos una app / sistema"
Buenísimo. Entonces quizá ya tienen una parte resuelta. Te pregunto algo puntual: ¿la gente agenda sola por ahí o igual terminan coordinando bastante por WhatsApp?

SI RESPONDE: "No, no tomamos turnos por WhatsApp"
Perfecto, gracias por aclararme. ¿Cómo lo resuelven hoy: llamada, Instagram, una app o presencial? Te pregunto porque si el flujo ya está bien resuelto, probablemente no tenga sentido molestarte.

CIERRE - agendar demo
Excelente. Te propongo algo simple: hacemos una demo de 15 minutos, te muestro cómo quedaría en {{negocio}} y si no ves valor real, lo dejamos ahí. ¿Hoy o mañana?`;

const objectionFlowBody = `OBJECIÓN: "No estoy interesado"
Te entiendo. Para no insistirte sin sentido: ¿no te interesa porque ya lo tienen resuelto, porque ahora no es prioridad o porque no viste claro el valor? Si es lo último, te muestro una demo de 10 minutos aplicada a {{negocio}} y lo evaluás con algo concreto.

OBJECIÓN: "Es caro / no hay presupuesto"
Tiene sentido cuidar el presupuesto. Antes de hablar de precio, aislemos si hay negocio: si esto les ahorra horas de WhatsApp, reduce turnos perdidos y ordena reservas 24 hs, ¿el problema sería el valor total o encontrar una forma de implementarlo sin afectar caja?

RESPUESTA SI INSISTE CON PRECIO
Te entiendo. La pregunta clave es cuánto les cuesta hoy no resolverlo: turnos que se pierden por responder tarde, ausencias sin recordatorio y tiempo del equipo contestando lo mismo. Si en la demo no vemos que el ahorro supera el costo, no avanzamos.

OBJECIÓN: "Lo tengo que pensar"
Obvio, tiene sentido pensarlo. Para ayudarte a decidir con información y no con duda: ¿qué parte te queda poco clara, el funcionamiento, el precio, la implementación o si tus clientes lo usarían?

RESPUESTA SI DICE "Después lo veo"
Dale. Solo para separar tiempo de decisión: si la demo te muestra que el sistema funciona para {{negocio}} y resuelve el problema, ¿estarías dispuesto a avanzar o hay otra cosa que te frenaría?

OBJECIÓN: "Tengo que hablarlo con mi socio / pareja"
Perfecto, tiene sentido que lo vea quien decide con vos. ¿Qué creés que le preocuparía más: precio, implementación, que los clientes lo usen o cambiar la forma de trabajar? Así lo resolvemos antes de la reunión.

RESPUESTA PARA INVOLUCRAR AL SOCIO / DUEÑO
Para que no tengas que explicarlo vos de cero, armemos una demo corta con esa persona. Le mostramos cómo quedaría aplicado a {{negocio}}, qué problema resuelve y cuánto trabajo les sacaría. ¿Te sirve coordinar 15 minutos?

OBJECIÓN: "No tengo tiempo"
Te entiendo, y justamente por eso te escribo. No te propongo una reunión larga: dame 10 minutos, te muestro cómo quedaría el agendamiento automático en {{negocio}} y si no ves ahorro de tiempo real, lo dejamos ahí.

RESPUESTA SI ESTÁ APURADO
Te lo resumo en una línea: el cliente entra, elige horario, deja sus datos y el turno queda confirmado sin que ustedes respondan manualmente cada mensaje. Si eso te sirve, hacemos demo de 10 minutos; si no, lo dejamos acá.

OBJECIÓN: "Ahora no"
Entiendo. Para ordenarme y no molestarte de más: cuando decís "ahora no", ¿es por tiempo, por presupuesto o porque todavía no es una prioridad? Si es timing, te escribo en la fecha correcta; si es otra cosa, lo resolvemos en una demo corta.

OBJECIÓN: "No es prioridad"
Te entiendo. Te hago una pregunta simple: si en los próximos 3 meses siguen tomando turnos igual que hoy, ¿qué es lo peor que pasa: más tiempo perdido, clientes sin respuesta, errores de agenda o nada importante? Si no hay dolor real, probablemente no tenga sentido avanzar.

OBJECIÓN: "Ya tenemos alguien que responde"
Perfecto. Esto no reemplaza a la persona: le saca lo repetitivo. La persona puede enfocarse en vender, resolver casos especiales o atender mejor, mientras el sistema toma datos, confirma y ordena turnos.

RESPUESTA SI DICE "Prefiero atención humana"
Totalmente, y está bien mantener atención humana para casos importantes. La idea es que la persona no esté respondiendo 40 veces horarios, dirección, disponibilidad y confirmaciones. Lo repetido lo toma el sistema; lo importante queda para ustedes.

OBJECIÓN: "Mis clientes prefieren escribir"
Totalmente, por eso no les sacamos WhatsApp. El cliente puede escribir igual, pero en vez de esperar respuesta, el sistema lo guía para reservar, dejar sus datos y confirmar el turno en el momento.

RESPUESTA SI TEME QUE EL CLIENTE NO LO USE
Tiene sentido esa duda. Por eso no cambiamos el hábito del cliente: si hoy escribe por WhatsApp, sigue escribiendo por WhatsApp. Solo hacemos que el camino para reservar sea más claro y rápido.

OBJECIÓN: "Ya probé algo parecido y no funcionó"
Te creo. Normalmente falla cuando es genérico, confuso o no respeta cómo compra el cliente. Nosotros lo armamos sobre el flujo real de {{negocio}}. Si querés, revisamos qué falló y te digo honestamente si vale la pena intentarlo de nuevo.

RESPUESTA SI TUVO MALA EXPERIENCIA
Justamente por eso preferimos mostrar demo antes de venderte nada. Vemos qué probaron, dónde se trabó y si este enfoque lo resuelve. Si vemos que va a repetir el mismo problema, te lo digo directo.

OBJECIÓN: "Hablame más adelante"
Obvio. Para hacerlo prolijo: ¿te parece que te escriba la semana que viene o preferís que lo dejemos para principio de mes? Así te contacto cuando tenga sentido y no te lleno de mensajes.

OBJECIÓN: "No quiero cambiar mi forma de trabajar"
Está bien. La idea no es cambiar lo que ya funciona, sino automatizar lo repetido. Si hoy contestan 30 veces lo mismo, el sistema toma esa parte y ustedes mantienen el control.

RESPUESTA SI LE DA MIEDO IMPLEMENTARLO
Lo entiendo. Por eso lo pensamos como una mejora gradual, no como cambiar todo de golpe. Primero dejamos armado el flujo principal de reservas; después ustedes deciden cuánto automatizar y cuánto mantener manual.

OBJECIÓN: "Ya tengo página web"
Genial, eso suma. No hace falta reemplazarla: podemos integrar el sistema de turnos dentro de la web actual. Y si la web no convierte bien, también podemos mejorarla o armar una nueva.

RESPUESTA SI LA WEB YA FUNCIONA
Buenísimo. Entonces no tocaría lo que ya funciona. La oportunidad sería sumar una reserva más directa: que quien entra a la web pueda agendar sin escribir, esperar respuesta o perderse en el camino.

OBJECIÓN: "Ya uso una app / sistema"
Buenísimo, entonces ya valoran ordenar la agenda. Te hago una pregunta puntual: ¿los clientes realmente reservan solos ahí o igual terminan escribiendo por WhatsApp para consultar horarios, confirmar o reprogramar?

RESPUESTA SI LA APP YA RESUELVE TODO
Perfecto, si la gente agenda sola, reprograma fácil y ustedes no dependen de WhatsApp, probablemente ya lo tengan bastante resuelto. En ese caso no te vendería algo innecesario. Si querés, solo revisamos si hay algún punto flojo.

OBJECIÓN: "Ya tengo proveedor"
Me alegra, eso quiere decir que ya le dan valor a ordenar el proceso. No te propongo cambiar por cambiar. Te propongo ver si podemos mejorar una parte específica: reservas 24 hs, recordatorios, integración con web o menos mensajes manuales.

RESPUESTA SI ESTÁ CONTENTO CON SU PROVEEDOR
Buenísimo. Entonces mirémoslo como segunda opción o mejora puntual, no como reemplazo. Si en 10 minutos no ves una diferencia concreta para {{negocio}}, no seguimos.

OBJECIÓN: "Mandame info"
Sí, te mando. Para que no sea algo genérico: ¿hoy qué les pesa más, responder tarde, ordenar horarios, reducir ausencias o liberar tiempo del equipo? Con eso te paso un ejemplo más parecido a {{negocio}}.

RESPUESTA PARA PEDIR DATO ANTES DE MANDAR INFO
Te mando algo corto. Para enfocarlo bien: ¿hoy toman turnos por WhatsApp, Instagram, llamada, web o una app? Con eso te paso un ejemplo que tenga sentido para {{negocio}}.

OBJECIÓN: "No entiendo bien qué hacen"
Simple: armamos un sistema para que tus clientes puedan reservar turno las 24 hs desde WhatsApp o web. El sistema muestra horarios, toma datos, confirma y puede enviar recordatorios, sin que ustedes tengan que contestar cada mensaje manualmente.

OBJECIÓN: "¿Esto es inteligencia artificial?"
Puede tener IA si hace falta, pero no dependemos de vender humo. La base es un flujo claro de reservas: horarios, datos, confirmación y recordatorios. Si después conviene sumar IA para responder preguntas frecuentes, se integra.

OBJECIÓN: "Mis clientes son grandes / no tecnológicos"
Tiene sentido. Por eso lo hacemos simple: nada raro, nada de pasos largos. El cliente escribe o entra a un link, elige horario y confirma. Si hoy pueden mandar WhatsApp, pueden usar este flujo.

OBJECIÓN: "No quiero pagar algo todos los meses"
Te entiendo. La pregunta es si el sistema se paga solo con el tiempo que libera y los turnos que evita perder. Si no hay retorno claro, no tiene sentido. Por eso primero vemos números simples en una demo.

OBJECIÓN: "Tengo miedo de que falle"
Es lógico. Por eso el sistema se prueba antes, se arranca con un flujo controlado y ustedes mantienen la posibilidad de intervenir manualmente. No se trata de perder control, sino de ordenar lo repetido.

OBJECIÓN: "No quiero que parezca robot"
Totalmente. El flujo se escribe con el tono de {{negocio}}, no como mensaje genérico. La idea es que sea claro, rápido y natural, manteniendo la opción de que una persona intervenga cuando haga falta.

OBJECIÓN: "No sé si me sirve para mi rubro"
Puede ser. Por eso no te lo vendería sin verlo. Hagamos una demo aplicada a {{rubro}} y en 10 minutos queda claro si encaja o no. Si no encaja, lo descartamos sin compromiso.

RESPUESTA CORTANTE: "No gracias"
Gracias por responder. Te dejo tranquilo entonces. Si más adelante quieren que los turnos se reserven solos desde WhatsApp o desde la web, escribime y te muestro un ejemplo sin compromiso.`;

const followUpFlowBody = `FOLLOW UP 1 - no respondió al filtro
Te consulto de nuevo por si se perdió el mensaje: ¿los turnos de {{negocio}} los toman por WhatsApp o usan otro sistema?

FOLLOW UP 2 - abrió interés pero no contestó
Me quedé pensando en {{negocio}}. Si hoy están tomando turnos por WhatsApp, probablemente podamos ahorrarles bastante ida y vuelta. ¿Querés que te muestre una demo corta?

FOLLOW UP 3 - después de mandar info
¿Pudiste verlo? Te lo resumo simple: el cliente entra, elige horario, deja sus datos y queda confirmado sin que ustedes respondan manualmente cada mensaje.

FOLLOW UP 4 - dueño / encargado
¿Pudiste pasárselo al dueño/encargado? Si querés, le mando directamente una demo corta y se evita el ida y vuelta.

FOLLOW UP 5 - cierre amable
Te cierro por acá para no molestarte. Si en algún momento quieren automatizar reservas por WhatsApp o sumarlo a la web, me escribís y lo vemos sin compromiso.`;

const suggestedFlows: Template[] = [{
  id: "suggested_appointment_flow",
  name: "Flujo principal: agendamiento 24 hs",
  channel: "WhatsApp",
  stage: "Contactado",
  body: appointmentFlowBody,
  active: true,
  createdAt: "",
}, {
  id: "suggested_objection_flow",
  name: "Flujo de objeciones: agenda automática",
  channel: "WhatsApp",
  stage: "Respondió",
  body: objectionFlowBody,
  active: true,
  createdAt: "",
}, {
  id: "suggested_followup_flow",
  name: "Flujo de seguimiento: agenda automática",
  channel: "WhatsApp",
  stage: "Contactado",
  body: followUpFlowBody,
  active: true,
  createdAt: "",
}];

const obraSuggestedFlows: Template[] = [{
  id: "suggested_obra_facultad",
  name: "Sincro Obra · WhatsApp inicial (contacto de facultad)",
  channel: "WhatsApp",
  stage: "Pendiente",
  body: `MSJ 1 - primer contacto
Buenas, ¿cómo estás? Soy Franco Restelli, estudiante de 5.º año de Arquitectura y fundador de Sincro Obra.
Saqué tu contacto de un grupo de la facultad. Te escribo con respeto y, si no aplica, cero problema.
Hoy ya hay estudios usando Sincro en obras reales y estamos abriendo algunos cupos con condiciones preferenciales de lanzamiento.
La plataforma ayuda a ordenar tareas, presupuesto, documentos y seguimiento de obra en un solo sistema.
¿Hoy estás trabajando en algún estudio o coordinando alguna obra o proyecto?`,
  active: true,
  createdAt: "",
}, {
  id: "suggested_obra_estudio",
  name: "Sincro Obra · WhatsApp inicial (estudio)",
  channel: "WhatsApp",
  stage: "Pendiente",
  body: `MSJ 1 - primer contacto
Buenas, ¿cómo están? Soy Franco Restelli, estudiante de último año de Arquitectura y fundador de Sincro Obra.
Estoy contactando estudios que coordinan obras y buscan ordenar tareas, presupuesto, documentos y seguimiento en un solo sistema.
Hoy ya hay estudios usando Sincro en obras reales y estamos abriendo algunos cupos con condiciones preferenciales de lanzamiento.
Quería consultarles si hoy llevan el seguimiento de obra con WhatsApp, Excel y Drive, o si ya tienen algún sistema más armado.`,
  active: true,
  createdAt: "",
}, {
  id: "suggested_obra_email",
  name: "Sincro Obra · Email inicial",
  channel: "Email",
  stage: "Pendiente",
  body: `MSJ 1 - asunto
Seguimiento de obras - Sincro Obra

MSJ 2 - cuerpo del email
Hola, ¿cómo están?
Soy Franco Restelli, estudiante avanzado de Arquitectura y fundador de Sincro Obra.
Estoy contactando estudios que coordinan obras y buscan ordenar tareas, presupuesto, documentos y seguimiento en un solo sistema.
Hoy ya hay estudios usando Sincro en obras reales y estamos abriendo algunos cupos con condiciones preferenciales de lanzamiento para implementarlo con acompañamiento inicial.
Quería consultarles si hoy llevan el seguimiento de obra con WhatsApp, Excel y Drive, o si ya tienen algún sistema más armado.
Les dejo la web: www.sincroobra.com
Saludos,
Franco Restelli`,
  active: true,
  createdAt: "",
}, {
  id: "suggested_obra_propuesta",
  name: "Sincro Obra · Envío de propuesta",
  channel: "WhatsApp",
  stage: "Propuesta enviada",
  body: `MSJ 1 - enviar con la presentación adjunta
Perfecto, muchas gracias.
Les comparto adjunta una presentación breve de Sincro Obra para que puedan verla tranquilos.
La plataforma está pensada para estudios que coordinan obras y necesitan ordenar tareas, responsables, presupuesto, documentos e incidencias en un solo lugar.
De todos modos, más que el PDF, lo más claro suele ser verlo 10 o 15 minutos aplicado a una obra de ejemplo. Si después de mirarlo les resulta interesante, podemos coordinar una reunión breve y les muestro rápidamente si tiene sentido para la forma de trabajo del estudio.
Quedo atento, gracias.`,
  active: true,
  createdAt: "",
}, {
  id: "suggested_obra_followup",
  name: "Sincro Obra · Follow-up 2–3 días",
  channel: "WhatsApp",
  stage: "Propuesta enviada",
  body: `MSJ 1 - enviar 2 o 3 días después
Hola, ¿cómo están? Retomo brevemente por la presentación de Sincro Obra que les compartí.
Para no mandarles información de más, quería consultarles si tiene sentido coordinar una reunión corta de 15 minutos para mostrarles el sistema aplicado a una obra de ejemplo.
La idea sería ver rápidamente si les puede servir para ordenar tareas, seguimiento, documentos y presupuesto y, si no aplica, lo descartamos sin problema.
¿Les serviría verlo esta semana?`,
  active: true,
  createdAt: "",
}, {
  id: "suggested_obra_cierre",
  name: "Sincro Obra · Cierre sin respuesta",
  channel: "WhatsApp",
  stage: "No respondió",
  body: `MSJ 1 - último seguimiento
Hola, retomo por última vez y no molesto más.
Les había compartido Sincro Obra, una plataforma para ordenar seguimiento de obra, tareas, presupuesto y documentación en un solo lugar.
Si hoy no es prioridad, cero problema. Si les interesa verlo más adelante, quedo a disposición para coordinar una demo breve.
Saludos,
Franco`,
  active: true,
  createdAt: "",
}, {
  id: "suggested_obra_referido",
  name: "Sincro Obra · Pedido de referido",
  channel: "WhatsApp",
  stage: "No interesado",
  body: `MSJ 1 - pedir un contacto referido
Gracias por responder.
Te hago una última consulta y no molesto más: ¿se te ocurre algún estudio o arquitecto o arquitecta al que le pueda servir?
Sobre todo alguien que esté coordinando obras y tenga tareas, presupuesto, documentos o seguimiento repartidos entre WhatsApp, Excel y Drive.`,
  active: true,
  createdAt: "",
}];

function isObraTemplate(template: Template) {
  return template.name.trim().toLowerCase().startsWith("sincro obra ·");
}

function conversationBlocks(body: string) {
  return body.split(/\n{2,}/).map((block) => {
    const [first, ...rest] = block.trim().split("\n");
    const title = first.trim();
    const content = rest.join("\n").trim();
    const upper = title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
    const kind = upper.startsWith("MSJ") ? "message" : upper.startsWith("SI RESPONDE") ? "reply" : "note";
    return { title, content, kind };
  }).filter((block) => block.title || block.content);
}

function FlowPreview({ templateId, body, copied, copyBlock }: { templateId:string; body: string; copied:string; copyBlock:(id:string,text:string)=>Promise<void> }) {
  return <div className="flow-preview">{conversationBlocks(body).map((block, index) => { const blockId=`${templateId}_${index}`; const text=block.content || block.title; return <div className={`flow-block ${block.kind}`} key={blockId}><div className="flow-block-head"><strong>{block.title}</strong><button onClick={()=>void copyBlock(blockId,text)}>{copied===blockId?<><Check size={13}/> Copiado</>:<><Copy size={13}/> Copiar</>}</button></div>{block.content && <p>{block.content}</p>}</div>; })}</div>;
}

function FlowCard({ template, copied, deletingId, suggested, edit, remove, copy, copyBlock }: { template:Template; copied:string; deletingId:string; suggested?:boolean; edit:(t:Template)=>void; remove?:(t:Template)=>void; copy:(t:Template)=>Promise<void>; copyBlock:(id:string,text:string)=>Promise<void> }) {
  const variables=["{{negocio}}","{{rubro}}"].filter((variable)=>template.body.includes(variable));
  return <article className={`template-card flow-card ${suggested?"suggested":""}`}><header><span className={`channel ${template.channel.toLowerCase()}`}>{template.channel==="WhatsApp"?<Phone size={14}/>:<Mail size={14}/>} {template.channel}</span><span className="template-stage">{template.stage}</span></header><h2>{template.name}</h2><FlowPreview templateId={template.id} body={template.body} copied={copied} copyBlock={copyBlock}/><footer><small>{variables.length?<>Variables: {variables.map((variable,index)=><span key={variable}>{index>0?" y ":""}<b>{variable}</b></span>)}</>:"Copiá cada bloque por separado."}</small><div className="template-actions"><button onClick={()=>edit(template)}><Pencil size={14}/> {suggested?"Usar":"Editar"}</button>{remove&&<button className="delete-template" disabled={deletingId===template.id} onClick={()=>void remove(template)}>{deletingId===template.id?<LoaderCircle className="spin" size={14}/>:<Trash2 size={14}/>} Eliminar</button>}<button onClick={()=>void copy(template)}>{copied===template.id?<><Check size={14}/> Todo copiado</>:<><Copy size={14}/> Copiar todo</>}</button></div></footer></article>;
}

function Messages({ templates, api, refresh }: { templates:Template[]; api:(p:Record<string,unknown>)=>Promise<ApiResponse>; refresh:()=>Promise<void> }) {
  const blankForm=(workspace:Workspace)=>({name:workspace==="obra"?"Sincro Obra · ":"",channel:"WhatsApp",stage:"Pendiente",body:""});
  const [workspace,setWorkspace]=useState<Workspace>("crm");
  const [copied,setCopied]=useState(""); const [modalOpen,setModalOpen]=useState(false); const [editingId,setEditingId]=useState<string|null>(null); const [form,setForm]=useState(blankForm("crm")); const [busy,setBusy]=useState(false); const [formError,setFormError]=useState(""); const [deletingId,setDeletingId]=useState("");
  async function writeClipboard(text:string){try{await navigator.clipboard.writeText(text);}catch{const area=document.createElement("textarea");area.value=text;area.style.position="fixed";area.style.opacity="0";document.body.appendChild(area);area.select();document.execCommand("copy");area.remove();}}
  async function copy(t:Template){await writeClipboard(t.body);setCopied(t.id);setTimeout(()=>setCopied(""),1800)}
  async function copyBlock(id:string,text:string){await writeClipboard(text);setCopied(id);setTimeout(()=>setCopied(""),1800)}
  function closeModal(){if(busy)return;setModalOpen(false);setEditingId(null);setForm(blankForm(workspace));setFormError("");}
  function createTemplate(){setEditingId(null);setForm(blankForm(workspace));setFormError("");setModalOpen(true);}
  function editTemplate(t:Template){setEditingId(t.id.startsWith("suggested_")?null:t.id);setForm({name:t.name,channel:t.channel,stage:t.stage,body:t.body});setFormError("");setModalOpen(true);}
  async function save(){if(!form.name.trim()||!form.body.trim()){setFormError("Completá el nombre y el flujo.");return;}setBusy(true);setFormError("");try{await api({action:editingId?"updateTemplate":"saveTemplate",templateId:editingId,template:form});setModalOpen(false);setEditingId(null);setForm(blankForm(workspace));await refresh();}catch(e){setFormError(e instanceof Error?e.message:"No se pudo guardar el flujo");}finally{setBusy(false);}}
  async function remove(t:Template){if(!window.confirm(`¿Eliminar el flujo "${t.name}"? Esta acción no se puede deshacer.`))return;setDeletingId(t.id);try{await api({action:"deleteTemplate",templateId:t.id});await refresh();}catch(e){window.alert(e instanceof Error?e.message:"No se pudo eliminar el flujo");}finally{setDeletingId("");}}
  const savedFlowBodiesByName = new Map(templates.map((t)=>[t.name.trim().toLowerCase(), t.body.trim()]));
  const obra=workspace==="obra";
  const visibleTemplates=templates.filter((template)=>isObraTemplate(template)===obra);
  const activeSuggestions=obra?obraSuggestedFlows:suggestedFlows;
  const visibleSuggestions = activeSuggestions.filter((flow)=>savedFlowBodiesByName.get(flow.name.trim().toLowerCase()) !== flow.body.trim());
  function changeWorkspace(next:Workspace){if(busy)return;setWorkspace(next);setModalOpen(false);setEditingId(null);setForm(blankForm(next));setFormError("");}
  return <div className="page-content"><div className="page-heading"><div><p className="eyebrow">Biblioteca de ventas</p><h1>Flujos de conversación</h1><p>{obra?"Mensajes exclusivos para presentar, seguir y cerrar conversaciones de Sincro Obra.":"Guiones por etapa con caminos posibles según lo que responde cada prospecto."}</p></div><button className="primary-button" onClick={createTemplate}><Plus size={17}/> Nuevo flujo</button></div><div className="workspace-tabs" role="tablist" aria-label="Producto de los mensajes"><button className={!obra?"active":""} onClick={()=>changeWorkspace("crm")}>Sincro CRM</button><button className={obra?"active":""} onClick={()=>changeWorkspace("obra")}>Sincro Obra</button></div>{visibleSuggestions.length>0&&<section className="flow-suggestions"><div className="panel-heading"><div><h2>Flujos sugeridos</h2><p>{obra?"Mensajes listos para copiar de a uno y adaptar si hace falta.":"Base editable para que el equipo tenga una guía común."}</p></div></div><div className="template-grid">{visibleSuggestions.map((t)=><FlowCard key={t.id} template={t} copied={copied} deletingId={deletingId} suggested edit={editTemplate} copy={copy} copyBlock={copyBlock}/>)}</div></section>}<div className="template-grid">{visibleTemplates.map((t)=><FlowCard key={t.id} template={t} copied={copied} deletingId={deletingId} edit={editTemplate} remove={remove} copy={copy} copyBlock={copyBlock}/>)}</div>{!visibleTemplates.length&&!visibleSuggestions.length&&<div className="empty-state"><MessageSquareText/><h3>No hay flujos</h3><p>Creá un flujo para empezar a ordenar las conversaciones del equipo.</p></div>}{modalOpen&&<div className="modal-backdrop" onMouseDown={closeModal}><div className="modal-card template-modal" onMouseDown={(e)=>e.stopPropagation()}><div className="modal-heading"><div><p className="eyebrow">{obra?"Sincro Obra":"Biblioteca"}</p><h2>{editingId?"Editar flujo":"Nuevo flujo"}</h2></div><button className="icon-button" onClick={closeModal} disabled={busy}><X/></button></div><label>Nombre<input autoFocus value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} placeholder={obra?"Sincro Obra · Nombre del flujo":"Ej: Flujo para agendamiento automático"}/></label><div className="form-row"><label>Canal<select value={form.channel} onChange={(e)=>setForm({...form,channel:e.target.value})}><option>WhatsApp</option><option>Email</option></select></label><label>Etapa<select value={form.stage} onChange={(e)=>setForm({...form,stage:e.target.value})}>{stages.map((s)=><option key={s}>{s}</option>)}</select></label></div><label>Flujo<textarea value={form.body} onChange={(e)=>setForm({...form,body:e.target.value})} rows={12} placeholder={"MSJ 1\nBuenas, ¿cómo va?\n\nSI RESPONDE: Me interesa\nAgendar reunión breve..."} /></label>{formError&&<p className="form-error">{formError}</p>}<div className="modal-actions"><button className="secondary-button" onClick={closeModal} disabled={busy}>Cancelar</button><button className="primary-button" onClick={()=>void save()} disabled={busy}>{busy&&<LoaderCircle className="spin" size={16}/>} {editingId?"Guardar cambios":"Crear flujo"}</button></div></div></div>}</div>;
}

function AddLead({ currentUser, workspace, api, close, saved }: { currentUser:string; workspace:Workspace; api:(p:Record<string,unknown>)=>Promise<ApiResponse>; close:()=>void; saved:()=>Promise<void> }) {
  const obra=workspace==="obra";
  const currentOwner=obra?"Franco":responsibleOwners.includes(currentUser)?currentUser:responsibleOwners[0];
  const [form,setForm]=useState({businessName:"",email:"",phone:"",segment:"",owner:currentOwner,status:"Pendiente",priority:"Media",batch:"",notes:""}); const [busy,setBusy]=useState(false); const [error,setError]=useState("");
  async function submit(){setBusy(true);setError("");try{await api({action:"create",workspace,lead:form});await saved();}catch(e){setError(e instanceof Error?e.message:"No se pudo guardar");setBusy(false);}}
  return <div className="modal-backdrop" onMouseDown={close}><div className="modal-card" onMouseDown={(e)=>e.stopPropagation()}><div className="modal-heading"><div><p className="eyebrow">{obra?"Sincro Obra":"Base compartida"}</p><h2>Nuevo prospecto</h2></div><button className="icon-button" onClick={close}><X/></button></div><label>Nombre del negocio *<input autoFocus value={form.businessName} onChange={(e)=>setForm({...form,businessName:e.target.value})} placeholder="Ej: Estudio Horizonte"/></label><div className="form-row"><label>Email<input type="email" value={form.email} onChange={(e)=>setForm({...form,email:e.target.value})} placeholder="hola@negocio.com"/></label><label>Teléfono / WhatsApp<input value={form.phone} onChange={(e)=>setForm({...form,phone:e.target.value})} placeholder="54911..."/></label></div><div className="form-row"><label>Rubro<input value={form.segment} onChange={(e)=>setForm({...form,segment:e.target.value})} placeholder="Arquitectura"/></label><label>Responsable<select value={form.owner} onChange={(e)=>setForm({...form,owner:e.target.value})}>{responsibleOwners.map((o)=><option key={o}>{o}</option>)}</select></label></div>{obra?<label>Estado<select value={form.status} onChange={(e)=>setForm({...form,status:e.target.value})}>{stages.map((s)=><option key={s}>{s}</option>)}</select></label>:<><div className="form-row"><label>Estado<select value={form.status} onChange={(e)=>setForm({...form,status:e.target.value})}>{stages.map((s)=><option key={s}>{s}</option>)}</select></label><label>Prioridad<select value={form.priority} onChange={(e)=>setForm({...form,priority:e.target.value})}><option>Alta</option><option>Media</option><option>Baja</option></select></label></div><label>Tanda<input value={form.batch} onChange={(e)=>setForm({...form,batch:e.target.value})} placeholder="Tanda 1"/></label></>}<label>Notas<textarea rows={3} value={form.notes} onChange={(e)=>setForm({...form,notes:e.target.value})} placeholder="Contexto útil para el próximo contacto..."/></label>{error&&<p className="form-error">{error}</p>}<div className="modal-actions"><button className="secondary-button" onClick={close}>Cancelar</button><button className="primary-button" onClick={()=>void submit()} disabled={busy}>{busy&&<LoaderCircle className="spin" size={16}/>} Guardar prospecto</button></div></div></div>;
}

function initials(name:string){return name.split(/[\s@.]+/).filter(Boolean).slice(0,2).map((x)=>x[0]?.toUpperCase()).join("")||"SA"}
function relativeTime(date:string){const d=Math.max(0,Date.now()-new Date(date).getTime());const h=Math.floor(d/3600000);if(h<1)return"Hace unos minutos";if(h<24)return`Hace ${h} h`;const days=Math.floor(h/24);return days===1?"Ayer":`Hace ${days} días`}
function whatsappNumber(phone:string){const digits=String(phone||"").replace(/\D/g,"");if(!digits)return"";if(digits.startsWith("549"))return digits;if(digits.startsWith("54"))return digits;if(digits.startsWith("01115")&&digits.length>=13)return `54911${digits.slice(5)}`;if(digits.startsWith("011")&&digits.length>=11)return `5411${digits.slice(3)}`;if(digits.startsWith("15")&&digits.length===10)return `54911${digits.slice(2)}`;if(digits.startsWith("11")&&digits.length===10)return `54${digits}`;return digits}
function formatPhone(p:string){const wa=whatsappNumber(p);if(!wa)return"";if(/^54911\d{8}$/.test(wa))return `+54 9 11 ${wa.slice(5,9)}-${wa.slice(9)}`;if(/^5411\d{8}$/.test(wa))return `+54 11 ${wa.slice(4,8)}-${wa.slice(8)}`;if(wa.startsWith("54"))return `+${wa}`;return String(p||"").trim()}
function downloadCsv(leads:Lead[],workspace:Workspace){const obra=workspace==="obra";const headers=obra?["Negocio","Email","Telefono","Rubro","Responsable","Estado","Proximo paso","Notas"]:["Negocio","Email","Telefono","Rubro","Responsable","Estado","Proximo paso","Prioridad","Tanda","Notas"];const esc=(v:string)=>`"${String(v??"").replace(/"/g,'""')}"`;const rows=leads.map((l)=>obra?[l.businessName,l.email,l.phone,l.segment,l.owner,l.status,l.nextFollowUp??"",l.notes]:[l.businessName,l.email,l.phone,l.segment,l.owner,l.status,l.nextFollowUp??"",l.priority,l.batch,l.notes]);const csv=[headers,...rows].map((r)=>r.map(esc).join(",")).join("\n");const a=document.createElement("a");a.href=URL.createObjectURL(new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"}));a.download=obra?"prospectos_sincro_obra.csv":"prospectos_sincro.csv";a.click();URL.revokeObjectURL(a.href)}
function downloadText(filename:string, text:string){const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([text],{type:"text/plain;charset=utf-8"}));a.download=filename;a.click();URL.revokeObjectURL(a.href)}
