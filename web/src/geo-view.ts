// Pure view helpers for the real map (tested; Leaflet stays in the component).
export interface FlowNode {
  label: string;
  role: string;
  /** [lon, lat] as stored in the schematic GeoJSON. */
  at: [number, number];
}

/** GeoJSON [lon, lat] → Leaflet [lat, lon]. */
export function toLatLngs(nodes: FlowNode[]): Array<[number, number]> {
  return nodes.map((n) => [n.at[1], n.at[0]]);
}

/** Center + zoom for the current schematic; falls back to the NYC showcase view. */
export function mapView(nodes: FlowNode[]): { center: [number, number]; zoom: number } {
  if (nodes.length === 0) return { center: [40.78, -73.97], zoom: 10 };
  const lats = nodes.map((n) => n.at[1]);
  const lons = nodes.map((n) => n.at[0]);
  const span = Math.max(Math.max(...lats) - Math.min(...lats), Math.max(...lons) - Math.min(...lons));
  const center: [number, number] = [
    (Math.min(...lats) + Math.max(...lats)) / 2,
    (Math.min(...lons) + Math.max(...lons)) / 2,
  ];
  return { center, zoom: span > 2 ? 7 : 10 };
}
