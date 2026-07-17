"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowDown, ArrowUp, BarChart3, BriefcaseBusiness, CalendarClock, Check, ChevronDown, CircleDollarSign, Clipboard, Clock3, Copy, Download, FileSpreadsheet, Filter, LayoutDashboard, LoaderCircle, Mail, Menu, MessageSquareText, MoreHorizontal, Phone, Plus, Search, Settings, Sparkles, Target, TrendingUp, Upload, UserRound, Users, X } from "lucide-react";

type Lead = { id: string; businessName: string; email: string; phone: string; segment: string; owner: string; status: string; priority: string; batch: string; notes: string; nextFollowUp: string | null; source: string; createdAt: string; updatedAt: string };
type Event = { id: string; leadId: string; type: string; fromStatus: string | null; toStatus: string | null; actor: string; note: string; createdAt: string };
type Template = { id: string; name: string; channel: string; stage: string; body: string; active: boolean; createdAt: string };
type Page = "resumen" | "pipeline" | "contactos" | "importar" | "mensajes";

const stages = ["Pendiente", "Contactado", "Respondió", "Propuesta enviada", "Reunión agendada", "Cerrado", "No respondió", "No interesado", "Perdido"];
const pipelineStages = stages.slice(0, 6);
const stageMeta: Record<string, { color: string; tint: string }> = {
  Pendiente: { color: "#6E7682", tint: "#ECECE7" }, Contactado: { color: "#2C7E96", tint: "#E5EFF1" }, "Respondió": { color: "#0A2540", tint: "#E6EBF0" }, "Propuesta enviada": { color: "#C25A12", tint: "#F6DCC6" }, "Reunión agendada": { color: "#287665", tint: "#E3F1ED" }, Cerrado: { color: "#2E7D32", tint: "#E5F2E4" }, "No respondió": { color: "#8A6D4A", tint: "#F2ECE4" }, "No interesado": { color: "#B44742", tint: "#F8E8E6" }, Perdido: { color: "#8C3338", tint: "#F5E5E6" },
};
const nav = [
  { id: "resumen" as Page, label: "Resumen", icon: LayoutDashboard }, { id: "pipeline" as Page, label: "Pipeline", icon: TrendingUp }, { id: "contactos" as Page, label: "Prospectos", icon: Users }, { id: "importar" as Page, label: "Importar Excel", icon: FileSpreadsheet }, { id: "mensajes" as Page, label: "Mensajes", icon: MessageSquareText },
];
const eventLabels: Record<string, string> = { contacted: "contactó a", replied: "registró respuesta de", proposal: "envió propuesta a", meeting: "agendó reunión con", closed: "cerró a", created: "cargó a", no_reply: "marcó sin respuesta a", stage_changed: "actualizó a" };

const fallbackData = { leads: [] as Lead[], events: [] as Event[], templates: [] as Template[] };

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
    try { await api({ action: "updateStage", leadId, status }); }
    catch (e) { setData(original); setError(e instanceof Error ? e.message : "No se pudo actualizar"); }
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
        <div className="sidebar-brand"><div className="brand-mark small" aria-hidden="true"><span className="logo-node light"/><span className="logo-bridge"/><span className="logo-node clay"/></div><div><div className="brand-wordmark"><strong>Sincro</strong><b>CRM</b></div><small>Pipeline comercial</small></div><button className="icon-button close-menu" onClick={() => setMenuOpen(false)} aria-label="Cerrar menú"><X size={18}/></button></div>
        <nav>{nav.map(({ id, label, icon: Icon }) => <button key={id} className={page === id ? "active" : ""} onClick={() => { setPage(id); setMenuOpen(false); }}><Icon size={18}/><span>{label}</span>{id === "contactos" && <em>{data.leads.length}</em>}</button>)}</nav>
        <div className="sidebar-insight"><Sparkles size={18}/><strong>Objetivo semanal</strong><p>100 contactos por día</p><div className="mini-progress"><span style={{ width: "68%" }}/></div><small>340 de 500 contactos</small></div>
        <div className="sidebar-footer"><div className="avatar">{initials(currentUser)}</div><div><strong>{currentUser.split(" · ")[0]}</strong><small>Equipo Sincro AI</small></div><MoreHorizontal size={18}/></div>
      </aside>

      <main className="main-area">
        <header className="topbar"><button className="icon-button mobile-menu" onClick={() => setMenuOpen(true)} aria-label="Abrir menú"><Menu size={20}/></button><div className="global-search"><Search size={18}/><input aria-label="Buscar en el CRM" placeholder="Buscar prospecto, email o teléfono..." onKeyDown={(e) => { if (e.key === "Enter") { setPage("contactos"); sessionStorage.setItem("crm-search", e.currentTarget.value); } }}/><kbd>⌘ K</kbd></div><div className="top-actions"><button className="icon-button notification" aria-label="Notificaciones"><Clock3 size={18}/><span/></button><button className="primary-button" onClick={() => setAddOpen(true)}><Plus size={18}/> Nuevo prospecto</button></div></header>
        {error && <div className="error-banner"><span>{error}</span><button onClick={() => { setError(""); void refresh(); }}>Reintentar</button></div>}
        {loading ? <Loading/> : <>
          {page === "resumen" && <Dashboard leads={data.leads} events={data.events} period={period} setPeriod={setPeriod} setPage={setPage}/>} 
          {page === "pipeline" && <Pipeline leads={data.leads} moveLead={moveLead}/>} 
          {page === "contactos" && <Contacts leads={data.leads} moveLead={moveLead} onAdd={() => setAddOpen(true)}/>} 
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
  const cutoff = Date.now() - (period === "hoy" ? 86400000 : period === "semana" ? 7 * 86400000 : 30 * 86400000);
  const filtered = events.filter((e) => new Date(e.createdAt).getTime() >= cutoff);
  const counts = { contacted: filtered.filter((e) => e.type === "contacted").length, replied: filtered.filter((e) => e.type === "replied").length, proposal: filtered.filter((e) => e.type === "proposal").length, meeting: filtered.filter((e) => e.type === "meeting").length, closed: filtered.filter((e) => e.type === "closed").length };
  const safeRate = (n: number, d: number) => d ? Math.round(n / d * 100) : 0;
  const cards = [
    { label: "Contactados", value: counts.contacted, icon: Mail, color: "blue", delta: "+12%" }, { label: "Respondieron", value: counts.replied, icon: MessageSquareText, color: "purple", delta: `${safeRate(counts.replied, counts.contacted)}% tasa` }, { label: "Propuestas", value: counts.proposal, icon: Clipboard, color: "orange", delta: `${safeRate(counts.proposal, counts.contacted)}% del total` }, { label: "Reuniones", value: counts.meeting, icon: CalendarClock, color: "teal", delta: `${safeRate(counts.meeting, counts.proposal)}% de propuestas` }, { label: "Cerrados", value: counts.closed, icon: CircleDollarSign, color: "green", delta: `${safeRate(counts.closed, counts.contacted)}% cierre` },
  ];
  const funnel = [
    ["Contactados", counts.contacted, 100, "#0A2540"], ["Respondieron", counts.replied, safeRate(counts.replied, counts.contacted), "#2C7E96"], ["Propuesta enviada", counts.proposal, safeRate(counts.proposal, counts.contacted), "#E9761D"], ["Reunión agendada", counts.meeting, safeRate(counts.meeting, counts.contacted), "#287665"], ["Cliente cerrado", counts.closed, safeRate(counts.closed, counts.contacted), "#2E7D32"],
  ] as const;
  const activity = events.slice(0, 5);
  const leadById = new Map(leads.map((l) => [l.id, l]));
  const team = [...new Set(leads.map((l) => l.owner))].slice(0, 3).map((owner) => ({ owner, contacts: filtered.filter((e) => e.actor === owner && e.type === "contacted").length, proposals: filtered.filter((e) => e.actor === owner && e.type === "proposal").length, closed: filtered.filter((e) => e.actor === owner && e.type === "closed").length }));
  const topBlock = funnel.slice(1).reduce((prev, curr) => curr[2] < prev[2] ? curr : prev, funnel[1]);

  return <div className="page-content">
    <div className="page-heading"><div><p className="eyebrow">Centro de control</p><h1>Buen día, equipo <span>👋</span></h1><p>Así viene el rendimiento comercial de Sincro.</p></div><div className="period-control">{(["hoy","semana","mes"] as const).map((p) => <button key={p} className={period === p ? "active" : ""} onClick={() => setPeriod(p)}>{p === "hoy" ? "Hoy" : p === "semana" ? "7 días" : "30 días"}</button>)}</div></div>
    <section className="metric-grid">{cards.map(({ label, value, icon: Icon, color, delta }) => <article className="metric-card" key={label}><div className={`metric-icon ${color}`}><Icon size={19}/></div><div className="metric-copy"><small>{label}</small><strong>{value}</strong><span className={delta.startsWith("+") ? "positive" : ""}>{delta.startsWith("+") && <ArrowUp size={12}/>} {delta}</span></div></article>)}</section>
    <section className="dashboard-grid">
      <article className="panel funnel-panel"><div className="panel-heading"><div><h2>Embudo de conversión</h2><p>Conversión sobre contactos realizados</p></div><button className="text-button" onClick={() => setPage("pipeline")}>Ver pipeline <ArrowDown size={14}/></button></div><div className="funnel">{funnel.map(([label, value, rate, color], index) => <div className="funnel-row" key={label}><div className="funnel-label"><span>{label}</span><strong>{value}</strong></div><div className="funnel-track"><div style={{ width: `${Math.max(rate, value ? 6 : 0)}%`, background: color }}><span>{rate}%</span></div></div>{index < funnel.length - 1 && <div className="stage-rate">{safeRate(funnel[index+1][1], value)}% pasa a la siguiente etapa</div>}</div>)}</div></article>
      <article className="panel insight-panel"><div className="insight-icon"><Target size={21}/></div><p className="eyebrow">Lectura del embudo</p><h2>La mayor oportunidad está en<br/><span>{topBlock[0]}</span></h2><p>Esta etapa concentra la caída más fuerte del período. Revisar el mensaje o material usado acá puede mejorar todo el cierre.</p><div className="insight-stat"><strong>{counts.contacted ? Math.max(1, Math.round(counts.contacted / Math.max(counts.closed, 1))) : 0}</strong><span>contactos por cada<br/>cliente cerrado</span></div><button onClick={() => setPage("mensajes")}>Revisar mensajes <ArrowDown size={14}/></button></article>
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

function Contacts({ leads, moveLead, onAdd }: { leads: Lead[]; moveLead:(id:string,status:string)=>void; onAdd:()=>void }) {
  const [search, setSearch] = useState(""); const [status, setStatus] = useState("Todos");
  useEffect(()=>{ const q=sessionStorage.getItem("crm-search"); if(q){setSearch(q); sessionStorage.removeItem("crm-search");}},[]);
  const filtered = leads.filter((l) => (status === "Todos" || l.status === status) && `${l.businessName} ${l.email} ${l.phone} ${l.segment}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="page-content"><div className="page-heading"><div><p className="eyebrow">Base compartida</p><h1>Prospectos</h1><p>{leads.length} registros disponibles para todo el equipo.</p></div><button className="primary-button" onClick={onAdd}><Plus size={17}/> Nuevo prospecto</button></div><section className="panel contacts-panel"><div className="table-toolbar"><label className="table-search"><Search size={17}/><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Buscar negocio, email, teléfono..."/></label><label className="select-wrap"><Filter size={15}/><select value={status} onChange={(e)=>setStatus(e.target.value)}><option>Todos</option>{stages.map((s)=><option key={s}>{s}</option>)}</select><ChevronDown size={14}/></label><button className="secondary-button" onClick={()=>downloadCsv(filtered)}><Download size={16}/> Exportar CSV</button></div><div className="table-scroll"><table><thead><tr><th>Negocio</th><th>Contacto</th><th>Rubro</th><th>Responsable</th><th>Estado</th><th>Última actividad</th></tr></thead><tbody>{filtered.map((lead)=><tr key={lead.id}><td><strong>{lead.businessName}</strong><small>{lead.source} · {lead.batch || "Sin tanda"}</small></td><td><span>{lead.email || "—"}</span><small>{lead.phone ? formatPhone(lead.phone) : ""}</small></td><td>{lead.segment}</td><td><span className="owner-cell"><div className="avatar tiny">{initials(lead.owner)}</div>{lead.owner}</span></td><td><label className="status-select" style={{background:stageMeta[lead.status]?.tint,color:stageMeta[lead.status]?.color}}><span className="stage-dot" style={{background:stageMeta[lead.status]?.color}}/><select value={lead.status} onChange={(e)=>void moveLead(lead.id,e.target.value)}>{stages.map((s)=><option key={s}>{s}</option>)}</select><ChevronDown size={13}/></label></td><td>{relativeTime(lead.updatedAt)}</td></tr>)}</tbody></table></div>{!filtered.length&&<div className="empty-state"><Search/><h3>No encontramos prospectos</h3><p>Probá cambiando los filtros o cargá uno nuevo.</p></div>}</section></div>;
}

function Importer({ api, refresh }: { api:(p:Record<string,unknown>)=>Promise<any>; refresh:()=>Promise<void> }) {
  const [rows,setRows]=useState<Record<string,string>[]>([]); const [name,setName]=useState(""); const [busy,setBusy]=useState(false); const [result,setResult]=useState("");
  async function readFile(file: File){ setName(file.name); setResult(""); const XLSX=await import("xlsx"); const data=await file.arrayBuffer(); const wb=XLSX.read(data,{type:"array"}); const raw=XLSX.utils.sheet_to_json<Record<string,unknown>>(wb.Sheets[wb.SheetNames[0]],{defval:""}); const norm=(s:string)=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,""); const pick=(r:Record<string,unknown>,keys:string[])=>{const found=Object.keys(r).find((k)=>keys.includes(norm(k)));return found?String(r[found]??""):""}; const parsed=raw.map((r)=>({businessName:pick(r,["negocio","nombredelnegocio","estudio","empresa","nombre"]),email:pick(r,["email","mail","correo"]),phone:pick(r,["telefono","telefonolimpio","telefonooriginal","celular","whatsapp"]),segment:pick(r,["rubro","segmento","categoria"]),owner:pick(r,["responsable","owner","usuario"]),status:pick(r,["estado","status"]),priority:pick(r,["prioridad"]),batch:pick(r,["tanda","lote"]),notes:pick(r,["notas","observaciones"])})); setRows(parsed.filter((r)=>r.businessName||r.email||r.phone)); }
  async function commit(){setBusy(true);try{const r=await api({action:"import",leads:rows});setResult(`${r.added} prospectos agregados · ${r.skipped} omitidos`);setRows([]);await refresh();}catch(e){setResult(e instanceof Error?e.message:"No se pudo importar");}finally{setBusy(false);}}
  return <div className="page-content"><div className="page-heading"><div><p className="eyebrow">Carga masiva</p><h1>Importar Excel</h1><p>Subí una lista y validala antes de sumarla a la base compartida.</p></div><a className="secondary-button" href="/Plantilla_Prospectos_Sincro_CRM.xlsx" download><Download size={16}/> Descargar plantilla</a></div><section className="import-grid"><article className="panel instructions"><div className="step-number">01</div><h2>Completá la plantilla</h2><p>Solo necesitás el nombre del negocio y un email o teléfono. El resto ayuda a ordenar y distribuir el trabajo.</p><ul><li><Check/> No cambies los títulos de las columnas</li><li><Check/> Un negocio por fila</li><li><Check/> No repitas email o teléfono</li></ul><a href="/Plantilla_Prospectos_Sincro_CRM.xlsx" download><FileSpreadsheet/> Plantilla_Prospectos_Sincro_CRM.xlsx <Download/></a></article><article className="panel upload-panel"><div className="step-number">02</div><h2>Subí el archivo completo</h2><label className="dropzone"><Upload size={30}/><strong>{name||"Arrastrá o elegí tu Excel"}</strong><span>Formatos .xlsx, .xls o .csv</span><input type="file" accept=".xlsx,.xls,.csv" onChange={(e)=>e.target.files?.[0]&&void readFile(e.target.files[0])}/></label>{result&&<p className="import-result">{result}</p>}</article></section>{rows.length>0&&<section className="panel preview-panel"><div className="panel-heading"><div><h2>Vista previa</h2><p>{rows.length} filas detectadas</p></div><button className="primary-button" onClick={()=>void commit()} disabled={busy}>{busy?<LoaderCircle className="spin" size={17}/>:<Upload size={17}/>} Confirmar importación</button></div><div className="table-scroll"><table><thead><tr><th>Negocio</th><th>Email</th><th>Teléfono</th><th>Rubro</th><th>Estado</th></tr></thead><tbody>{rows.slice(0,20).map((r,i)=><tr key={i}><td><strong>{r.businessName||<span className="invalid">Falta nombre</span>}</strong></td><td>{r.email||"—"}</td><td>{r.phone||"—"}</td><td>{r.segment||"General"}</td><td>{r.status||"Pendiente"}</td></tr>)}</tbody></table></div></section>}</div>;
}

function Messages({ templates, api, refresh }: { templates:Template[]; api:(p:Record<string,unknown>)=>Promise<any>; refresh:()=>Promise<void> }) {
  const [copied,setCopied]=useState(""); const [creating,setCreating]=useState(false); const [form,setForm]=useState({name:"",channel:"WhatsApp",stage:"Pendiente",body:""});
  async function copy(t:Template){await navigator.clipboard.writeText(t.body);setCopied(t.id);setTimeout(()=>setCopied(""),1800)}
  async function save(){if(!form.name||!form.body)return;await api({action:"saveTemplate",template:form});setCreating(false);setForm({name:"",channel:"WhatsApp",stage:"Pendiente",body:""});await refresh();}
  return <div className="page-content"><div className="page-heading"><div><p className="eyebrow">Biblioteca compartida</p><h1>Mensajes modelo</h1><p>El equipo copia, personaliza y envía una comunicación consistente.</p></div><button className="primary-button" onClick={()=>setCreating(true)}><Plus size={17}/> Nueva plantilla</button></div><div className="template-grid">{templates.map((t)=><article className="template-card" key={t.id}><header><span className={`channel ${t.channel.toLowerCase()}`}>{t.channel==="WhatsApp"?<Phone size={14}/>:<Mail size={14}/>} {t.channel}</span><span className="template-stage">{t.stage}</span></header><h2>{t.name}</h2><p>{t.body}</p><footer><small>Usá <b>{"{{negocio}}"}</b> para personalizar</small><button onClick={()=>void copy(t)}>{copied===t.id?<><Check size={16}/> Copiado</>:<><Copy size={16}/> Copiar</>}</button></footer></article>)}</div>{creating&&<div className="modal-backdrop" onMouseDown={()=>setCreating(false)}><div className="modal-card template-modal" onMouseDown={(e)=>e.stopPropagation()}><div className="modal-heading"><div><p className="eyebrow">Biblioteca</p><h2>Nueva plantilla</h2></div><button className="icon-button" onClick={()=>setCreating(false)}><X/></button></div><label>Nombre<input value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} placeholder="Ej: Seguimiento después de propuesta"/></label><div className="form-row"><label>Canal<select value={form.channel} onChange={(e)=>setForm({...form,channel:e.target.value})}><option>WhatsApp</option><option>Email</option></select></label><label>Etapa<select value={form.stage} onChange={(e)=>setForm({...form,stage:e.target.value})}>{stages.map((s)=><option key={s}>{s}</option>)}</select></label></div><label>Mensaje<textarea value={form.body} onChange={(e)=>setForm({...form,body:e.target.value})} rows={7} placeholder="Escribí el mensaje modelo..."/></label><button className="primary-button full" onClick={()=>void save()}>Guardar plantilla</button></div></div>}</div>;
}

function AddLead({ currentUser, api, close, saved }: { currentUser:string; api:(p:Record<string,unknown>)=>Promise<any>; close:()=>void; saved:()=>Promise<void> }) {
  const [form,setForm]=useState({businessName:"",email:"",phone:"",segment:"",owner:currentUser.split(" · ")[0],status:"Pendiente",priority:"Media",batch:"",notes:""}); const [busy,setBusy]=useState(false); const [error,setError]=useState("");
  async function submit(){setBusy(true);setError("");try{await api({action:"create",lead:form});await saved();}catch(e){setError(e instanceof Error?e.message:"No se pudo guardar");setBusy(false);}}
  return <div className="modal-backdrop" onMouseDown={close}><div className="modal-card" onMouseDown={(e)=>e.stopPropagation()}><div className="modal-heading"><div><p className="eyebrow">Base compartida</p><h2>Nuevo prospecto</h2></div><button className="icon-button" onClick={close}><X/></button></div><label>Nombre del negocio *<input autoFocus value={form.businessName} onChange={(e)=>setForm({...form,businessName:e.target.value})} placeholder="Ej: Estudio Horizonte"/></label><div className="form-row"><label>Email<input type="email" value={form.email} onChange={(e)=>setForm({...form,email:e.target.value})} placeholder="hola@negocio.com"/></label><label>Teléfono / WhatsApp<input value={form.phone} onChange={(e)=>setForm({...form,phone:e.target.value})} placeholder="54911..."/></label></div><div className="form-row"><label>Rubro<input value={form.segment} onChange={(e)=>setForm({...form,segment:e.target.value})} placeholder="Arquitectura"/></label><label>Prioridad<select value={form.priority} onChange={(e)=>setForm({...form,priority:e.target.value})}><option>Alta</option><option>Media</option><option>Baja</option></select></label></div><div className="form-row"><label>Estado<select value={form.status} onChange={(e)=>setForm({...form,status:e.target.value})}>{stages.map((s)=><option key={s}>{s}</option>)}</select></label><label>Tanda<input value={form.batch} onChange={(e)=>setForm({...form,batch:e.target.value})} placeholder="Tanda 1"/></label></div><label>Notas<textarea rows={3} value={form.notes} onChange={(e)=>setForm({...form,notes:e.target.value})} placeholder="Contexto útil para el próximo contacto..."/></label>{error&&<p className="form-error">{error}</p>}<div className="modal-actions"><button className="secondary-button" onClick={close}>Cancelar</button><button className="primary-button" onClick={()=>void submit()} disabled={busy}>{busy&&<LoaderCircle className="spin" size={16}/>} Guardar prospecto</button></div></div></div>;
}

function initials(name:string){return name.split(/[\s@.]+/).filter(Boolean).slice(0,2).map((x)=>x[0]?.toUpperCase()).join("")||"SA"}
function relativeTime(date:string){const d=Math.max(0,Date.now()-new Date(date).getTime());const h=Math.floor(d/3600000);if(h<1)return"Hace unos minutos";if(h<24)return`Hace ${h} h`;const days=Math.floor(h/24);return days===1?"Ayer":`Hace ${days} días`}
function formatPhone(p:string){if(!p)return"";return p.startsWith("54")?`+54 ${p.slice(2,4)} ${p.slice(4,8)}-${p.slice(8)}`:p}
function downloadCsv(leads:Lead[]){const headers=["Negocio","Email","Telefono","Rubro","Responsable","Estado","Prioridad","Tanda","Notas"];const esc=(v:string)=>`"${String(v??"").replace(/"/g,'""')}"`;const csv=[headers,...leads.map((l)=>[l.businessName,l.email,l.phone,l.segment,l.owner,l.status,l.priority,l.batch,l.notes])].map((r)=>r.map(esc).join(",")).join("\n");const a=document.createElement("a");a.href=URL.createObjectURL(new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"}));a.download="prospectos_sincro.csv";a.click();URL.revokeObjectURL(a.href)}
