"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowDown, ArrowUp, BarChart3, BriefcaseBusiness, CalendarClock, Check, ChevronDown, CircleDollarSign, Clipboard, Clock3, Copy, Download, FileSpreadsheet, Filter, LayoutDashboard, LoaderCircle, Mail, Menu, MessageSquareText, MoreHorizontal, Pencil, Phone, Plus, Search, Settings, Sparkles, Target, Trash2, TrendingUp, Upload, UserRound, Users, X } from "lucide-react";

type Lead = { id: string; businessName: string; email: string; phone: string; segment: string; owner: string; status: string; priority: string; batch: string; notes: string; nextFollowUp: string | null; source: string; createdAt: string; updatedAt: string };
type Event = { id: string; leadId: string; type: string; fromStatus: string | null; toStatus: string | null; actor: string; note: string; createdAt: string };
type Template = { id: string; name: string; channel: string; stage: string; body: string; active: boolean; createdAt: string };
type Page = "resumen" | "pipeline" | "contactos" | "importar" | "mensajes";

const stages = ["Pendiente", "Contactado", "Respondió", "Propuesta enviada", "Reunión agendada", "Cerrado", "No respondió", "No interesado", "Perdido"];
const responsibleOwners = ["Franco", "Trezza", "Laucha"];
const pipelineStages = stages.slice(0, 6);
const stageMeta: Record<string, { color: string; tint: string }> = {
  Pendiente: { color: "#6E7682", tint: "#ECECE7" }, Contactado: { color: "#2C7E96", tint: "#E5EFF1" }, "Respondió": { color: "#0A2540", tint: "#E6EBF0" }, "Propuesta enviada": { color: "#C25A12", tint: "#F6DCC6" }, "Reunión agendada": { color: "#287665", tint: "#E3F1ED" }, Cerrado: { color: "#2E7D32", tint: "#E5F2E4" }, "No respondió": { color: "#8A6D4A", tint: "#F2ECE4" }, "No interesado": { color: "#B44742", tint: "#F8E8E6" }, Perdido: { color: "#8C3338", tint: "#F5E5E6" },
};
const nav = [
  { id: "resumen" as Page, label: "Resumen", icon: LayoutDashboard }, { id: "pipeline" as Page, label: "Pipeline", icon: TrendingUp }, { id: "contactos" as Page, label: "Prospectos", icon: Users }, { id: "importar" as Page, label: "Importar Excel", icon: FileSpreadsheet }, { id: "mensajes" as Page, label: "Mensajes", icon: MessageSquareText },
];
const eventLabels: Record<string, string> = { contacted: "contactó a", replied: "registró respuesta de", proposal: "envió propuesta a", meeting: "agendó reunión con", closed: "cerró a", created: "cargó a", no_reply: "marcó sin respuesta a", stage_changed: "actualizó a" };

const fallbackData = { leads: [] as Lead[], events: [] as Event[], templates: [] as Template[] };
const dailyContactTarget = 100;
const weeklyContactTarget = 500;
const dayMs = 86400000;

function normalizedStatus(value: string | null | undefined) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
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

export default function CrmApp({ currentUser }: { currentUser: string }) {
  const [page, setPage] = useState<Page>("resumen");
  const [data, setData] = useState(fallbackData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [period, setPeriod] = useState<"hoy" | "semana" | "mes">("semana");

  async function refresh() {
    try {
      const response = await fetch("/api/crm", { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "No se pudo cargar la información");
      setData(json);
      setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "Error de conexión"); }
    finally { setLoading(false); }
  }
  useEffect(() => { void refresh(); }, []);

  async function api(payload: Record<string, unknown>) {
    const response = await fetch("/api/crm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const json = await response.json();
    if (!response.ok) throw new Error(json.error || "No se pudo guardar");
    return json;
  }

  async function moveLead(leadId: string, status: string) {
    const original = data;
    const now = new Date().toISOString();
    const lead = data.leads.find((l) => l.id === leadId);
    if (!lead || lead.status === status) return;
    setData((d) => ({ ...d, leads: d.leads.map((l) => l.id === leadId ? { ...l, status, updatedAt: now } : l), events: [{ id: `temp_${Date.now()}`, leadId, type: ({ Contactado: "contacted", "Respondió": "replied", "Propuesta enviada": "proposal", "Reunión agendada": "meeting", Cerrado: "closed" } as Record<string,string>)[status] ?? "stage_changed", fromStatus: lead.status, toStatus: status, actor: currentUser, note: "", createdAt: now }, ...d.events] }));
    try {
      const saved = await api({ action: "updateStage", leadId, status });
      setData((d) => ({
        ...d,
        leads: d.leads.map((l) => l.id === leadId ? saved.lead : l),
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
      if (Array.isArray(saved.leads)) setData((d) => ({ ...d, leads: d.leads.map((l) => saved.leads.find((u: Lead) => u.id === l.id) ?? l) }));
    } catch (e) { setData(original); setError(e instanceof Error ? e.message : "No se pudo reasignar"); }
  }

  const contactGoal = useMemo(() => {
    const now = Date.now();
    const contactMoves = data.events.filter((event) => movedBetween(event, "Pendiente", "Contactado"));
    const today = contactMoves.filter((event) => new Date(event.createdAt).getTime() >= now - dayMs).length;
    const week = contactMoves.filter((event) => new Date(event.createdAt).getTime() >= now - 7 * dayMs).length;
    return { today, week, progress: Math.min(100, Math.round((week / weeklyContactTarget) * 100)) };
  }, [data.events]);

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
        <div className="sidebar-brand"><div className="brand-mark small" aria-hidden="true"><span className="logo-node light"/><span className="logo-bridge"/><span className="logo-node clay"/></div><div><div className="brand-wordmark"><strong>Sincro</strong><b>CRM</b></div><small>Pipeline comercial</small></div><button className="icon-button close-menu" onClick={() => setMenuOpen(false)} aria-label="Cerrar menú"><X size={18}/></button></div>
        <nav>{nav.map(({ id, label, icon: Icon }) => <button key={id} className={page === id ? "active" : ""} onClick={() => { setPage(id); setMenuOpen(false); }}><Icon size={18}/><span>{label}</span>{id === "contactos" && <em>{data.leads.length}</em>}</button>)}</nav>
        <div className="sidebar-insight"><Sparkles size={18}/><strong>Objetivo semanal</strong><p>{contactGoal.today} contactados hoy · meta {dailyContactTarget}</p><div className="mini-progress"><span style={{ width: `${contactGoal.progress}%` }}/></div><small>{contactGoal.week} de {weeklyContactTarget} contactos</small></div>
        <div className="sidebar-footer"><div className="avatar">{initials(currentUser)}</div><div><strong>{currentUser.split(" · ")[0]}</strong><small>Equipo Sincro AI</small></div><MoreHorizontal size={18}/></div>
      </aside>

      <main className="main-area">
        <header className="topbar"><button className="icon-button mobile-menu" onClick={() => setMenuOpen(true)} aria-label="Abrir menú"><Menu size={20}/></button><div className="global-search"><Search size={18}/><input aria-label="Buscar en el CRM" placeholder="Buscar prospecto, email o teléfono..." onKeyDown={(e) => { if (e.key === "Enter") { setPage("contactos"); sessionStorage.setItem("crm-search", e.currentTarget.value); } }}/><kbd>⌘ K</kbd></div><div className="top-actions"><button className="icon-button notification" aria-label="Notificaciones"><Clock3 size={18}/><span/></button><button className="primary-button" onClick={() => setAddOpen(true)}><Plus size={18}/> Nuevo prospecto</button></div></header>
        {error && <div className="error-banner"><span>{error}</span><button onClick={() => { setError(""); void refresh(); }}>Reintentar</button></div>}
        {loading ? <Loading/> : <>
          {page === "resumen" && <Dashboard leads={data.leads} events={data.events} period={period} setPeriod={setPeriod} setPage={setPage}/>} 
          {page === "pipeline" && <Pipeline leads={data.leads} moveLead={moveLead}/>} 
          {page === "contactos" && <Contacts leads={data.leads} moveLead={moveLead} updateLeadOwner={updateLeadOwner} deleteLead={deleteLead} onAdd={() => setAddOpen(true)}/>} 
          {page === "importar" && <Importer api={api} refresh={refresh}/>} 
          {page === "mensajes" && <Messages templates={data.templates} api={api} refresh={refresh}/>} 
        </>}
      </main>
      {addOpen && <AddLead currentUser={currentUser} api={api} close={() => setAddOpen(false)} saved={async () => { setAddOpen(false); await refresh(); }}/>} 
    </div>
  );
}

function Loading() { return <div className="loading"><LoaderCircle className="spin"/><p>Sincronizando la operación comercial...</p></div>; }

function Dashboard({ leads, events, period, setPeriod, setPage }: { leads: Lead[]; events: Event[]; period: string; setPeriod: (p: "hoy"|"semana"|"mes") => void; setPage: (p: Page) => void }) {
  const cutoff = Date.now() - (period === "hoy" ? dayMs : period === "semana" ? 7 * dayMs : 30 * dayMs);
  const filtered = events.filter((e) => new Date(e.createdAt).getTime() >= cutoff);
  const safeRate = (n: number, d: number) => d ? Math.round(n / d * 100) : 0;
  const totalLeads = leads.length;
  const counts = {
    contacted: leads.filter((l) => !reachedStatus(l, ["Pendiente"])).length,
    replied: leads.filter((l) => reachedStatus(l, ["Respondió", "No interesado", "Propuesta enviada", "Reunión agendada", "Cerrado"])).length,
    proposal: leads.filter((l) => reachedStatus(l, ["Propuesta enviada", "Reunión agendada", "Cerrado"])).length,
    meeting: leads.filter((l) => reachedStatus(l, ["Reunión agendada", "Cerrado"])).length,
    closed: leads.filter((l) => reachedStatus(l, ["Cerrado"])).length,
  };
  const bases = {
    contacted: totalLeads,
    replied: counts.contacted,
    proposal: counts.replied,
    meeting: counts.proposal,
    closed: counts.meeting,
  };
  const cards = [
    { label: "Contactados", value: counts.contacted, icon: Mail, color: "blue", delta: `${safeRate(counts.contacted, bases.contacted)}% del total` }, { label: "Respondieron", value: counts.replied, icon: MessageSquareText, color: "purple", delta: `${safeRate(counts.replied, bases.replied)}% de contactados` }, { label: "Propuestas", value: counts.proposal, icon: Clipboard, color: "orange", delta: `${safeRate(counts.proposal, bases.proposal)}% de respuestas` }, { label: "Reuniones", value: counts.meeting, icon: CalendarClock, color: "teal", delta: `${safeRate(counts.meeting, bases.meeting)}% de propuestas` }, { label: "Cerrados", value: counts.closed, icon: CircleDollarSign, color: "green", delta: `${safeRate(counts.closed, bases.closed)}% de reuniones` },
  ];
  const funnelMetrics = [
    { label: "Contactados", value: counts.contacted, rate: safeRate(counts.contacted, bases.contacted), base: bases.contacted, color: "#0A2540" },
    { label: "Respondieron", value: counts.replied, rate: safeRate(counts.replied, bases.replied), base: bases.replied, color: "#2C7E96" },
    { label: "Propuesta enviada", value: counts.proposal, rate: safeRate(counts.proposal, bases.proposal), base: bases.proposal, color: "#E9761D" },
    { label: "Reunión agendada", value: counts.meeting, rate: safeRate(counts.meeting, bases.meeting), base: bases.meeting, color: "#287665" },
    { label: "Cliente cerrado", value: counts.closed, rate: safeRate(counts.closed, bases.closed), base: bases.closed, color: "#2E7D32" },
  ] as const;
  const activity = events.slice(0, 5);
  const leadById = new Map(leads.map((l) => [l.id, l]));
  const team = [...new Set(leads.map((l) => l.owner))].slice(0, 3).map((owner) => ({ owner, contacts: filtered.filter((e) => e.actor === owner && movedBetween(e, "Pendiente", "Contactado")).length, proposals: filtered.filter((e) => e.actor === owner && movedBetween(e, "Respondió", "Propuesta enviada")).length, closed: filtered.filter((e) => e.actor === owner && movedBetween(e, "Reunión agendada", "Cerrado")).length }));
  const topBlock = funnelMetrics.slice(1).reduce((prev, curr) => curr.rate < prev.rate ? curr : prev, funnelMetrics[1]);

  return <div className="page-content">
    <div className="page-heading"><div><p className="eyebrow">Centro de control</p><h1>Buen día, equipo <span>👋</span></h1><p>Así viene el rendimiento comercial de Sincro.</p></div><div className="period-control">{(["hoy","semana","mes"] as const).map((p) => <button key={p} className={period === p ? "active" : ""} onClick={() => setPeriod(p)}>{p === "hoy" ? "Hoy" : p === "semana" ? "7 días" : "30 días"}</button>)}</div></div>
    <section className="metric-grid">{cards.map(({ label, value, icon: Icon, color, delta }) => <article className="metric-card" key={label}><div className={`metric-icon ${color}`}><Icon size={19}/></div><div className="metric-copy"><small>{label}</small><strong>{value}</strong><span className={delta.startsWith("+") ? "positive" : ""}>{delta.startsWith("+") && <ArrowUp size={12}/>} {delta}</span></div></article>)}</section>
    <section className="dashboard-grid">
      <article className="panel funnel-panel"><div className="panel-heading"><div><h2>Embudo de conversión</h2><p>Conversión desde la etapa anterior</p></div><button className="text-button" onClick={() => setPage("pipeline")}>Ver pipeline <ArrowDown size={14}/></button></div><div className="funnel">{funnelMetrics.map(({ label, value, rate, base, color }) => <div className="funnel-row" key={label}><div className="funnel-label"><span>{label}</span><strong>{value}</strong></div><div className="funnel-track"><div style={{ width: `${Math.max(rate, value ? 6 : 0)}%`, background: color }}><span>{rate}%</span></div></div><div className="stage-rate">{value} de {base} etapa anterior</div></div>)}</div></article>
      <article className="panel insight-panel"><div className="insight-icon"><Target size={21}/></div><p className="eyebrow">Lectura del embudo</p><h2>La mayor oportunidad está en<br/><span>{topBlock.label}</span></h2><p>Esta etapa concentra la caída más fuerte del período. Revisar el mensaje o material usado acá puede mejorar todo el cierre.</p><div className="insight-stat"><strong>{bases.closed ? Math.max(1, Math.round(bases.closed / Math.max(counts.closed, 1))) : 0}</strong><span>reuniones por cada<br/>cliente cerrado</span></div><button onClick={() => setPage("mensajes")}>Revisar mensajes <ArrowDown size={14}/></button></article>
      <article className="panel activity-panel"><div className="panel-heading"><div><h2>Actividad reciente</h2><p>Últimos movimientos del equipo</p></div><Activity size={18}/></div><div className="activity-list">{activity.map((event) => { const lead = leadById.get(event.leadId); return <div className="activity-item" key={event.id}><div className="avatar mini">{initials(event.actor)}</div><div><p><strong>{event.actor.split("@")[0]}</strong> {eventLabels[event.type] ?? "actualizó a"} <b>{lead?.businessName ?? "un prospecto"}</b></p><small>{relativeTime(event.createdAt)}</small></div><span className="activity-dot" style={{ background: stageMeta[event.toStatus ?? "Pendiente"]?.color }}/></div>; })}</div></article>
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

function Contacts({ leads, moveLead, updateLeadOwner, deleteLead, onAdd }: { leads: Lead[]; moveLead:(id:string,status:string)=>void; updateLeadOwner:(ids:string[],owner:string)=>void; deleteLead:(id:string)=>void; onAdd:()=>void }) {
  const [search, setSearch] = useState(""); const [status, setStatus] = useState("Todos"); const [selected, setSelected] = useState<string[]>([]); const [bulkOwner, setBulkOwner] = useState(responsibleOwners[0]); const [copyMessage, setCopyMessage] = useState(""); const [range, setRange] = useState(""); const [rangeMessage, setRangeMessage] = useState("");
  useEffect(()=>{ const q=sessionStorage.getItem("crm-search"); if(q){setSearch(q); sessionStorage.removeItem("crm-search");}},[]);
  const filtered = leads.filter((l) => (status === "Todos" || l.status === status) && `${l.businessName} ${l.email} ${l.phone} ${l.segment}`.toLowerCase().includes(search.toLowerCase()));
  const selectedLeads = filtered.filter((l)=>selected.includes(l.id));
  const selectedWithPhone = selectedLeads.filter((l)=>whatsappNumber(l.phone));
  const allVisibleSelected = filtered.length > 0 && filtered.every((l)=>selected.includes(l.id));
  const toggle = (leadId:string) => setSelected((ids)=>ids.includes(leadId)?ids.filter((id)=>id!==leadId):[...ids,leadId]);
  const selectVisible = () => setSelected((ids)=>allVisibleSelected?ids.filter((id)=>!filtered.some((l)=>l.id===id)):[...new Set([...ids,...filtered.map((l)=>l.id)])]);
  function selectRange(){
    const match=range.trim().match(/^(\d+)\s*[-–—]\s*(\d+)$/);
    if(!match){setRangeMessage("Usá el formato 20-50");return;}
    const start=Number(match[1]); const end=Number(match[2]);
    if(start<1||end<=start){setRangeMessage("El segundo número debe ser mayor al primero");return;}
    const rangeIds=filtered.slice(start-1,end-1).map((l)=>l.id);
    if(!rangeIds.length){setRangeMessage(`No hay prospectos desde el número ${start}`);return;}
    setSelected(rangeIds);
    setRangeMessage(`${rangeIds.length} seleccionados · ${start}-${Math.min(end,filtered.length+1)}`);
  }
  async function copyText(text:string, message:string){ if(!text){setCopyMessage("No hay teléfonos seleccionados.");return;} try{ await navigator.clipboard.writeText(text); setCopyMessage(message); } catch { const area=document.createElement("textarea"); area.value=text; document.body.appendChild(area); area.select(); document.execCommand("copy"); area.remove(); setCopyMessage(message); } window.setTimeout(()=>setCopyMessage(""),2600); }
  const phoneLines = selectedWithPhone.map((l)=>whatsappNumber(l.phone)).join("\n");
  const downloadWhatsApp = () => downloadText("whatsapp_seleccionados_sincro.txt",phoneLines);
  return <div className="page-content"><div className="page-heading"><div><p className="eyebrow">Base compartida</p><h1>Prospectos</h1><p>{leads.length} registros disponibles para todo el equipo.</p></div><button className="primary-button" onClick={onAdd}><Plus size={17}/> Nuevo prospecto</button></div><section className="panel contacts-panel"><div className="table-toolbar"><label className="table-search"><Search size={17}/><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Buscar negocio, email, teléfono..."/></label><label className="select-wrap"><Filter size={15}/><select value={status} onChange={(e)=>setStatus(e.target.value)}><option>Todos</option>{stages.map((s)=><option key={s}>{s}</option>)}</select><ChevronDown size={14}/></label><button className="secondary-button" onClick={()=>downloadCsv(filtered)}><Download size={16}/> Exportar CSV</button></div><div className="bulk-toolbar"><div><strong>{selected.length ? `${selected.length} seleccionados` : "Seleccioná prospectos para trabajar en lote"}</strong><small>{selectedWithPhone.length} con teléfono listo para WhatsApp</small></div><div className="range-selector"><label htmlFor="contact-range">Rango</label><input id="contact-range" value={range} onChange={(e)=>{setRange(e.target.value);setRangeMessage("");}} onKeyDown={(e)=>{if(e.key==="Enter")selectRange();}} placeholder="20-50" aria-describedby="range-help"/><button className="secondary-button compact" onClick={selectRange}>Seleccionar</button><small id="range-help">El final no se incluye</small>{rangeMessage&&<em>{rangeMessage}</em>}</div><label className="select-wrap bulk-owner"><Users size={14}/><select value={bulkOwner} onChange={(e)=>setBulkOwner(e.target.value)}>{responsibleOwners.map((o)=><option key={o}>{o}</option>)}</select><ChevronDown size={14}/></label><button className="primary-button compact" disabled={!selected.length} onClick={()=>void updateLeadOwner(selected,bulkOwner)}>Asignar responsable</button><button className="secondary-button compact" disabled={!selectedWithPhone.length} onClick={()=>void copyText(phoneLines,`Copiados ${selectedWithPhone.length} números de WhatsApp`)}><Copy size={14}/> Copiar WhatsApp</button><button className="secondary-button compact" disabled={!selectedWithPhone.length} onClick={downloadWhatsApp}><Download size={14}/> TXT</button><button className="text-button clear-selection" disabled={!selected.length} onClick={()=>setSelected([])}>Limpiar</button>{copyMessage&&<em>{copyMessage}</em>}</div><div className="table-scroll"><table><thead><tr><th className="select-col"><input type="checkbox" aria-label="Seleccionar visibles" checked={allVisibleSelected} onChange={selectVisible}/></th><th className="number-col">#</th><th>Negocio</th><th>Contacto</th><th>Rubro</th><th>Responsable</th><th>Estado</th><th>Última actividad</th><th>Acciones</th></tr></thead><tbody>{filtered.map((lead,index)=><tr key={lead.id} className={selected.includes(lead.id)?"selected-row":""}><td className="select-col"><input type="checkbox" aria-label={`Seleccionar ${lead.businessName}`} checked={selected.includes(lead.id)} onChange={()=>toggle(lead.id)}/></td><td className="number-col">{index+1}</td><td><strong>{lead.businessName}</strong><small>{lead.source} · {lead.batch || "Sin tanda"}</small></td><td><div className="contact-cell">{lead.email&&<span className="contact-line"><Mail size={13}/>{lead.email}</span>}{lead.phone&&<span className="contact-line"><Phone size={13}/>{formatPhone(lead.phone)}</span>}{!lead.email&&!lead.phone&&<span className="muted-dash">Sin contacto</span>}</div></td><td>{lead.segment}</td><td><label className="owner-select"><div className="avatar tiny">{initials(lead.owner)}</div><select value={lead.owner} onChange={(e)=>void updateLeadOwner([lead.id],e.target.value)}>{responsibleOwners.map((o)=><option key={o}>{o}</option>)}</select><ChevronDown size={13}/></label></td><td><label className="status-select" style={{background:stageMeta[lead.status]?.tint,color:stageMeta[lead.status]?.color}}><span className="stage-dot" style={{background:stageMeta[lead.status]?.color}}/><select value={lead.status} onChange={(e)=>void moveLead(lead.id,e.target.value)}>{stages.map((s)=><option key={s}>{s}</option>)}</select><ChevronDown size={13}/></label></td><td>{relativeTime(lead.updatedAt)}</td><td><button className="icon-button row-delete" onClick={() => void deleteLead(lead.id)} aria-label={`Eliminar ${lead.businessName}`} title="Eliminar prospecto"><Trash2 size={14}/></button></td></tr>)}</tbody></table></div>{!filtered.length&&<div className="empty-state"><Search/><h3>No encontramos prospectos</h3><p>Probá cambiando los filtros o cargá uno nuevo.</p></div>}</section></div>;
}

function Importer({ api, refresh }: { api:(p:Record<string,unknown>)=>Promise<any>; refresh:()=>Promise<void> }) {
  const [rows,setRows]=useState<Record<string,string>[]>([]); const [name,setName]=useState(""); const [busy,setBusy]=useState(false); const [result,setResult]=useState(""); const [skipped,setSkipped]=useState(0);
  const norm=(s:string)=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
  const ownerValue=(v:string)=>responsibleOwners.find((o)=>norm(o)===norm(v))||responsibleOwners[0];
  async function readFile(file: File){
    setName(file.name); setResult("Leyendo archivo..."); setRows([]); setSkipped(0);
    try{
      const XLSX=await import("xlsx"); const data=await file.arrayBuffer(); const wb=XLSX.read(data,{type:"array"}); const sheet=wb.Sheets[wb.SheetNames[0]];
      const matrix=XLSX.utils.sheet_to_json<unknown[]>(sheet,{header:1,defval:"",blankrows:false});
      const headerIndex=matrix.findIndex((row)=>{const keys=row.map((c)=>norm(String(c??"")));return keys.includes("negocio")&&(keys.includes("email")||keys.includes("telefono"));});
      if(headerIndex<0){setResult("No encontré los encabezados de la plantilla. Revisá que existan Negocio, Email o Teléfono.");return;}
      const headers=matrix[headerIndex].map((c)=>norm(String(c??"")));
      const idx=(keys:string[])=>headers.findIndex((h)=>keys.includes(h));
      const indexes={businessName:idx(["negocio","nombredelnegocio","estudio","empresa","nombre"]),email:idx(["email","mail","correo"]),phone:idx(["telefono","telefonolimpio","telefonooriginal","celular","whatsapp"]),segment:idx(["rubro","segmento","categoria"]),owner:idx(["responsable","owner","usuario"]),status:idx(["estado","status"]),priority:idx(["prioridad"]),batch:idx(["tanda","lote"]),notes:idx(["notas","observaciones"])};
      const val=(row:unknown[],i:number)=>i>=0?String(row[i]??"").trim():"";
      const parsed=matrix.slice(headerIndex+1).map((row)=>({businessName:val(row,indexes.businessName),email:val(row,indexes.email),phone:val(row,indexes.phone),segment:val(row,indexes.segment),owner:ownerValue(val(row,indexes.owner)),status:val(row,indexes.status)||"Pendiente",priority:val(row,indexes.priority)||"Media",batch:val(row,indexes.batch),notes:val(row,indexes.notes)}));
      const usable=parsed.filter((r)=>r.businessName&&(r.email||r.phone));
      const incomplete=parsed.filter((r)=>r.businessName||r.email||r.phone).length-usable.length;
      setRows(usable); setSkipped(Math.max(0,incomplete));
      setResult(usable.length?`${usable.length} filas listas para importar${incomplete?` · ${incomplete} incompletas`:''}. Revisá la vista previa y confirmá.`:"No detecté filas importables. Completá Negocio y al menos Email o Teléfono.");
    }catch(e){setResult(e instanceof Error?e.message:"No pude leer el archivo");}
  }
  async function commit(){if(!rows.length)return;setBusy(true);try{const r=await api({action:"import",leads:rows});setResult(`${r.added} prospectos agregados · ${r.skipped + skipped} omitidos`);setRows([]);setSkipped(0);await refresh();}catch(e){setResult(e instanceof Error?e.message:"No se pudo importar");}finally{setBusy(false);}}
  return <div className="page-content"><div className="page-heading"><div><p className="eyebrow">Carga masiva</p><h1>Importar Excel</h1><p>Subí una lista y validala antes de sumarla a la base compartida.</p></div><a className="secondary-button" href="/Plantilla_Prospectos_Sincro_CRM.xlsx" download><Download size={16}/> Descargar plantilla</a></div><section className="import-grid"><article className="panel instructions"><div className="step-number">01</div><h2>Completá la plantilla</h2><p>Solo necesitás el nombre del negocio y un email o teléfono. El resto ayuda a ordenar y distribuir el trabajo.</p><ul><li><Check/> Responsables válidos: Franco, Trezza y Laucha</li><li><Check/> Un negocio por fila</li><li><Check/> No repitas email o teléfono</li></ul><a href="/Plantilla_Prospectos_Sincro_CRM.xlsx" download><FileSpreadsheet/> Plantilla_Prospectos_Sincro_CRM.xlsx <Download/></a></article><article className="panel upload-panel"><div className="step-number">02</div><h2>Subí el archivo completo</h2><label className="dropzone"><Upload size={30}/><strong>{name||"Arrastrá o elegí tu Excel"}</strong><span>Formatos .xlsx, .xls o .csv</span><input type="file" accept=".xlsx,.xls,.csv" onChange={(e)=>e.target.files?.[0]&&void readFile(e.target.files[0])}/></label>{result&&<p className={`import-result ${rows.length?"":"warning"}`}>{result}</p>}{rows.length>0&&<button className="primary-button import-confirm" onClick={()=>void commit()} disabled={busy}>{busy?<LoaderCircle className="spin" size={17}/>:<Upload size={17}/>} Confirmar importación</button>}</article></section>{rows.length>0&&<section className="panel preview-panel"><div className="panel-heading"><div><h2>Vista previa</h2><p>{rows.length} filas detectadas · responsables alineados con la plantilla</p></div></div><div className="table-scroll"><table><thead><tr><th>Negocio</th><th>Email</th><th>Teléfono</th><th>Rubro</th><th>Responsable</th><th>Estado</th></tr></thead><tbody>{rows.slice(0,20).map((r,i)=><tr key={i}><td><strong>{r.businessName}</strong></td><td>{r.email||"—"}</td><td>{r.phone||"—"}</td><td>{r.segment||"General"}</td><td>{r.owner}</td><td>{r.status||"Pendiente"}</td></tr>)}</tbody></table></div></section>}</div>;
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
Te entiendo. Para cerrar bien y no insistirte de más: ¿no te interesa porque ya lo tienen resuelto, por presupuesto o porque ahora no es prioridad?

OBJECIÓN: "Es caro / no hay presupuesto"
Tiene sentido cuidar el presupuesto. La pregunta sería si hoy están perdiendo más por turnos no respondidos, ausencias o tiempo del equipo contestando mensajes. Si querés, en 10 minutos calculamos si tiene sentido económico antes de hablar de precio.

OBJECIÓN: "No tengo tiempo"
Justamente apunta a eso. No te propongo una reunión larga: te muestro una demo de 10 minutos y decidís si vale la pena seguir. Si no te ahorra tiempo, no avanzamos.

OBJECIÓN: "Ahora no"
Dale. Para ubicarme: ¿"ahora no" es esta semana, este mes o este trimestre? Así no te persigo al pedo y te escribo cuando tenga sentido.

OBJECIÓN: "Ya tenemos alguien que responde"
Perfecto. Esto no reemplaza a la persona: le saca lo repetitivo. La persona puede enfocarse en vender, resolver casos especiales o atender mejor, mientras el sistema toma datos, confirma y ordena turnos.

OBJECIÓN: "Mis clientes prefieren escribir"
Totalmente, por eso no les sacamos WhatsApp. La idea es que puedan escribir igual, pero que el sistema los guíe a reservar sin esperar a que alguien esté libre para responder.

OBJECIÓN: "Ya probé algo parecido y no funcionó"
Te creo. Normalmente falla cuando es genérico o le pide demasiado al cliente. Lo que hacemos es armarlo sobre el flujo real del negocio. Si querés, revisamos qué falló y te digo honestamente si tiene sentido intentarlo de nuevo.

OBJECIÓN: "Hablame más adelante"
Obvio. ¿Te parece que te escriba el martes que viene o preferís que lo dejemos para principio de mes? Así queda ordenado y no te mando mensajes al azar.

OBJECIÓN: "No quiero cambiar mi forma de trabajar"
Está bien. La idea no es cambiar lo que ya funciona, sino automatizar lo repetido. Si hoy contestan 30 veces lo mismo, el sistema toma esa parte y ustedes mantienen el control.

RESPUESTA CORTANTE: "No gracias"
Gracias por responder. Te dejo tranquilo entonces. Si más adelante quieren que los turnos se reserven solos desde WhatsApp o web, escribime y te muestro un ejemplo.`;

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
  return <article className={`template-card flow-card ${suggested?"suggested":""}`}><header><span className={`channel ${template.channel.toLowerCase()}`}>{template.channel==="WhatsApp"?<Phone size={14}/>:<Mail size={14}/>} {template.channel}</span><span className="template-stage">{template.stage}</span></header><h2>{template.name}</h2><FlowPreview templateId={template.id} body={template.body} copied={copied} copyBlock={copyBlock}/><footer><small>Variables: <b>{"{{negocio}}"}</b> y <b>{"{{rubro}}"}</b></small><div className="template-actions"><button onClick={()=>edit(template)}><Pencil size={14}/> {suggested?"Usar":"Editar"}</button>{remove&&<button className="delete-template" disabled={deletingId===template.id} onClick={()=>void remove(template)}>{deletingId===template.id?<LoaderCircle className="spin" size={14}/>:<Trash2 size={14}/>} Eliminar</button>}<button onClick={()=>void copy(template)}>{copied===template.id?<><Check size={14}/> Todo copiado</>:<><Copy size={14}/> Copiar todo</>}</button></div></footer></article>;
}

function Messages({ templates, api, refresh }: { templates:Template[]; api:(p:Record<string,unknown>)=>Promise<any>; refresh:()=>Promise<void> }) {
  const emptyForm={name:"",channel:"WhatsApp",stage:"Pendiente",body:""};
  const [copied,setCopied]=useState(""); const [modalOpen,setModalOpen]=useState(false); const [editingId,setEditingId]=useState<string|null>(null); const [form,setForm]=useState(emptyForm); const [busy,setBusy]=useState(false); const [formError,setFormError]=useState(""); const [deletingId,setDeletingId]=useState("");
  async function copy(t:Template){await navigator.clipboard.writeText(t.body);setCopied(t.id);setTimeout(()=>setCopied(""),1800)}
  async function copyBlock(id:string,text:string){await navigator.clipboard.writeText(text);setCopied(id);setTimeout(()=>setCopied(""),1800)}
  function closeModal(){if(busy)return;setModalOpen(false);setEditingId(null);setForm(emptyForm);setFormError("");}
  function createTemplate(){setEditingId(null);setForm(emptyForm);setFormError("");setModalOpen(true);}
  function editTemplate(t:Template){setEditingId(t.id.startsWith("suggested_")?null:t.id);setForm({name:t.name,channel:t.channel,stage:t.stage,body:t.body});setFormError("");setModalOpen(true);}
  async function save(){if(!form.name.trim()||!form.body.trim()){setFormError("Completá el nombre y el flujo.");return;}setBusy(true);setFormError("");try{await api({action:editingId?"updateTemplate":"saveTemplate",templateId:editingId,template:form});setModalOpen(false);setEditingId(null);setForm(emptyForm);await refresh();}catch(e){setFormError(e instanceof Error?e.message:"No se pudo guardar el flujo");}finally{setBusy(false);}}
  async function remove(t:Template){if(!window.confirm(`¿Eliminar el flujo "${t.name}"? Esta acción no se puede deshacer.`))return;setDeletingId(t.id);try{await api({action:"deleteTemplate",templateId:t.id});await refresh();}catch(e){window.alert(e instanceof Error?e.message:"No se pudo eliminar el flujo");}finally{setDeletingId("");}}
  const savedFlowNames = new Set(templates.map((t)=>t.name.trim().toLowerCase()));
  const visibleSuggestions = suggestedFlows.filter((flow)=>!savedFlowNames.has(flow.name.trim().toLowerCase()));
  return <div className="page-content"><div className="page-heading"><div><p className="eyebrow">Biblioteca compartida</p><h1>Flujos de conversación</h1><p>Guiones por etapa con caminos posibles según lo que responde cada prospecto.</p></div><button className="primary-button" onClick={createTemplate}><Plus size={17}/> Nuevo flujo</button></div>{visibleSuggestions.length>0&&<section className="flow-suggestions"><div className="panel-heading"><div><h2>Flujos sugeridos</h2><p>Base editable para que el equipo tenga una guía común.</p></div></div><div className="template-grid">{visibleSuggestions.map((t)=><FlowCard key={t.id} template={t} copied={copied} deletingId={deletingId} suggested edit={editTemplate} copy={copy} copyBlock={copyBlock}/>)}</div></section>}<div className="template-grid">{templates.map((t)=><FlowCard key={t.id} template={t} copied={copied} deletingId={deletingId} edit={editTemplate} remove={remove} copy={copy} copyBlock={copyBlock}/>)}</div>{!templates.length&&!visibleSuggestions.length&&<div className="empty-state"><MessageSquareText/><h3>No hay flujos</h3><p>Creá un flujo para empezar a ordenar las conversaciones del equipo.</p></div>}{modalOpen&&<div className="modal-backdrop" onMouseDown={closeModal}><div className="modal-card template-modal" onMouseDown={(e)=>e.stopPropagation()}><div className="modal-heading"><div><p className="eyebrow">Biblioteca</p><h2>{editingId?"Editar flujo":"Nuevo flujo"}</h2></div><button className="icon-button" onClick={closeModal} disabled={busy}><X/></button></div><label>Nombre<input autoFocus value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} placeholder="Ej: Flujo para agendamiento automático"/></label><div className="form-row"><label>Canal<select value={form.channel} onChange={(e)=>setForm({...form,channel:e.target.value})}><option>WhatsApp</option><option>Email</option></select></label><label>Etapa<select value={form.stage} onChange={(e)=>setForm({...form,stage:e.target.value})}>{stages.map((s)=><option key={s}>{s}</option>)}</select></label></div><label>Flujo<textarea value={form.body} onChange={(e)=>setForm({...form,body:e.target.value})} rows={12} placeholder={"MSJ 1\nBuenas, ¿cómo va?\n\nSI RESPONDE: Me interesa\nAgendar reunión breve..."} /></label>{formError&&<p className="form-error">{formError}</p>}<div className="modal-actions"><button className="secondary-button" onClick={closeModal} disabled={busy}>Cancelar</button><button className="primary-button" onClick={()=>void save()} disabled={busy}>{busy&&<LoaderCircle className="spin" size={16}/>} {editingId?"Guardar cambios":"Crear flujo"}</button></div></div></div>}</div>;
}

function AddLead({ currentUser, api, close, saved }: { currentUser:string; api:(p:Record<string,unknown>)=>Promise<any>; close:()=>void; saved:()=>Promise<void> }) {
  const currentOwner=responsibleOwners.includes(currentUser)?currentUser:responsibleOwners[0];
  const [form,setForm]=useState({businessName:"",email:"",phone:"",segment:"",owner:currentOwner,status:"Pendiente",priority:"Media",batch:"",notes:""}); const [busy,setBusy]=useState(false); const [error,setError]=useState("");
  async function submit(){setBusy(true);setError("");try{await api({action:"create",lead:form});await saved();}catch(e){setError(e instanceof Error?e.message:"No se pudo guardar");setBusy(false);}}
  return <div className="modal-backdrop" onMouseDown={close}><div className="modal-card" onMouseDown={(e)=>e.stopPropagation()}><div className="modal-heading"><div><p className="eyebrow">Base compartida</p><h2>Nuevo prospecto</h2></div><button className="icon-button" onClick={close}><X/></button></div><label>Nombre del negocio *<input autoFocus value={form.businessName} onChange={(e)=>setForm({...form,businessName:e.target.value})} placeholder="Ej: Estudio Horizonte"/></label><div className="form-row"><label>Email<input type="email" value={form.email} onChange={(e)=>setForm({...form,email:e.target.value})} placeholder="hola@negocio.com"/></label><label>Teléfono / WhatsApp<input value={form.phone} onChange={(e)=>setForm({...form,phone:e.target.value})} placeholder="54911..."/></label></div><div className="form-row"><label>Rubro<input value={form.segment} onChange={(e)=>setForm({...form,segment:e.target.value})} placeholder="Arquitectura"/></label><label>Responsable<select value={form.owner} onChange={(e)=>setForm({...form,owner:e.target.value})}>{responsibleOwners.map((o)=><option key={o}>{o}</option>)}</select></label></div><div className="form-row"><label>Estado<select value={form.status} onChange={(e)=>setForm({...form,status:e.target.value})}>{stages.map((s)=><option key={s}>{s}</option>)}</select></label><label>Prioridad<select value={form.priority} onChange={(e)=>setForm({...form,priority:e.target.value})}><option>Alta</option><option>Media</option><option>Baja</option></select></label></div><label>Tanda<input value={form.batch} onChange={(e)=>setForm({...form,batch:e.target.value})} placeholder="Tanda 1"/></label><label>Notas<textarea rows={3} value={form.notes} onChange={(e)=>setForm({...form,notes:e.target.value})} placeholder="Contexto útil para el próximo contacto..."/></label>{error&&<p className="form-error">{error}</p>}<div className="modal-actions"><button className="secondary-button" onClick={close}>Cancelar</button><button className="primary-button" onClick={()=>void submit()} disabled={busy}>{busy&&<LoaderCircle className="spin" size={16}/>} Guardar prospecto</button></div></div></div>;
}

function initials(name:string){return name.split(/[\s@.]+/).filter(Boolean).slice(0,2).map((x)=>x[0]?.toUpperCase()).join("")||"SA"}
function relativeTime(date:string){const d=Math.max(0,Date.now()-new Date(date).getTime());const h=Math.floor(d/3600000);if(h<1)return"Hace unos minutos";if(h<24)return`Hace ${h} h`;const days=Math.floor(h/24);return days===1?"Ayer":`Hace ${days} días`}
function whatsappNumber(phone:string){const digits=String(phone||"").replace(/\D/g,"");if(!digits)return"";if(digits.startsWith("549"))return digits;if(digits.startsWith("54"))return digits;if(digits.startsWith("01115")&&digits.length>=13)return `54911${digits.slice(5)}`;if(digits.startsWith("011")&&digits.length>=11)return `5411${digits.slice(3)}`;if(digits.startsWith("15")&&digits.length===10)return `54911${digits.slice(2)}`;if(digits.startsWith("11")&&digits.length===10)return `54${digits}`;return digits}
function formatPhone(p:string){const wa=whatsappNumber(p);if(!wa)return"";if(/^54911\d{8}$/.test(wa))return `+54 9 11 ${wa.slice(5,9)}-${wa.slice(9)}`;if(/^5411\d{8}$/.test(wa))return `+54 11 ${wa.slice(4,8)}-${wa.slice(8)}`;if(wa.startsWith("54"))return `+${wa}`;return String(p||"").trim()}
function downloadCsv(leads:Lead[]){const headers=["Negocio","Email","Telefono","Rubro","Responsable","Estado","Prioridad","Tanda","Notas"];const esc=(v:string)=>`"${String(v??"").replace(/"/g,'""')}"`;const csv=[headers,...leads.map((l)=>[l.businessName,l.email,l.phone,l.segment,l.owner,l.status,l.priority,l.batch,l.notes])].map((r)=>r.map(esc).join(",")).join("\n");const a=document.createElement("a");a.href=URL.createObjectURL(new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"}));a.download="prospectos_sincro.csv";a.click();URL.revokeObjectURL(a.href)}
function downloadText(filename:string, text:string){const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([text],{type:"text/plain;charset=utf-8"}));a.download=filename;a.click();URL.revokeObjectURL(a.href)}
