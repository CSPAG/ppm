/** Modul abschluss (340_abschluss; AP-E7-1): Abschlussbericht, Folge der Entscheide, Lessons Learned. */
import assert from 'node:assert/strict';
import { full, tenant } from '../harness.ts';
import type { Matrix } from './typ.ts';

/** Projekt «Probe» (2026-001) aus matrix/projekt.ts. */
const PROBE = "(SELECT id FROM ppm.projekt WHERE nummer = '2026-001')";

const PL = "ppm.recht_am_projekt('projekt:write'::text, projekt_id)";
const INTERN = "(current_setting('app.abschluss_intern'::text, true) = 'on'::text)";
const NUTZEN = `(${PL} OR ppm.recht_am_projekt('vertrag:decide'::text, projekt_id) OR app.has_permission('vertrag:review'::text) OR ${INTERN})`;

export const matrix: Matrix = {
  tables: {
    abschlussbericht: async (tx, t) => {
      await tx.query(`INSERT INTO ppm.abschlussbericht (tenant_id, projekt_id, art, zielerreichung) VALUES ($1, ${PROBE}, 'abschluss', 'Probe')`, [t]);
      return "zielerreichung = 'Probe'";
    },
    abschluss_entscheid: async (tx, t) => {
      // Schreiben nur als Folge eines Entscheids (app.abschluss_intern)
      await tx.query("SELECT set_config('app.abschluss_intern', 'on', true)");
      await tx.query(`INSERT INTO ppm.abschluss_entscheid (tenant_id, projekt_id, quelle, quelle_id, kontext, ergebnis, vorher_lebenszyklus)
        VALUES ($1, ${PROBE}, 'traktandum', gen_random_uuid(), 'aktiv', 'weiterfuehren', 'aktiv')`, [t]);
      await tx.query("SELECT set_config('app.abschluss_intern', '', true)");
      return "ergebnis = 'weiterfuehren'";
    },
    lessons_learned: async (tx, t) => {
      await tx.query(`INSERT INTO ppm.lessons_learned (tenant_id, projekt_id, text) VALUES ($1, ${PROBE}, 'Probe')`, [t]);
      return "text = 'Probe'";
    },
  },
  policies: [
    // Muster KIND (fachmodell.md 3.4); die Folge eines Entscheids schreibt über `app.abschluss_intern`
    'ppm.abschlussbericht.abschlussbericht_read RESTRICTIVE SELECT ppm_app USING ppm.projekt_sichtbar(projekt_id) CHECK -',
    `ppm.abschlussbericht.abschlussbericht_insert RESTRICTIVE INSERT ppm_app USING - CHECK (${PL} OR ${INTERN})`,
    `ppm.abschlussbericht.abschlussbericht_update RESTRICTIVE UPDATE ppm_app USING ${NUTZEN} CHECK ${NUTZEN}`,
    `ppm.abschlussbericht.abschlussbericht_delete RESTRICTIVE DELETE ppm_app USING ${INTERN} CHECK -`,
    'ppm.abschluss_entscheid.abschluss_entscheid_read RESTRICTIVE SELECT ppm_app USING ppm.projekt_sichtbar(projekt_id) CHECK -',
    `ppm.abschluss_entscheid.abschluss_entscheid_insert RESTRICTIVE INSERT ppm_app USING - CHECK ${INTERN}`,
    `ppm.abschluss_entscheid.abschluss_entscheid_update RESTRICTIVE UPDATE ppm_app USING ${INTERN} CHECK ${INTERN}`,
    'ppm.lessons_learned.lessons_learned_read RESTRICTIVE SELECT ppm_app USING ppm.projekt_sichtbar(projekt_id) CHECK -',
    `ppm.lessons_learned.lessons_learned_insert RESTRICTIVE INSERT ppm_app USING - CHECK ${PL}`,
    `ppm.lessons_learned.lessons_learned_update RESTRICTIVE UPDATE ppm_app USING ${PL} CHECK ${PL}`,
    `ppm.lessons_learned.lessons_learned_delete RESTRICTIVE DELETE ppm_app USING ${PL} CHECK -`,
  ],
  tags: ['Abschluss', 'Lessons Learned'],
  seed: async (api, a, mark) => {
    const t = await tenant(api.t.runtime, 'acme');
    const projekt = await full(api.t.runtime, t, async tx => (await tx.query<{ id: string }>('SELECT id FROM ppm.projekt WHERE name = $1', [mark])).rows[0]!.id);
    const r = await api.app.inject({ method: 'POST', url: `/v1/projekte/${projekt}/lessons-learned`, headers: a, payload: { text: mark, kategorie: mark } });
    assert.equal(r.statusCode, 201, r.body);
    return { lesson: r.json().id as string };
  },
  cases: {
    'GET /v1/projekte/:id/abschluss': i => ({ method: 'GET', url: `/v1/projekte/${i.projekt}/abschluss`, kind: 'foreign' }),
    'PUT /v1/projekte/:id/abschluss': i => ({
      method: 'PUT', url: `/v1/projekte/${i.projekt}/abschluss`, headers: { 'if-match': 'W/"0"' }, kind: 'foreign',
      body: { projektstand: '', zielerreichung: 'x', kpiWerte: [], businessCase: '', uebergabe: '', offenePunkte: [] },
    }),
    'PUT /v1/projekte/:id/abschluss/nutzen': i => ({
      method: 'PUT', url: `/v1/projekte/${i.projekt}/abschluss/nutzen`, headers: { 'if-match': 'W/"1"' }, body: { rolle: 'ue', beurteilung: 'x' }, kind: 'foreign',
    }),
    'POST /v1/projekte/:id/abschluss/einreichen': i => ({ method: 'POST', url: `/v1/projekte/${i.projekt}/abschluss/einreichen`, headers: { 'if-match': 'W/"1"' }, kind: 'foreign' }),
    // vor der Abnahme abschliessen (AP-E8-4, UC-015 A3)
    'POST /v1/projekte/:id/abschluss/abschliessen': i => ({ method: 'POST', url: `/v1/projekte/${i.projekt}/abschluss/abschliessen`, headers: { 'if-match': 'W/"1"' }, kind: 'foreign' }),
    'GET /v1/projekte/:id/abschluss/dokument': i => ({ method: 'GET', url: `/v1/projekte/${i.projekt}/abschluss/dokument?format=pdf`, kind: 'foreign' }),
    'POST /v1/projekte/:id/wiederaufnahme': i => ({ method: 'POST', url: `/v1/projekte/${i.projekt}/wiederaufnahme`, body: { begruendung: 'x' }, kind: 'foreign' }),
    'GET /v1/lessons-learned': () => ({ method: 'GET', url: '/v1/lessons-learned', kind: 'list' }),
    'POST /v1/projekte/:id/lessons-learned': i => ({ method: 'POST', url: `/v1/projekte/${i.projekt}/lessons-learned`, body: { text: 'x' }, kind: 'foreign' }),
    'PATCH /v1/lessons-learned/:id': i => ({ method: 'PATCH', url: `/v1/lessons-learned/${i.lesson}`, headers: { 'if-match': 'W/"1"' }, body: { text: 'gehackt' }, kind: 'foreign' }),
    'DELETE /v1/lessons-learned/:id': i => ({ method: 'DELETE', url: `/v1/lessons-learned/${i.lesson}`, headers: { 'if-match': 'W/"1"' }, kind: 'foreign' }),
  },
  unchanged: async (api, a, mark) => {
    const r = await api.app.inject({ method: 'GET', url: '/v1/lessons-learned', headers: a });
    assert.equal(r.statusCode, 200, r.body);
    assert.ok((r.json().items as { text: string }[]).some(l => l.text === mark), 'Lesson Learned von A unverändert');
  },
};
