import type { ReactNode, SVGProps } from 'react';
import '../../styles/record-pages.css';

/* Public Record page parts shared by /#/triage, /#/impact, /#/global, /#/study
   and /#/kit: the register header, the masthead (blue mono kicker, Public Sans
   800 title, serif dek, hairline meta table) and § section heads. */

type IcoProps = SVGProps<SVGSVGElement>;
const ico = (paths: ReactNode) =>
  function Ico({ className, ...p }: IcoProps) {
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true" className={className ? `rp-ico ${className}` : 'rp-ico'} {...p}>
        {paths}
      </svg>
    );
  };

/* Drawn, square-ended glyphs (the mock's set). */
export const IcoPlus = ico(<path d="M10 4v12M4 10h12" />);
export const IcoAsk = ico(<path d="M3 4h14v9H9l-4 3.5V13H3z" />);
export const IcoInfo = ico(
  <>
    <rect x="2.5" y="2.5" width="15" height="15" />
    <path d="M10 9v5.5M10 6v1" />
  </>,
);
export const IcoAlert = ico(
  <>
    <path d="M10 2.5 18 17H2z" />
    <path d="M10 8v4.5M10 14.2v1" />
  </>,
);
export const IcoArrow = ico(<path d="M3 10h13M11 5l5 5-5 5" />);
export const IcoExt = ico(<path d="M7 4h9v9M16 4 5 15" />);
export const IcoDown = ico(<path d="m5 7.5 5 5 5-5" />);
export const IcoRetry = ico(<path d="M16 10a6 6 0 1 1-1.8-4.3M16 3v4h-4" />);
export const IcoCheck = ico(<path d="m4 10.5 4 4 8-9" />);
export const IcoBack = ico(<path d="M17 10H4M9 5l-5 5 5 5" />);

/** The register drop: ink outline, water line, register-blue fill below it. */
export function RecordMark({ size = 26 }: { size?: number }) {
  return (
    <svg viewBox="0 0 26 26" width={size} height={size} aria-hidden="true">
      <defs>
        <clipPath id="rp-drop">
          <path d="M13 1.5c4.2 5.4 7.8 9.6 7.8 14a7.8 7.8 0 0 1-15.6 0c0-4.4 3.6-8.6 7.8-14z" />
        </clipPath>
      </defs>
      <rect x="0" y="14" width="26" height="12" fill="var(--register)" clipPath="url(#rp-drop)" />
      <path d="M13 1.5c4.2 5.4 7.8 9.6 7.8 14a7.8 7.8 0 0 1-15.6 0c0-4.4 3.6-8.6 7.8-14z" fill="none" stroke="var(--ink)" strokeWidth="1.8" />
      <path d="M2 14h3.5M20.5 14H24" stroke="var(--ink)" strokeWidth="1.4" />
    </svg>
  );
}

/** Register header: brand (back to the chat), page name, actions. */
export function RecordHeader({ page, children }: { page: string; children?: ReactNode }) {
  return (
    <header className="rp-hdr">
      <a href="#/" className="rp-brand" aria-label="Back to Taproot Atlas">
        <RecordMark />
        <span className="rp-brand-name">Taproot Atlas</span>
        <span className="rp-brand-sub">{page}</span>
      </a>
      {children}
      <a href="#/" className="rp-btn quiet" aria-label="New chat">
        <IcoPlus />
        <span className="txt">New chat</span>
      </a>
    </header>
  );
}

export interface MetaRow {
  k: string;
  v: ReactNode;
}

export function Masthead({ kicker, title, dek, meta, h1Props }: { kicker: string[]; title: ReactNode; dek?: ReactNode; meta?: MetaRow[]; h1Props?: { className?: string } }) {
  return (
    <header className={`rp-mast${meta && meta.length ? '' : ' solo'}`}>
      <div className="rp-mast-title">
        <p className="rp-kicker">
          {kicker.map((k) => (
            <span key={k}>{k}</span>
          ))}
        </p>
        <h1 className={h1Props?.className ?? 'rp-h1'}>{title}</h1>
        {dek ? <p className="rp-dek">{dek}</p> : null}
      </div>
      {meta && meta.length ? (
        <dl className="rp-meta">
          {meta.map((m) => (
            <div key={m.k}>
              <dt>{m.k}</dt>
              <dd>{m.v}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </header>
  );
}

/** § section: numbered tag, Public Sans 800 heading, right-aligned note, 2px ink rule. */
export function Sec({ no, title, note, children, label, className }: { no: string; title: ReactNode; note?: ReactNode; children: ReactNode; label?: string; className?: string }) {
  return (
    <section className={`rp-sec${className ? ` ${className}` : ''}`} aria-label={label}>
      <div className="rp-sec-h">
        <span className="rp-sec-no">§{no}</span>
        <h2>{title}</h2>
        {note ? <p>{note}</p> : <span />}
      </div>
      <div className="rp-sec-body">{children}</div>
    </section>
  );
}

export function ExtLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="rp-link rp-link-ext">
      {children}
      <IcoExt />
    </a>
  );
}
