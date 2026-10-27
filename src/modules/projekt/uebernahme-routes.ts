/**
 * Route der Übernahme aus dem Excel-Dashboard (AP-E0-7; K16, A-14; fachmodell.md 5: `POST /projekte/uebernahme`, Datei,
 * Prüflauf ohne Speichern). Einmalige Einrichtung an der Organisation: Projekte anlegen und ändern, Projektorganisation
 * festlegen und die Rechte der registrierten Beiträge (z. B. Bericht der Vorperiode).
 */
import { Type, type Static } from '@sinclair/typebox';
import type { FastifyInstance } from 'fastify';
import { actorOf, HttpError, IdempotencyHeaders, type Deps } from '@vollholz/platform';
import { rechteDerTeile, uebernehmen, type Fehler, type ZeileErgebnis } from './uebernahme.ts';

const TAG = 'Projekte';

const FehlerT = Type.Object({ spalte: Type.Union([Type.String(), Type.Null()]), text: Type.String() }, { additionalProperties: false });

export const UebernahmeIn = Type.Object({
  csv: Type.String({ minLength: 1, maxLength: 2_000_000, description: 'Dashboard als CSV (Excel «CSV UTF-8», Trennzeichen `;` oder `,`), Spalten nach `scripts/uebernahme/vorlage.csv`.' }),
  portfolio: Type.String({ minLength: 1, maxLength: 40, description: 'Schlüssel des Portfolios aller Zeilen, z. B. `transformation`.' }),
  periode: Type.Optional(Type.String({ pattern: '^[0-9]{4}-(0[1-9]|1[0-2])$', description: 'Periode der übernommenen Werte (Status, Trend): Vorperiode des ersten Berichts. Ohne Angabe der Vormonat.' })),
  speichern: Type.Boolean({ description: '`false`: Prüflauf, nichts wird gespeichert. `true`: speichern, nur wenn keine Zeile einen Fehler hat (sonst 422 mit dem Ergebnis).' }),
}, { $id: 'UebernahmeIn', additionalProperties: false });

export const UebernahmeErgebnis = Type.Object({
  gespeichert: Type.Boolean(),
  periode: Type.String(),
  kopf: Type.Array(FehlerT, { description: 'Fehler der ganzen Datei (Kopfzeile, Portfolio).' }),
  zeilen: Type.Array(Type.Object({
    zeile: Type.Integer({ description: 'Zeilennummer in der Datei (Kopf = 1).' }),
    index: Type.String(), name: Type.String(),
    nummer: Type.Union([Type.String(), Type.Null()], { description: 'Projektnummer beim Speichern bzw. die vorgesehene im Prüflauf.' }),
    fehler: Type.Array(FehlerT),
  }, { additionalProperties: false })),
  anzahl: Type.Object({ zeilen: Type.Integer(), fehlerhaft: Type.Integer() }, { additionalProperties: false }),
}, { $id: 'UebernahmeErgebnis', additionalProperties: false });
type Ergebnis = Static<typeof UebernahmeErgebnis>;

/** Vormonat in der Zeitzone der Organisation (Europe/Zurich). */
function vormonat(jetzt = new Date()): string {
  const [j, m] = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zurich', year: 'numeric', month: '2-digit' }).format(jetzt).split('-').map(Number) as [number, number];
  return m === 1 ? `${j - 1}-12` : `${j}-${String(m - 1).padStart(2, '0')}`;
}

/** Ergebnis, das die Transaktion zurücksetzt (Prüflauf oder Fehler beim Speichern). */
class Zurueck extends Error {
  readonly ergebnis: { kopf: Fehler[]; zeilen: ZeileErgebnis[] };
  constructor(ergebnis: { kopf: Fehler[]; zeilen: ZeileErgebnis[] }) { super('zurück'); this.ergebnis = ergebnis; }
}

export function registerUebernahmeRoutes(app: FastifyInstance, deps: Deps): void {
  for (const s of [UebernahmeIn, UebernahmeErgebnis]) app.addSchema(s);

  app.post('/v1/projekte/uebernahme', {
    schema: {
      tags: [TAG], summary: 'Projekte aus dem Excel-Dashboard übernehmen',
      description: 'Einmalige Übernahme der laufenden Projekte (K16, A-14): je Zeile Projekt mit Nummer, Phase, Handlungsfeld, Projektleitung, dazu die Beiträge der Module (Bericht der Vorperiode mit Status und Trend, nächster Meilenstein). Prüflauf mit `speichern: false` meldet Fehler je Zeile und speichert nichts; mit `speichern: true` wird nur ohne Fehler gespeichert (alles oder nichts). Rechte an der Organisation: `projekt:create`, `projekt:write`, `projekt:organisation` und die der Beiträge (`statusbericht:write`).',
      headers: IdempotencyHeaders, body: Type.Ref('UebernahmeIn'), response: { 200: Type.Ref('UebernahmeErgebnis') },
    },
  }, async req => {
    for (const r of new Set(['projekt:create', 'projekt:write', 'projekt:organisation', ...rechteDerTeile()])) await req.need(r);
    const body = req.body as Static<typeof UebernahmeIn>;
    const p = req.requirePrincipal();
    const periode = body.periode ?? vormonat();
    const ctx = { db: deps.db, tenantId: p.tenantId, tuples: deps.iam.tuples, who: actorOf(req), principalId: p.principalId };
    let e: { kopf: Fehler[]; zeilen: ZeileErgebnis[] };
    let gespeichert = false;
    try {
      e = await req.tx(async tx => {
        const r = await uebernehmen(tx, ctx, { csv: body.csv, portfolio: body.portfolio, periode });
        const fehlerhaft = r.kopf.length > 0 || r.zeilen.some(z => z.fehler.length);
        if (!body.speichern || fehlerhaft || !r.zeilen.length) throw new Zurueck(r);
        return r;
      });
      gespeichert = true;
    } catch (x) {
      if (!(x instanceof Zurueck)) throw x;
      e = x.ergebnis;
    }
    const out: Ergebnis = {
      gespeichert, periode, kopf: e.kopf, zeilen: e.zeilen,
      anzahl: { zeilen: e.zeilen.length, fehlerhaft: e.zeilen.filter(z => z.fehler.length).length },
    };
    if (body.speichern && !gespeichert) {
      throw new HttpError(422, 'Übernahme nicht gespeichert', 'Die Datei enthält Fehler oder keine Zeilen. Korrigieren Sie die gemeldeten Zeilen und prüfen Sie erneut; gespeichert wird nur eine fehlerfreie Datei.', {}, out);
    }
    return out;
  });
}
