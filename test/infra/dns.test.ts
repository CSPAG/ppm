// Abgleich der DNS-Einträge bei Infomaniak (infra/dns, übernommen aus vollholz/identity): Planung ohne API und Ausführung gegen eine nachgebildete API.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execute, InfomaniakDns, normalizeValue, parseDesired, pending, plan, relativeName, type DesiredState, type Existing } from '../../infra/dns/dns.ts';

const soll: DesiredState = {
  zone: 'project-suite.ch',
  records: [
    { name: 'ppm', type: 'A', value: '203.0.113.10', ttl: 3600 },
    { name: 'ppm', type: 'AAAA', value: '2001:db8:1::1', ttl: 3600 },
    { name: 'ppm', type: 'CAA', value: '0 issue "letsencrypt.org"', ttl: 3600 },
  ],
};

const fremd: Existing[] = [
  { id: 1, source: '.', type: 'A', target: '198.51.100.1', ttl: 3600 },
  { id: 2, source: 'www', type: 'CNAME', target: 'project-suite.ch', ttl: 3600 },
  { id: 3, source: '.', type: 'MX', target: 'mta.example.ch', ttl: 3600 },
  { id: 4, source: 'ppm', type: 'TXT', target: '"v=fremd"', ttl: 300 },
];

test('Namen relativ zur Zone und Werte vergleichbar', () => {
  assert.equal(relativeName('ppm.project-suite.ch.', 'project-suite.ch'), 'ppm');
  assert.equal(relativeName('.', 'project-suite.ch'), '@');
  assert.equal(relativeName('project-suite.ch', 'project-suite.ch'), '@');
  assert.equal(normalizeValue('AAAA', '2001:0db8:0001:0000:0000:0000:0000:0001'), '2001:db8:1::1');
  assert.equal(normalizeValue('CAA', '0 issue letsencrypt.org'), '0 issue "letsencrypt.org"');
  assert.equal(normalizeValue('CAA', '0  ISSUE "letsencrypt.org"'), '0 issue "letsencrypt.org"');
});

test('leere Zone: alles anlegen, fremde Einträge bleiben unberührt', () => {
  const p = plan(soll, fremd);
  assert.deepEqual(p.conflicts, []);
  assert.deepEqual(p.changes.map(c => c.op), ['create', 'create', 'create']);
  assert.ok(!p.changes.some(c => c.op !== 'create' && [1, 2, 3, 4].includes(c.id)));
});

test('idempotent: gleicher Stand ergibt keine Änderung (auch mit anderer Schreibweise)', () => {
  const ist: Existing[] = [...fremd,
    { id: 10, source: 'ppm', type: 'A', target: '203.0.113.10', ttl: 3600 },
    { id: 11, source: 'ppm.project-suite.ch', type: 'AAAA', target: '2001:db8:1:0::1', ttl: 3600 },
    { id: 12, source: 'ppm', type: 'CAA', target: '0 issue letsencrypt.org', ttl: 3600 },
  ];
  assert.equal(pending(plan(soll, ist)).length, 0);
});

test('abweichende Adresse und TTL werden geändert, überzählige gelöscht', () => {
  const ist: Existing[] = [...fremd,
    { id: 10, source: 'ppm', type: 'A', target: '192.0.2.99', ttl: 3600 },
    { id: 13, source: 'ppm', type: 'A', target: '192.0.2.98', ttl: 3600 },
    { id: 11, source: 'ppm', type: 'AAAA', target: '2001:db8:1::1', ttl: 300 },
  ];
  const ops = pending(plan(soll, ist)).map(c => `${c.op}:${'id' in c ? c.id : '-'}`).sort();
  assert.deepEqual(ops, ['create:-', 'delete:13', 'update:10', 'update:11']);
});

test('www vor dem Host ist ein eigener Name: ppm-Einträge bleiben, www.ppm wird angelegt', () => {
  const mitWww: DesiredState = { ...soll, records: [...soll.records, ...soll.records.map(r => ({ ...r, name: 'www.ppm' }))] };
  assert.equal(relativeName('www.ppm.project-suite.ch.', 'project-suite.ch'), 'www.ppm');
  const ist: Existing[] = [...fremd,
    { id: 10, source: 'ppm', type: 'A', target: '203.0.113.10', ttl: 3600 },
    { id: 11, source: 'ppm', type: 'AAAA', target: '2001:db8:1::1', ttl: 3600 },
    { id: 12, source: 'ppm', type: 'CAA', target: '0 issue "letsencrypt.org"', ttl: 3600 },
  ];
  const p = plan(mitWww, ist);
  assert.deepEqual(p.conflicts, []);
  assert.deepEqual(pending(p).map(c => c.op === 'create' ? `${c.rec.name} ${c.rec.type}` : c.op), ['www.ppm A', 'www.ppm AAAA', 'www.ppm CAA']);
});

test('CNAME unter verwaltetem Namen ist ein Konflikt', () => {
  const p = plan(soll, [{ id: 20, source: 'ppm', type: 'CNAME', target: 'x.example.ch', ttl: 3600 }]);
  assert.equal(p.conflicts.length, 1);
});

test('Soll-Liste wird geprüft: kein Apex, nur A/AAAA/CAA, gültige Werte', () => {
  assert.throws(() => plan({ zone: 'project-suite.ch', records: [{ name: '@', type: 'A', value: '203.0.113.1', ttl: 3600 }] }, []), /ungültiger Name/);
  assert.throws(() => plan({ zone: 'project-suite.ch', records: [{ name: 'ppm', type: 'MX' as 'A', value: 'x', ttl: 3600 }] }, []), /Typ nicht erlaubt/);
  assert.throws(() => plan({ zone: 'project-suite.ch', records: [{ name: 'ppm', type: 'A', value: '2001:db8::1', ttl: 3600 }] }, []), /IPv4/);
  assert.throws(() => plan({ zone: 'project-suite.ch', records: [{ name: 'ppm', type: 'A', value: '203.0.113.1', ttl: 30 }] }, []), /TTL/);
});

test('tofu output -json (mit und ohne «value») wird gelesen', () => {
  const s = parseDesired(JSON.stringify({ sensitive: false, type: 'object', value: soll }));
  assert.equal(s.zone, 'project-suite.ch');
  assert.equal(s.records.length, 3);
  assert.equal(parseDesired(JSON.stringify(soll)).records[0]!.type, 'A');
});

test('Ausführung gegen nachgebildete API: anlegen, ändern, löschen; Token nur im Header', async () => {
  const records: Array<Record<string, unknown>> = [
    { id: 1, source: '.', type: 'A', target: '198.51.100.1', ttl: 3600 },
    { id: 10, source: 'ppm', type: 'A', target: '192.0.2.99', ttl: 3600 },
    { id: 13, source: 'ppm', type: 'A', target: '192.0.2.98', ttl: 3600 },
  ];
  let next = 100;
  const calls: string[] = [];
  const fake = async (url: string, init: { method: string; headers: Record<string, string>; body?: string }) => {
    assert.equal(init.headers.Authorization, 'Bearer geheim');
    assert.ok(!url.includes('geheim'));
    const u = new URL(url);
    calls.push(`${init.method} ${u.pathname}`);
    const id = Number(u.pathname.split('/').pop());
    const ok = (data: unknown, extra = {}) => ({ status: 200, json: async () => ({ result: 'success', data, ...extra }) });
    if (init.method === 'GET') return ok(records.map(r => ({ ...r })), { pages: 1 });
    if (init.method === 'POST') { const b = JSON.parse(init.body!); records.push({ id: next++, ...b }); return ok(true); }
    const i = records.findIndex(r => r.id === id);
    if (i < 0) return { status: 404, json: async () => ({ result: 'error', error: { code: 'not_found' } }) };
    if (init.method === 'PUT') { Object.assign(records[i]!, JSON.parse(init.body!)); return ok(true); }
    records.splice(i, 1); return ok(true);
  };
  const api = new InfomaniakDns('geheim', { fetch: fake });
  const p = plan(soll, await api.list(soll.zone));
  await execute(api, soll.zone, p, () => {});
  assert.equal(pending(plan(soll, await api.list(soll.zone))).length, 0);
  assert.ok(records.some(r => r.id === 1), 'fremder Eintrag bleibt');
  assert.equal(calls.filter(c => c.startsWith('DELETE')).length, 1);
  assert.ok(calls.findIndex(c => c.startsWith('DELETE')) > calls.findIndex(c => c.startsWith('POST')), 'erst anlegen, dann löschen');
});

test('Fehler der API werden ohne Token gemeldet', async () => {
  const api = new InfomaniakDns('geheim', { fetch: async () => ({ status: 401, json: async () => ({ result: 'error', error: { code: 'not_authorized', description: 'Token ungültig' } }) }) });
  await assert.rejects(api.list('project-suite.ch'), (e: Error) => /HTTP 401 not_authorized/.test(e.message) && !e.message.includes('geheim'));
});
