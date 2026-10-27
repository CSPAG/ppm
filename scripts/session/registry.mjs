// Registry für @vollholz/* aus den Tarballs eines Ordners, mehrere Versionen je Paket (scripts/session/setup.sh).
import { createServer } from 'node:http';
import { readdirSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
const dir = process.argv[2], port = 4873, base = `http://127.0.0.1:${port}`;
const pk = new Map(), files = new Map();
for (const f of readdirSync(dir).filter(f => f.endsWith('.tgz'))) {
  const data = readFileSync(join(dir, f));
  const m = JSON.parse(execFileSync('tar', ['-xzOf', join(dir, f), 'package/package.json'], { encoding: 'utf8' }));
  files.set(f, data);
  const p = pk.get(m.name) ?? { name: m.name, 'dist-tags': {}, versions: {} };
  p.versions[m.version] = { ...m, dist: { tarball: `${base}/-/${f}`, integrity: 'sha512-' + createHash('sha512').update(data).digest('base64'), shasum: createHash('sha1').update(data).digest('hex') } };
  const vs = Object.keys(p.versions).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  p['dist-tags'].latest = vs.at(-1); pk.set(m.name, p);
}
const server = createServer((req, res) => {
  const path = decodeURIComponent((req.url ?? '/').split('?')[0]);
  // Ein neuer Lauf von setup.sh beendet die Registry eines früheren Laufs (nur lokal erreichbar)
  if (req.method === 'POST' && path === '/-/beenden') { res.end('{}'); server.close(); setImmediate(() => process.exit(0)); return; }
  if (path.startsWith('/-/') && files.has(path.slice(3))) { res.writeHead(200); return res.end(files.get(path.slice(3))); }
  const p = pk.get(path.slice(1));
  if (p) { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify(p)); }
  res.writeHead(404); res.end('{}');
}).listen(port, '127.0.0.1', () => console.log('Registry', [...pk.values()].map(p => p.name + '@' + Object.keys(p.versions).join('/')).join(', ')));
