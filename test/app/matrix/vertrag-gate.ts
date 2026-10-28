/** Modul vertrag, Gate-Modus und Gate-Entscheid (190_vertrag_gate; AP-E3-3). */
import type { Matrix } from './typ.ts';

/** Version «Probe» aus matrix/vertrag.ts. */
const PROBE = "FROM ppm.vertrag_version WHERE begruendung = 'Probe'";

const SCHREIBEN = "app.has_permission('vertrag:write'::text, 'projekt'::text, projekt_id)";
const INTERN = "(current_setting('app.vertrag_intern'::text, true) = 'on'::text)";
const SP = "app.has_permission('vertrag:decide'::text, 'projekt'::text, projekt_id)";

export const matrix: Matrix = {
  tables: {
    gate_antrag: async (tx, t) => {
      await tx.query(`INSERT INTO ppm.gate_antrag (tenant_id, projekt_id, version_id, gate_code) SELECT $1, projekt_id, id, 'P0_P1' ${PROBE}`, [t]);
      return "gate_code = 'P0_P1'";
    },
    leitfrage_antwort: async (tx, t) => {
      await tx.query(`INSERT INTO ppm.leitfrage_antwort (tenant_id, projekt_id, gate_antrag_id, leitfrage_id, antwort)
        SELECT $1, a.projekt_id, a.id, (SELECT id FROM ppm.leitfrage WHERE tenant_id = $1 LIMIT 1), 'Probe' FROM ppm.gate_antrag a WHERE a.tenant_id = $1`, [t]);
      return "antwort = 'Probe'";
    },
    nutzenpruefung: async (tx, t) => {
      await tx.query(`INSERT INTO ppm.nutzenpruefung (tenant_id, projekt_id, version_id, beurteilung) SELECT $1, projekt_id, id, 'Probe' ${PROBE}`, [t]);
      return "beurteilung = 'Probe'";
    },
  },
  policies: [
    // Muster ÜBER ELTERN mit dem Projekt (fachmodell.md 3.4); der Entscheid schreibt über `app.vertrag_intern`
    'ppm.gate_antrag.gate_antrag_read RESTRICTIVE SELECT ppm_app USING ppm.projekt_sichtbar(projekt_id) CHECK -',
    `ppm.gate_antrag.gate_antrag_insert RESTRICTIVE INSERT ppm_app USING - CHECK (${SCHREIBEN} OR ${INTERN})`,
    `ppm.gate_antrag.gate_antrag_update RESTRICTIVE UPDATE ppm_app USING (${SCHREIBEN} OR ${INTERN}) CHECK (${SCHREIBEN} OR ${INTERN})`,
    'ppm.leitfrage_antwort.leitfrage_antwort_read RESTRICTIVE SELECT ppm_app USING ppm.projekt_sichtbar(projekt_id) CHECK -',
    `ppm.leitfrage_antwort.leitfrage_antwort_insert RESTRICTIVE INSERT ppm_app USING - CHECK ${SCHREIBEN}`,
    `ppm.leitfrage_antwort.leitfrage_antwort_update RESTRICTIVE UPDATE ppm_app USING ${SCHREIBEN} CHECK ${SCHREIBEN}`,
    `ppm.leitfrage_antwort.leitfrage_antwort_delete RESTRICTIVE DELETE ppm_app USING ${SCHREIBEN} CHECK -`,
    'ppm.nutzenpruefung.nutzenpruefung_read RESTRICTIVE SELECT ppm_app USING ppm.projekt_sichtbar(projekt_id) CHECK -',
    `ppm.nutzenpruefung.nutzenpruefung_insert RESTRICTIVE INSERT ppm_app USING - CHECK (${SCHREIBEN} OR ${SP})`,
    `ppm.nutzenpruefung.nutzenpruefung_update RESTRICTIVE UPDATE ppm_app USING (${SCHREIBEN} OR ${SP}) CHECK (${SCHREIBEN} OR ${SP})`,
  ],
  cases: {
    'GET /v1/vertragsversionen/:id/gate': i => ({ method: 'GET', url: `/v1/vertragsversionen/${i.vertragVersion}/gate`, kind: 'foreign' }),
    'PUT /v1/vertragsversionen/:id/gate/leitfragen/:leitfrageId': i => ({
      method: 'PUT', url: `/v1/vertragsversionen/${i.vertragVersion}/gate/leitfragen/00000000-0000-4000-8000-000000000001`,
      body: { antwort: 'x' }, headers: { 'if-match': 'W/"0"' }, kind: 'foreign',
    }),
    'PUT /v1/vertragsversionen/:id/gate/nutzen': i => ({
      method: 'PUT', url: `/v1/vertragsversionen/${i.vertragVersion}/gate/nutzen`, body: { beurteilung: '', werte: [] }, headers: { 'if-match': 'W/"0"' }, kind: 'foreign',
    }),
  },
};
