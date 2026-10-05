import React from 'react';

const FLAG_BLUE = '#0a3161';

/** Points of a 5-point star centered at (cx, cy). */
function starPoints(cx: number, cy: number, outer: number, inner: number): string {
  const pts: string[] = [];
  for (let k = 0; k < 10; k++) {
    const r = k % 2 === 0 ? outer : inner;
    const a = ((k * 36 - 90) * Math.PI) / 180;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(' ');
}

/**
 * Taproot Atlas mark: Old Glory Blue droplet filled with as many white
 * stars as fit (US-flag blue + white stars, no flag itself).
 */
export function Logo({ size = 30 }: { size?: number }) {
  const stars: Array<{ x: number; y: number }> = [];
  const gap = 4.1;
  let row = 0;
  for (let y = 4.5; y <= 28; y += gap) {
    const offset = row % 2 === 0 ? 0 : gap / 2;
    for (let x = 8 + offset; x <= 24.5; x += gap) {
      stars.push({ x, y });
    }
    row++;
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role="img"
      aria-label="Taproot Atlas logo"
      className="logo-mark"
    >
      <defs>
        <clipPath id="ta-drop-clip">
          <path d="M16 2.5C16 2.5 6.5 14.2 6.5 20a9.5 9.5 0 0 0 19 0C25.5 14.2 16 2.5 16 2.5Z" />
        </clipPath>
      </defs>
      <path
        d="M16 2.5C16 2.5 6.5 14.2 6.5 20a9.5 9.5 0 0 0 19 0C25.5 14.2 16 2.5 16 2.5Z"
        fill={FLAG_BLUE}
      />
      <g clipPath="url(#ta-drop-clip)">
        {stars.map((s, i) => (
          <polygon key={i} points={starPoints(s.x, s.y, 1.45, 0.58)} fill="#ffffff" opacity="0.95" />
        ))}
      </g>
    </svg>
  );
}
