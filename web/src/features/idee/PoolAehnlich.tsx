/**
 * Ähnliche eingereichte Ideen schon beim Ausfüllen (K4 Schritt 2, UC-001 Schritt 3; Master Entscheid 14, A-73): nach
 * Handlungsfeld oder gemeinsamen betroffenen Bereichen, als Hinweis (darstellung.md «Hinweis») mit aufklappbarer Liste.
 * Die Ideen öffnen in einem neuen Tab, damit der Assistent mit dem Entwurf offen bleibt. Ohne Treffer, beim Laden und
 * bei einem Fehler erscheint nichts: der Hinweis ist eine Hilfe, kein Teil des Ablaufs.
 */
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/index.ts';
import { Hinweis } from '../../ui/index.ts';
import { ideePfad } from './stand.tsx';
import { TI } from './texte.ts';

export function useAehnlicheIdeen(o: { handlungsfeldId: string | null; bereiche: string[]; ausser?: string }) {
  const aktiv = !!o.handlungsfeldId || o.bereiche.length > 0;
  return useQuery({
    queryKey: ['idee', 'aehnlich', o.handlungsfeldId, [...o.bereiche].sort(), o.ausser ?? null] as const,
    enabled: aktiv,
    staleTime: 60_000,
    queryFn: async ({ signal }) => (await api.GET('/v1/ideen/aehnlich', {
      params: { query: { handlungsfeldId: o.handlungsfeldId ?? undefined, bereich: o.bereiche.length ? o.bereiche : undefined, ausser: o.ausser } }, signal,
    })).data!.items,
  });
}

export function AehnlicheIdeen(p: { handlungsfeldId: string | null; bereiche: string[]; ausser?: string }) {
  const q = useAehnlicheIdeen(p);
  const items = q.data ?? [];
  if (!items.length) return null;
  return (
    <div className="idee-aehnlich" aria-live="polite">
      <Hinweis stufe="hinweis">
        <details>
          <summary>{TI.aehnlich.titel(items.length)}</summary>
          <p className="muted small">{TI.aehnlich.erklaerung}</p>
          <ul>
            {items.map(x => (
              <li key={x.idee.id}>
                <a href={ideePfad(x.idee.nummer)} target="_blank" rel="noreferrer">{x.idee.titel || TI.ohneTitel}</a>
                <span className="muted small"> · {TI.stand[x.idee.stand] ?? x.idee.stand}{x.gleichesHandlungsfeld ? ` · ${TI.aehnlich.gleichesFeld}` : ''}{x.gemeinsameBereiche ? ` · ${TI.aehnlich.bereiche(x.gemeinsameBereiche)}` : ''}</span>
              </li>
            ))}
          </ul>
        </details>
      </Hinweis>
    </div>
  );
}
