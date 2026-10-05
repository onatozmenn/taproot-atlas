// Pure view helpers for the schematic map (tested; MapLibre stays in the component).
export interface FlowNode {
  label: string;
  role: string;
  /** [lon, lat] as stored in the schematic GeoJSON. */
  at: [number, number];
}

/** GeoJSON [lon, lat] → map [lat, lon] (kept for tests and list views). Drops non-finite points. */
export function toLatLngs(nodes: FlowNode[]): Array<[number, number]> {
  return nodes
    .filter((n) => Number.isFinite(n.at[0]) && Number.isFinite(n.at[1]))
    .map((n) => [n.at[1], n.at[0]]);
}

/** Center + zoom for the current schematic; falls back to the NYC showcase view. */
export function mapView(nodes: FlowNode[]): { center: [number, number]; zoom: number } {
  const valid = nodes.filter((n) => Number.isFinite(n.at[0]) && Number.isFinite(n.at[1]));
  if (valid.length === 0) return { center: [40.78, -73.97], zoom: 10 };
  const lats = valid.map((n) => n.at[1]);
  const lons = valid.map((n) => n.at[0]);
  const span = Math.max(Math.max(...lats) - Math.min(...lats), Math.max(...lons) - Math.min(...lons));
  const center: [number, number] = [
    (Math.min(...lats) + Math.max(...lats)) / 2,
    (Math.min(...lons) + Math.max(...lons)) / 2,
  ];
  return { center, zoom: span > 2 ? 7 : 10 };
}

/**
 * MapLibre-ready bounding box [[minLon, minLat], [maxLon, maxLat]] for
 * fitBounds framing. Null when there is nothing to frame (or a single
 * point, where fitBounds would degenerate — use mapView instead).
 */
export function flowBounds(nodes: FlowNode[]): [[number, number], [number, number]] | null {
  const valid = nodes.filter((n) => Number.isFinite(n.at[0]) && Number.isFinite(n.at[1]));
  if (valid.length < 2) return null;
  const lats = valid.map((n) => n.at[1]);
  const lons = valid.map((n) => n.at[0]);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  if (minLat === maxLat && minLon === maxLon) return null;
  return [
    [minLon, minLat],
    [maxLon, maxLat],
  ];
}
