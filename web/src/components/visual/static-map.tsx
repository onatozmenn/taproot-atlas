import { useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from 'next-themes';

/**
 * A map that needs no GPU. When WebGL is missing (older laptops, locked-down
 * browsers, headless QA) or MapLibre can't start, the service area is drawn
 * as SVG over plain raster tiles in Web Mercator, so the answer still shows
 * the place instead of an error box.
 */

type Ring = number[][];
const TILE = 256;
// Esri Canvas basemaps: keyless raster tiles (CARTO now watermarks keyless use).
const BASE = (dark: boolean) =>
  `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_${dark ? 'Dark' : 'Light'}_Gray_Base/MapServer/tile`;

/** lon/lat → world pixels at zoom z. */
function project([lon, lat]: number[], z: number): [number, number] {
  const s = TILE * 2 ** z;
  const x = ((lon + 180) / 360) * s;
  const r = (Math.max(-85.05, Math.min(85.05, lat)) * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * s;
  return [x, y];
}

export interface StaticMapProps {
  rings: Ring[];
  /** Far sources (watersheds) with schematic arcs into the area. */
  sources?: Array<{ label: string; at: [number, number] }>;
  centre?: [number, number] | null;
  modeled?: boolean;
  height: number;
  label: string;
}

function arcPath(a: [number, number], b: [number, number]): string {
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  const cx = mx + (b[1] - a[1]) * 0.18;
  const cy = my - (b[0] - a[0]) * 0.18;
  return `M${a[0].toFixed(1)},${a[1].toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${b[0].toFixed(1)},${b[1].toFixed(1)}`;
}

export function StaticMap({ rings, sources = [], centre, modeled, height, label }: StaticMapProps) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === 'dark';

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    setWidth(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const view = useMemo(() => {
    if (!width) return null;
    const pts = [...rings.flat(), ...sources.map((s) => s.at)];
    if (pts.length === 0) return null;
    const pad = 40;
    // Largest zoom (≤ 12) at which everything fits inside the box.
    let z = 12;
    for (; z > 2; z--) {
      const xy = pts.map((p) => project(p, z));
      const w = Math.max(...xy.map((p) => p[0])) - Math.min(...xy.map((p) => p[0]));
      const h = Math.max(...xy.map((p) => p[1])) - Math.min(...xy.map((p) => p[1]));
      if (w <= width - pad * 2 && h <= height - pad * 2) break;
    }
    const xy = pts.map((p) => project(p, z));
    const cx = (Math.max(...xy.map((p) => p[0])) + Math.min(...xy.map((p) => p[0]))) / 2;
    const cy = (Math.max(...xy.map((p) => p[1])) + Math.min(...xy.map((p) => p[1]))) / 2;
    const ox = cx - width / 2;
    const oy = cy - height / 2;
    const toScreen = (p: number[]): [number, number] => {
      const [x, y] = project(p, z);
      return [x - ox, y - oy];
    };
    const tiles: Array<{ key: string; src: string; left: number; top: number }> = [];
    const n = 2 ** z;
    for (let tx = Math.floor(ox / TILE); tx <= Math.floor((ox + width) / TILE); tx++) {
      for (let ty = Math.floor(oy / TILE); ty <= Math.floor((oy + height) / TILE); ty++) {
        if (ty < 0 || ty >= n) continue;
        const wx = ((tx % n) + n) % n;
        tiles.push({ key: `${z}/${tx}/${ty}`, src: `${BASE(dark)}/${z}/${ty}/${wx}`, left: tx * TILE - ox, top: ty * TILE - oy });
      }
    }
    const d = rings
      .map((r) => r.map((p, i) => `${i ? 'L' : 'M'}${toScreen(p).map((v) => v.toFixed(1)).join(',')}`).join('') + 'Z')
      .join('');
    const c = centre ? toScreen(centre) : null;
    const arcs = c ? sources.map((s) => ({ label: s.label.replace(/ Watershed$/i, ''), at: toScreen(s.at), d: arcPath(toScreen(s.at), c) })) : [];
    return { tiles, d, arcs };
  }, [width, height, rings, sources, centre, dark]);

  return (
    <div ref={box} className="relative overflow-hidden bg-[var(--muted)]" style={{ height }} role="img" aria-label={label}>
      {view?.tiles.map((t) => (
        <img
          key={t.key}
          src={t.src}
          alt=""
          draggable={false}
          loading="lazy"
          // A tile that fails to load disappears instead of drawing a broken-image frame.
          onError={(e) => {
            e.currentTarget.style.visibility = 'hidden';
          }}
          className="pointer-events-none absolute select-none" style={{ left: t.left, top: t.top, width: TILE, height: TILE }} />
      ))}
      {view && (
        <svg className="absolute inset-0" width="100%" height={height} aria-hidden="true">
          <path d={view.d} fillRule="evenodd" className="static-map-fill" />
          <path d={view.d} pathLength={modeled ? undefined : 1} className="static-map-line" style={modeled ? { strokeDasharray: '6 4', animation: 'none' } : { strokeDasharray: 1 }} />
          {view.arcs.map((a) => (
            <g key={a.label}>
              <path d={a.d} className="static-map-arc" />
              <circle cx={a.at[0]} cy={a.at[1]} r={5} className="static-map-dot" />
              <text x={a.at[0]} y={a.at[1] + 20} textAnchor="middle" className="static-map-label">
                {a.label}
              </text>
            </g>
          ))}
        </svg>
      )}
      <span className="absolute bottom-1 right-2 rounded bg-background/70 px-1 text-[10px] text-muted-foreground">Esri, HERE, Garmin, © OpenStreetMap</span>
    </div>
  );
}
