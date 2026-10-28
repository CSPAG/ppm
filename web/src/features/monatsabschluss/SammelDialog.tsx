/**
 * Vorschau der Wirkung vor Aktionen, die auf andere wirken (I-R1 Stufe 3; K1 Prüfen Schritt 3, UC-005 Schritt 3 und A1):
 * Sammelbestätigung nennt, welche Berichte bestätigt und welche übersprungen werden (mit Auffälligkeit, A-28, oder in
 * anderem Stand); Einfordern nennt die Projekte, deren Projektleitung eine Erinnerung erhält. Erst der bewusste Klick
 * führt aus.
 */
import { Dialog, Hinweis, Icon } from '../../ui/index.ts';
import type { Zeile } from './api.ts';
import { TM } from './texte.ts';

export type Vorschau = { art: 'bestaetigen' | 'einfordern'; zeilen: Zeile[] };

export interface SammelDialogProps {
  vorschau: Vorschau;
  onClose(): void;
  /** Führt die Aktion aus; Sammelbestätigung mit allen eingereichten, damit der Server die auffälligen nennt (A-28). */
  ausfuehren(zeilen: Zeile[]): void;
  beschaeftigt: boolean;
}

/** Aufteilung wie der Server (`POST /v1/perioden/:periode/bestaetigen`): nur eingereichte ohne Auffälligkeit. */
export function aufteilen(zeilen: Zeile[]) {
  const moeglich = zeilen.filter(z => z.can.bestaetigen && z.stand === 'eingereicht');
  return {
    moeglich,
    ok: moeglich.filter(z => !z.auffaelligkeiten.length),
    auffaellig: moeglich.filter(z => z.auffaelligkeiten.length),
    stand: zeilen.filter(z => !moeglich.includes(z)),
  };
}

const Liste = ({ zeilen }: { zeilen: Zeile[] }) => (
  <ul className="ma-vorschau">
    {zeilen.map(z => <li key={z.projektId}><span className="mono">{z.projektNummer}</span> {z.projektName}</li>)}
  </ul>
);

export function SammelDialog({ vorschau, onClose, ausfuehren, beschaeftigt }: SammelDialogProps) {
  if (vorschau.art === 'einfordern') {
    const zs = vorschau.zeilen;
    return (
      <Dialog title={TM.vorschau.einfordernTitel(zs.length === 1 ? zs[0]!.projektNummer : null, zs.length)} onClose={onClose} footer={<>
        <button type="button" className="btn" onClick={onClose} data-autofocus>{TM.aktion.abbrechen}</button>
        <button type="button" className="btn primary" disabled={beschaeftigt} onClick={() => ausfuehren(zs)}>
          <Icon name="send" />{zs.length === 1 ? TM.aktion.einfordern : TM.aktion.sammelEinfordern(zs.length)}
        </button>
      </>}>
        <p>{TM.vorschau.einfordernWirkung(zs.length)}</p>
        <Liste zeilen={zs} />
      </Dialog>
    );
  }
  const t = aufteilen(vorschau.zeilen);
  return (
    <Dialog title={TM.vorschau.bestaetigenTitel(t.ok.length)} onClose={onClose} footer={<>
      <button type="button" className="btn" onClick={onClose} data-autofocus>{TM.aktion.abbrechen}</button>
      {t.ok.length ? (
        <button type="button" className="btn primary" disabled={beschaeftigt} onClick={() => ausfuehren(t.moeglich)}>
          <Icon name="check" />{TM.aktion.sammelBestaetigen(t.ok.length)}
        </button>
      ) : null}
    </>}>
      {t.ok.length ? (
        <>
          <p>{TM.vorschau.bestaetigenWirkung(t.ok.length)}</p>
          <Liste zeilen={t.ok} />
        </>
      ) : <Hinweis stufe="hinweis">{TM.vorschau.keinerOhneAuffaelligkeit}</Hinweis>}
      {t.auffaellig.length ? (
        <>
          <p>{TM.vorschau.uebersprungenAuffaellig(t.auffaellig.length)}</p>
          <Liste zeilen={t.auffaellig} />
        </>
      ) : null}
      {t.stand.length ? (
        <>
          <p>{TM.vorschau.uebersprungenStand(t.stand.length)}</p>
          <Liste zeilen={t.stand} />
        </>
      ) : null}
    </Dialog>
  );
}
