import { describe, it, expect } from 'vitest';
import { toLatLngs, mapView } from './geo-view';

const nodes = [
  { label: 'Catskill Watershed', role: 'watershed', at: [-74.3, 42.0] as [number, number] },
  { label: 'Treatment', role: 'treatment_facility', at: [-73.9, 40.9] as [number, number] },
];

describe('geo-view', () => {
  it('swaps GeoJSON order to Leaflet order', () => {
    expect(toLatLngs(nodes)).toEqual([[42.0, -74.3], [40.9, -73.9]]);
  });

  it('zooms out for wide basins, in for local zones', () => {
    expect(mapView(nodes).zoom).toBe(10);
    expect(mapView([])).toEqual({ center: [40.78, -73.97], zoom: 10 });
    const wide = [...nodes, { label: 'Far', role: 'watershed', at: [-70.0, 38.0] as [number, number] }];
    expect(mapView(wide).zoom).toBe(7);
  });
});
