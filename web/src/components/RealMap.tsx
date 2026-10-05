import React, { useEffect, useRef, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowRight01Icon, FactoryIcon, Home01Icon, WavesIcon } from '@hugeicons/core-free-icons';
import type { TapAnswer } from '../api';
import { mapView, flowBounds } from '../geo-view';

/**
 * Protomaps vector basemap (MapLibre GL) with the Resolver schematic drawn
 * on top. Tiles are context only: facts, badges, and disclaimers stay
 * Resolver-owned.
 *
 * Source selection (first configured wins):
 *  1. VITE_PROTOMAPS_TILES_URL — self-hosted .pmtiles (pmtiles:// protocol)
 *  2. VITE_PROTOMAPS_API_KEY — hosted TileJSON api.protomaps.com/tiles/v4.json
 *  3. OSM raster fallback (no key needed, keeps previews working offline-proof)
 */

let protomapsProtocolRegistered = false;

const ROLE_ICON = {
  watershed: { icon: WavesIcon, cls: 'flow-blue', label: 'Watershed' },
  treatment_facility: { icon: FactoryIcon, cls: 'flow-amber', label: 'Treatment' },
  distribution_zone: { icon: Home01Icon, cls: 'flow-green', label: 'Tap zone' },
} as const;

export function RealMap({ answer }: { answer: TapAnswer }) {
  const divRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let map: { remove: () => void } | null = null;
    let cancelled = false;
    (async () => {
      try {
        const maplibregl = await import('maplibre-gl');
        await import('maplibre-gl/dist/maplibre-gl.css');
        if (cancelled || !divRef.current) return;
        // Vite code-splits the MapLibre web worker into a hashed chunk whose
        // URL the default resolver cannot find ("Worker failed to load").
        // Point it at the bundled worker explicitly (verified pattern for
        // maplibre-gl v6 + Vite 5; config.WORKER_URL is the public API).
        const { default: mapWorkerUrl } = await import(
          'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
        );
        maplibregl.config.WORKER_URL = mapWorkerUrl;

        const apiKey = (import.meta.env.VITE_PROTOMAPS_API_KEY as string | undefined)?.trim();
        const tilesUrl = (import.meta.env.VITE_PROTOMAPS_TILES_URL as string | undefined)?.trim();

        const glyphs = 'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf';
        const sprite = 'https://protomaps.github.io/basemaps-assets/sprites/v4/light';
        const attribution =
          '<a href="https://protomaps.com">Protomaps</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

        const rasterStyle = {
          version: 8 as const,
          sources: {
            osm: {
              type: 'raster' as const,
              tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
              tileSize: 256,
              attribution:
                '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            },
          },
          layers: [{ id: 'osm', type: 'raster' as const, source: 'osm' }],
        };

        let style: unknown = rasterStyle;
        let vector = false;
        if (tilesUrl || apiKey) {
          const { Protocol } = await import('pmtiles');
          const { layers, namedFlavor } = await import('@protomaps/basemaps');
          if (!protomapsProtocolRegistered) {
            maplibregl.addProtocol('pmtiles', new Protocol().tile);
            protomapsProtocolRegistered = true;
          }
          style = {
            version: 8,
            glyphs,
            sprite,
            sources: {
              protomaps: tilesUrl
                ? { type: 'vector', url: `pmtiles://${tilesUrl}`, attribution }
                : {
                    type: 'vector',
                    url: `https://api.protomaps.com/tiles/v4.json?key=${apiKey}`,
                    attribution,
                  },
            },
            layers: layers('protomaps', namedFlavor('light'), { lang: 'en' }),
          };
          vector = true;
        }

        const { center, zoom } = mapView(answer.flow);
        const m = new maplibregl.Map({
          container: divRef.current,
          style: style as never,
          center: [center[1], center[0]],
          zoom,
          // Direct interaction: wheel zoom on hover, pinch zoom on touch.
          scrollZoom: true,
          touchZoomRotate: true,
          doubleClickZoom: true,
          attributionControl: { compact: true },
        });

        const points = answer.flow
          .filter((f) => Number.isFinite(f.at[0]) && Number.isFinite(f.at[1]))
          .map((f) => ({
            type: 'Feature' as const,
            geometry: { type: 'Point' as const, coordinates: [f.at[0], f.at[1]] },
            properties: { label: f.label, role: f.role },
          }));
        const lineCoords = points.map((p) => p.geometry.coordinates);

        const addOverlay = () => {
          if (m.getSource('flow')) return;
          m.addSource('flow', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: points },
          });
          if (lineCoords.length > 1) {
            // Dashed connector between the schematic points.
            m.addSource('flow-connector', {
              type: 'geojson',
              data: {
                type: 'FeatureCollection',
                features: [
                  { type: 'Feature', geometry: { type: 'LineString', coordinates: lineCoords }, properties: {} },
                ],
              },
            });
            m.addLayer({
              id: 'flow-connector-line',
              type: 'line',
              source: 'flow-connector',
              paint: { 'line-color': '#0a2f5c', 'line-width': 2.5, 'line-dasharray': [2, 2] },
            });
          }
          m.addLayer({
            id: 'flow-points',
            type: 'circle',
            source: 'flow',
            paint: {
              'circle-radius': 8,
              'circle-color': '#0a2f5c',
              'circle-stroke-color': '#ffffff',
              'circle-stroke-width': 2,
            },
          });
          m.addLayer({
            id: 'flow-labels',
            type: 'symbol',
            source: 'flow',
            layout: {
              'text-field': ['get', 'label'],
              'text-size': 12,
              'text-offset': [0, 1.4],
              'text-font': ['Noto Sans Regular'],
            },
            paint: { 'text-color': '#111418', 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 },
          });
          m.on('click', 'flow-points', (e) => {
            const f = e.features?.[0];
            const coords = (f?.geometry as { coordinates?: [number, number] } | undefined)?.coordinates;
            const label = (f?.properties as { label?: string } | undefined)?.label;
            const role = (f?.properties as { role?: string } | undefined)?.role;
            if (!coords || !label) return;
            new maplibregl.Popup({ closeButton: false })
              .setLngLat([coords[0], coords[1]])
              .setText(`${label} (${(role ?? '').replace(/_/g, ' ')})`)
              .addTo(m);
          });
        };

        let fellBack = false;
        m.on('error', (e) => {
          // Protomaps source unreachable (bad key, offline): degrade to OSM
          // raster once instead of leaving an empty canvas.
          const sourceId = (e as { sourceId?: string }).sourceId;
          if (vector && !fellBack) {
            fellBack = true;
            m.setStyle(rasterStyle as never);
            m.once('styledata', addOverlay);
          }
        });

        m.on('load', () => {
          if (cancelled) return;
          addOverlay();
          // Frame the whole schematic with breathing room instead of a
          // fixed zoom — wide spreads (e.g. LA basins) zoom out, local
          // zones stay close.
          const bounds = flowBounds(answer.flow);
          if (bounds) {
            try {
              m.fitBounds(bounds, { padding: 48, maxZoom: 10 });
            } catch {
              // Keep the initial view; framing is cosmetic.
            }
          }
        });
        map = m;
      } catch {
        if (!cancelled) {
          setFailed(true);
        }
      }
    })();
    return () => {
      cancelled = true;
      try {
        map?.remove();
      } catch {
        // Already torn down; nothing to do.
      }
    };
  }, [answer]);

  return (
    <div className="map-card">
      {failed ? (
        <p className="map-fallback">Map tiles unavailable. The schematic flow is listed below.</p>
      ) : (
        <div
          ref={divRef}
          className="real-map"
          role="application"
          aria-label={`Map of ${answer.basins.join(' and ') || 'unverified area'} water flow`}
        />
      )}
      {answer.flow.length > 0 ? (
        <ol className="flow-strip" aria-label="Schematic water flow">
          {answer.flow.map((f, i) => {
            const meta =
              ROLE_ICON[f.role as keyof typeof ROLE_ICON] ??
              ({ icon: WavesIcon, cls: 'flow-blue', label: f.role.replace(/_/g, ' ') } as const);
            return (
              <React.Fragment key={f.label}>
                {i > 0 && (
                  <li className="flow-sep" aria-hidden="true">
                    <HugeiconsIcon icon={ArrowRight01Icon} size={16} />
                  </li>
                )}
                <li className="flow-node" title={`${f.label} (${f.role.replace(/_/g, ' ')})`}>
                  <span className={`flow-dot ${meta.cls}`}>
                    <HugeiconsIcon icon={meta.icon} size={18} />
                  </span>
                  <span className="flow-text">
                    <strong>{f.label}</strong>
                    <span className="flow-role">{meta.label}</span>
                  </span>
                </li>
              </React.Fragment>
            );
          })}
        </ol>
      ) : (
        <p className="map-fallback">Outside showcase snapshot — unverified area</p>
      )}
    </div>
  );
}
