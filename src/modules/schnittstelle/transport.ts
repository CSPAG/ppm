/**
 * Netz-Adapter der Schnittstellen (scripts/check-network.ts): Abruf beim und Lieferung an das Umsystem, nur über
 * `safeRequest` (SSRF-Schutz, keine Weiterleitungen, Zeit- und Grössenlimit). Private Adressen nur mit
 * `WEBHOOK_ALLOW_PRIVATE` (Entwicklung und Tests). Protokoll: HTTP(S) mit JSON (Annahme AP-E7-3; Adresse und Protokoll
 * der Umsysteme stehen nicht in docs/).
 */
import { safeRequest, SsrfError } from '@vollholz/platform';

export interface Optionen { timeoutMs: number; allowPrivate: boolean }

/** Antwort höchstens 10 MB (Ist-Kosten eines Monats). */
const MAX_BYTES = 10 * 1024 * 1024;
const USER_AGENT = 'ppm-schnittstelle/1';

/** Fehler des Transports mit Text für das Laufprotokoll. */
export class TransportFehler extends Error {}

async function anfrage(adresse: string, o: Optionen, init: { method: string; body?: string }): Promise<string> {
  let res;
  try {
    res = await safeRequest(adresse, {
      method: init.method, timeoutMs: o.timeoutMs, allowPrivate: o.allowPrivate, maxBytes: MAX_BYTES, userAgent: USER_AGENT,
      headers: { accept: 'application/json', ...(init.body !== undefined ? { 'content-type': 'application/json' } : {}) },
      ...(init.body !== undefined ? { body: init.body } : {}),
    });
  } catch (e) {
    if (e instanceof SsrfError) throw new TransportFehler(`Adresse nicht zulässig: ${e.message}`);
    throw new TransportFehler(`Umsystem nicht erreichbar: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (res.status < 200 || res.status >= 300) throw new TransportFehler(`Das Umsystem antwortet mit Status ${res.status}.`);
  return res.body;
}

/** Daten beim Umsystem abholen (eingehend) bzw. für den Testlauf die Verbindung prüfen. */
export const abrufen = (adresse: string, o: Optionen): Promise<string> => anfrage(adresse, o, { method: 'GET' });

/** Daten an das Umsystem liefern (ausgehend), als JSON. */
export const liefern = async (adresse: string, inhalt: unknown, o: Optionen): Promise<void> => {
  await anfrage(adresse, o, { method: 'POST', body: JSON.stringify(inhalt) });
};
