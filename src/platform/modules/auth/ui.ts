/**
 * Auslieferung der Webapp aus `WEB_DIST_DIR` (same-origin mit API und BFF): SPA-Fallback auf `index.html`
 * (`no-cache`), `/assets/*` unveränderlich (`immutable`), Pfadprüfung gegen das Verlassen von `dist`, CSP ohne
 * `unsafe-inline` mit `connect-src 'self'` und `form-action 'self' <Keycloak>`. Ohne Build zeigt die API ausserhalb der
 * Produktion eine Hinweisseite, in Produktion 503.
 */
import { createReadStream, existsSync, realpathSync, statSync } from 'node:fs';
import { extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { HttpError } from '../../core/errors.ts';
import type { Deps } from '../../http/app.ts';

const ROOT = resolve(import.meta.dirname, '..', '..', '..', '..');

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.webp': 'image/webp', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json', '.map': 'application/json',
};

/** Pfade, die nie an die Webapp gehen (API, BFF, Betrieb). */
const NOT_UI = /^\/(v1|auth|healthz|readyz|mcp)(\/|$)/;

export function uiCsp(keycloakOrigin: string): string {
  return [
    "default-src 'self'", "script-src 'self'", "style-src 'self'", "img-src 'self' data:", "font-src 'self'",
    "connect-src 'self'", `form-action 'self' ${keycloakOrigin}`, "frame-ancestors 'none'", "base-uri 'self'", "object-src 'none'",
  ].join('; ');
}

/** Datei in `dist` zu einem Pfad der Anfrage; `null`, wenn es keine gibt oder der Pfad `dist` verliesse. */
export function resolveAsset(dist: string, urlPath: string): string | null {
  let p: string;
  try { p = decodeURIComponent(urlPath.split('?')[0]!); } catch { return null; }
  if (p.includes('\0') || p.includes('\\')) return null;
  const file = resolve(dist, `.${p}`);
  const rel = relative(dist, file);
  if (rel.startsWith('..') || isAbsolute(rel) || rel.split(sep).includes('..')) return null;
  if (!existsSync(file) || !statSync(file).isFile()) return null;
  // Symlinks dürfen dist nicht verlassen
  const real = realpathSync(file);
  if (!real.startsWith(realpathSync(dist) + sep)) return null;
  return real;
}

const HINT = `<!doctype html><html lang="de"><meta charset="utf-8"><title>PPM</title><body style="font-family:system-ui;margin:3rem">
<h1>Webapp nicht gebaut</h1><p>Die API läuft. Für die Oberfläche: <code>npm run web:build</code> und danach neu laden.</p>
<p><a href="/v1/docs">API-Dokumentation</a></p></body></html>`;

export function registerUi(app: FastifyInstance, deps: Deps): void {
  const dist = isAbsolute(deps.cfg.http.webDist) ? deps.cfg.http.webDist : join(ROOT, deps.cfg.http.webDist);
  const csp = uiCsp(new URL(deps.cfg.iam.oidc.issuer).origin);
  const prod = deps.cfg.mode === 'production';

  const send = (reply: FastifyReply, file: string, immutable: boolean) => reply
    .header('content-type', TYPES[extname(file)] ?? 'application/octet-stream')
    .header('cache-control', immutable ? 'public, max-age=31536000, immutable' : 'no-cache')
    .header('content-security-policy', csp)
    .header('x-content-type-options', 'nosniff')
    .send(createReadStream(file));

  const handler = async (req: import('fastify').FastifyRequest, reply: FastifyReply) => {
    const path = req.url.split('?')[0]!;
    if (NOT_UI.test(path)) throw new HttpError(404, 'Nicht gefunden');
    const index = join(dist, 'index.html');
    if (!existsSync(index)) {
      if (prod) throw new HttpError(503, 'Oberfläche nicht verfügbar');
      return reply.header('content-type', 'text/html; charset=utf-8').header('content-security-policy', "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'").send(HINT);
    }
    const file = path === '/' ? null : resolveAsset(dist, path);
    if (file) return send(reply, file, path.startsWith('/assets/'));
    // Unbekannte Dateien unter /assets/ sind echte 404 (kein index.html mit falschem Typ)
    if (path.startsWith('/assets/') || extname(path)) throw new HttpError(404, 'Nicht gefunden');
    return send(reply, index, false);
  };
  app.get('/', { schema: { hide: true } }, handler);
  app.get('/*', { schema: { hide: true } }, handler);
}
