import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the Sincro CRM shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /Sincro CRM \| Pipeline comercial/i);
  assert.match(html, /Sincronizando la operaci[oó]n comercial/i);
  assert.doesNotMatch(html, /Your site is taking shape|Codex is working/i);
});

test("Sincro Obra seed is complete, unique, and omits priority and batch", async () => {
  const source = await readFile(new URL("../app/sincro-obra-data.ts", import.meta.url), "utf8");
  const rows = source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("["))
    .map((line) => JSON.parse(line.replace(/,$/, "")));

  assert.equal(rows.length, 117);
  assert.ok(rows.every((row) => row.length === 6));
  assert.ok(rows.every(([, email, phone]) => email || phone));
  assert.doesNotMatch(source, /\bpriority\b|\bbatch\b|\bprioridad\b|\btanda\b/i);

  const emails = rows.map(([, email]) => email).filter(Boolean);
  const phones = rows.map(([, , phone]) => phone).filter(Boolean);
  assert.equal(new Set(emails).size, emails.length);
  assert.equal(new Set(phones).size, phones.length);
});

test("product data, metrics, import, and messages stay separated", async () => {
  const [app, route] = await Promise.all([
    readFile(new URL("../app/crm-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/crm/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(app, /type Workspace = "crm" \| "obra"/);
  assert.match(app, /data\.leads\.filter\(\(lead\) => !isSincroObraLead\(lead\)\)/);
  assert.match(app, /data\.leads\.filter\(isSincroObraLead\)/);
  assert.match(app, /<Dashboard leads=\{crmLeads\} events=\{crmEvents\}/);
  assert.match(app, /workspace="obra"/);
  assert.match(app, /Prioridad y Tanda se ignoran/);
  assert.match(route, /payload\.action === "seedSincroObra"/);
  assert.match(route, /sourceFor\(payload\.workspace, "Excel"\)/);
});

test("Sincro Obra has copyable proposal and follow-up flows", async () => {
  const app = await readFile(new URL("../app/crm-app.tsx", import.meta.url), "utf8");
  assert.match(app, /Sincro Obra · Envío de propuesta/);
  assert.match(app, /Sincro Obra · Follow-up 2–3 días/);
  assert.match(app, /Sincro Obra · Cierre sin respuesta/);
  assert.match(app, /copyBlock\(blockId,text\)/);
  assert.match(app, /navigator\.clipboard\.writeText\(text\)/);
  assert.match(app, /slice\(start-1,end-1\)/);
  assert.match(app, /El final no se incluye/);
});

test("prospects can be filtered by status and segment together", async () => {
  const app = await readFile(new URL("../app/crm-app.tsx", import.meta.url), "utf8");
  assert.match(app, /aria-label="Filtrar por estado"/);
  assert.match(app, /aria-label="Filtrar por rubro"/);
  assert.match(app, /Todos los rubros/);
  assert.match(app, /status === "Todos" \|\| l\.status === status/);
  assert.match(app, /normalizedStatus\(l\.segment\) === normalizedStatus\(segmentFilter\)/);
});

test("prospects expose an inline persistent next step", async () => {
  const [app, route] = await Promise.all([
    readFile(new URL("../app/crm-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/crm/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(app, /<th>Próximo paso<\/th>/);
  assert.match(app, /<NextStepCell key=.* lead=\{lead\} save=\{updateLead\}\/>/);
  assert.match(app, /nextFollowUp:next/);
  assert.match(app, /Enter o salir para guardar/);
  assert.match(route, /next_follow_up: input\.nextFollowUp === undefined/);
  assert.match(route, /String\(input\.nextFollowUp \?\? ""\)\.trim\(\) \|\| null/);
});

test("prospect search matches partial phone numbers regardless of formatting", async () => {
  const app = await readFile(new URL("../app/crm-app.tsx", import.meta.url), "utf8");
  assert.match(app, /function matchesLeadSearch\(lead: Lead, query: string\)/);
  assert.match(app, /const queryDigits = query\.replace\(\/\\D\/g, ""\)/);
  assert.match(app, /const phoneDigits = lead\.phone\.replace\(\/\\D\/g, ""\)/);
  assert.match(app, /phoneDigits\.includes\(queryDigits\)/);
  assert.match(app, /searchValue=\{contactSearch\} onSearchChange=\{setContactSearch\}/);
  assert.match(app, /value=\{contactSearch\} onChange=\{\(e\)=>setContactSearch\(e\.target\.value\)\}/);
  assert.doesNotMatch(app, /sessionStorage\.setItem\("crm-search"/);
});
