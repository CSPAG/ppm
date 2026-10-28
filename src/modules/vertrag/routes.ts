/**
 * Routen des Projektvertrags (AP-E3-1; fachmodell.md 5) nach dem Muster der Handlungsfelder: Rechte über `req.need` am
 * Projekt, Lesesicht über `req.tx`, Fähigkeiten `can`, ETag/If-Match (412), Idempotenz (Querschnitt), Audit und
 * Ereignis in derselben Transaktion. Lesen mit `projekt:read`, bearbeiten und einreichen mit `vertrag:write`; Beträge
 * (Kap. 9) nur mit `finanzen:read` (A-33).
 *
 * Versionen (DM.02.01), Kapitel 1–13 (Q7), Pflichtangaben der Zielphase (UC-002 A3, K2-4) und Einreichen zur Prüfung
 * (DM.02.02, UC-002 Schritt 8). Weitere Pakete (Quality-Check, Gate, Änderung, Vergleich, Dokument) hängen eigene
 * Routendateien in `index.ts` ein.
 */
import { Type } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  actorOf, conflict, etag, forbidden, IdempotencyHeaders, IdParams, IfMatchHeaders, invalid, notFound, preconditionFailed, requireIfMatch,
  type Deps, type Tx,
} from '@vollholz/platform';
import { aufgabe } from '../eingang/index.ts';
import { aktuellesPhasenmodell } from '../phasenmodell/index.ts';
import { fullTx, record } from '../../platform.ts';
import { anlegen, entwurfsanlass, entwurfVon, pruefeBegruendung, STAND_TEXT, type Phasenmodell } from './entwurf.ts';
import { KAPITEL, KAPITEL_MIT_BETRAEGEN, LISTEN_SCHEMAS, ohneBetraege, titel } from './kapitel.ts';
import { pruefen, type Modell, type Pruefung } from './pflichtangaben.ts';
import {
  EntwurfCreate, Kapitel, KapitelKopf, KapitelParams, KapitelPut, Pflichtangaben, Vertrag, VertragVersion, VertragVersionDetail,
  type EntwurfCreateIn, type VertragVersionOut,
} from './schemas.ts';
import * as store from './store.ts';

export const TAG = 'Projektvertrag';

const projektOrt = (id: string) => ({ type: 'projekt', id });

/** Endzustände des Projekts sind lesend (UC-015 Schritt 6). */
const projektAenderbar = (p: store.ProjektKopf) => p.lebenszyklus === 'aktiv' || p.lebenszyklus === 'sistiert';

async function projekt(tx: Tx, id: string): Promise<store.ProjektKopf> {
  const p = await store.projekt(tx, id);
  if (!p) throw notFound('Projekt');
  return p;
}

/** Version unter der Lesesicht samt Projekt, sonst 404 (fremde und unbekannte IDs gleich). */
async function versionMitProjekt(tx: Tx, id: string): Promise<{ v: store.VersionRow; p: store.ProjektKopf }> {
  const v = await store.version(tx, id);
  if (!v) throw notFound('Vertragsversion');
  return { v, p: await projekt(tx, v.projekt_id) };
}

/** Recht am Projekt der Version: vorher lesen (Lesesicht), dann prüfen. */
async function mitRecht(req: FastifyRequest, id: string, perm: 'projekt:read' | 'vertrag:write'): Promise<{ v: store.VersionRow; p: store.ProjektKopf }> {
  const r = await req.tx(tx => versionMitProjekt(tx, id));
  await req.need(perm, projektOrt(r.p.id));
  return r;
}

const bearbeitbar = (v: store.VersionRow, p: store.ProjektKopf) => v.stand === 'in_arbeit' && projektAenderbar(p);

async function versionOut(req: FastifyRequest, v: store.VersionRow, p: store.ProjektKopf): Promise<VertragVersionOut> {
  const write = bearbeitbar(v, p) && await req.can('vertrag:write', projektOrt(p.id));
  return {
    id: v.id, projektId: v.projekt_id, nummer: v.nummer, anlass: v.anlass, zielphase: v.zielphase, stand: v.stand, baseline: v.baseline,
    baselineAt: v.baseline_at, basisVersionId: v.basis_version_id, begruendung: v.begruendung, eingereichtAt: v.eingereicht_at,
    version: v.version, createdAt: v.created_at, updatedAt: v.updated_at,
    can: { write, einreichen: write && v.anlass !== 'aenderung' },
  };
}

async function pflichtangaben(tx: Tx, v: store.VersionRow, modell: Modell | null): Promise<Pruefung[]> {
  const inhalte = Object.fromEntries((await store.kapitel(tx, v.id)).map(k => [k.kapitel, k.inhalt]));
  return pruefen(modell, v, inhalte);
}

/** Kapitel der Basisversion (Abweichung zur Baseline). */
async function basisKapitel(tx: Tx, v: store.VersionRow, nr: number): Promise<store.KapitelRow | null> {
  return v.basis_version_id ? store.einKapitel(tx, v.basis_version_id, nr) : null;
}

// ---------------------------------------------------------------- Prüfung des Inhalts eines Kapitels

/** Gleich wie die Basis? Vergleich ohne die Verweise ins Register (die setzt das System). */
const gleich = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Beträge auf Rappen, FTE auf zwei Stellen (Spalten im Register numeric(14,2)). */
function runden(nr: number, inhalt: Record<string, unknown>): Record<string, unknown> {
  if (nr !== 9) return inhalt;
  const r2 = (x: number | null) => (x === null ? null : Math.round(x * 100) / 100);
  const k = inhalt as { kosten: { betrag: number | null }[]; personal: { fte: number | null }[] };
  return { ...inhalt, kosten: k.kosten.map(x => ({ ...x, betrag: r2(x.betrag) })), personal: k.personal.map(x => ({ ...x, fte: r2(x.fte) })) };
}

type Fehler = { path: string; message: string };

/** Schema des Kapitels (Q7) und fachliche Regeln der Listen; Fehler mit Pfad im Inhalt. */
interface ZielLesen {
  ziel: (id: string) => Promise<{ id: string; handlungsfeld_id: string } | null>;
  jahresziel: (id: string) => Promise<{ id: string; strategisches_ziel_id: string } | null>;
}

async function pruefeInhalt(tx: Tx, nr: number, inhalt: unknown, zielLesen: ZielLesen): Promise<Record<string, unknown>> {
  const schema = KAPITEL[nr - 1]!;
  if (!Value.Check(schema, LISTEN_SCHEMAS, inhalt)) {
    const fehler = [...Value.Errors(schema, LISTEN_SCHEMAS, inhalt)].slice(0, 20).map(e => ({ path: `/inhalt${e.path}`, message: `Ungültiger Wert (${e.message}).` }));
    throw invalid(`Der Inhalt passt nicht zu Kapitel ${nr} «${titel(nr)}».`, fehler);
  }
  const i = inhalt as Record<string, unknown>;
  const fehler: Fehler[] = [];
  if (nr === 2) {
    const k = i as { handlungsfeldId: string | null; strategischesZielId: string | null; jahreszielId: string | null };
    if (k.strategischesZielId) {
      const z = await zielLesen.ziel(k.strategischesZielId);
      if (!z) fehler.push({ path: '/inhalt/strategischesZielId', message: 'Dieses strategische Ziel gibt es nicht.' });
      else if (k.handlungsfeldId && z.handlungsfeld_id !== k.handlungsfeldId) fehler.push({ path: '/inhalt/handlungsfeldId', message: 'Das Ziel gehört zu einem anderen Handlungsfeld.' });
      else k.handlungsfeldId = z.handlungsfeld_id;
    }
    if (k.jahreszielId) {
      const j = await zielLesen.jahresziel(k.jahreszielId);
      if (!j) fehler.push({ path: '/inhalt/jahreszielId', message: 'Dieses Jahresziel gibt es nicht.' });
      else if (j.strategisches_ziel_id !== k.strategischesZielId) fehler.push({ path: '/inhalt/jahreszielId', message: 'Das Jahresziel gehört nicht zum gewählten strategischen Ziel.' });
    }
  }
  if (nr === 6) {
    const liste = i.abhaengigkeiten as { zuProjektId: string }[];
    const sichtbar = await store.projekteSichtbar(tx, liste.map(a => a.zuProjektId));
    liste.forEach((a, n) => { if (!sichtbar.has(a.zuProjektId)) fehler.push({ path: `/inhalt/abhaengigkeiten/${n}/zuProjektId`, message: 'Dieses Projekt gibt es nicht.' }); });
  }
  if (nr === 8) {
    const liste = i.mitglieder as { personId: string; funktion: string }[];
    const da = await store.personenVorhanden(tx, [...new Set(liste.map(m => m.personId))]);
    const einzeln = new Set<string>();
    liste.forEach((m, n) => {
      if (!da.has(m.personId)) fehler.push({ path: `/inhalt/mitglieder/${n}/personId`, message: 'Diese Person gibt es in der Organisation nicht.' });
      if (['sp', 'pl', 'ctl'].includes(m.funktion)) {
        if (einzeln.has(m.funktion)) fehler.push({ path: `/inhalt/mitglieder/${n}/funktion`, message: 'Sponsor, Projektleitung und CTL je höchstens eine Person (A-04).' });
        einzeln.add(m.funktion);
      }
    });
  }
  if (nr === 9) {
    const liste = i.personal as { phase: string; rolle: string; groesse: string | null; fte: number | null; vonMonat: string | null; bisMonat: string | null }[];
    const gesehen = new Set<string>();
    liste.forEach((z, n) => {
      const mitFte = z.fte !== null && !!z.vonMonat && !!z.bisMonat && z.vonMonat <= z.bisMonat;
      const nurGroesse = z.groesse !== null && z.fte === null && !z.vonMonat && !z.bisMonat;
      if (!mitFte && !nurGroesse) fehler.push({ path: `/inhalt/personal/${n}`, message: 'Entweder eine Grösse (S/M/L) oder FTE mit Monat von und bis (von ≤ bis), nicht beides (A-20).' });
      const k = `${z.phase}:${z.rolle}`;
      if (gesehen.has(k)) fehler.push({ path: `/inhalt/personal/${n}/rolle`, message: 'Je Rolle und Phase eine Zeile.' });
      gesehen.add(k);
    });
  }
  if (fehler.length) throw invalid(`Kapitel ${nr} «${titel(nr)}» ist nicht vollständig gültig.`, fehler);
  return runden(nr, i);
}

// ---------------------------------------------------------------- Routen

export function registerRoutes(app: FastifyInstance, deps: Deps): void {
  /**
   * Phasenmodell in Kraft für Pflichtangaben und Vorbelegung. Es ist Konfiguration der Organisation: in voller Sicht
   * gelesen, damit die Sperre auch für Personen mit nur Projektrollen gilt. Am Gate gilt die Version in Kraft ab diesem
   * Gate (A-13); bei einer Änderung (AP-E3-4) die des Projekts (`projekt.phasenmodell_id`, AP-E0-4) – bis das Modul
   * projekt sie über `index.ts` bietet, ebenfalls die Version in Kraft.
   */
  const modell = (req: FastifyRequest): Promise<Phasenmodell> => fullTx(deps.db, req.requirePrincipal().tenantId, tx => aktuellesPhasenmodell(tx));

  for (const s of [...LISTEN_SCHEMAS, ...KAPITEL, VertragVersion, KapitelKopf, VertragVersionDetail, Vertrag, EntwurfCreate, Kapitel, KapitelPut, Pflichtangaben]) app.addSchema(s);

  /** Detail einer Version: Kopf und Kapitel mit «geändert» und «Angaben fehlen». */
  async function detail(req: FastifyRequest, tx: Tx, v: store.VersionRow, p: store.ProjektKopf, m: Modell | null) {
    const [kapitel, angaben] = [await store.kapitel(tx, v.id), await pflichtangaben(tx, v, m)];
    return {
      version: await versionOut(req, v, p),
      kapitel: kapitel.map(k => ({
        kapitel: k.kapitel, titel: titel(k.kapitel), geaendert: k.geaendert, fehlend: angaben.filter(a => a.kapitel === k.kapitel && !a.erfuellt).length,
        version: k.version, updatedAt: k.updated_at,
      })),
    };
  }

  app.get('/v1/projekte/:id/vertrag', {
    schema: {
      tags: [TAG], summary: 'Projektvertrag: Versionen', params: IdParams, response: { 200: Type.Ref('Vertrag') },
      description: 'Alle Versionen des Projektvertrags (neueste zuerst) mit Entwurf und Baseline (UI-07). `can.entwerfen` nennt die Anlässe, für die jetzt ein Entwurf möglich ist.',
    },
  }, async req => {
    const { id } = req.params as { id: string };
    await req.need('projekt:read', projektOrt(id));
    const { p, versionen } = await req.tx(async tx => ({ p: await projekt(tx, id), versionen: await store.versionen(tx, id) }));
    const darf = projektAenderbar(p) && !entwurfVon(versionen) && await req.can('vertrag:write', projektOrt(id));
    const entwerfen = darf ? entwurfsanlass.anlaesse().filter(a => entwurfsanlass.regel(a)!.moeglich({ projekt: p, versionen }) === null) : [];
    return {
      projektId: id,
      versionen: await Promise.all(versionen.map(v => versionOut(req, v, p))),
      entwurf: entwurfVon(versionen)?.id ?? null,
      baseline: versionen.find(v => v.baseline)?.id ?? null,
      can: { entwerfen },
    };
  });

  app.post('/v1/projekte/:id/vertrag/entwuerfe', {
    schema: {
      tags: [TAG], summary: 'Projektvertrag: Entwurf anlegen', params: IdParams, headers: IdempotencyHeaders, body: Type.Ref('VertragEntwurfCreate'),
      response: { 201: Type.Ref('VertragVersionDetail') },
      description: 'Legt den Entwurf einer neuen Version mit allen 13 Kapiteln an (höchstens einer je Projekt, UX-E5; sonst 409 mit `entwurf`). '
        + 'Erster Vertrag (`initial`, UC-002 Schritt 1): Version 0.1, Ausgangslage, Zielsetzung und Strategiebezug aus der Projektidee, Lieferergebnisse und Meilensteine aus dem Phasenmodell.',
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await req.need('vertrag:write', projektOrt(id));
    const body = req.body as EntwurfCreateIn;
    const begruendung = body.begruendung?.trim() ?? '';
    pruefeBegruendung(body.anlass, begruendung);
    const who = actorOf(req);
    const m = await modell(req);
    const out = await req.tx(async tx => {
      const p = await projekt(tx, id);
      if (!projektAenderbar(p)) throw conflict(`Das Projekt ${p.nummer} kann nur noch gelesen werden.`, { reason: 'lebenszyklus', lebenszyklus: p.lebenszyklus });
      const v = await anlegen(tx, who, p, body.anlass, begruendung, m);
      return detail(req, tx, v, p, m);
    });
    reply.code(201).header('etag', etag(out.version.version)).header('location', `/v1/vertragsversionen/${out.version.id}`);
    return out;
  });

  app.get('/v1/vertragsversionen/:id', {
    schema: {
      tags: [TAG], summary: 'Vertragsversion lesen', params: IdParams, response: { 200: Type.Ref('VertragVersionDetail') },
      description: 'Kopf der Version und Kapitelnavigation mit «geändert gegenüber Baseline» und fehlenden Pflichtangaben je Kapitel (K2 Schritt 2). `ETag` der Version.',
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { v, p } = await mitRecht(req, id, 'projekt:read');
    const m = await modell(req);
    const out = await req.tx(tx => detail(req, tx, v, p, m));
    reply.header('etag', etag(v.version));
    return out;
  });

  app.get('/v1/vertragsversionen/:id/kapitel/:nr', {
    schema: {
      tags: [TAG], summary: 'Kapitel lesen', params: KapitelParams, response: { 200: Type.Ref('VertragKapitel') },
      description: 'Inhalt eines Kapitels mit dem Inhalt der Basisversion (Abweichung zur Baseline am Feld). Beträge (Kap. 9) ohne `finanzen:read` als null (A-33). `ETag` des Kapitels.',
    },
  }, async (req, reply) => {
    const { id, nr } = req.params as { id: string; nr: number };
    const { v, p } = await mitRecht(req, id, 'projekt:read');
    const [k, basis] = await req.tx(async tx => [await store.einKapitel(tx, id, nr), await basisKapitel(tx, v, nr)] as const);
    if (!k) throw notFound('Kapitel');
    const betraege = !KAPITEL_MIT_BETRAEGEN.includes(nr) || await req.can('finanzen:read', projektOrt(p.id));
    const sicht = (x: Record<string, unknown>) => (betraege ? x : ohneBetraege(nr, x));
    const write = bearbeitbar(v, p) && await req.can('vertrag:write', projektOrt(p.id)) && betraege;
    reply.header('etag', etag(k.version));
    return {
      versionId: id, kapitel: nr, titel: titel(nr), inhalt: sicht(k.inhalt), basis: basis ? sicht(basis.inhalt) : null, geaendert: k.geaendert,
      version: k.version, updatedAt: k.updated_at, can: { write },
    };
  });

  app.put('/v1/vertragsversionen/:id/kapitel/:nr', {
    schema: {
      tags: [TAG], summary: 'Kapitel speichern', params: KapitelParams, headers: IfMatchHeaders, body: Type.Ref('VertragKapitelPut'), response: { 200: Type.Ref('VertragKapitel') },
      description: 'Ersetzt den Inhalt eines Kapitels im Entwurf «in Arbeit» (automatisches Speichern, I-R3); `If-Match` Pflicht, bei fremder Änderung 412 (K2 Z7). '
        + 'Der Inhalt wird gegen das Schema des Kapitels geprüft (422 mit Pfad). Kapitel 9 nur mit `finanzen:read`.',
    },
  }, async (req, reply) => {
    const { id, nr } = req.params as { id: string; nr: number };
    const erwartet = requireIfMatch(req);
    const { v, p } = await mitRecht(req, id, 'vertrag:write');
    if (KAPITEL_MIT_BETRAEGEN.includes(nr) && !(await req.can('finanzen:read', projektOrt(p.id)))) {
      throw forbidden('Kapitel 9 enthält Beträge; ohne Recht auf Beträge kannst du es nicht bearbeiten.');
    }
    const who = actorOf(req);
    // Strategische Ziele sind Stammdaten der Organisation (AP-E0-9, Lesen an der Organisation): Prüfung in voller Sicht,
    // damit die Projektleitung mit Rollen nur am Projekt sie wählen kann
    const voll = <T>(fn: (tx: Tx) => Promise<T>) => fullTx(deps.db, req.requirePrincipal().tenantId, fn);
    const zielLesen: ZielLesen = { ziel: zid => voll(tx => store.strategischesZiel(tx, zid)), jahresziel: jid => voll(tx => store.jahresziel(tx, jid)) };
    const out = await req.tx(async tx => {
      if (!bearbeitbar(v, p)) throw conflict(`Version ${v.nummer} ist ${STAND_TEXT[v.stand]} und kann nicht bearbeitet werden.`, { reason: 'stand', stand: v.stand });
      const vorher = await store.einKapitel(tx, id, nr);
      if (!vorher) throw notFound('Kapitel');
      if (vorher.version !== erwartet) throw preconditionFailed(vorher.version);
      const inhalt = await pruefeInhalt(tx, nr, (req.body as { inhalt: unknown }).inhalt, zielLesen);
      const basis = await basisKapitel(tx, v, nr);
      const geaendert = basis ? !gleich(inhalt, basis.inhalt) : false;
      if (!(await store.kapitelSetzen(tx, id, nr, erwartet, inhalt, geaendert))) throw preconditionFailed(vorher.version + 1);
      const k = (await store.einKapitel(tx, id, nr))!;
      const daten = { versionId: id, projektId: p.id, nummer: v.nummer, kapitel: nr, geaendert, version: k.version };
      await record(tx, who, { action: 'vertrag.chapter_updated', resourceType: 'vertrag_version', resourceId: id, data: { ...daten, projekt: p.nummer }, event: daten });
      return { k, basis };
    });
    reply.header('etag', etag(out.k.version));
    return {
      versionId: id, kapitel: nr, titel: titel(nr), inhalt: out.k.inhalt, basis: out.basis?.inhalt ?? null, geaendert: out.k.geaendert,
      version: out.k.version, updatedAt: out.k.updated_at, can: { write: true },
    };
  });

  app.get('/v1/vertragsversionen/:id/pflichtangaben', {
    schema: {
      tags: [TAG], summary: 'Pflichtangaben der Zielphase', params: IdParams, response: { 200: Type.Ref('VertragPflichtangaben') },
      description: 'Verlangte Angaben aus dem Phasenmodell (Gate in die Zielphase und Zielphase, K13, A-12) mit Stand und Sprungziel (Kapitel, Feld) für das Seitenpanel (K2-4).',
    },
  }, async req => {
    const { id } = req.params as { id: string };
    const { v } = await mitRecht(req, id, 'projekt:read');
    const m = await modell(req);
    const angaben = await req.tx(tx => pflichtangaben(tx, v, m));
    return { versionId: id, zielphase: v.zielphase, vollstaendig: angaben.every(a => a.erfuellt), angaben };
  });

  app.post('/v1/vertragsversionen/:id/einreichen', {
    schema: {
      tags: [TAG], summary: 'Zur Prüfung einreichen', params: IdParams, headers: IfMatchHeaders,
      response: { 200: Type.Ref('VertragVersionDetail') },
      description: 'Entwurf «in Arbeit» → «in Prüfung» (DM.02.02, UC-002 Schritt 8); die UE erhält die Aufgabe «Quality-Check». Fehlen Pflichtangaben der Zielphase: 422 mit je einem Fehler '
        + '`/kapitel/<nr>/<feld>` (UC-002 A3). Eine Änderung reicht die PL beim Sponsor ein (UC-007, nicht hier). `If-Match` Pflicht.',
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const erwartet = requireIfMatch(req);
    const { v, p } = await mitRecht(req, id, 'vertrag:write');
    const who = actorOf(req);
    const m = await modell(req);
    const out = await req.tx(async tx => {
      if (!bearbeitbar(v, p)) throw conflict(`Version ${v.nummer} ist ${STAND_TEXT[v.stand]} und kann nicht eingereicht werden.`, { reason: 'stand', stand: v.stand });
      if (v.version !== erwartet) throw preconditionFailed(v.version);
      if (v.anlass === 'aenderung') throw conflict('Eine Änderung reichst du beim Sponsor ein («Änderung einreichen»).', { reason: 'anlass' });
      const fehlend = (await pflichtangaben(tx, v, m)).filter(a => !a.erfuellt);
      if (fehlend.length) {
        throw invalid(`Angaben für Phase ${v.zielphase} fehlen: ${fehlend.map(a => `${a.text} (Kap. ${a.kapitel})`).join(', ')}. Ergänze sie, um einzureichen.`,
          fehlend.map(a => ({ path: `/kapitel/${a.kapitel}/${a.feld}`, message: a.grund ?? a.text })));
      }
      if (!(await store.standSetzen(tx, id, erwartet, ['in_arbeit'], 'in_pruefung', { eingereicht: true }))) throw preconditionFailed(v.version + 1);
      // Aufgaben (fachmodell.md 4.2): «Projektvertrag erstellen» bzw. «überarbeiten» erledigt, Quality-Check an die UE
      await aufgabe.erledigen(tx, { art: 'vertrag.erstellen', bezug: { typ: 'projekt', id: p.id } });
      await aufgabe.erledigen(tx, { art: 'vertrag.ueberarbeiten', bezug: { typ: 'vertrag_version', id } });
      await aufgabe.oeffnen(tx, {
        art: 'vertrag.quality_check', bezug: { typ: 'vertrag_version', id }, empfaenger: { recht: 'vertrag:review' },
        titel: `Quality-Check Projektvertrag ${p.name}`, kontext: `${p.nummer} ${p.name} · Version ${v.nummer} für ${v.zielphase}`,
        link: `/projekte/${p.nummer}/vertrag/pruefen`,
      });
      const r = (await store.version(tx, id))!;
      const daten = { id, projektId: p.id, nummer: r.nummer, anlass: r.anlass, zielphase: r.zielphase, stand: r.stand };
      await record(tx, who, { action: 'vertrag.submitted', resourceType: 'vertrag_version', resourceId: id, data: { ...daten, projekt: p.nummer }, event: daten });
      return detail(req, tx, r, p, m);
    });
    reply.header('etag', etag(out.version.version));
    return out;
  });
}

