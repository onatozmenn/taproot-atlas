import { useEffect, useRef, useState } from 'react';
import { MapIcon } from 'lucide-react';
import type { WaterSystemProfile } from '../../../../types/water-intelligence';
import type { TapAnswer } from '../../api';
import { loadMaplibre } from '../RealMap';
import { num, people, titleCase } from '../report/format';
import { VisualFrame } from './frame';

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
    (async () => {
      try {
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
        map.on('error', () => {
          if (map && !map.isStyleLoaded()) setFailed(true);
        });
        map.on('load', () => {
          if (!map) return;
          // Quiet the basemap so the water reads first.
          for (const l of map.getStyle().layers ?? []) {
            if (/poi|aeroway|railway|highway-shield|road_shield|building/.test(l.id)) map.setLayoutProperty(l.id, 'visibility', 'none');
            if (l.id === 'water') map.setPaintProperty(l.id, 'fill-color', '#d6e6f5');
            if (l.id === 'waterway') map.setPaintProperty(l.id, 'line-color', '#b5d1ec');
          }
          map.addSource('area', { type: 'geojson', data: { type: 'Feature', geometry: sa.geometry as never, properties: {} } });
          map.addLayer({ id: 'area-fill', type: 'fill', source: 'area', paint: { 'fill-color': '#0066c5', 'fill-opacity': 0 } });
          map.addLayer({
            id: 'area-line',
            type: 'line',
            source: 'area',
            paint: { 'line-color': '#003f7f', 'line-width': 1.6, 'line-opacity': 0, ...(sa.method === 'modeled' ? { 'line-dasharray': [2, 1.5] } : {}) },
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
            map.addLayer({ id: 'arcs-base', type: 'line', source: 'arcs', paint: { 'line-color': '#0066c5', 'line-width': 2, 'line-opacity': 0.18 }, layout: { 'line-cap': 'round' } });
            map.addLayer({ id: 'arcs-flow', type: 'line', source: 'arcs', paint: { 'line-color': '#0066c5', 'line-width': 2.4, 'line-dasharray': [0, 4, 3] }, layout: { 'line-cap': 'round' } });
            map.addLayer({ id: 'wsheds-dot', type: 'circle', source: 'wsheds', paint: { 'circle-radius': 5, 'circle-color': '#ffffff', 'circle-stroke-color': '#0066c5', 'circle-stroke-width': 2 } });
            map.addLayer({
              id: 'wsheds-label',
              type: 'symbol',
              source: 'wsheds',
              layout: { 'text-field': ['get', 'label'], 'text-font': ['Noto Sans Regular'], 'text-size': 12, 'text-offset': [0, 1.2], 'text-anchor': 'top' },
              paint: { 'text-color': '#003f7f', 'text-halo-color': '#ffffff', 'text-halo-width': 1.6 },
            });
          }
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
              map.setPaintProperty('area-fill', 'fill-opacity', 0.13 * e);
              map.setPaintProperty('area-line', 'line-opacity', 0.9 * e);
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
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
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
    p.population ? `${people(p.population)} people` : '',
    sa.areaKm2 ? `${num(sa.areaKm2)} km²` : '',
    p.connections ? `${num(p.connections)} connections` : '',
  ].filter(Boolean);

  return (
    <VisualFrame
      eyebrow={sa.method === 'reported' ? 'Service area · boundary reported by the state or utility' : 'Service area · boundary estimated by EPA'}
      headline={titleCase(p.name)}
      sub={facts.join(' · ')}
      source={`EPA Public Water System Service Areas${sources.length > 0 ? ' · source arcs are schematic' : ''}`}
      sourceUrl={sa.sourceUrl}
      bleed
    >
      <div className={compact ? 'relative h-[240px]' : 'relative h-[320px]'}>
        {failed ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 bg-[var(--muted)] text-[14px] text-muted-foreground">
            <MapIcon className="size-5" />
            The map couldn't load. The boundary is still in the EPA record.
          </div>
        ) : (
          <div ref={el} className="service-map absolute inset-0" role="application" aria-label={`Map of the area ${p.name} serves`} />
        )}
      </div>
    </VisualFrame>
  );
}
