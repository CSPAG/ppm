/**
 * Weiter ohne Vermerk im Reiter «Vertrag» (UC-002 A7, UC-003 A7; UX-E12, A-74): offene Vermerke am Projekt und an den
 * Versionen («Quality-Check offen», «Unterschrift offen», «ohne Gate-Entscheid»), dazu «Dem Gremium vorlegen» und
 * «Phase … beginnen». Vor dem Klick nennt ein Dialog, was dann fehlt (I-R1 Stufe 3); die Aufgaben bleiben offen.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../../api/index.ts';
import { Dialog, ErrorState, Icon, T, useToast, Vermerke } from '../../ui/index.ts';
import { TV } from './texte.ts';

const key = (projektId: string) => ['vertrag', 'vermerke', projektId] as const;

export function VermerkPanel({ projektId }: { projektId: string }) {
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: key(projektId), queryFn: async ({ signal }) => (await api.GET('/v1/projekte/{id}/vermerke', { params: { path: { id: projektId } }, signal })).data! });
  const [dialog, setDialog] = useState<'vorlegen' | 'phase' | null>(null);
  const fertig = async (text: string) => { setDialog(null); toast.show(text); await qc.invalidateQueries({ queryKey: ['vertrag'] }); await qc.invalidateQueries({ queryKey: ['projekt'] }); };
  const vorlegen = useMutation({
    mutationFn: async (v: { id: string; version: number }) => (await api.POST('/v1/vertragsversionen/{id}/vorlegen', { params: { path: { id: v.id }, header: { 'if-match': `W/"${v.version}"` } } })).data!,
    onSuccess: () => void fertig(TV.vermerk.vorgelegt),
  });
  const phase = useMutation({
    mutationFn: async (p: string) => (await api.POST('/v1/projekte/{id}/phase-beginnen', { params: { path: { id: projektId } }, body: { phase: p as 'P1' } })).data!,
    onSuccess: (_d, p) => void fertig(TV.vermerk.phaseBegonnen(p)),
  });
  const d = q.data;
  if (!d) return null;
  const offen = [...d.projekt, ...d.versionen.flatMap(v => v.vermerke)];
  if (!offen.length && !d.can.vorlegen && !d.can.phaseBeginnen) return null;
  return (
    <section className="vt-vermerke" aria-label={TV.vermerk.titel}>
      <h3 className="grp-h">{TV.vermerk.titel}</h3>
      {offen.length ? (
        <ul className="vt-vermerk-liste">
          {d.projekt.length ? <li><Vermerke vermerke={d.projekt} /></li> : null}
          {d.versionen.map(v => <li key={v.versionId}><span className="muted small">{TV.vermerk.version(v.nummer)}</span> <Vermerke vermerke={v.vermerke} /></li>)}
        </ul>
      ) : null}
      <div className="acts">
        {d.can.vorlegen ? <button type="button" className="btn" onClick={() => setDialog('vorlegen')}><Icon name="send" />{TV.vermerk.vorlegen}</button> : null}
        {d.can.phaseBeginnen ? <button type="button" className="btn" onClick={() => setDialog('phase')}><Icon name="arrow" />{TV.vermerk.phaseBeginnen(d.can.phaseBeginnen)}</button> : null}
      </div>
      {dialog === 'vorlegen' && d.can.vorlegen ? (
        <Dialog title={TV.vermerk.vorlegenFrage(d.can.vorlegen.nummer)} onClose={() => setDialog(null)} footer={<>
          <button type="button" className="btn" onClick={() => setDialog(null)} data-autofocus>{T.common.cancel}</button>
          <button type="button" className="btn primary" disabled={vorlegen.isPending}
            onClick={() => vorlegen.mutate({ id: d.can.vorlegen!.versionId, version: d.can.vorlegen!.version })}>{TV.vermerk.vorlegen}</button>
        </>}>
          <p>{d.can.vorlegen.fehlt.length ? TV.vermerk.vorlegenMitVermerk(d.can.vorlegen.fehlt.map(f => f.text).join(', ')) : TV.vermerk.vorlegenOhneVermerk}</p>
          {vorlegen.error ? <ErrorState error={vorlegen.error} /> : null}
        </Dialog>
      ) : null}
      {dialog === 'phase' && d.can.phaseBeginnen ? (
        <Dialog title={TV.vermerk.phaseFrage(d.can.phaseBeginnen)} onClose={() => setDialog(null)} footer={<>
          <button type="button" className="btn" onClick={() => setDialog(null)} data-autofocus>{T.common.cancel}</button>
          <button type="button" className="btn primary" disabled={phase.isPending} onClick={() => phase.mutate(d.can.phaseBeginnen!)}>{TV.vermerk.phaseBeginnen(d.can.phaseBeginnen)}</button>
        </>}>
          <p>{TV.vermerk.phaseWirkung(d.can.phaseBeginnen)}</p>
          {phase.error ? <ErrorState error={phase.error} /> : null}
        </Dialog>
      ) : null}
    </section>
  );
}
