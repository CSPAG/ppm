/**
 * Routen der Szenarien mit Wasserlinie (BC PP.03.01–03; UC-008 Schritte 5–6; K5 Schritte 5–6) nach dem Muster der
 * Matrix: Rechte über `req.need` am Portfolio, Lesesicht über `req.tx`, Fähigkeiten `can`, If-Match (412), Idempotenz
 * (Querschnitt), Audit und Ereignis in derselben Transaktion. Ein Szenario ist eine Kopie des Ist-Stands; der Ist-Stand
 * (Rangfolge, Projekte) ändert sich nie. Die Wasserlinie wird bei jedem Lesen gerechnet, mit dem aktuellen Bedarf der
 * Projekte (K5 Z7). Übernommen wird ein Szenario erst mit dem Entscheid des Gremiums (AP-E5-5).
 */
import { Type } from '@sinclair/typebox';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  actorOf, conflict, etag, IdempotencyHeaders, IdParams, IfMatchHeaders, invalid, notFound, preconditionFailed, requireIfMatch, type Deps, type Tx,
} from '@vollholz/platform';
import { record } from '../../platform.ts';
import { projektdaten } from '../projektdaten/index.ts';
import { auslastung, type AuslastungErgebnis } from '../ressource/index.ts';
import { achse, ressourcen, type Einschaetzung } from './matrix.ts';
import * as rang from './matrix-store.ts';
import { TAG } from './routes.ts';
import { abhaengigkeitVerletzt, wasserlinie, type RechenZelle } from './szenario.ts';
import {
  Szenario, SzenarioBeantragen, SzenarioCreate, SzenarioListe, SzenarioPatch, SzenarioPositionenPut, SzenarioVergleich,
  type SzenarioBeantragenIn, type SzenarioListeOut, type SzenarioOut, type SzenarioPositionenPutIn, type SzenarioVergleichOut,
} from './szenario-schemas.ts';
import * as sz from './szenario-store.ts';
import { antragZuruecknehmen, istStart } from './entscheid-store.ts';
import * as store from './store.ts';

const NAME = 'Szenario';
const portfolioOrt = (id: string) => ({ type: 'portfolio', id });

// ---------------------------------------------------------------- Rechnung

const zahl = (m: string) => Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7)) - 1;
const monatVon = (n: number) => `${Math.floor(n / 12)}-${String((n % 12) + 1).padStart(2, '0')}`;
/** Höchstens 20 Jahre Auslastung je Rechnung (Schutz vor unplausiblen Monaten). */
const HORIZONT = 240;

const fmtChf = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1).replace('.', ',')} Mio.` : new Intl.NumberFormat('de-CH').format(Math.round(n)));
const fmtFte = (n: number) => n.toFixed(1).replace('.', ',');
const fmtDatum = (d: Date) => d.toISOString().slice(0, 10).split('-').reverse().join('.');
const quartal = (m: string) => `Q${Math.floor((Number(m.slice(5, 7)) - 1) / 3) + 1} ${m.slice(0, 4)}`;
const projekteText = (n: number) => (n === 1 ? '1 Projekt' : `${n} Projekte`);

/** Grundlage eines Portfolios für alle seine Szenarien (einmal je Anfrage gelesen). */
interface Grundlage {
  portfolio: store.PortfolioKopf;
  modell: store.ModellRow | null;
  rahmen: number | null;
  kostenSichtbar: boolean;
  projekte: Map<string, ProjektDaten>;
  /** aktive Projekte nach Nummer */
  reihenfolge: string[];
}
interface ProjektDaten {
  kopf: store.ProjektKopf;
  kosten: number | null;
  fteMonate: number | null;
  groesse: 'S' | 'M' | 'L' | null;
  nurGroesse: string[];
  startGeplant: string | null;
  endeGeplant: string | null;
  geaendertAt: Date | null;
  braucht: string[];
  nutzen: 'hoch' | 'tief' | 'grenze' | null;
  risiko: 'hoch' | 'tief' | 'grenze' | null;
  strategiebeitrag: Einschaetzung | null;
  bewertet: boolean;
}

async function grundlage(tx: Tx, portfolioId: string, kostenSichtbar: boolean): Promise<Grundlage> {
  const portfolio = await store.portfolio(tx, portfolioId);
  if (!portfolio) throw notFound('Portfolio');
  const modell = await store.aktuell(tx);
  const kriterien = modell ? await store.kriterien(tx, modell.id) : [];
  const nutzenK = kriterien.filter(k => k.dimension === 'nutzen').map(k => k.schluessel);
  const risikoK = kriterien.filter(k => k.dimension === 'risiko').map(k => k.schluessel);
  const rahmen = modell ? (await store.budgetrahmen(tx, modell.id)).find(b => b.portfolio_id === portfolioId)?.betrag ?? null : null;
  const aktiv = (await store.projekte(tx, portfolioId, null)).filter(p => p.lebenszyklus === 'aktiv');
  const ids = new Set(aktiv.map(p => p.id));
  const bew = modell ? await store.bewertungen(tx, modell.id, aktiv.map(p => p.id)) : [];
  const projekte = new Map<string, ProjektDaten>();
  for (const p of aktiv) {
    const bedarf = await projektdaten.lesen(tx, 'ressourcenbedarf', { projektId: p.id });
    const kostenRows = kostenSichtbar ? await projektdaten.lesen(tx, 'kosten', { projektId: p.id }) : [];
    const abh = await projektdaten.abhaengigkeiten(tx, p.id);
    const b = new Map(bew.filter(x => x.projekt_id === p.id).map(x => [x.kriterium, x.einschaetzung as Einschaetzung]));
    const fte = bedarf.filter(x => typeof x.fte === 'number' && typeof x.vonMonat === 'string');
    const r = ressourcen(bedarf);
    const geaendert = [...bedarf, ...kostenRows].reduce<Date | null>((a, x) => (!a || x.updatedAt > a ? x.updatedAt : a), null);
    projekte.set(p.id, {
      kopf: p,
      kosten: kostenSichtbar ? Math.round(kostenRows.reduce((s, k) => s + Number(k.prognose ?? k.budgetBaseline ?? 0), 0) * 100) / 100 : null,
      fteMonate: r.fteMonate, groesse: r.groesse,
      nurGroesse: bedarf.filter(x => typeof x.groesse === 'string').map(x => `${String(x.rolle)} ${String(x.phase)}: ${String(x.groesse)}`),
      startGeplant: fte.length ? fte.map(x => String(x.vonMonat)).sort()[0]! : null,
      endeGeplant: fte.length ? fte.map(x => String(x.bisMonat)).sort().at(-1)! : null,
      geaendertAt: geaendert,
      braucht: [...new Set(abh.filter(a => a.richtung === 'ausgehend' && ids.has(a.anderesId) && a.anderesId !== p.id).map(a => a.anderesId))],
      nutzen: achse(nutzenK, b).stufe, risiko: achse(risikoK, b).stufe,
      strategiebeitrag: b.get('strategiebeitrag') ?? null,
      bewertet: b.size > 0,
    });
  }
  return { portfolio, modell, rahmen, kostenSichtbar, projekte, reihenfolge: aktiv.map(p => p.id) };
}

/** Positionen des Szenarios mit den aktiven Projekten abgleichen: nicht mehr aktive fallen weg, neue kommen ans Ende. */
function abgleichen(g: Grundlage, rows: readonly sz.PositionRow[]) {
  const da = rows.filter(r => g.projekte.has(r.projekt_id)).map(r => ({ projektId: r.projekt_id, aktiv: r.aktiv, startMonat: r.start_monat, neu: false }));
  const bekannt = new Set(da.map(p => p.projektId));
  for (const id of g.reihenfolge) if (!bekannt.has(id)) da.push({ projektId: id, aktiv: true, startMonat: null, neu: true });
  return da.map((p, i) => ({ ...p, rang: i + 1 }));
}

export interface Gerechnet { positionen: SzenarioOut['positionen']; rechnung: SzenarioOut['rechnung'] }

async function rechnen(tx: Tx, g: Grundlage, s: sz.SzenarioRow): Promise<Gerechnet> {
  const pos = abgleichen(g, await sz.positionen(tx, s.id));
  const start = (p: (typeof pos)[number]) => p.startMonat ?? g.projekte.get(p.projektId)!.startGeplant;

  // Zeitraum der Auslastung: Bedarf der enthaltenen Projekte, nach Szenario verschoben
  let von = Infinity, bis = -Infinity;
  for (const p of pos) {
    const d = g.projekte.get(p.projektId)!;
    if (!p.aktiv || !d.startGeplant || !d.endeGeplant) continue;
    const n = p.startMonat ? zahl(p.startMonat) - zahl(d.startGeplant) : 0;
    von = Math.min(von, zahl(d.startGeplant) + n);
    bis = Math.max(bis, zahl(d.endeGeplant) + n);
  }
  let erg: AuslastungErgebnis = { monate: [], rollen: [], engpaesse: [] };
  if (Number.isFinite(von)) {
    erg = await auslastung.berechnen(tx, monatVon(von), monatVon(Math.min(bis, von + HORIZONT)), pos.map(p => ({ projektId: p.projektId, aktiv: p.aktiv, startMonat: p.startMonat })));
  }
  const zellen: RechenZelle[] = erg.rollen.flatMap(r => r.zellen.map(z => ({ rolle: r.rolle, monat: z.monat, angebot: z.angebot, beitraege: z.beitraege })));

  const wl = wasserlinie(pos.map(p => ({ projektId: p.projektId, aktiv: p.aktiv, kosten: g.projekte.get(p.projektId)!.kosten })), zellen, g.kostenSichtbar ? g.rahmen : null);
  const unter = pos.filter(p => p.aktiv && wl.ueber.get(p.projektId) === false).length;
  const bei = pos.find(p => p.projektId === wl.beiProjektId);
  let text: string | null = null;
  if (wl.grund === 'budget' && g.rahmen !== null) {
    text = `Budget: CHF ${fmtChf(wl.budget.bedarf ?? wl.kumuliert.get(bei!.projektId) ?? 0)} statt höchstens ${fmtChf(g.rahmen)} (${g.portfolio.name}). Unter der Wasserlinie: ${projekteText(unter)}.`;
  } else if (wl.grund === 'kapazitaet' && wl.durchbruch) {
    const d = wl.durchbruch;
    const betroffen = new Set(zellen.find(z => z.rolle === d.rolle && z.monat === d.monat)?.beitraege.map(b => b.projektId)).size;
    text = `Kapazität ${quartal(d.monat)}: ${fmtFte(d.bedarf)} FTE ${d.rolle} statt höchstens ${fmtFte(d.angebot)}. Betroffen: ${projekteText(betroffen)}. Unter der Wasserlinie: ${projekteText(unter)}.`;
  }

  const hinweise: string[] = [];
  if (!g.modell) hinweise.push('Kein Bewertungsmodell in Kraft: Nutzen, Risiko und Budgetrahmen fehlen.');
  if (!g.kostenSichtbar) hinweise.push('Beträge sehen Sie nicht. Die Wasserlinie zeigt nur die Kapazität.');
  else if (g.rahmen === null) hinweise.push('Ohne Budgetrahmen zeigt die Wasserlinie nur die Kapazität.');
  const nurGroesse = pos.filter(p => p.aktiv && g.projekte.get(p.projektId)!.nurGroesse.length).length;
  if (nurGroesse) hinweise.push(`Ressourcenbedarf nur als Grösse: ${projekteText(nurGroesse)}. Dieser Bedarf ist in der Kapazität nicht gerechnet.`);

  const rangVon = new Map(pos.map(p => [p.projektId, p]));
  const positionen = pos.map(p => {
    const d = g.projekte.get(p.projektId)!;
    const warnungen: SzenarioOut['positionen'][number]['warnungen'] = [];
    if (p.aktiv) {
      for (const andereId of d.braucht) {
        const q = rangVon.get(andereId);
        if (!q?.aktiv) continue;
        const v = abhaengigkeitVerletzt({ rang: p.rang, start: start(p) }, { rang: q.rang, start: start(q) });
        const b = g.projekte.get(andereId)!.kopf;
        if (v) warnungen.push({ art: 'abhaengigkeit', text: `Abhängigkeit: ${d.kopf.nummer} braucht ${b.nummer}, ${v === 'rang' ? `liegt aber vor ${b.nummer}` : 'startet aber früher'}.` });
      }
    }
    if (d.geaendertAt && d.geaendertAt > s.created_at) warnungen.push({ art: 'bedarf_geaendert', text: `Bedarf geändert am ${fmtDatum(d.geaendertAt)}.` });
    if (d.nurGroesse.length) warnungen.push({ art: 'nur_groesse', text: `Ressourcenbedarf nur als Grösse (${d.nurGroesse.join(', ')}), nicht in der Kapazität gerechnet.` });
    return {
      projektId: p.projektId, nummer: d.kopf.nummer, name: d.kopf.name, phase: d.kopf.phase, rang: p.rang, aktiv: p.aktiv,
      startMonat: p.startMonat, startGeplant: d.startGeplant, kosten: d.kosten, kostenKumuliert: p.aktiv ? wl.kumuliert.get(p.projektId) ?? null : null,
      fteMonate: d.fteMonate, groesse: d.groesse, nutzen: d.nutzen, risiko: d.risiko, strategiebeitrag: d.strategiebeitrag, bewertet: d.bewertet,
      ueberWasserlinie: p.aktiv ? wl.ueber.get(p.projektId)! : null, neu: p.neu, warnungen,
    };
  });
  return {
    positionen,
    rechnung: {
      wasserlinie: { beiRang: bei?.rang ?? null, grund: wl.grund, text },
      budget: { rahmen: g.kostenSichtbar ? g.rahmen : null, bedarf: g.kostenSichtbar ? wl.budget.bedarf : null },
      engpaesse: erg.engpaesse, unter, hinweise,
    },
  };
}

async function aufbereiten(tx: Tx, g: Grundlage, s: sz.SzenarioRow, write: boolean): Promise<SzenarioOut> {
  const r = await rechnen(tx, g, s);
  return {
    id: s.id, portfolioId: s.portfolio_id, name: s.name, stand: s.stand, version: s.version, createdAt: s.created_at, updatedAt: s.updated_at,
    beantragtAt: s.beantragt_at, modell: g.modell ? { id: g.modell.id, nummer: g.modell.nummer } : null, kostenSichtbar: g.kostenSichtbar,
    ...r, vorlage: (s.vorlage ?? null) as SzenarioOut['vorlage'], can: { write: write && s.stand === 'entwurf' },
  } as SzenarioOut;
}

/** Vergleich bis drei Szenarien (K5 Schritt 6): Kennzahlen der Projekte über der Wasserlinie, Unterschiede hervorgehoben. */
async function vergleichen(tx: Tx, g: Grundlage, liste: readonly sz.SzenarioRow[]): Promise<SzenarioVergleichOut> {
  const spalten: SzenarioVergleichOut['szenarien'] = [];
  const seite = new Map<string, Set<string>>();
  for (const s of liste) {
    const r = await rechnen(tx, g, s);
    const ueber = r.positionen.filter(p => p.ueberWasserlinie === true);
    const zaehle = <K extends string>(keys: readonly K[], wert: (p: (typeof ueber)[number]) => K | null) => {
      const o = Object.fromEntries([...keys, 'offen'].map(k => [k, 0])) as Record<K | 'offen', number>;
      for (const p of ueber) o[wert(p) ?? 'offen']++;
      return o;
    };
    for (const p of r.positionen) {
      let x = seite.get(p.projektId);
      if (!x) seite.set(p.projektId, x = new Set());
      x.add(p.ueberWasserlinie === true ? 'ueber' : p.ueberWasserlinie === false ? 'unter' : 'ohne');
    }
    spalten.push({
      id: s.id, name: s.name, stand: s.stand,
      kosten: g.kostenSichtbar ? Math.round(ueber.reduce((a, p) => a + (p.kosten ?? 0), 0) * 100) / 100 : null,
      budget: r.rechnung.budget,
      nutzen: zaehle(['hoch', 'tief', 'grenze'] as const, p => p.nutzen),
      risiko: zaehle(['hoch', 'tief', 'grenze'] as const, p => p.risiko),
      strategiebeitrag: zaehle(['hoch', 'mittel', 'tief'] as const, p => p.strategiebeitrag),
      ueber: ueber.map(p => p.projektId),
      unter: r.positionen.filter(p => p.ueberWasserlinie === false).map(p => p.projektId),
      wasserlinie: r.rechnung.wasserlinie,
      engpaesse: r.rechnung.engpaesse,
    });
  }
  const hinweise: string[] = [];
  if (!g.kostenSichtbar) hinweise.push('Beträge sehen Sie nicht. Die Wasserlinie zeigt nur die Kapazität.');
  else if (g.rahmen === null) hinweise.push('Ohne Budgetrahmen zeigt die Wasserlinie nur die Kapazität.');
  return {
    portfolioId: g.portfolio.id,
    projekte: g.reihenfolge.map(id => {
      const k = g.projekte.get(id)!.kopf;
      return { id, nummer: k.nummer, name: k.name, unterschiedlich: (seite.get(id)?.size ?? 0) > 1 };
    }),
    szenarien: spalten,
    hinweise,
  };
}

/** Szenarioquelle für die Auslastung je Szenario (`/v1/auslastung?szenario=`, Modul ressource). */
async function ansicht(tx: Tx, id: string) {
  const s = await sz.lesen(tx, id);
  if (!s) return null;
  return { id: s.id, name: s.name, positionen: (await sz.positionen(tx, id)).map(p => ({ projektId: p.projekt_id, aktiv: p.aktiv, startMonat: p.start_monat })) };
}

const snapshot = (s: sz.SzenarioRow) => ({ id: s.id, portfolioId: s.portfolio_id, name: s.name, stand: s.stand, version: s.version });

// ---------------------------------------------------------------- Routen

export function registerSzenarioRoutes(app: FastifyInstance, _deps: Deps): void {
  for (const s of [SzenarioVergleich, Szenario, SzenarioListe, SzenarioCreate, SzenarioPatch, SzenarioPositionenPut, SzenarioBeantragen]) app.addSchema(s);
  auslastung.szenarioQuelleSetzen(ansicht);

  /** Szenario lesen (404 ohne Lesesicht) und Leserecht am Portfolio prüfen. */
  async function szenario(req: FastifyRequest, id: string): Promise<sz.SzenarioRow> {
    const s = await req.tx(tx => sz.lesen(tx, id));
    if (!s) throw notFound(NAME);
    await req.need('priorisierung:read', portfolioOrt(s.portfolio_id));
    return s;
  }
  const kosten = (req: FastifyRequest, portfolioId: string) => req.can('finanzen:read', portfolioOrt(portfolioId));
  const schreiben = (req: FastifyRequest, portfolioId: string) => req.can('priorisierung:write', portfolioOrt(portfolioId));

  app.get('/v1/portfolios/:id/szenarien', {
    schema: {
      tags: [TAG], summary: 'Szenarien des Portfolios',
      description: 'Szenarien ohne verworfene, nach Anlage (K5 Z2: leer, solange keines angelegt ist).',
      params: IdParams, response: { 200: Type.Ref('SzenarioListe') },
    },
  }, async (req): Promise<SzenarioListeOut> => {
    const { id } = req.params as { id: string };
    await req.need('priorisierung:read', portfolioOrt(id));
    const write = await schreiben(req, id);
    const rows = await req.tx(async tx => {
      if (!(await store.portfolio(tx, id))) throw notFound('Portfolio');
      return sz.liste(tx, id);
    });
    return {
      items: rows.map(s => ({ id: s.id, name: s.name, stand: s.stand, version: s.version, createdAt: s.created_at, updatedAt: s.updated_at, beantragtAt: s.beantragt_at })) as SzenarioListeOut['items'],
      can: { write },
    };
  });

  app.post('/v1/portfolios/:id/szenarien', {
    schema: {
      tags: [TAG], summary: 'Szenario anlegen',
      description: 'Kopie des Ist-Stands (UC-008 Schritt 5): aktive Projekte in der entschiedenen Rangfolge (danach der Entwurf, danach nach Nummer), Start wie geplant. Der Ist-Stand des Portfolios ändert sich nicht.',
      params: IdParams, headers: IdempotencyHeaders, body: Type.Ref('SzenarioCreate'), response: { 201: Type.Ref('Szenario') },
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await req.need('priorisierung:read', portfolioOrt(id));
    await req.need('priorisierung:write', portfolioOrt(id));
    const k = await kosten(req, id);
    const body = req.body as { name: string };
    const who = actorOf(req);
    const out = await req.tx(async tx => {
      const g = await grundlage(tx, id, k);
      const raenge = await rang.rangfolge(tx, id);
      const ordnung = (stand: 'entschieden' | 'entwurf') => new Map(raenge.filter(r => r.stand === stand).map(r => [r.projekt_id, r.rang]));
      const ent = ordnung('entschieden'), entw = ordnung('entwurf');
      const reihe = [...g.reihenfolge].sort((a, b) =>
        (ent.get(a) ?? Infinity) - (ent.get(b) ?? Infinity) || (entw.get(a) ?? Infinity) - (entw.get(b) ?? Infinity));
      const s = await sz.anlegen(tx, id, body.name);
      // Start aus dem Ist-Stand (Rangfolge «entschieden», AP-E5-5), sonst wie geplant
      const start = await istStart(tx, id);
      await sz.positionenSetzen(tx, s.id, reihe.map(p => ({ projektId: p, aktiv: true, startMonat: start.get(p) ?? null })));
      const daten = { ...snapshot(s), projekte: reihe.length };
      await record(tx, who, { action: 'szenario.created', resourceType: 'szenario', resourceId: s.id, data: daten, event: daten });
      return aufbereiten(tx, g, s, true);
    });
    return reply.code(201).header('location', `/v1/szenarien/${out.id}`).header('etag', etag(out.version)).send(out);
  });

  app.get('/v1/szenarien/vergleich', {
    schema: {
      tags: [TAG], summary: 'Szenarien vergleichen',
      description: 'Bis drei Szenarien desselben Portfolios nebeneinander (UC-008 Schritt 6): Kosten, Nutzen, Risiko und Strategiebeitrag der Projekte über der Wasserlinie, Projekte darunter und Engpässe; `unterschiedlich` markiert Projekte, die nicht überall auf derselben Seite liegen.',
      querystring: Type.Object({ ids: Type.String({ description: 'IDs, mit Komma getrennt (1–3).' }) }, { additionalProperties: false }),
      response: { 200: Type.Ref('SzenarioVergleich') },
    },
  }, async (req): Promise<SzenarioVergleichOut> => {
    const ids = [...new Set((req.query as { ids: string }).ids.split(',').map(x => x.trim()).filter(Boolean))];
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!ids.length || ids.length > 3 || ids.some(x => !uuid.test(x))) {
      throw invalid('Wählen Sie ein bis drei Szenarien.', [{ path: '/ids', message: 'ein bis drei IDs, mit Komma getrennt' }]);
    }
    const rows: sz.SzenarioRow[] = [];
    for (const x of ids) rows.push(await szenario(req, x));
    if (new Set(rows.map(r => r.portfolio_id)).size > 1) throw invalid('Verglichen werden nur Szenarien desselben Portfolios.', [{ path: '/ids', message: 'verschiedene Portfolios' }]);
    const k = await kosten(req, rows[0]!.portfolio_id);
    return req.tx(async tx => vergleichen(tx, await grundlage(tx, rows[0]!.portfolio_id, k), rows));
  });

  app.get('/v1/szenarien/:id', {
    schema: {
      tags: [TAG], summary: 'Szenario mit Wasserlinie',
      description: 'Positionen nach Rang mit Wasserlinie gegen Budgetrahmen und Kapazität, Engpässen je Quartal und Rolle und Warnungen am Projekt (Abhängigkeit verletzt, Bedarf geändert, Bedarf nur als Grösse). Gerechnet mit dem aktuellen Bedarf (K5 Z7).',
      params: IdParams, response: { 200: Type.Ref('Szenario') },
    },
  }, async (req, reply): Promise<SzenarioOut> => {
    const { id } = req.params as { id: string };
    const s = await szenario(req, id);
    const [k, w] = await Promise.all([kosten(req, s.portfolio_id), schreiben(req, s.portfolio_id)]);
    const out = await req.tx(async tx => aufbereiten(tx, await grundlage(tx, s.portfolio_id, k), (await sz.lesen(tx, id)) ?? s, w));
    reply.header('etag', etag(out.version));
    return out;
  });

  /** Ändern im Entwurf: Version prüfen, Stand prüfen, ausführen, Audit; liefert das neu gerechnete Szenario. */
  async function aendern(
    req: FastifyRequest, aktion: `szenario.${string}`, tun: (tx: Tx, s: sz.SzenarioRow, g: Grundlage) => Promise<sz.SzenarioRow | null>,
    erlaubt: readonly sz.SzenarioStand[] = ['entwurf'], daten: (s: sz.SzenarioRow) => Record<string, unknown> = snapshot,
  ): Promise<SzenarioOut> {
    const { id } = req.params as { id: string };
    const version = requireIfMatch(req);
    const s0 = await szenario(req, id);
    await req.need('priorisierung:write', portfolioOrt(s0.portfolio_id));
    const k = await kosten(req, s0.portfolio_id);
    const who = actorOf(req);
    return req.tx(async tx => {
      const s = await sz.lesen(tx, id);
      if (!s) throw notFound(NAME);
      if (s.version !== version) throw preconditionFailed(s.version);
      if (!erlaubt.includes(s.stand)) throw conflict(`Das Szenario «${s.name}» ist ${s.stand === 'beantragt' ? 'als Antrag gewählt' : s.stand} und nicht mehr änderbar.`, { reason: 'stand', stand: s.stand });
      const g = await grundlage(tx, s.portfolio_id, k);
      const neu = await tun(tx, s, g);
      if (!neu) throw preconditionFailed(s.version);
      const d = daten(neu);
      await record(tx, who, { action: aktion, resourceType: 'szenario', resourceId: s.id, data: { before: snapshot(s), after: d }, event: d });
      return aufbereiten(tx, g, neu, true);
    });
  }

  app.patch('/v1/szenarien/:id', {
    schema: {
      tags: [TAG], summary: 'Szenario umbenennen', description: 'Nur im Entwurf, mit `If-Match` (412).',
      params: IdParams, headers: IfMatchHeaders, body: Type.Ref('SzenarioPatch'), response: { 200: Type.Ref('Szenario') },
    },
  }, async (req, reply) => {
    const body = req.body as { name: string };
    const out = await aendern(req, 'szenario.renamed', (tx, s) => sz.aendern(tx, s.id, s.version, { name: body.name }));
    reply.header('etag', etag(out.version));
    return out;
  });

  app.put('/v1/szenarien/:id/positionen', {
    schema: {
      tags: [TAG], summary: 'Reihenfolge und Start setzen',
      description: 'Ersetzt die Positionen (Rang = Reihenfolge, Startmonat, enthalten) und liefert die neu gerechnete Wasserlinie (K5-1). Nur aktive Projekte des Portfolios, jedes einmal (422); nicht genannte aktive Projekte kommen ans Ende. Nur im Entwurf, mit `If-Match` (412). Der Ist-Stand ändert sich nicht.',
      params: IdParams, headers: IfMatchHeaders, body: Type.Ref('SzenarioPositionenPut'), response: { 200: Type.Ref('Szenario') },
    },
  }, async (req, reply) => {
    const body = req.body as SzenarioPositionenPutIn;
    const out = await aendern(req, 'szenario.reordered', async (tx, s, g) => {
      const fehler: { path: string; message: string }[] = [];
      body.positionen.forEach((p, i) => {
        if (!g.projekte.has(p.projektId)) fehler.push({ path: `/positionen/${i}/projektId`, message: 'kein aktives Projekt dieses Portfolios' });
        if (body.positionen.findIndex(x => x.projektId === p.projektId) !== i) fehler.push({ path: `/positionen/${i}/projektId`, message: 'Projekt mehrfach genannt' });
      });
      if (fehler.length) throw invalid('Die Positionen passen nicht zum Portfolio.', fehler);
      const genannt = new Set(body.positionen.map(p => p.projektId));
      const liste = [
        ...body.positionen.map(p => ({ projektId: p.projektId, aktiv: p.aktiv ?? true, startMonat: p.startMonat ?? null })),
        ...g.reihenfolge.filter(x => !genannt.has(x)).map(x => ({ projektId: x, aktiv: true, startMonat: null })),
      ];
      const neu = await sz.aendern(tx, s.id, s.version, {});
      if (neu) await sz.positionenSetzen(tx, s.id, liste);
      return neu;
    }, ['entwurf'], s => ({ ...snapshot(s), positionen: body.positionen.length }));
    reply.header('etag', etag(out.version));
    return out;
  });

  app.post('/v1/szenarien/:id/verwerfen', {
    schema: {
      tags: [TAG], summary: 'Szenario verwerfen',
      description: 'Entwurf oder Antrag verwerfen; der Ist-Stand des Portfolios bleibt unverändert. Mit `If-Match` (412).',
      params: IdParams, headers: IfMatchHeaders, response: { 200: Type.Ref('Szenario') },
    },
  }, async (req, reply) => {
    const out = await aendern(req, 'szenario.discarded', async (tx, s) => {
      await antragZuruecknehmen(tx, s);
      const s2 = (await sz.lesen(tx, s.id))!;
      return sz.aendern(tx, s2.id, s2.version, { stand: 'verworfen', vorlage: null });
    }, ['entwurf', 'beantragt']);
    reply.header('etag', etag(out.version));
    return out;
  });

  app.post('/v1/szenarien/:id/beantragen', {
    schema: {
      tags: [TAG], summary: 'Als Antrag wählen',
      description: 'Wählt das Szenario als Antrag und hält die Entscheidungsvorlage mit allen verglichenen Szenarien fest (UC-008 Schritt 6, K5 Schritt 6). Ein bisheriger Antrag des Portfolios wird wieder Entwurf. `nichtBewertet` nennt Projekte ohne Bewertung (Warnung, keine Sperre). Traktandiert wird mit AP-E5-5. Mit `If-Match` (412).',
      params: IdParams, headers: IfMatchHeaders, body: Type.Ref('SzenarioBeantragen'), response: { 200: Type.Ref('Szenario') },
    },
  }, async (req, reply) => {
    const body = (req.body ?? {}) as SzenarioBeantragenIn;
    const andere = (body.vergleich ?? []).filter(x => x !== (req.params as { id: string }).id);
    const verglichen: sz.SzenarioRow[] = [];
    for (const x of andere) verglichen.push(await szenario(req, x));
    const out = await aendern(req, 'szenario.proposed', async (tx, s, g) => {
      if (verglichen.some(v => v.portfolio_id !== s.portfolio_id)) {
        throw invalid('Verglichen werden nur Szenarien desselben Portfolios.', [{ path: '/vergleich', message: 'anderes Portfolio' }]);
      }
      const bisher = await sz.beantragtes(tx, s.portfolio_id, s.id);
      if (bisher) {
        // ein noch nicht versendetes Traktandum des bisherigen Antrags entfällt; versendet bleibt er fest (409, AP-E5-5)
        await antragZuruecknehmen(tx, bisher);
        const b = (await sz.lesen(tx, bisher.id))!;
        await sz.aendern(tx, b.id, b.version, { stand: 'entwurf', vorlage: null });
      }
      const r = await rechnen(tx, g, s);
      const vergleich = await vergleichen(tx, g, [s, ...verglichen]);
      vergleich.szenarien[0]!.stand = 'beantragt';
      const vorlage = { erstelltAt: new Date().toISOString(), vergleich, nichtBewertet: r.positionen.filter(p => !p.bewertet).map(p => p.nummer) };
      return sz.aendern(tx, s.id, s.version, { stand: 'beantragt', vorlage });
    }, ['entwurf'], s => ({ ...snapshot(s), vergleich: andere }));
    reply.header('etag', etag(out.version));
    return out;
  });
}

/** Für den Entscheid (AP-E5-5, `entscheid*`): Szenario mit Wasserlinie rechnen, wie es die Routen zeigen. */
export async function szenarioRechnen(tx: Tx, s: sz.SzenarioRow, kostenSichtbar: boolean): Promise<Gerechnet> {
  return rechnen(tx, await grundlage(tx, s.portfolio_id, kostenSichtbar), s);
}
