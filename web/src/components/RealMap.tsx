import React, { useEffect, useRef, useState } from 'react';
import type { TapAnswer } from '../api';
import { toLatLngs, mapView } from '../geo-view';

/**
 * Real tile layer (OSM) with the Resolver schematic drawn on top.
 * Tiles are context only: facts, badges, and disclaimers stay Resolver-owned.
 */
export function RealMap({ answer }: { answer: TapAnswer }) {
  const divRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const badge =
    answer.boundaryType === 'VERIFIED_AGENCY'
      ? { text: 'Verified boundary', cls: 'badge-verified' }
      : answer.boundaryType === 'MODELED_EPA'
        ? { text: 'Modeled boundary', cls: 'badge-modeled' }
        : { text: 'Unverified boundary', cls: 'badge-modeled' };

  useEffect(() => {
    let map: { remove: () => void } | null = null;
    let cancelled = false;
    (async () => {
      try {
        const L = await import('leaflet');
        await import('leaflet/dist/leaflet.css');
        if (cancelled || !divRef.current) return;
        const { center, zoom } = mapView(answer.flow);
        const m = L.map(divRef.current, { scrollWheelZoom: false }).setView(center, zoom);
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 18,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(m);
        const latlngs = toLatLngs(answer.flow);
        for (const [i, ll] of latlngs.entries()) {
          L.circleMarker(ll, { radius: 8 }).addTo(m).bindPopup(answer.flow[i].label);
        }
        if (latlngs.length > 1) L.polyline(latlngs, { dashArray: '6 6' }).addTo(m);
        map = m;
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [answer]);

  return (
    <div className="map-card">
      <div className="map-head">
        <span className={`badge ${badge.cls}`}>
          {badge.text}
        </span>
        <span className="map-note">Schematic overlay — not an engineering alignment</span>
      </div>
      {failed ? (
        <p className="map-fallback">Map tiles unavailable. The schematic flow is listed below.</p>
      ) : (
        <div ref={divRef} className="real-map" role="application" aria-label={`Map of ${answer.basins.join(' and ') || 'unverified area'} water flow`} />
      )}
      <ul className="map-flow-list">
        {answer.flow.length > 0 ? (
          answer.flow.map((f) => <li key={f.label}>{f.label} ({f.role.replace(/_/g, ' ')})</li>)
        ) : (
          <li>Outside showcase snapshot — unverified area</li>
        )}
      </ul>
      <div className="map-foot">
        <span>Tiles © OpenStreetMap contributors (context only). Flow data: {answer.pwsid} snapshot.</span>
      </div>
    </div>
  );
}
