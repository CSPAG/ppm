/**
 * Geordnetes Beenden auf SIGTERM/SIGINT: `/readyz` sofort 503 → `SHUTDOWN_DELAY` → Server schliessen bzw. Worker holt
 * nichts mehr ab → Pools schliessen, Telemetrie leeren → Exit 0; dauert es länger als `SHUTDOWN_TIMEOUT`, Exit 1.
 */
import { stopTelemetry } from './telemetry.ts';

export interface Logger { info(o: object | string, m?: string): void; error(o: object | string, m?: string): void }

export class Runtime {
  private stopping = false;
  private readonly steps: { name: string; run: () => Promise<unknown> }[] = [];
  private readonly o: { shutdownDelayMs: number; shutdownTimeoutMs: number; log: Logger; exit?: (code: number) => void };
  constructor(o: Runtime['o']) { this.o = o; }

  /** Bereit für Verkehr (false ab dem Signal). */
  get ready(): boolean { return !this.stopping; }

  /** Schritt beim Beenden; in der Reihenfolge der Registrierung (Server zuerst, Pools zuletzt). */
  onShutdown(name: string, run: () => Promise<unknown>): this { this.steps.push({ name, run }); return this; }

  install(): this {
    for (const sig of ['SIGTERM', 'SIGINT'] as const) process.once(sig, () => void this.shutdown(sig));
    return this;
  }

  async shutdown(reason: string): Promise<void> {
    if (this.stopping) return;
    this.stopping = true;
    const exit = this.o.exit ?? ((c: number) => process.exit(c));
    this.o.log.info({ reason }, 'Beenden: nicht mehr bereit');
    const timer = setTimeout(() => { this.o.log.error({ reason }, 'Beenden: Zeitlimit überschritten'); exit(1); }, this.o.shutdownTimeoutMs);
    timer.unref();
    try {
      await new Promise(r => setTimeout(r, this.o.shutdownDelayMs));
      for (const s of this.steps) {
        try { await s.run(); } catch (e) { this.o.log.error({ step: s.name, err: (e as Error).message }, 'Beenden: Schritt fehlgeschlagen'); }
      }
      await stopTelemetry();
      clearTimeout(timer);
      this.o.log.info({ reason }, 'Beendet');
      exit(0);
    } catch (e) {
      this.o.log.error({ err: (e as Error).message }, 'Beenden fehlgeschlagen');
      exit(1);
    }
  }
}
