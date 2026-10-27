/**
 * Telefon (unter 768 px, I-N3, IA «Navigation»): Leiste unten mit höchstens drei Arbeitsräumen und «Mehr»; unter
 * «Mehr» als Blatt von unten (I-M3) die übrigen Arbeitsräume und das Konto (Person, Organisation, Farbschema, Meine
 * Rollen und Rechte, Organisation wechseln, Abmelden). Ziele mindestens 44 × 44 px (Q-B4).
 */
import { orgName as nameOf, useAuthz, useIam, useIamConfig } from '@vollholz/iam-web';
import { useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { applyTheme, Icon, T, themeMode, useFocusTrap, type ThemeMode } from '../ui/index.ts';
import type { SichtbarerRaum } from './nav.ts';

export function BottomNav({ unten, mehr, mehrOffen, onMehr }: { unten: SichtbarerRaum[]; mehr: SichtbarerRaum[]; mehrOffen: boolean; onMehr(): void }) {
  const { router: { Link } } = useIamConfig();
  const mehrAktiv = mehr.some(r => r.aktiv);
  return (
    <nav className="bnav" aria-label={T.nav.main}>
      <ul>
        {unten.map(r => (
          <li key={r.id}>
            <Link to={r.pfad} className={`bn${r.aktiv ? ' on' : ''}`} {...(r.aktiv ? { 'aria-current': 'page' as const } : {})}>
              <Icon name={r.icon} /><span>{r.label}</span>
            </Link>
          </li>
        ))}
        <li>
          <button type="button" className={`bn${mehrAktiv ? ' on' : ''}`} aria-haspopup="dialog" aria-expanded={mehrOffen} onClick={onMehr}>
            <Icon name="more" /><span>{T.nav.mehr}</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}

const THEMES: { mode: ThemeMode; label: string }[] = [
  { mode: 'light', label: T.theme.light }, { mode: 'dark', label: T.theme.dark }, { mode: 'system', label: T.theme.system },
];

export function MehrBlatt({ raeume, onClose, onRechte }: { raeume: SichtbarerRaum[]; onClose(): void; onRechte(): void }) {
  const { router: { Link } } = useIamConfig();
  const { me, orgName, switchOrg, logout } = useIam();
  const { roleLabel } = useAuthz();
  const [theme, setTheme] = useState(themeMode);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  const kontoId = useId();
  useFocusTrap(ref, onClose);
  const andere = me.organizations.filter(o => o !== me.selectedOrganization);
  return createPortal(
    <div className="overlay blatt-wrap" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} className="blatt" role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1}>
        <div className="blatt-h">
          <h2 id={id}>{T.nav.mehrTitel}</h2>
          <button type="button" className="iconbtn" onClick={onClose} aria-label={T.common.close}><Icon name="x" /></button>
        </div>
        <div className="blatt-b">
          {raeume.length ? (
            <ul className="blatt-l">
              {raeume.map(r => (
                <li key={r.id}>
                  <Link to={r.pfad} className={`nav blatt-i${r.aktiv ? ' on' : ''}`} {...(r.aktiv ? { 'aria-current': 'page' as const } : {})}>
                    <Icon name={r.icon} /><span className="lbl">{r.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
          <section aria-labelledby={kontoId} className="blatt-konto">
            <h3 id={kontoId}>{T.nav.konto}</h3>
            <p className="blatt-person">
              <b>{me.person.name ?? me.person.email}</b>
              {me.person.name && me.person.email ? <span className="muted small">{me.person.email}</span> : null}
              <span className="muted small">{T.konto.organisation} <b>{orgName}</b> · {me.roles.map(roleLabel).join(', ') || T.konto.keineRolle}</span>
            </p>
            <div className="seg" role="group" aria-label={T.theme.label}>
              {THEMES.map(t => (
                <button key={t.mode} type="button" className={theme === t.mode ? 'on' : undefined} aria-pressed={theme === t.mode}
                  onClick={() => { applyTheme(t.mode); setTheme(t.mode); }}>{t.label}</button>
              ))}
            </div>
            <ul className="blatt-l">
              <li><button type="button" className="nav blatt-i" onClick={onRechte}><Icon name="shield" /><span className="lbl">{T.konto.rechte}</span></button></li>
              {andere.map(o => (
                <li key={o}><button type="button" className="nav blatt-i" onClick={() => void switchOrg(o)}><Icon name="building" /><span className="lbl">{T.konto.wechseln(nameOf(me, o))}</span></button></li>
              ))}
              <li><button type="button" className="nav blatt-i" onClick={() => void logout()}><Icon name="x" /><span className="lbl">{T.konto.abmelden}</span></button></li>
            </ul>
          </section>
        </div>
      </div>
    </div>,
    document.body,
  );
}
