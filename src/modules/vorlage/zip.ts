/**
 * Minimales ZIP (PKWARE APPNOTE 6.3, «deflate», ohne Zip64) für die Word-Ausgabe; aus `node:zlib`, ohne weitere
 * Bibliothek. Feste Zeitangabe, damit dieselbe Eingabe dieselbe Datei ergibt.
 */
import { crc32, deflateRawSync } from 'node:zlib';

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
