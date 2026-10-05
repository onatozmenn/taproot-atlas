import React, { useEffect, useRef, useState } from 'react';
import type { TapAnswer } from '../api';
import { mapView } from '../geo-view';

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

export function RealMap({ answer }: { answer: TapAnswer }) {
  const divRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const [basemap, setBasemap] = useState<'protomaps' | 'osm'>('protomaps');

  useEffect(() => {
    let map: { remove: () => void } | null = null;
    let cancelled = false;
    (async () => {
      try {
        const maplibregl = await import('maplibre-gl');
        await import('maplibre-gl/dist/maplibre-gl.css');
        if (cancelled || !divRef.current) return;

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
          scrollZoom: false,
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
          if (vector && !fellBack && sourceId === 'protomaps') {
            fellBack = true;
            m.setStyle(rasterStyle as never);
            m.once('styledata', addOverlay);
            setBasemap('osm');
          }
        });

        m.on('load', () => {
          if (!cancelled) addOverlay();
        });
        if (!vector) setBasemap('osm');
        map = m;
      } catch {
        if (!cancelled) {
          setFailed(true);
          setBasemap('osm');
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
      <ul className="map-flow-list">
        {answer.flow.length > 0 ? (
          answer.flow.map((f) => (
            <li key={f.label}>
              {f.label} ({f.role.replace(/_/g, ' ')})
            </li>
          ))
        ) : (
          <li>Outside showcase snapshot — unverified area</li>
        )}
      </ul>
      <div className="map-foot">
        <span>
          {basemap === 'protomaps' ? (
            <>
              Basemap © <a href="https://protomaps.com">Protomaps</a> ©{' '}
              <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors (context only).
            </>
          ) : (
            <>Tiles © OpenStreetMap contributors (context only).</>
          )}{' '}
          Flow data: {answer.pwsid} snapshot. Schematic overlay, not an engineering alignment.
        </span>
      </div>
    </div>
  );
}
