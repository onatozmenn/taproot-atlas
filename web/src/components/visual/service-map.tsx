import { useEffect, useRef, useState } from 'react';
import type { WaterSystemProfile } from '../../../../types/water-intelligence';
import type { TapAnswer } from '../../api';
import { loadMaplibre } from '../RealMap';
import { num, people, titleCase } from '../report/format';
import { VisualFrame } from './frame';
import { StaticMap } from './static-map';

const STYLE = 'https://tiles.openfreemap.org/styles/positron';
type Ring = number[][];

function ringsOf(g: NonNullable<WaterSystemProfile['serviceArea']>['geometry']): Ring[] {
  const c = g.coordinates as unknown;
  if (g.type === 'Polygon') return (c as Ring[]).slice(0, 1);
  return (c as Ring[][]).map((poly) => poly[0]);
}

function bboxOf(rings: Ring[]): [[number, number], [number, number]] | null {
  let w = 180, s = 90, e = -180, n = -90;
  for (const r of rings) for (const [x, y] of r) { if (x < w) w = x; if (x > e) e = x; if (y < s) s = y; if (y > n) n = y; }
  return w <= e ? [[w, s], [e, n]] : null;
}

/** Area-weighted-ish centre: the bbox centre of the largest ring. */
function centreOf(rings: Ring[]): [number, number] | null {
  let best: Ring | null = null;
  let bestA = -1;
  for (const r of rings) {
    const b = bboxOf([r]);
    if (!b) continue;
    const a = (b[1][0] - b[0][0]) * (b[1][1] - b[0][1]);
    if (a > bestA) { bestA = a; best = r; }
  }
  const b = best ? bboxOf([best]) : null;
  return b ? [(b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2] : null;
}

/** MapLibre needs a real GPU canvas; without one the map stays a blank box. */
function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') ?? c.getContext('webgl'));
  } catch {
    return false;
  }
}

/**
 * How long to wait for the basemap to settle before admitting defeat. Tile
 * hosts can hang (blocked network, adblock) without ever firing an error,
 * which used to leave a permanently blank map and no fallback.
 */
const SETTLE_MS = 15000;

/** A record token as a concrete colour MapLibre can paint. */
function tok(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/** Paper land, register-tint water, hairline roads, ink-3 labels. */
function paintBase(map: import('maplibre-gl').Map) {
  const paper = tok('--paper', '#fafaf7');
  const field = tok('--field', '#f1f1ec');
  const rule = tok('--rule', '#d4d4cf');
  const ink3 = tok('--ink-3', '#6e7076');
  const water = tok('--register-tint', '#e8edf6');
  const waterLine = tok('--register-line', '#9fb2d6');
  for (const l of map.getStyle().layers ?? []) {
    if (l.id.startsWith('area-') || l.id.startsWith('arcs-') || l.id.startsWith('wsheds-')) continue;
    try {
      if (l.type === 'background') map.setPaintProperty(l.id, 'background-color', paper);
      else if (l.type === 'fill') {
        map.setPaintProperty(l.id, 'fill-color', /water/.test(l.id) ? water : field);
        if (!/water/.test(l.id)) map.setPaintProperty(l.id, 'fill-opacity', 0.6);
      } else if (l.type === 'line') map.setPaintProperty(l.id, 'line-color', /water|river/.test(l.id) ? waterLine : rule);
      else if (l.type === 'symbol') {
        map.setPaintProperty(l.id, 'text-color', /water/.test(l.id) ? waterLine : ink3);
        map.setPaintProperty(l.id, 'text-halo-color', paper);
      }
    } catch {
      /* layer without that paint property */
    }
  }
}

/** A gentle arc from a to b, for water arriving from a far source. */
function arc(a: [number, number], b: [number, number], steps = 48): number[][] {
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const k = 0.18;
  const cx = mx - dy * k;
  const cy = my + dx * k;
  const out: number[][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    out.push([(1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * cx + t * t * b[0], (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * cy + t * t * b[1]]);
  }
  return out;
}

/**
 * Where the water goes, on a real map: the camera drifts down onto the
 * utility's service area, its border draws itself in, and for cities with
 * a known far source, arcs carry water in from each watershed.
 */
export function ServiceMap({ answer, p, compact = false }: { answer: TapAnswer; p: WaterSystemProfile; compact?: boolean }) {
  const el = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const sa = p.serviceArea!;
  const rings = ringsOf(sa.geometry);
  const centre = centreOf(rings);
  const sources = answer.flow.filter((f) => f.role === 'watershed' && Number.isFinite(f.at[0]) && Number.isFinite(f.at[1]));

  useEffect(() => {
    let map: import('maplibre-gl').Map | null = null;
    let raf = 0;
    let cancelled = false;
    let settleTimer = 0;
    let themeObs: MutationObserver | null = null;
    const fail = () => {
      if (!cancelled) {
        window.clearTimeout(settleTimer);
        setFailed(true);
      }
    };
    (async () => {
      try {
        if (!webglAvailable()) throw new Error('webgl unavailable');
        const ml = await loadMaplibre();
        if (cancelled || !el.current) return;
        const box = bboxOf([...rings, ...sources.map((s) => [[s.at[0], s.at[1]]])]);
        if (!box) throw new Error('no geometry');
        const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        map = new ml.Map({
          container: el.current,
          style: STYLE,
          bounds: box,
          fitBoundsOptions: { padding: 24 },
          attributionControl: { compact: true },
          cooperativeGestures: true,
          dragRotate: false,
          pitchWithRotate: false,
        });
        settleTimer = window.setTimeout(fail, SETTLE_MS);
        // Theme switch: repaint the basemap from the new tokens.
        themeObs = new MutationObserver(() => {
          if (map && map.isStyleLoaded()) {
            paintBase(map);
            if (map.getLayer('area-line')) map.setPaintProperty('area-line', 'line-color', tok('--ink', '#111214'));
            if (map.getLayer('area-fill')) map.setPaintProperty('area-fill', 'fill-color', tok('--register', '#0b3d91'));
          }
        });
        themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        let tileErrors = 0;
        // A tile that arrived means the basemap is painting; stop the clock.
        // ('idle' never comes: the animated source arcs repaint forever.
        // Our own GeoJSON overlays resolve instantly and don't count.)
        map.on('sourcedata', (e) => {
          if (e.isSourceLoaded && e.sourceId !== 'area' && e.sourceId !== 'arcs' && e.sourceId !== 'wsheds') {
            window.clearTimeout(settleTimer);
          }
        });
        map.on('error', () => {
          if (!map) return;
          if (!map.isStyleLoaded()) {
            fail();
            return;
          }
          // Tile/glyph failures after the style arrived: a few bad tiles are
          // normal, but a burst of them means the basemap will never paint.
          tileErrors += 1;
          if (tileErrors >= 6) fail();
        });
        map.on('idle', () => {
          window.clearTimeout(settleTimer);
        });
        map.on('load', () => {
          if (!map) return;
          // Monochrome paper basemap: hide the noise, then paint from the record tokens.
          for (const l of map.getStyle().layers ?? []) {
            if (/poi|aeroway|railway|highway-shield|road_shield|building|housenum/.test(l.id)) map.setLayoutProperty(l.id, 'visibility', 'none');
          }
          map.addSource('area', { type: 'geojson', data: { type: 'Feature', geometry: sa.geometry as never, properties: {} } });
          map.addLayer({ id: 'area-fill', type: 'fill', source: 'area', paint: { 'fill-color': tok('--register', '#0b3d91'), 'fill-opacity': 0 } });
          map.addLayer({
            id: 'area-line',
            type: 'line',
            source: 'area',
            paint: { 'line-color': tok('--ink', '#111214'), 'line-width': 1.5, 'line-opacity': 0, ...(sa.method === 'modeled' ? { 'line-dasharray': [3, 1.5] } : {}) },
          });
          if (centre && sources.length > 0) {
            map.addSource('arcs', {
              type: 'geojson',
              data: {
                type: 'FeatureCollection',
                features: sources.map((s) => ({ type: 'Feature', geometry: { type: 'LineString', coordinates: arc([s.at[0], s.at[1]], centre) }, properties: {} })),
              },
            });
            map.addSource('wsheds', {
              type: 'geojson',
              data: {
                type: 'FeatureCollection',
                features: sources.map((s) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [s.at[0], s.at[1]] }, properties: { label: s.label.replace(/ Watershed$/i, '') } })),
              },
            });
            map.addLayer({ id: 'arcs-base', type: 'line', source: 'arcs', paint: { 'line-color': tok('--register', '#0b3d91'), 'line-width': 1, 'line-opacity': 0.35 }, layout: { 'line-cap': 'butt' } });
            map.addLayer({ id: 'arcs-flow', type: 'line', source: 'arcs', paint: { 'line-color': tok('--register', '#0b3d91'), 'line-width': 2, 'line-dasharray': [0, 4, 3] }, layout: { 'line-cap': 'butt' } });
            map.addLayer({ id: 'wsheds-dot', type: 'circle', source: 'wsheds', paint: { 'circle-radius': 5, 'circle-color': tok('--paper', '#fafaf7'), 'circle-stroke-color': tok('--register', '#0b3d91'), 'circle-stroke-width': 2 } });
            map.addLayer({
              id: 'wsheds-label',
              type: 'symbol',
              source: 'wsheds',
              layout: { 'text-field': ['get', 'label'], 'text-font': ['Noto Sans Regular'], 'text-size': 11, 'text-transform': 'uppercase', 'text-letter-spacing': 0.06, 'text-offset': [0, 1.2], 'text-anchor': 'top' },
              paint: { 'text-color': tok('--register', '#0b3d91'), 'text-halo-color': tok('--paper', '#fafaf7'), 'text-halo-width': 2 },
            });
          }
          paintBase(map);
          // Arrival: start a little wide, settle onto the area, then fade the border and fill in.
          if (!reduce) map.jumpTo({ zoom: map.getZoom() - 1.4 });
          map.fitBounds(box, { padding: compact ? 36 : 48, duration: reduce ? 0 : 2200, essential: true, maxZoom: 12.5 });
          const t0 = performance.now();
          const dash = [
            [0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5], [2, 4, 1], [2.5, 4, 0.5], [3, 4, 0],
            [0, 0.5, 3, 3.5], [0, 1, 3, 3], [0, 1.5, 3, 2.5], [0, 2, 3, 2], [0, 2.5, 3, 1.5], [0, 3, 3, 1], [0, 3.5, 3, 0.5],
          ];
          const tick = (t: number) => {
            if (!map) return;
            const k = Math.min(1, (t - t0 - 700) / 1400);
            if (k >= 0) {
              const e = 1 - Math.pow(1 - k, 3);
              map.setPaintProperty('area-fill', 'fill-opacity', 0.14 * e);
              map.setPaintProperty('area-line', 'line-opacity', e);
            }
            if (map.getLayer('arcs-flow') && !reduce) {
              const step = Math.floor((t / 70) % dash.length);
              map.setPaintProperty('arcs-flow', 'line-dasharray', dash[step]);
            }
            if (k < 1 || (map.getLayer('arcs-flow') && !reduce)) raf = requestAnimationFrame(tick);
          };
          raf = requestAnimationFrame(tick);
        });
      } catch {
        fail();
      }
    })();
    return () => {
      cancelled = true;
      themeObs?.disconnect();
      window.clearTimeout(settleTimer);
      cancelAnimationFrame(raf);
      try {
        map?.remove();
      } catch {
        /* already gone */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.pwsid]);

  const facts = [
    sa.areaKm2 ? `${num(sa.areaKm2)} km²` : '',
    p.connections ? `${num(p.connections)} connections` : '',
    sa.method === 'reported' ? 'boundary reported by the state or utility' : 'boundary estimated by EPA',
  ].filter(Boolean);
  const height = compact ? 240 : 320;

  return (
    <VisualFrame
      fig={6}
      eyebrow={`Service area · ${sa.method === 'reported' ? 'reported' : 'estimated'}`}
      record={p.pwsid}
      hero={p.population ? people(p.population) : undefined}
      unit={p.population ? 'people' : undefined}
      headline={titleCase(p.name)}
      sub={facts.join(' · ')}
      note={`${sa.method === 'reported' ? 'Reported' : 'Approximate'} service area${sources.length > 0 ? '; source arcs are schematic' : ''}.`}
      source="EPA service areas"
      sourceUrl={sa.sourceUrl}
    >
      <div className="rf-map" style={{ height }}>
        {/* WebGL map, or the SVG fallback when it can't start */}
        {failed ? (
          <StaticMap
            rings={rings}
            sources={sources.map((x) => ({ label: x.label, at: [x.at[0], x.at[1]] as [number, number] }))}
            centre={centre}
            modeled={sa.method === 'modeled'}
            height={height - 2}
            label={`Map of the area ${titleCase(p.name)} serves`}
          />
        ) : (
          // Inline positioning: MapLibre's own `.maplibregl-map` rule sets
          // position:relative, which beats Tailwind's `absolute` and
          // collapses this box to zero height (blank map).
          <div ref={el} className="service-map" role="application" aria-label={`Map of the area ${p.name} serves`} style={{ position: 'absolute', inset: 0 }} />
        )}
        <span className="rf-map-n" aria-hidden="true">
          <svg viewBox="0 0 12 18">
            <path d="M6 0 12 18 6 14 0 18Z" fill="currentColor" />
          </svg>
          N
        </span>
      </div>
      <div className="rf-map-key" aria-hidden="true">
        <span>
          <i className="area" data-modeled={sa.method === 'modeled' || undefined} /> Service area
        </span>
        {sources.length > 0 && (
          <>
            <span>
              <i className="src" /> Source
            </span>
            <span>
              <i className="flow" /> Flow (schematic)
            </span>
          </>
        )}
      </div>
    </VisualFrame>
  );
}
