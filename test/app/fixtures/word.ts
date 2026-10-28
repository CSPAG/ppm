/**
 * Word-Vorlage (.docx) für Tests der Vorlagen (AP-E7-7): Absätze aus Läufen, damit Platzhalter wie in echten Dateien über
 * mehrere Läufe verteilt sein können (`[['«Projekt', 'name»']]`); optional mit Kopfzeile.
 */
import { zip } from '../../../src/modules/vorlage/zip.ts';

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const absatz = (laeufe: string[]) => `<w:p><w:pPr><w:pStyle w:val="Normal"/></w:pPr>${laeufe.map((t, i) => `<w:r>${i ? '<w:rPr><w:b/></w:rPr>' : ''}<w:t xml:space="preserve">${esc(t)}</w:t></w:r>`).join('')}</w:p>`;

export function wordVorlage(absaetze: string[][], kopfzeile?: string): Buffer {
  const rel = kopfzeile ? '<Relationship Id="rIdK" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>' : '';
  return zip([
    { name: '[Content_Types].xml', daten: '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>' },
    { name: '_rels/.rels', daten: '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>' },
    { name: 'word/_rels/document.xml.rels', daten: `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rel}</Relationships>` },
    { name: 'word/document.xml', daten: `<?xml version="1.0" encoding="UTF-8"?><w:document ${W}><w:body>${absaetze.map(absatz).join('')}<w:sectPr>${kopfzeile ? '<w:headerReference w:type="default" r:id="rIdK"/>' : ''}</w:sectPr></w:body></w:document>` },
    ...(kopfzeile ? [{ name: 'word/header1.xml', daten: `<?xml version="1.0" encoding="UTF-8"?><w:hdr ${W}>${absatz([kopfzeile])}</w:hdr>` }] : []),
  ]);
}
