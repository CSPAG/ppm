/**
 * Werkbank wie in vollholz/assets: Topbar (Marke mit Organisation, Suche als Befehlspalette, Farbschema, Kontomenü),
 * Navigation nach Arbeitsräumen (links ab 768 px, unten auf dem Telefon; `nav.ts`), Arbeitsfläche als «Karte»,
 * Schubladen rechts. Strg/⌘ K öffnet die Befehlspalette, «/» die Suche der Liste, «?» die Übersicht der Kürzel.
 */
import { useRouterState } from '@tanstack/react-router';
import { AccountMenu, BreakGlassBanner, initials, MyRightsDialog, useIam, useIamConfig } from '@vollholz/iam-web';
import { useEffect, useState, type ReactNode } from 'react';
import { applyTheme, avatarColor, Icon, T } from '../ui/index.ts';
import { BottomNav, MehrBlatt } from './BottomNav.tsx';
import { CommandPalette } from './CommandPalette.tsx';
import { kuerzelTaste, KuerzelUebersicht } from './Kuerzel.tsx';
import { useShell } from './context.ts';
import { aufteilenUnten, useNavigation, useZaehler } from './nav.ts';
import { BereichLeiste, Rail } from './Rail.tsx';
import { ThemeToggle } from './ThemeSwitch.tsx';

export function AppShell({ children }: { children: ReactNode }) {
  const { me, orgName, canSomewhere } = useIam();
  const { router } = useIamConfig();
  const path = useRouterState({ select: s => s.location.pathname });
  const reg = useShell();
  const { raeume, aktionen, suchen } = useNavigation(reg, path);
  const zaehler = useZaehler(reg);
  // Persönliches im Kontomenü (IA: Profil und Stellvertretung, UC-016 Schritt 4)
  const konto = (reg.konto ?? []).filter(k => canSomewhere(k.recht));
  const { unten, mehr } = aufteilenUnten(raeume);
  const [palette, setPalette] = useState(false);
  const [rechte, setRechte] = useState(false);
  const [kuerzel, setKuerzel] = useState(false);
  // «Mehr» offen nur für die Seite, auf der es geöffnet wurde (Wechsel der Seite schliesst es)
  const [mehrAt, setMehrAt] = useState<string | null>(null);
  const mehrOffen = mehrAt === path;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette(o => !o); }
      else if (kuerzelTaste(e, () => setKuerzel(true))) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const avatar = <span className="avatar" style={{ background: avatarColor(me.person.subject) }} aria-hidden="true">{initials(me.person.name ?? me.person.email ?? '?')}</span>;
  return (
    <>
      <a href="#main" className="skip">{T.nav.skip}</a>
      <div className="app">
        <header className="top">
          <div className="brand">
            <div className="brand-mark"><Icon name="layers" /></div><span className="bt">{T.app}</span>
            {orgName ? <small className="org" title={orgName}><span className="sr">{T.konto.organisation} </span>{orgName}</small> : null}
          </div>
          <button type="button" className="omni" onClick={() => setPalette(true)} aria-keyshortcuts="Control+K" aria-label={T.nav.omni}>
            <Icon name="search" /><span>{T.nav.omni}</span><kbd aria-hidden="true">{T.palette.hint}</kbd>
          </button>
          <div className="top-konto">
            <ThemeToggle />
            <AccountMenu avatar={avatar} extraItems={close => (
              <>
                {konto.map(k => (
                  <button key={k.id} type="button" role="menuitem" className="iam-menu-i" onClick={() => { close(); router.navigate(k.pfad); }}>
                    <Icon name={k.icon} className="iam-ico" />{k.label}
                  </button>
                ))}
                {(['light', 'dark', 'system'] as const).map(m => (
                  <button key={m} type="button" role="menuitem" className="iam-menu-i" onClick={() => { applyTheme(m); close(); }}>
                    <Icon name="eye" className="iam-ico" />{`${T.theme.label}: ${T.theme[m]}`}
                  </button>
                ))}
              </>
            )} />
          </div>
        </header>
        <div className="shell">
          <Rail raeume={raeume} zaehler={zaehler} />
          <main className="main" id="main" tabIndex={-1}>
            <BreakGlassBanner />
            <BereichLeiste raum={raeume.find(r => r.aktiv)} />
            {children}
          </main>
        </div>
        <BottomNav unten={unten} mehr={mehr} mehrOffen={mehrOffen} onMehr={() => setMehrAt(mehrOffen ? null : path)} zaehler={zaehler} />
      </div>
      {kuerzel ? <KuerzelUebersicht onClose={() => setKuerzel(false)} /> : null}
      {palette ? <CommandPalette raeume={raeume} aktionen={aktionen} suchen={suchen} onClose={() => setPalette(false)} /> : null}
      {mehrOffen ? <MehrBlatt raeume={mehr} konto={konto} zaehler={zaehler} onClose={() => setMehrAt(null)} onRechte={() => { setMehrAt(null); setRechte(true); }} /> : null}
      {rechte ? <MyRightsDialog onClose={() => setRechte(false)} /> : null}
    </>
  );
}
