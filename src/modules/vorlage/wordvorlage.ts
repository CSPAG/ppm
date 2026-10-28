/**
 * Hochgeladene Word-Vorlagen (.docx; UC-018 Schritt 2): Platzhalter lesen und mit den Werten der Dokumentausgabe füllen.
 * Platzhalter stehen wie in den Vorlagen des PM-Handbuchs in Guillemets: «Projektname» (Q7). Word teilt Text oft auf
 * mehrere Läufe auf; gelesen und ersetzt wird darum je Absatz über den ganzen Text. Ein Absatz mit Platzhalter behält die
 * Formatierung seines ersten Laufs. Gelesen werden Haupttext, Kopf- und Fusszeilen.
 */
import { entpacken, zip, ZipFehler, type Eintrag } from './zip.ts';

export class VorlageFehler extends Error {}

/** Teile mit Text, in denen Platzhalter stehen können. */
const TEIL = /^word\/(document|header\d*|footer\d*)\.xml$/;
const PLATZHALTER = /«([^«»\r\n]{1,80})»/g;
const ABSATZ = /<w:p[ >][\s\S]*?<\/w:p>/g;
const TEXT = /(<w:t(?: [^>]*)?>)([\s\S]*?)(<\/w:t>)/g;

const unesc = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  // eslint-disable-next-line no-control-regex -- Steuerzeichen sind in XML 1.0 nicht erlaubt
  .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');

const absatzText = (p: string) => [...p.matchAll(TEXT)].map(m => unesc(m[2]!)).join('');

function teile(datei: Buffer): Eintrag[] {
  let eintraege: Eintrag[];
  try { eintraege = entpacken(datei); } catch (e) {
    throw new VorlageFehler(e instanceof ZipFehler ? `Die Datei ist keine gültige Word-Datei (${e.message})` : 'Die Datei ist keine gültige Word-Datei.');
  }
  if (!eintraege.some(e => e.name === 'word/document.xml') || !eintraege.some(e => e.name === '[Content_Types].xml')) {
    throw new VorlageFehler('Die Datei ist keine Word-Datei (.docx): word/document.xml fehlt.');
  }
  if (eintraege.some(e => /vbaProject\.bin$/i.test(e.name))) throw new VorlageFehler('Vorlagen mit Makros (.docm) sind nicht erlaubt.');
  return eintraege;
}

export interface Gelesen {
  /** Platzhalter in der Reihenfolge des ersten Vorkommens, ohne Guillemets. */
  platzhalter: string[];
  /** Ganzer Text der Vorlage (für Hinweise, z. B. Kennzeichnung der Personendaten, G12). */
  text: string;
}

/** Word-Datei prüfen und ihre Platzhalter lesen; `VorlageFehler`, wenn sie keine gültige .docx ist. */
export function lesen(datei: Buffer): Gelesen {
  const gefunden: string[] = [];
  const texte: string[] = [];
  for (const e of teile(datei).filter(x => TEIL.test(x.name))) {
    for (const m of e.daten.toString('utf8').matchAll(ABSATZ)) {
      const t = absatzText(m[0]);
      texte.push(t);
      for (const p of t.matchAll(PLATZHALTER)) {
        const name = p[1]!.trim();
        if (name && !gefunden.includes(name)) gefunden.push(name);
      }
    }
  }
  return { platzhalter: gefunden, text: texte.join('\n') };
}

/** Absatz mit ersetztem Text: der ganze Text im ersten Textelement, die übrigen leer; Zeilenumbrüche als `<w:br/>`. */
function absatzErsetzen(p: string, werte: ReadonlyMap<string, string>): string {
  const alt = absatzText(p);
  if (!alt.includes('«')) return p;
  const neu = alt.replace(PLATZHALTER, (ganz, name: string) => werte.get(name.trim()) ?? ganz);
  if (neu === alt) return p;
  let erstes = true;
  return p.replace(TEXT, (_m, auf: string, _inhalt: string, zu: string) => {
    if (!erstes) return `${auf}${zu}`;
    erstes = false;
    const oeffnen = auf.includes('xml:space') ? auf : auf.replace('<w:t', '<w:t xml:space="preserve"');
    return oeffnen + neu.split('\n').map(esc).join(`${zu}<w:br/>${oeffnen}`) + zu;
  });
}

/**
 * Vorlage füllen: jeder zugeordnete Platzhalter erhält seinen Wert (`werte`: Platzhalter → Text); Platzhalter ohne Wert
 * bleiben stehen. Liefert die neue Word-Datei.
 */
export function fuellen(datei: Buffer, werte: ReadonlyMap<string, string>): Buffer {
  return zip(teile(datei).map(e => (TEIL.test(e.name)
    ? { name: e.name, daten: e.daten.toString('utf8').replace(ABSATZ, p => absatzErsetzen(p, werte)) }
    : e)));
}
