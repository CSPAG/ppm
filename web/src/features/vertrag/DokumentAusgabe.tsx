/**
 * Dokumentausgabe einer Vertragsversion (DM.02.07; UC-002 Schritt 12; K2 Schritt 11, UI-11): «Als Dokument
 * herunterladen» als PDF oder Word im Layout der Vorlage. Die Datei kommt über den typisierten Client (gleiche Herkunft,
 * Organisation im Kopf der Anfrage) und wird im Browser gespeichert. Der Hinweis auf Personendaten steht neben der
 * Aktion (G12). Einbau in die Versionen der Projektakte mit AP-E3-1 (Oberfläche).
 */
import { describeError } from '@vollholz/iam-web';
import { useId, useState } from 'react';
import { api } from '../../api/index.ts';
import { Hinweis, Icon } from '../../ui/index.ts';
import { TD } from './DokumentTexte.ts';
import './Dokument.css';

type Format = 'pdf' | 'docx';

/** Dateiname aus `Content-Disposition` (Rückfall: Version). */
const dateiname = (r: Response, nummer: string, format: Format) =>
  /filename="([^"]+)"/.exec(r.headers.get('content-disposition') ?? '')?.[1] ?? `Projektvertrag-v${nummer}.${format}`;

function speichern(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function DokumentAusgabe({ versionId, nummer }: { versionId: string; nummer: string }) {
  const id = useId();
  const [laeuft, setLaeuft] = useState<Format | null>(null);
  const [meldung, setMeldung] = useState<{ ok: boolean; text: string } | null>(null);

  const laden = async (format: Format) => {
    setLaeuft(format);
    setMeldung(null);
    try {
      const { data, response } = await api.GET('/v1/vertragsversionen/{id}/dokument', { params: { path: { id: versionId }, query: { format } }, parseAs: 'blob' });
      const name = dateiname(response, nummer, format);
      speichern(data as unknown as Blob, name);
      setMeldung({ ok: true, text: TD.bereit(name) });
    } catch (e) {
      const d = describeError(e);
      setMeldung({ ok: false, text: d.detail || d.title || TD.fehler });
    } finally {
      setLaeuft(null);
    }
  };

  return (
    <div className="dokument-ausgabe" role="group" aria-labelledby={`${id}-t`} aria-describedby={`${id}-h`}>
      <span id={`${id}-t`} className="dokument-t"><Icon name="download" /> {TD.aktion}</span>
      <div className="dokument-acts">
        <button type="button" className="btn sm" onClick={() => void laden('pdf')} disabled={laeuft !== null} aria-label={TD.pdfLang(nummer)}>{TD.pdf}</button>
        <button type="button" className="btn sm" onClick={() => void laden('docx')} disabled={laeuft !== null} aria-label={TD.wordLang(nummer)}>{TD.word}</button>
      </div>
      <p id={`${id}-h`} className="muted small">{TD.personendaten}</p>
      <div role="status" aria-live="polite" className="small">
        {laeuft ? TD.wirdErstellt : meldung?.ok ? meldung.text : null}
      </div>
      {meldung && !meldung.ok ? <Hinweis stufe="sperre" live>{meldung.text}</Hinweis> : null}
    </div>
  );
}
