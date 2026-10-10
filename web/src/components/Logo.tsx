import { useId } from 'react';

/**
 * Taproot Atlas mark (Public Record): an ink-outlined drop with a level
 * line, the lower half filled in register blue. Same drawing as the
 * masthead mark on the record pages.
 */
export function Logo({ size = 26 }: { size?: number }) {
  const clip = `ta-drop-${useId().replace(/:/g, '')}`;
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" role="img" aria-label="Taproot Atlas logo" className="logo-mark" style={{ flex: 'none' }}>
      <defs>
        <clipPath id={clip}>
          <path d="M13 1.5c4.2 5.4 7.8 9.6 7.8 14a7.8 7.8 0 0 1-15.6 0c0-4.4 3.6-8.6 7.8-14z" />
        </clipPath>
      </defs>
      <rect x="0" y="14" width="26" height="12" fill="var(--register)" clipPath={`url(#${clip})`} />
      <path d="M13 1.5c4.2 5.4 7.8 9.6 7.8 14a7.8 7.8 0 0 1-15.6 0c0-4.4 3.6-8.6 7.8-14z" fill="none" stroke="var(--ink)" strokeWidth="1.8" />
      <path d="M2 14h3.5M20.5 14H24" stroke="var(--ink)" strokeWidth="1.4" />
    </svg>
  );
}
