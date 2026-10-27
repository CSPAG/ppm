/**
 * Word-Ausgabe (Office Open XML, ECMA-376) des Dokumentmodells: Formatvorlagen «Titel», «Überschrift 1/2» (mit
 * Gliederungsebene für das Inhaltsverzeichnis in Word), Tabellen mit Rahmen, Kopfzeile (G12) und Fusszeile mit «Seite n
 * von m» als Felder. Ohne Fremdbibliothek; das Paket schreibt `zip.ts`.
 */
import type { Block, Dokument } from './modell.ts';
import { zip } from './zip.ts';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  // Steuerzeichen sind in XML 1.0 nicht erlaubt
  // eslint-disable-next-line no-control-regex
  .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

/** Lauf mit Text; Zeilenumbrüche als `<w:br/>`. */
function lauf(text: string, o: { fett?: boolean; kursiv?: boolean } = {}): string {
  const rpr = o.fett || o.kursiv ? `<w:rPr>${o.fett ? '<w:b/>' : ''}${o.kursiv ? '<w:i/>' : ''}</w:rPr>` : '';
  return text.split('\n').map((t, i) => `<w:r>${rpr}${i ? '<w:br/>' : ''}<w:t xml:space="preserve">${esc(t)}</w:t></w:r>`).join('');
}

const absatz = (inhalt: string, stil?: string) => `<w:p>${stil ? `<w:pPr><w:pStyle w:val="${stil}"/></w:pPr>` : ''}${inhalt}</w:p>`;

/** Satzspiegel A4 hochkant mit 2 cm Rand: 11906 × 16838 Twips, nutzbar 9638 Twips. */
const BREITE = 9638;

function tabelle(kopf: readonly string[] | null, zeilen: readonly (readonly string[])[], anteile: readonly number[]): string {
  const summe = anteile.reduce((s, x) => s + x, 0);
  const breiten = anteile.map(a => Math.round((a / summe) * BREITE));
  const zelle = (t: string, w: number, fett: boolean) =>
    `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${fett ? '<w:shd w:val="clear" w:color="auto" w:fill="EDEDED"/>' : ''}</w:tcPr>${absatz(lauf(t, { fett }), 'Tabelle')}</w:tc>`;
  const zeile = (z: readonly string[], fett: boolean, kopfzeile: boolean) =>
    `<w:tr>${kopfzeile ? '<w:trPr><w:tblHeader/></w:trPr>' : ''}${z.map((t, i) => zelle(t, breiten[i] ?? 0, fett || (!kopf && i === 0))).join('')}</w:tr>`;
  const rahmen = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(s => `<w:${s} w:val="single" w:sz="4" w:space="0" w:color="999999"/>`).join('');
  return `<w:tbl><w:tblPr><w:tblW w:w="${BREITE}" w:type="dxa"/><w:tblBorders>${rahmen}</w:tblBorders><w:tblLayout w:type="fixed"/>`
    + `<w:tblCellMar><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr>`
    + `<w:tblGrid>${breiten.map(w => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>`
    + (kopf ? zeile(kopf, true, true) : '') + zeilen.map(z => zeile(z, false, false)).join('') + '</w:tbl>' + absatz('');
}

function block(b: Block): string {
  switch (b.art) {
    case 'titel': return absatz(lauf(b.text), 'Title') + (b.untertitel ? absatz(lauf(b.untertitel), 'Subtitle') : '');
    case 'ueberschrift': return absatz(lauf(b.text), b.ebene === 1 ? 'Heading1' : 'Heading2');
    case 'absatz': return b.text.trim() ? absatz(lauf(b.text)) : absatz(lauf(b.leer ?? '–', { kursiv: true }), 'Leer');
    case 'felder': return tabelle(null, b.zeilen, [3, 7]);
    case 'tabelle': return b.zeilen.length
      ? tabelle(b.kopf, b.zeilen, b.breiten ?? b.kopf.map(() => 1))
      : absatz(lauf(b.leer ?? '–', { kursiv: true }), 'Leer');
  }
}

const feld = (code: string) =>
  `<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> ${code} </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>`;

const STILE = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles ${W}>
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="20"/><w:lang w:val="de-CH"/></w:rPr></w:rPrDefault>
<w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="1200" w:after="240"/></w:pPr><w:rPr><w:b/><w:sz w:val="44"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="480"/></w:pPr><w:rPr><w:sz w:val="28"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="360" w:after="120"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="80"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="22"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Tabelle"><w:name w:val="Tabelle"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="40" w:after="40"/></w:pPr><w:rPr><w:sz w:val="18"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Leer"><w:name w:val="Leer"/><w:basedOn w:val="Normal"/><w:rPr><w:i/><w:color w:val="666666"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Kopf"><w:name w:val="Kopf"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="0"/></w:pPr><w:rPr><w:sz w:val="16"/><w:color w:val="444444"/></w:rPr></w:style>
</w:styles>`;

/** Word-Datei (.docx) des Dokuments. */
export function docx(d: Dokument): Buffer {
  const body = d.bloecke.map(block).join('');
  const sect = '<w:sectPr><w:headerReference w:type="default" r:id="rIdKopf"/><w:footerReference w:type="default" r:id="rIdFuss"/>'
    + '<w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1418" w:right="1134" w:bottom="1418" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr>';
  const dokument = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document ${W}><w:body>${body}${sect}</w:body></w:document>`;
  const kopf = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:hdr ${W}>${absatz(lauf(d.kopfzeile, { fett: true }), 'Kopf')}</w:hdr>`;
  const fuss = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:ftr ${W}><w:p><w:pPr><w:pStyle w:val="Kopf"/></w:pPr>`
    + `${lauf(`${d.fusszeile} · Seite `)}${feld('PAGE')}${lauf(' von ')}${feld('NUMPAGES')}</w:p></w:ftr>`;
  const rel = (id: string, typ: string, ziel: string) => `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${typ}" Target="${ziel}"/>`;
  const rels = (inhalt: string) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${inhalt}</Relationships>`;
  const ct = (teil: string, typ: string) => `<Override PartName="${teil}" ContentType="application/vnd.openxmlformats-officedocument.${typ}"/>`;
  return zip([
    { name: '[Content_Types].xml', daten: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`
      + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>'
      + ct('/word/document.xml', 'wordprocessingml.document.main+xml') + ct('/word/styles.xml', 'wordprocessingml.styles+xml')
      + ct('/word/header1.xml', 'wordprocessingml.header+xml') + ct('/word/footer1.xml', 'wordprocessingml.footer+xml')
      + '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>' },
    { name: '_rels/.rels', daten: rels(rel('rId1', 'officeDocument', 'word/document.xml')
      + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>') },
    { name: 'docProps/core.xml', daten: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/">`
      + `<dc:title>${esc(d.titel)}</dc:title><dc:language>de-CH</dc:language><cp:keywords>${esc(d.kopfzeile)}</cp:keywords></cp:coreProperties>` },
    { name: 'word/_rels/document.xml.rels', daten: rels(rel('rIdStile', 'styles', 'styles.xml') + rel('rIdKopf', 'header', 'header1.xml') + rel('rIdFuss', 'footer', 'footer1.xml')) },
    { name: 'word/document.xml', daten: dokument },
    { name: 'word/styles.xml', daten: STILE },
    { name: 'word/header1.xml', daten: kopf },
    { name: 'word/footer1.xml', daten: fuss },
  ]);
}
