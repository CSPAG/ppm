/** Redaction: Geheimnisse nie in Logs (Logger, Fehlertexte, Adressen). */

/** Pfade für den Logger (pino `redact`). */
export const REDACT_PATHS = [
  'req.headers.authorization', 'req.headers.dpop', 'req.headers.cookie', 'req.headers["x-csrf-token"]', 'req.headers["idempotency-key"]',
  'res.headers["set-cookie"]', '*.password', '*.secret', '*.token', '*.access_token', '*.refresh_token', '*.client_secret',
];

/** Adresse ohne Benutzer, Passwort und Query (für Logs, z. B. Webhook-Ziele oder Datenbank-URLs). */
export function redactUrl(u: string): string {
  try {
    const x = new URL(u);
    x.username = x.username ? '***' : '';
    x.password = x.password ? '***' : '';
    x.search = x.search ? '?…' : '';
    return x.toString();
  } catch { return '[ungültige Adresse]'; }
}

/** Text auf eine Länge kürzen (Fehlermeldungen von Gegenstellen) und Steuerzeichen entfernen. */
export function clip(s: string, max = 500): string {
  // eslint-disable-next-line no-control-regex
  const t = s.replace(/[\u0000-\u001f\u007f]+/g, ' ');
  return t.length > max ? `${t.slice(0, max)}…` : t;
}
