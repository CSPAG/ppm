/** Modul vertrag, Quality-Check und Unterschriften (180_vertrag_pruefung; AP-E3-2). */
import type { Matrix } from './typ.ts';

/** Version «Probe» aus matrix/vertrag.ts. */
const PROBE = "FROM ppm.vertrag_version WHERE begruendung = 'Probe'";

export const matrix: Matrix = {
  tables: {
    quality_check: async (tx, t) => {
      await tx.query(`INSERT INTO ppm.quality_check (tenant_id, projekt_id, version_id, ergebnis, by_person) SELECT $1, projekt_id, id, 'bestaetigt', gen_random_uuid() ${PROBE}`, [t]);
      return "ergebnis = 'bestaetigt'";
    },
    unterschrift: async (tx, t) => {
      await tx.query(`INSERT INTO ppm.unterschrift (tenant_id, projekt_id, version_id, quality_check_id, funktion, person_id, ergebnis)
        SELECT $1, q.projekt_id, q.version_id, q.id, 'sp', gen_random_uuid(), 'unterzeichnet' FROM ppm.quality_check q`, [t]);
      return "funktion = 'sp'";
    },
  },
  policies: [
    // Muster KIND (fachmodell.md 3.4): lesen, wer das Projekt sieht; schreiben mit dem Recht der Handlung; nur anhängen
    'ppm.quality_check.quality_check_read RESTRICTIVE SELECT ppm_app USING ppm.projekt_sichtbar(projekt_id) CHECK -',
    "ppm.quality_check.quality_check_insert RESTRICTIVE INSERT ppm_app USING - CHECK app.has_permission('vertrag:review'::text)",
    'ppm.unterschrift.unterschrift_read RESTRICTIVE SELECT ppm_app USING ppm.projekt_sichtbar(projekt_id) CHECK -',
    "ppm.unterschrift.unterschrift_insert RESTRICTIVE INSERT ppm_app USING - CHECK app.has_permission('vertrag:sign'::text, 'projekt'::text, projekt_id)",
  ],
  cases: {
    'GET /v1/vertragsversionen/:id/pruefung': i => ({ method: 'GET', url: `/v1/vertragsversionen/${i.vertragVersion}/pruefung`, kind: 'foreign' }),
    'POST /v1/vertragsversionen/:id/quality-check': i => ({
      method: 'POST', url: `/v1/vertragsversionen/${i.vertragVersion}/quality-check`, body: { ergebnis: 'bestaetigt' }, headers: { 'if-match': 'W/"1"' }, kind: 'foreign',
    }),
    'POST /v1/vertragsversionen/:id/unterschriften': i => ({
      method: 'POST', url: `/v1/vertragsversionen/${i.vertragVersion}/unterschriften`, body: { ergebnis: 'unterzeichnet' }, headers: { 'if-match': 'W/"1"' }, kind: 'foreign',
    }),
  },
};
