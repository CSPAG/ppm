/** Modul idee, Freigabe der Initialisierung (240_idee_freigabe, UC-001 Schritte 6–7, A4, AP-E4-3): keine eigene Tabelle, nur Routen. */
import type { Matrix } from './typ.ts';

export const matrix: Matrix = {
  cases: {
    'GET /v1/ideen/:id/freigabe': i => ({ method: 'GET', url: `/v1/ideen/${i.idee}/freigabe`, kind: 'foreign' }),
    'PUT /v1/ideen/:id/freigabe/angaben': i => ({ method: 'PUT', url: `/v1/ideen/${i.idee}/freigabe/angaben`, body: { sponsor: null, projektleitung: null }, headers: { 'if-match': 'W/"1"' }, kind: 'foreign' }),
    'POST /v1/ideen/:id/traktandieren': i => ({ method: 'POST', url: `/v1/ideen/${i.idee}/traktandieren`, headers: { 'if-match': 'W/"1"' }, kind: 'foreign' }),
    // Initialisierung vor dem Entscheid (AP-E8-4, UC-001 A6)
    'POST /v1/ideen/:id/initialisieren': i => ({ method: 'POST', url: `/v1/ideen/${i.idee}/initialisieren`, headers: { 'if-match': 'W/"1"' }, kind: 'foreign' }),
    'POST /v1/ideen/:id/freigeben': i => ({ method: 'POST', url: `/v1/ideen/${i.idee}/freigeben`, body: { sponsor: '00000000-0000-4000-8000-000000000001', projektleitung: '00000000-0000-4000-8000-000000000001' }, headers: { 'if-match': 'W/"1"' }, kind: 'foreign' }),
    'POST /v1/ideen/:id/ablehnen': i => ({ method: 'POST', url: `/v1/ideen/${i.idee}/ablehnen`, body: { begruendung: 'gehackt' }, headers: { 'if-match': 'W/"1"' }, kind: 'foreign' }),
  },
};
