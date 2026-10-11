import { useId } from 'react';

/**
 * Taproot's droplet mark with real water inside: a clipped wave that sits at
 * a calm level, and while an answer is on its way it rises and drifts like a
 * glass filling. Pure SVG + CSS (see water.css); reduced motion keeps the
 * level and drops the drift.
 */
export function WaterMark({ size = 20, filling = false, className }: { size?: number; filling?: boolean; className?: string }) {
  const id = useId().replace(/:/g, '');
  const clip = `wm-clip-${id}`;
  const drop = 'M12 2.2c3.9 4.9 7.2 8.8 7.2 12.9a7.2 7.2 0 0 1-14.4 0c0-4.1 3.3-8 7.2-12.9z';
  // Crests wider than the drop so the drift loops seamlessly (period 24).
  const wave = 'M-24 0 q6 -2.2 12 0 t12 0 t12 0 t12 0 t12 0 t12 0 V30 H-24 Z';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={`wm${filling ? ' wm-filling' : ''}${className ? ` ${className}` : ''}`}
      style={{ flex: 'none' }}
    >
      <defs>
        <clipPath id={clip}>
          <path d={drop} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <g className="wm-level">
          <path className="wm-wave wm-wave-back" d={wave} />
          <path className="wm-wave wm-wave-front" d={wave} />
        </g>
      </g>
      <path d={drop} className="wm-outline" fill="none" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M9.2 13.4c-.5 1.5-.2 3 .9 4" className="wm-glint" fill="none" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

/**
 * The quiet water surface under the start screen: three slow layered swells,
 * drawn once as SVG and drifted with transforms only (GPU, no layout).
 */
export function WaterSurface() {
  const swell = (amp: number, len: number) => {
    // A periodic path two viewports wide so translateX(-50%) loops seamlessly.
    let d = 'M0 40';
    for (let x = 0; x < 2400; x += len) d += ` q${len / 4} ${-amp} ${len / 2} 0 t${len / 2} 0`;
    return `${d} V120 H0 Z`;
  };
  return (
    <div className="cg-surface" aria-hidden="true">
      <svg viewBox="0 0 2400 120" preserveAspectRatio="none" className="cg-swell s1">
        <path d={swell(10, 300)} />
      </svg>
      <svg viewBox="0 0 2400 120" preserveAspectRatio="none" className="cg-swell s2">
        <path d={swell(7, 240)} />
      </svg>
      <svg viewBox="0 0 2400 120" preserveAspectRatio="none" className="cg-swell s3">
        <path d={swell(5, 160)} />
      </svg>
    </div>
  );
}
