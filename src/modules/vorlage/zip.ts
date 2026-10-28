/**
 * Minimales ZIP (PKWARE APPNOTE 6.3, «deflate», ohne Zip64) für die Word-Ausgabe und hochgeladene Vorlagen; aus
 * `node:zlib`, ohne weitere Bibliothek. Feste Zeitangabe, damit dieselbe Eingabe dieselbe Datei ergibt.
 */
import { crc32, deflateRawSync, inflateRawSync } from 'node:zlib';

export interface Eintrag { name: string; daten: Buffer | string }

// 1.1.1980 00:00 im DOS-Format
const DOS_ZEIT = 0;
const DOS_DATUM = (0 << 9) | (1 << 5) | 1;

export function zip(eintraege: readonly Eintrag[]): Buffer {
  const lokal: Buffer[] = [];
  const zentral: Buffer[] = [];
  let offset = 0;
  for (const e of eintraege) {
    const name = Buffer.from(e.name, 'utf8');
    const roh = typeof e.daten === 'string' ? Buffer.from(e.daten, 'utf8') : e.daten;
    const gepackt = deflateRawSync(roh);
    const crc = crc32(roh);
    const kopf = Buffer.alloc(30);
    kopf.writeUInt32LE(0x04034b50, 0);
    kopf.writeUInt16LE(20, 4); // benötigte Version
    kopf.writeUInt16LE(0x0800, 6); // Namen in UTF-8
    kopf.writeUInt16LE(8, 8); // deflate
    kopf.writeUInt16LE(DOS_ZEIT, 10);
    kopf.writeUInt16LE(DOS_DATUM, 12);
    kopf.writeUInt32LE(crc, 14);
    kopf.writeUInt32LE(gepackt.length, 18);
    kopf.writeUInt32LE(roh.length, 22);
    kopf.writeUInt16LE(name.length, 26);
    kopf.writeUInt16LE(0, 28);
    lokal.push(kopf, name, gepackt);

    const z = Buffer.alloc(46);
    z.writeUInt32LE(0x02014b50, 0);
    z.writeUInt16LE(20, 4);
    z.writeUInt16LE(20, 6);
    z.writeUInt16LE(0x0800, 8);
    z.writeUInt16LE(8, 10);
    z.writeUInt16LE(DOS_ZEIT, 12);
    z.writeUInt16LE(DOS_DATUM, 14);
    z.writeUInt32LE(crc, 16);
    z.writeUInt32LE(gepackt.length, 20);
    z.writeUInt32LE(roh.length, 24);
    z.writeUInt16LE(name.length, 28);
    z.writeUInt32LE(offset, 42);
    zentral.push(z, name);
    offset += kopf.length + name.length + gepackt.length;
  }
  const zentralLaenge = zentral.reduce((s, b) => s + b.length, 0);
  const ende = Buffer.alloc(22);
  ende.writeUInt32LE(0x06054b50, 0);
  ende.writeUInt16LE(eintraege.length, 8);
  ende.writeUInt16LE(eintraege.length, 10);
  ende.writeUInt32LE(zentralLaenge, 12);
  ende.writeUInt32LE(offset, 16);
  return Buffer.concat([...lokal, ...zentral, ende]);
}

/** Grenzen beim Entpacken hochgeladener Dateien (Schutz vor «Zip-Bomben»). */
const MAX_EINTRAEGE = 2000;
const MAX_ENTPACKT = 50 * 1024 * 1024;

export class ZipFehler extends Error {}

/**
 * ZIP lesen (zentrales Verzeichnis; «stored» und «deflate»). Wirft `ZipFehler` bei ungültiger Datei, Verschlüsselung,
 * Zip64 oder zu grossem Inhalt.
 */
export function entpacken(b: Buffer): Eintrag[] {
  // Ende des zentralen Verzeichnisses: höchstens 64 KB Kommentar am Ende
  let ende = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 22 - 0xffff); i--) {
    if (b.readUInt32LE(i) === 0x06054b50) { ende = i; break; }
  }
  if (ende < 0) throw new ZipFehler('Keine ZIP-Datei.');
  const anzahl = b.readUInt16LE(ende + 10);
  let p = b.readUInt32LE(ende + 16);
  if (anzahl > MAX_EINTRAEGE || p >= b.length) throw new ZipFehler('Ungültiges Verzeichnis.');
  const out: Eintrag[] = [];
  let summe = 0;
  for (let n = 0; n < anzahl; n++) {
    if (p + 46 > b.length || b.readUInt32LE(p) !== 0x02014b50) throw new ZipFehler('Ungültiges Verzeichnis.');
    const flags = b.readUInt16LE(p + 8), methode = b.readUInt16LE(p + 10);
    const gepackt = b.readUInt32LE(p + 20), roh = b.readUInt32LE(p + 24);
    const nameLen = b.readUInt16LE(p + 28), extra = b.readUInt16LE(p + 30), kommentar = b.readUInt16LE(p + 32);
    const lokal = b.readUInt32LE(p + 42);
    const name = b.subarray(p + 46, p + 46 + nameLen).toString(flags & 0x0800 ? 'utf8' : 'latin1');
    p += 46 + nameLen + extra + kommentar;
    if (flags & 0x1) throw new ZipFehler('Verschlüsselte Dateien werden nicht unterstützt.');
    if (gepackt === 0xffffffff || roh === 0xffffffff) throw new ZipFehler('Zip64 wird nicht unterstützt.');
    summe += roh;
    if (summe > MAX_ENTPACKT) throw new ZipFehler('Inhalt zu gross.');
    if (lokal + 30 > b.length || b.readUInt32LE(lokal) !== 0x04034b50) throw new ZipFehler('Ungültiger Eintrag.');
    const start = lokal + 30 + b.readUInt16LE(lokal + 26) + b.readUInt16LE(lokal + 28);
    const daten = b.subarray(start, start + gepackt);
    if (daten.length !== gepackt) throw new ZipFehler('Ungültiger Eintrag.');
    let inhalt: Buffer;
    if (methode === 0) inhalt = Buffer.from(daten);
    else if (methode === 8) {
      try { inhalt = inflateRawSync(daten, { maxOutputLength: roh + 1 }); } catch { throw new ZipFehler('Eintrag lässt sich nicht entpacken.'); }
    } else throw new ZipFehler(`Kompression ${methode} wird nicht unterstützt.`);
    if (inhalt.length !== roh) throw new ZipFehler('Ungültige Grösse.');
    if (!name.endsWith('/')) out.push({ name, daten: inhalt });
  }
  return out;
}
