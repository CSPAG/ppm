/**
 * Aufrufe der REST-API aus dem MCP-Dienst (`ApiClient` aus `@vollholz/iam`: DPoP-Proof je Aufruf, Nonce, X-Tenant).
 * Der MCP-Dienst hat keine eigene Fachlogik und keinen Datenbank-Login.
 */
import { ApiError, type ApiClient } from '@vollholz/iam';

export { ApiError, type ApiClient };

/** GET mit JSON-Antwort; Fehler der API als Text für das Werkzeugergebnis. */
export async function getJson<T>(api: ApiClient, path: string, query?: Record<string, string | number | undefined>): Promise<{ ok: true; body: T } | { ok: false; error: string }> {
  try {
    const r = await api.call<T & { title?: string; detail?: string }>('GET', path, { query });
    if (r.status >= 400) return { ok: false, error: `${r.status} ${r.body?.title ?? ''}${r.body?.detail ? `: ${r.body.detail}` : ''}`.trim() };
    return { ok: true, body: r.body };
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? `${e.status} ${e.message}` : 'Die API ist nicht erreichbar.' };
  }
}
