/**
 * DNS-Einträge der Plattform bei Infomaniak abgleichen (idempotent). Es gibt keinen offiziellen OpenTofu-Provider für
 * Infomaniak; die Soll-Liste kommt deshalb aus `tofu output -json dns` (infra/hetzner) und wird hier über die
 * Infomaniak-API v2 gesetzt.
 *
 *   node infra/dns/dns.ts plan  [--input soll.json]   Probelauf: zeigt Abweichungen, ändert nichts (Exit 2 = Abweichungen)
 *   node infra/dns/dns.ts apply [--input soll.json]   Abweichungen beheben, danach erneut prüfen
 *
 * Bequemer über infra/dns/dns.sh (holt die Soll-Liste aus OpenTofu). Übernommen aus vollholz/identity (infra/dns).
 *
 * Verwaltet werden ausschliesslich die Paare (Name, Typ) aus der Soll-Liste, z. B. «ppm A». Alle anderen Einträge
 * der Zone bleiben unberührt – auch andere Typen unter demselben Namen. Innerhalb eines verwalteten Paars werden
 * fehlende Werte angelegt, abweichende geändert und überzählige gelöscht. Steht unter einem verwalteten Namen ein CNAME,
 * bricht der Lauf ohne Änderung ab (Konflikt). Die Zone selbst (Apex) wird nie verwaltet.
 *
 * API (Quelle: https://developer.infomaniak.com/openapi.json, Stand 2026-10-18):
 *   GET    /2/zones/{zone}/records            List dns records   (Scope dns:read, paginiert)
 *   POST   /2/zones/{zone}/records            Store dns record   (dns:write) {source, type, target, ttl}
 *   PUT    /2/zones/{zone}/records/{record}   Update dns record  (dns:write) {target, ttl}
 *   DELETE /2/zones/{zone}/records/{record}   Delete dns record  (dns:write)
 * Antworten: {"result": "success"|"error", "data": …, "error": {…}}; Authentifizierung «Authorization: Bearer <token>».
 * Token: INFOMANIAK_API_TOKEN (Rechte nur «dns»). Er wird nie ausgegeben.
 */
import { readFileSync } from 'node:fs';
import { isIP } from 'node:net';
import { pathToFileURL } from 'node:url';

export type RecordType = 'A' | 'AAAA' | 'CAA';
export interface Desired { name: string; type: RecordType; value: string; ttl: number }
export interface Existing { id: number; source: string; type: string; target: string; ttl: number }
export interface DesiredState { zone: string; records: Desired[] }

export type Change =
  | { op: 'create'; rec: Desired }
  | { op: 'update'; id: number; from: Existing; rec: Desired }
  | { op: 'delete'; id: number; from: Existing; name: string }
  | { op: 'keep'; id: number; rec: Desired };

export interface Plan { changes: Change[]; conflicts: string[] }

const TYPES: readonly RecordType[] = ['A', 'AAAA', 'CAA'];
const LABEL = /^(?!-)[a-z0-9_-]{1,63}(?<!-)$/;

/** Name relativ zur Zone, klein geschrieben; Apex = «@». */
export function relativeName(source: string, zone: string): string {
  let s = source.trim().toLowerCase().replace(/\.$/, '');
  const z = zone.toLowerCase().replace(/\.$/, '');
  if (s === '' || s === '@' || s === '.' || s === z) return '@';
  if (s.endsWith(`.${z}`)) s = s.slice(0, -(z.length + 1));
  return s;
}

/** Wert in vergleichbarer Form (IPv6 kanonisch, CAA ohne Unterschiede in Anführungszeichen und Leerraum). */
export function normalizeValue(type: string, value: string): string {
  const v = value.trim();
  if (type === 'A') return v;
  if (type === 'AAAA') {
    try { return new URL(`http://[${v}]/`).hostname.slice(1, -1); } catch { return v.toLowerCase(); }
  }
  if (type === 'CAA') {
    const m = /^(\d+)\s+([A-Za-z0-9]+)\s+"?(.*?)"?$/.exec(v);
    return m ? `${Number(m[1])} ${m[2]!.toLowerCase()} "${m[3]}"` : v;
  }
  return v;
}

export function validate(state: DesiredState): void {
  const errors: string[] = [];
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(state.zone)) errors.push(`ungültige Zone «${state.zone}»`);
  for (const r of state.records) {
    const where = `${r.name} ${r.type}`;
    if (!r.name.split('.').every(l => LABEL.test(l))) errors.push(`${where}: ungültiger Name (relativ zur Zone, nicht der Apex)`);
    if (!TYPES.includes(r.type)) errors.push(`${where}: Typ nicht erlaubt (nur ${TYPES.join(', ')})`);
    if (!Number.isInteger(r.ttl) || r.ttl < 60 || r.ttl > 86400) errors.push(`${where}: TTL muss zwischen 60 und 86400 liegen`);
    if (r.type === 'A' && isIP(r.value) !== 4) errors.push(`${where}: keine IPv4-Adresse`);
    if (r.type === 'AAAA' && isIP(r.value) !== 6) errors.push(`${where}: keine IPv6-Adresse`);
    if (r.type === 'CAA' && !/^\d+\s+[a-z]+\s+"[^"]+"$/i.test(r.value)) errors.push(`${where}: CAA im Format 0 issue "ca.example"`);
  }
  if (errors.length) throw new Error(`Soll-Liste ungültig:\n  ${errors.join('\n  ')}`);
}

/** Vergleicht Soll und Ist für die verwalteten Paare (Name, Typ). Reine Funktion, ohne API-Aufrufe. */
export function plan(state: DesiredState, existing: Existing[]): Plan {
  validate(state);
  const changes: Change[] = [];
  const conflicts: string[] = [];
  const ist = existing.map(e => ({ ...e, name: relativeName(e.source, state.zone), norm: normalizeValue(e.type, e.target) }));

  const groups = new Map<string, Desired[]>();
  for (const r of state.records) {
    const key = `${r.name}|${r.type}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  for (const name of new Set(state.records.map(r => r.name))) {
    if (ist.some(e => e.name === name && e.type === 'CNAME')) conflicts.push(`${name}: CNAME vorhanden – A/AAAA/CAA daneben unzulässig, bitte von Hand klären`);
  }

  for (const [key, wanted] of groups) {
    const [name, type] = key.split('|') as [string, RecordType];
    const present = ist.filter(e => e.name === name && e.type === type);
    const unmatched = [...present];
    const missing: Desired[] = [];
    for (const rec of wanted) {
      const i = unmatched.findIndex(e => e.norm === normalizeValue(type, rec.value));
      if (i < 0) { missing.push(rec); continue; }
      const [e] = unmatched.splice(i, 1);
      changes.push(e!.ttl === rec.ttl ? { op: 'keep', id: e!.id, rec } : { op: 'update', id: e!.id, from: e!, rec });
    }
    for (const rec of missing) {
      const e = unmatched.shift();
      changes.push(e ? { op: 'update', id: e.id, from: e, rec } : { op: 'create', rec });
    }
    for (const e of unmatched) changes.push({ op: 'delete', id: e.id, from: e, name });
  }
  return { changes, conflicts };
}

export function describe(p: Plan, zone: string): string {
  const lines = [`Zone ${zone} – verwaltet: ${[...new Set(p.changes.map(c => c.op === 'delete' ? `${c.name} ${c.from.type}` : `${c.rec.name} ${c.rec.type}`))].join(', ') || '–'}; alle anderen Einträge bleiben unberührt`];
  for (const c of p.changes) {
    if (c.op === 'keep') lines.push(`  = ${c.rec.name} ${c.rec.type} ${c.rec.value} (TTL ${c.rec.ttl})`);
    if (c.op === 'create') lines.push(`  + ${c.rec.name} ${c.rec.type} ${c.rec.value} (TTL ${c.rec.ttl})`);
    if (c.op === 'update') lines.push(`  ~ ${c.rec.name} ${c.rec.type} ${c.from.target} (TTL ${c.from.ttl}) → ${c.rec.value} (TTL ${c.rec.ttl})`);
    if (c.op === 'delete') lines.push(`  - ${c.name} ${c.from.type} ${c.from.target} (TTL ${c.from.ttl})`);
  }
  for (const k of p.conflicts) lines.push(`  ! Konflikt: ${k}`);
  return lines.join('\n');
}

export const pending = (p: Plan) => p.changes.filter(c => c.op !== 'keep');

// ---------- Infomaniak-API

type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body?: string; signal?: AbortSignal }) => Promise<{ status: number; json(): Promise<unknown> }>;

export class InfomaniakDns {
  private readonly token: string;
  private readonly base: string;
  private readonly fetcher: FetchLike;

  constructor(token: string, opts: { base?: string; fetch?: FetchLike } = {}) {
    if (!token) throw new Error('INFOMANIAK_API_TOKEN fehlt');
    this.token = token;
    this.base = opts.base ?? 'https://api.infomaniak.com';
    this.fetcher = opts.fetch ?? (fetch as unknown as FetchLike);
  }

  private async call(method: string, path: string, body?: unknown): Promise<{ data: unknown; pages?: number }> {
    const res = await this.fetcher(`${this.base}${path}`, {
      method,
      headers: { Authorization: `Bearer ${this.token}`, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(30_000),
    });
    const json = (await res.json().catch(() => ({}))) as { result?: string; data?: unknown; pages?: number; error?: { code?: string; description?: string } };
    if (res.status >= 400 || json.result !== 'success') {
      const e = json.error ?? {};
      throw new Error(`Infomaniak ${method} ${path}: HTTP ${res.status}${e.code ? ` ${e.code}` : ''}${e.description ? ` – ${e.description}` : ''}`);
    }
    return { data: json.data, pages: json.pages };
  }

  async list(zone: string): Promise<Existing[]> {
    const out: Existing[] = [];
    for (let page = 1; ; page++) {
      const { data, pages } = await this.call('GET', `/2/zones/${encodeURIComponent(zone)}/records?page=${page}&per_page=500`);
      const items = (data ?? []) as Array<Record<string, unknown>>;
      for (const r of items) out.push({ id: Number(r.id), source: String(r.source ?? ''), type: String(r.type), target: String(r.target ?? ''), ttl: Number(r.ttl) });
      if (!pages || page >= pages || items.length === 0) break;
    }
    return out;
  }

  async create(zone: string, r: Desired): Promise<void> {
    await this.call('POST', `/2/zones/${encodeURIComponent(zone)}/records`, { source: r.name, type: r.type, target: r.value, ttl: r.ttl });
  }

  async update(zone: string, id: number, r: Desired): Promise<void> {
    await this.call('PUT', `/2/zones/${encodeURIComponent(zone)}/records/${id}`, { target: r.value, ttl: r.ttl });
  }

  async remove(zone: string, id: number): Promise<void> {
    await this.call('DELETE', `/2/zones/${encodeURIComponent(zone)}/records/${id}`);
  }
}

/** Führt die Änderungen eines Plans aus (erst anlegen/ändern, dann löschen). */
export async function execute(api: InfomaniakDns, zone: string, p: Plan, log: (s: string) => void): Promise<void> {
  if (p.conflicts.length) throw new Error('Konflikte – nichts geändert');
  const order = [...pending(p)].sort((a, b) => (a.op === 'delete' ? 1 : 0) - (b.op === 'delete' ? 1 : 0));
  for (const c of order) {
    if (c.op === 'create') { await api.create(zone, c.rec); log(`  angelegt: ${c.rec.name} ${c.rec.type} ${c.rec.value}`); }
    if (c.op === 'update') { await api.update(zone, c.id, c.rec); log(`  geändert: ${c.rec.name} ${c.rec.type} ${c.rec.value}`); }
    if (c.op === 'delete') { await api.remove(zone, c.id); log(`  gelöscht: ${c.name} ${c.from.type} ${c.from.target}`); }
  }
}

/** Liest die Soll-Liste: Ausgabe von `tofu output -json dns` ({zone, records}). */
export function parseDesired(text: string): DesiredState {
  const raw = JSON.parse(text) as { zone?: unknown; records?: unknown; value?: unknown };
  const v = (raw.value ?? raw) as { zone?: unknown; records?: unknown };
  if (typeof v.zone !== 'string' || !Array.isArray(v.records)) throw new Error('Soll-Liste: erwartet {"zone": "…", "records": [...]}');
  return {
    zone: v.zone.toLowerCase(),
    records: v.records.map((r: Record<string, unknown>) => ({ name: String(r.name).toLowerCase(), type: String(r.type).toUpperCase() as RecordType, value: String(r.value), ttl: Number(r.ttl) })),
  };
}

async function main(argv: string[]): Promise<number> {
  const mode = argv[0];
  if (mode !== 'plan' && mode !== 'apply') {
    console.error('Aufruf: node infra/dns/dns.ts plan|apply [--input soll.json] [--only name,…]  (ohne --input: Soll-Liste von stdin)');
    return 1;
  }
  const i = argv.indexOf('--input');
  const state = parseDesired(readFileSync(i >= 0 ? argv[i + 1]! : 0, 'utf8'));
  // Schutz: nur ausdrücklich erlaubte Namen (dns.sh: --only ppm,www.ppm); alles andere in der Zone bleibt unberührt
  const o = argv.indexOf('--only');
  if (o >= 0) {
    const allowed = new Set((argv[o + 1] ?? '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean));
    const other = state.records.filter(r => !allowed.has(r.name)).map(r => `${r.name} ${r.type}`);
    if (other.length) throw new Error(`Soll-Liste enthält nicht erlaubte Namen (erlaubt: ${[...allowed].join(', ')}): ${other.join(', ')}`);
  }
  if (state.records.length === 0) { console.log('Keine Soll-Einträge (domain leer?) – nichts zu tun.'); return 0; }
  const api = new InfomaniakDns(process.env.INFOMANIAK_API_TOKEN ?? '');

  let p = plan(state, await api.list(state.zone));
  console.log(describe(p, state.zone));
  if (p.conflicts.length) { console.error('Abbruch wegen Konflikten – nichts geändert.'); return 1; }
  const n = pending(p).length;
  if (mode === 'plan') { console.log(n ? `${n} Änderung(en) nötig (Probelauf, nichts geändert).` : 'Keine Abweichungen.'); return n ? 2 : 0; }
  if (n === 0) { console.log('Keine Abweichungen – nichts zu tun.'); return 0; }

  console.log('Änderungen ausführen:');
  await execute(api, state.zone, p, s => console.log(s));
  p = plan(state, await api.list(state.zone));
  if (pending(p).length) { console.error('Nach dem Anwenden weichen noch Einträge ab:\n' + describe(p, state.zone)); return 1; }
  console.log('Fertig – alle verwalteten Einträge stimmen.');
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then(code => { process.exitCode = code; }, (err: Error) => { console.error(`dns: ${err.message}`); process.exitCode = 1; });
}
