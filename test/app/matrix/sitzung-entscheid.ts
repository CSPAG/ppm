/** Modul sitzung, Teil AP-E2-2 (140_entscheid_protokoll; BC PP.04.02, PS.02.02): Entscheid, Verlauf, Auflage, Protokoll und Routen. */
import assert from 'node:assert/strict';
import { login } from '../api.ts';
import type { Matrix } from './typ.ts';

export const matrix: Matrix = {
  tables: {
    // Traktandum «Probe» und Sitzung 2026-11-18 aus test/app/matrix/sitzung.ts
    entscheid: async (tx, t) => {
      await tx.query("INSERT INTO ppm.entscheid (tenant_id, traktandum_id, sitzung_id, ergebnis, begruendung) SELECT $1, id, sitzung_id, 'freigegeben', 'Probe' FROM ppm.traktandum WHERE titel = 'Probe'", [t]);
      return "begruendung = 'Probe'";
    },
    // entsteht mit dem Entscheid (Trigger entscheid_history)
    entscheid_version: async () => "begruendung = 'Probe'",
    auflage: async (tx, t) => {
      await tx.query(
        `INSERT INTO ppm.auflage (tenant_id, entscheid_id, position, text, verantwortlich, termin)
         SELECT $1, e.id, 1, 'Probe', p.id, '2026-12-31' FROM ppm.entscheid e, ppm.principal p WHERE e.begruendung = 'Probe' AND p.subject = 'probe-pl'`, [t]);
      return "text = 'Probe'";
    },
    protokoll: async (tx, t) => {
      await tx.query(`INSERT INTO ppm.protokoll (tenant_id, sitzung_id, inhalt) SELECT $1, id, '{"probe": true}' FROM ppm.sitzung WHERE datum = '2026-11-18'`, [t]);
      return "inhalt ? 'probe'";
    },
  },
  policies: [
    // Auflage: mit dem Entscheid; verantwortliche Person und Vertretung sehen und melden erledigt
    "ppm.auflage.auflage_delete RESTRICTIVE DELETE ppm_app USING (EXISTS ( SELECT 1 FROM (ppm.entscheid e JOIN ppm.traktandum t ON (((t.tenant_id = e.tenant_id) AND (t.id = e.traktandum_id)))) WHERE ((e.id = auflage.entscheid_id) AND ppm.gremium_recht('sitzung:write'::text, t.portfolio_id)))) CHECK -",
    "ppm.auflage.auflage_insert RESTRICTIVE INSERT ppm_app USING - CHECK (EXISTS ( SELECT 1 FROM (ppm.entscheid e JOIN ppm.traktandum t ON (((t.tenant_id = e.tenant_id) AND (t.id = e.traktandum_id)))) WHERE ((e.id = auflage.entscheid_id) AND ppm.gremium_recht('sitzung:write'::text, t.portfolio_id))))",
    "ppm.auflage.auflage_read RESTRICTIVE SELECT ppm_app USING ((EXISTS ( SELECT 1 FROM ppm.entscheid e WHERE (e.id = auflage.entscheid_id))) OR (verantwortlich = app.principal_id()) OR (EXISTS ( SELECT 1 FROM ppm.stellvertretung s WHERE ((s.tenant_id = auflage.tenant_id) AND (s.vertretene_person = auflage.verantwortlich) AND (s.vertreter_person = app.principal_id()) AND ((((now() AT TIME ZONE 'Europe/Zurich'::text))::date >= s.von) AND (((now() AT TIME ZONE 'Europe/Zurich'::text))::date <= s.bis)))))) CHECK -",
    "ppm.auflage.auflage_update RESTRICTIVE UPDATE ppm_app USING ((EXISTS ( SELECT 1 FROM (ppm.entscheid e JOIN ppm.traktandum t ON (((t.tenant_id = e.tenant_id) AND (t.id = e.traktandum_id)))) WHERE ((e.id = auflage.entscheid_id) AND ppm.gremium_recht('sitzung:write'::text, t.portfolio_id)))) OR (verantwortlich = app.principal_id()) OR (EXISTS ( SELECT 1 FROM ppm.stellvertretung s WHERE ((s.tenant_id = auflage.tenant_id) AND (s.vertretene_person = auflage.verantwortlich) AND (s.vertreter_person = app.principal_id()) AND ((((now() AT TIME ZONE 'Europe/Zurich'::text))::date >= s.von) AND (((now() AT TIME ZONE 'Europe/Zurich'::text))::date <= s.bis)))))) CHECK ((EXISTS ( SELECT 1 FROM (ppm.entscheid e JOIN ppm.traktandum t ON (((t.tenant_id = e.tenant_id) AND (t.id = e.traktandum_id)))) WHERE ((e.id = auflage.entscheid_id) AND ppm.gremium_recht('sitzung:write'::text, t.portfolio_id)))) OR (verantwortlich = app.principal_id()) OR (EXISTS ( SELECT 1 FROM ppm.stellvertretung s WHERE ((s.tenant_id = auflage.tenant_id) AND (s.vertretene_person = auflage.verantwortlich) AND (s.vertreter_person = app.principal_id()) AND ((((now() AT TIME ZONE 'Europe/Zurich'::text))::date >= s.von) AND (((now() AT TIME ZONE 'Europe/Zurich'::text))::date <= s.bis))))))",
    // Entscheid, Muster ÜBER ELTERN (Traktandum); schreiben mit sitzung:write
    "ppm.entscheid.entscheid_delete RESTRICTIVE DELETE ppm_app USING (EXISTS ( SELECT 1 FROM ppm.traktandum t WHERE ((t.id = entscheid.traktandum_id) AND ppm.gremium_recht('sitzung:write'::text, t.portfolio_id)))) CHECK -",
    "ppm.entscheid.entscheid_insert RESTRICTIVE INSERT ppm_app USING - CHECK (EXISTS ( SELECT 1 FROM ppm.traktandum t WHERE ((t.id = entscheid.traktandum_id) AND ppm.gremium_recht('sitzung:write'::text, t.portfolio_id))))",
    'ppm.entscheid.entscheid_read RESTRICTIVE SELECT ppm_app USING (EXISTS ( SELECT 1 FROM ppm.traktandum t WHERE (t.id = entscheid.traktandum_id))) CHECK -',
    "ppm.entscheid.entscheid_update RESTRICTIVE UPDATE ppm_app USING (EXISTS ( SELECT 1 FROM ppm.traktandum t WHERE ((t.id = entscheid.traktandum_id) AND ppm.gremium_recht('sitzung:write'::text, t.portfolio_id)))) CHECK (EXISTS ( SELECT 1 FROM ppm.traktandum t WHERE ((t.id = entscheid.traktandum_id) AND ppm.gremium_recht('sitzung:write'::text, t.portfolio_id))))",
    // Verlauf, Muster STAND: lesen mit dem Entscheid, nur anhängen
    'ppm.entscheid_version.entscheid_version_insert RESTRICTIVE INSERT ppm_app USING - CHECK (EXISTS ( SELECT 1 FROM ppm.entscheid e WHERE (e.id = entscheid_version.entscheid_id)))',
    'ppm.entscheid_version.entscheid_version_read RESTRICTIVE SELECT ppm_app USING (EXISTS ( SELECT 1 FROM ppm.entscheid e WHERE (e.id = entscheid_version.entscheid_id))) CHECK -',
    // Protokoll: Entwurf nur sitzung:write, Mitglieder ab Versand
    "ppm.protokoll.protokoll_delete RESTRICTIVE DELETE ppm_app USING (EXISTS ( SELECT 1 FROM ppm.sitzung s WHERE ((s.id = protokoll.sitzung_id) AND ppm.gremium_recht('sitzung:write'::text, s.portfolio_id)))) CHECK -",
    "ppm.protokoll.protokoll_insert RESTRICTIVE INSERT ppm_app USING - CHECK (EXISTS ( SELECT 1 FROM ppm.sitzung s WHERE ((s.id = protokoll.sitzung_id) AND ppm.gremium_recht('sitzung:write'::text, s.portfolio_id))))",
    "ppm.protokoll.protokoll_read RESTRICTIVE SELECT ppm_app USING (EXISTS ( SELECT 1 FROM ppm.sitzung s WHERE ((s.id = protokoll.sitzung_id) AND (ppm.gremium_recht('sitzung:write'::text, s.portfolio_id) OR ((protokoll.stand = 'versendet'::text) AND ppm.gremium_recht('sitzung:read'::text, s.portfolio_id)))))) CHECK -",
    "ppm.protokoll.protokoll_update RESTRICTIVE UPDATE ppm_app USING (EXISTS ( SELECT 1 FROM ppm.sitzung s WHERE ((s.id = protokoll.sitzung_id) AND ppm.gremium_recht('sitzung:write'::text, s.portfolio_id)))) CHECK (EXISTS ( SELECT 1 FROM ppm.sitzung s WHERE ((s.id = protokoll.sitzung_id) AND ppm.gremium_recht('sitzung:write'::text, s.portfolio_id))))",
  ],
  seed: async (api, a, mark) => {
    const inject = async (method: string, url: string, payload?: unknown, headers: Record<string, string> = {}) => {
      const r = await api.app.inject({ method: method as 'GET', url, headers: { ...a, ...headers }, ...(payload ? { payload: payload as Record<string, unknown> } : {}) });
      assert.ok(r.statusCode < 300, `${method} ${url}: ${r.statusCode} ${r.body}`);
      return r.json();
    };
    const verantwortlich = (await login(api, 'acme', 'u-a-auflage', 'leser')).principalId;
    const p = await inject('POST', '/v1/portfolios', { kategorie: 'B', schluessel: 'sitzung-b', name: mark });
    const g = await inject('POST', '/v1/gremien', { portfolioId: p.id, kuerzel: 'gremium-b', name: mark, art: 'entscheidend' });
    for (const datum of ['2026-12-09', '2026-12-16', '2027-01-20']) await inject('POST', `/v1/gremien/${g.id}/termine`, { datum });
    // Sitzung durchführen bis zum Entscheid mit Auflage (laufend) …
    const durchfuehren = async (datum: string) => {
      let s = await inject('POST', '/v1/gremien/gremium-b/sitzungen', { datum });
      s = await inject('POST', `/v1/sitzungen/${s.id}/traktanden`, { art: 'eskalation', titel: mark, antrag: mark });
      s = await inject('POST', `/v1/sitzungen/${s.id}/versenden`, undefined, { 'if-match': `W/"${s.version}"` });
      const m = await inject('POST', `/v1/sitzungen/${s.id}/starten`, undefined, { 'if-match': `W/"${s.version}"` });
      const t = m.traktanden[0].traktandumId;
      const e = await inject('PUT', `/v1/traktanden/${t}/entscheid`, { ergebnis: 'erledigt', begruendung: mark, auflagen: [{ text: mark, verantwortlich, termin: '2027-02-01' }] });
      return { s: m, t, auflage: e.auflagen[0].id };
    };
    const laufend = await durchfuehren('2026-12-09');
    // … und eine geschlossene Sitzung mit versendetem Protokoll
    const geschlossen = await durchfuehren('2026-12-16');
    const m = await inject('GET', `/v1/sitzungen/${geschlossen.s.sitzungId}/entscheide`);
    await inject('POST', `/v1/sitzungen/${m.sitzungId}/schliessen`, undefined, { 'if-match': `W/"${m.version}"` });
    const pr = await inject('GET', `/v1/sitzungen/${m.sitzungId}/protokoll`);
    await inject('POST', `/v1/sitzungen/${m.sitzungId}/protokoll/versenden`, undefined, { 'if-match': `W/"${pr.version}"` });
    // Eingang von A wie vorher (Matrix eingang): «Unterlagen lesen» der laufenden Sitzung von Hand erledigen
    for (const x of (await inject('GET', '/v1/eingang')).items as { id: string; titel: string }[]) {
      if (x.titel.startsWith('Unterlagen GREMIUM-B')) await inject('POST', `/v1/eingang/aufgaben/${x.id}/erledigen`);
    }
    return { sitzungLaufend: laufend.s.sitzungId, traktandumEntschieden: laufend.t, auflage: laufend.auflage, sitzungGeschlossen: m.sitzungId };
  },
  cases: {
    'GET /v1/sitzungen/:id/entscheide': i => ({ method: 'GET', url: `/v1/sitzungen/${i.sitzungLaufend}/entscheide`, kind: 'foreign' }),
    'POST /v1/sitzungen/:id/starten': i => ({ method: 'POST', url: `/v1/sitzungen/${i.sitzungLaufend}/starten`, headers: { 'if-match': 'W/"5"' }, kind: 'foreign' }),
    'POST /v1/sitzungen/:id/schliessen': i => ({ method: 'POST', url: `/v1/sitzungen/${i.sitzungLaufend}/schliessen`, headers: { 'if-match': 'W/"5"' }, kind: 'foreign' }),
    'GET /v1/traktanden/:id/entscheid': i => ({ method: 'GET', url: `/v1/traktanden/${i.traktandumEntschieden}/entscheid`, kind: 'foreign' }),
    'PUT /v1/traktanden/:id/entscheid': i => ({ method: 'PUT', url: `/v1/traktanden/${i.traktandumEntschieden}/entscheid`, body: { ergebnis: 'zurueckgestellt', begruendung: 'gehackt' }, headers: { 'if-match': 'W/"1"' }, kind: 'foreign' }),
    'PUT /v1/traktanden/:id/entscheid/sns': i => ({ method: 'PUT', url: `/v1/traktanden/${i.traktandumEntschieden}/entscheid/sns`, body: { ergebnis: 'erledigt', begruendung: 'gehackt' }, headers: { 'if-match': 'W/"1"' }, kind: 'foreign' }),
    'GET /v1/entscheide': () => ({ method: 'GET', url: '/v1/entscheide', kind: 'list' }),
    'POST /v1/auflagen/:id/erfuellen': i => ({ method: 'POST', url: `/v1/auflagen/${i.auflage}/erfuellen`, kind: 'foreign' }),
    'GET /v1/sitzungen/:id/protokoll': i => ({ method: 'GET', url: `/v1/sitzungen/${i.sitzungGeschlossen}/protokoll`, kind: 'foreign' }),
    'PUT /v1/sitzungen/:id/protokoll': i => ({ method: 'PUT', url: `/v1/sitzungen/${i.sitzungGeschlossen}/protokoll`, body: { anwesende: 'gehackt' }, headers: { 'if-match': 'W/"1"' }, kind: 'foreign' }),
    'GET /v1/sitzungen/:id/protokoll/versand': i => ({ method: 'GET', url: `/v1/sitzungen/${i.sitzungGeschlossen}/protokoll/versand`, kind: 'foreign' }),
    'POST /v1/sitzungen/:id/protokoll/versenden': i => ({ method: 'POST', url: `/v1/sitzungen/${i.sitzungGeschlossen}/protokoll/versenden`, headers: { 'if-match': 'W/"1"' }, kind: 'foreign' }),
  },
  unchanged: async (api, a, mark) => {
    const l = (await api.app.inject({ method: 'GET', url: '/v1/entscheide?gremium=gremium-b', headers: a })).json();
    assert.deepEqual(l.items.map((e: { ergebnis: string; begruendung: string; auflagen: { stand: string }[] }) => [e.ergebnis, e.begruendung, e.auflagen.map(x => x.stand)]),
      [['erledigt', mark, ['offen']], ['erledigt', mark, ['offen']]]);
    const s = (await api.app.inject({ method: 'GET', url: '/v1/gremien/gremium-b/sitzungen/2026-12-16', headers: a })).json();
    const p = (await api.app.inject({ method: 'GET', url: `/v1/sitzungen/${s.id}/protokoll`, headers: a })).json();
    assert.deepEqual([s.stand, p.stand, p.inhalt.anwesende], ['protokoll_versendet', 'versendet', '']);
  },
};
