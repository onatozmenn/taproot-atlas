import type { ReactNode, SVGProps } from 'react';

/* Drawn glyphs for the Public Record chat: 20px grid, square caps, 1.6 stroke. */
const ico = (paths: ReactNode) =>
  function Ico({ className, ...p }: SVGProps<SVGSVGElement>) {
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false" className={className ? `rc-ico ${className}` : 'rc-ico'} {...p}>
        {paths}
      </svg>
    );
  };

export const RcPlus = ico(<path d="M10 4v12M4 10h12" />);
export const RcMenu = ico(<path d="M3 5.5h14M3 10h14M3 14.5h14" />);
export const RcArrow = ico(<path d="M3 10h13M11 5l5 5-5 5" />);
export const RcChevRight = ico(<path d="m7 4 6 6-6 6" />);
export const RcChevDown = ico(<path d="m4 7 6 6 6-6" />);
export const RcDown = ico(<path d="M10 3v13M5 11l5 5 5-5" />);
export const RcExt = ico(<path d="M11 3.5h5.5V9M16.5 3.5 9 11M14 12.5v4H3.5V6h4" />);
export const RcClose = ico(<path d="m5 5 10 10M15 5 5 15" />);
export const RcCheck = ico(<path d="m4 10.5 4 4 8-9" />);
export const RcCopy = ico(
  <>
    <rect x="6.5" y="6.5" width="10" height="10" />
    <path d="M13.5 3.5h-10v10" />
  </>,
);
export const RcUp = ico(<path d="M6.5 9 9 3.5c1 0 2 .8 2 2V8h4.2c.9 0 1.5.8 1.3 1.6l-1.3 5.6c-.2.6-.7 1-1.3 1H6.5M3 9h3.5v7.2H3z" />);
export const RcDownVote = ico(<path d="M6.5 11 9 16.5c1 0 2-.8 2-2V12h4.2c.9 0 1.5-.8 1.3-1.6L15.2 4.8c-.2-.6-.7-1-1.3-1H6.5M3 3.8h3.5V11H3z" />);
export const RcAttach = ico(<path d="M13.5 6.5 7.6 12.4a1.8 1.8 0 0 0 2.5 2.5l6-6a3.4 3.4 0 0 0-4.8-4.8l-6.2 6.2a5 5 0 0 0 7 7l4.4-4.4" />);
export const RcMic = ico(
  <>
    <rect x="7.5" y="2.5" width="5" height="9" rx="2.5" />
    <path d="M4.5 9.5a5.5 5.5 0 0 0 11 0M10 15v3M7 18h6" />
  </>,
);
export const RcLocate = ico(
  <>
    <circle cx="10" cy="10" r="5" />
    <path d="M10 1.5v4M10 14.5v4M1.5 10h4M14.5 10h4" />
    <rect x="9" y="9" width="2" height="2" fill="currentColor" stroke="none" />
  </>,
);
export const RcStop = ico(<rect x="5" y="5" width="10" height="10" fill="currentColor" stroke="none" />);
export const RcSun = ico(
  <>
    <circle cx="10" cy="10" r="3.5" />
    <path d="M10 1.5v2.5M10 16v2.5M1.5 10H4M16 10h2.5M4 4l1.8 1.8M14.2 14.2 16 16M16 4l-1.8 1.8M5.8 14.2 4 16" />
  </>,
);
export const RcMoon = ico(<path d="M16 12.5A7 7 0 0 1 7.5 4a7 7 0 1 0 8.5 8.5z" />);
export const RcTrash = ico(<path d="M4 5.5h12M8 5.5V3.5h4v2M5.5 5.5l.8 11h7.4l.8-11M8.5 8.5v5M11.5 8.5v5" />);
