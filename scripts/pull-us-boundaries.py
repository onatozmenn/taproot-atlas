#!/usr/bin/env python3
"""Pull EPA service-area boundary rings for every PWSID in data/us-systems.json.

Source: EPA Community Water System Service Area Boundaries (ArcGIS
FeatureServer, national dataset covering ~99% of CWS population).
Query per PWSID with reduced geometry precision, then radial-distance
simplification. Output: data/us-boundaries.json (rings only, no PII).

Run: python scripts/pull-us-boundaries.py
"""

import json
import math
import os
import time
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SYSTEMS = os.path.join(ROOT, "data", "us-systems.json")
OUT = os.path.join(ROOT, "data", "us-boundaries.json")

FS = "https://services2.arcgis.com/StPxaQgNkHR75lJU/ArcGIS/rest/services/EPA_Community_Water_System_Service_Area_Boundaries/FeatureServer/8/query"
UA = {"User-Agent": "taproot-atlas/0.1.0 (water-intelligence; contact: showcase-only demo)"}


def get_json(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as res:
        return json.load(res)


def perp_dist(p, a, b):
    dx, dy = b[0] - a[0], b[1] - a[1]
    denom = math.hypot(dx, dy)
    if denom == 0:
        return math.hypot(p[0] - a[0], p[1] - a[1])
    return abs((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) / denom


def simplify_ring(ring, tol=0.004):
    """Radial-distance decimation; keeps first/last closure."""
    if len(ring) <= 16:
        return ring
    out = [ring[0]]
    for p in ring[1:-1]:
        if perp_dist(p, out[-1], ring[-1]) > tol or math.hypot(p[0] - out[-1][0], p[1] - out[-1][1]) > tol * 4:
            out.append(p)
    out.append(ring[-1])
    return out


def main():
    systems = json.load(open(SYSTEMS))["systems"]
    print(f"systems: {len(systems)}")
    out_systems = []
    missing = []
    statuses = {}
    for s in systems:
        pwsid = s["pwsid"]
        q = urllib.parse.urlencode(
            {
                "where": f"PWSID='{pwsid}'",
                "outFields": "PWSID,Verification_Status",
                "returnGeometry": "true",
                "geometryPrecision": "3",
                "f": "geojson",
            }
        )
        try:
            d = get_json(f"{FS}?{q}")
        except Exception as e:  # noqa: BLE001 - network best effort, reported below
            print(f"{pwsid}: fetch failed ({e})")
            missing.append(pwsid)
            time.sleep(0.5)
            continue
        feats = d.get("features", [])
        if not feats:
            missing.append(pwsid)
            time.sleep(0.3)
            continue
        rings = []
        status = ""
        for f in feats:
            props = f.get("properties", {}) or {}
            status = status or props.get("Verification_Status", "")
            g = f.get("geometry") or {}
            polys = g.get("coordinates") or []
            # MultiPolygon: [poly[ring[pt]]]; Polygon: [ring[pt]]
            if g.get("type") == "Polygon":
                polys = [polys]
            for poly in polys:
                for ring in poly:
                    if len(ring) >= 4:
                        rings.append([[round(x, 3), round(y, 3)] for x, y in simplify_ring(ring)])
        statuses[status] = statuses.get(status, 0) + 1
        out_systems.append({"pwsid": pwsid, "verificationStatus": status, "rings": rings})
        time.sleep(0.3)
    doc = {
        "snapshotVersion": "us-boundaries-2026-10-v1",
        "captureTime": time.strftime("%Y-%m-%dT00:00:00Z", time.gmtime()),
        "provenanceNote": (
            "Service-area rings from the EPA national boundaries FeatureServer, "
            "geometryPrecision 3 + radial simplification. Schematic/coarse only: "
            "resolution and orientation, never a legal definition."
        ),
        "source": "https://services2.arcgis.com/StPxaQgNkHR75lJU/ArcGIS/rest/services/EPA_Community_Water_System_Service_Area_Boundaries/FeatureServer",
        "systems": out_systems,
    }
    json.dump(doc, open(OUT, "w"))
    print(f"matched: {len(out_systems)}, missing: {missing}")
    print(f"verification statuses: {statuses}")
    print(f"bytes: {os.path.getsize(OUT)}")


if __name__ == "__main__":
    main()
