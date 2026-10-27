import { ICONS, type IconName } from './icons.ts';

/** Icon aus dem Satz von vollholz/assets. Dekorativ (aria-hidden), Beschriftung gehört an das umgebende Element. */
export function Icon({ name, className }: { name: IconName; className?: string }) {
  return <svg className={`ico${className ? ` ${className}` : ''}`} viewBox="0 0 24 24" aria-hidden="true" focusable="false" dangerouslySetInnerHTML={{ __html: ICONS[name] }} />;
}
