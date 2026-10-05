#!/usr/bin/env python3
"""Pull the top-100 US community water systems from EPA SDWIS (Envirofacts
efservice, no key) and rebuild data/us-systems.json.

Provenance:
  - PWSID, name, city, state, population: EPA SDWIS WATER_SYSTEM table
    (active community systems serving >100k), sorted by population desc,
    deduplicated to the largest system per city.
  - Map centers: OSM Nominatim geocoding of "city, state" (attribute OSM).
    Cached in scripts/.cache-nominatim.json; be nice (1 req/sec).
  - The 4 curated entries keep hand-verified basins (see CURATED below).

Run: python scripts/pull-us-systems.py
"""

import json
import os
import time
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "us-systems.json")
CACHE = os.path.join(ROOT, "scripts", ".cache-nominatim.json")
EF = "https://data.epa.gov/efservice"

# Hand-verified entries: basins checked against CA SDWIS, Chicago CCR,
# LADWP supply page, Houston Public Works (see verificationSources).
CURATED = {
    "NY7003493": {
        "city": "New York",
        "basins": [{"name": "Catskill", "at": [-74.3, 42.0]}, {"name": "Delaware", "at": [-75.2, 41.7]}],
        "utilityUrl": "https://www.nyc.gov/site/dep/water/drinking-water.page",
        "reportUrl": "https://www.nyc.gov/site/dep/water/drinking-water.page",
        "metricsCurated": True,
    },
    "CA1910067": {
        "basins": [
            {"name": "Owens Valley", "at": [-118.3, 37.0]},
            {"name": "Mono Basin", "at": [-119.0, 38.0]},
            {"name": "Colorado River", "at": [-114.7, 36.0]},
        ],
        "utilityUrl": "https://www.ladwp.com/who-we-are/water-system/sources-supply",
        "reportUrl": "https://www.ladwp.com/who-we-are/water-system/las-drinking-water-quality-report",
        "metricsCurated": False,
    },
    "IL0316000": {
        "basins": [{"name": "Lake Michigan", "at": [-87.2, 42.8]}],
        "utilityUrl": "https://www.chicago.gov/city/en/depts/water/supp_info/Consumer_ConfidenceReports.html",
        "reportUrl": "https://www.chicago.gov/city/en/depts/water/supp_info/Consumer_ConfidenceReports.html",
        "metricsCurated": False,
    },
    "TX1010013": {
        "basins": [{"name": "Trinity River", "at": [-94.8, 30.6]}, {"name": "Lake Livingston", "at": [-95.1, 30.7]}],
        "utilityUrl": "https://www.houstonpublicworks.org/drinking-water-quality-report",
        "reportUrl": "https://www.houstonpublicworks.org/drinking-water-quality-report",
        "metricsCurated": False,
    },
}

UA = {"User-Agent": "taproot-atlas/0.1.0 (water-intelligence; contact: showcase-only demo)"}


def get_json(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as res:
        return json.load(res)


def main():
    systems = get_json(
        f"{EF}/WATER_SYSTEM/PWS_TYPE_CODE/=/CWS/PWS_ACTIVITY_CODE/=/A/"
        "POPULATION_SERVED_COUNT/>/100000/JSON"
    )
    print(f"EPA SDWIS active CWS >100k: {len(systems)}")

    # Largest system per city, then top 100 cities by population.
    by_city = {}
    for s in systems:
        try:
            pop = int(s.get("population_served_count") or 0)
        except (TypeError, ValueError):
            pop = 0
        key = ((s.get("city_name") or "").strip().upper(), (s.get("state_code") or "").strip().upper())
        if not key[0] or not key[1]:
            continue
        if key not in by_city or pop > by_city[key][0]:
            by_city[key] = (pop, s)
    ranked = sorted(by_city.values(), key=lambda t: -t[0])
    print(f"unique cities: {len(by_city)}")

    cache = {}
    if os.path.exists(CACHE):
        cache = json.load(open(CACHE))

    entries = []
    skipped = []
    for pop, s in ranked:
        if len(entries) >= 100:
            break
        pwsid = s["pwsid"]
        curated = CURATED.get(pwsid, {})
        city = curated.get("city", s["city_name"].strip())
        state = s["state_code"].strip()
        name = (s.get("pws_name") or "").strip().title()
        if pwsid in CURATED:
            center = {"NY7003493": [-73.97, 40.78], "CA1910067": [-118.25, 34.05],
                      "IL0316000": [-87.63, 41.88], "TX1010013": [-95.37, 29.76]}[pwsid]
        else:
            q = f"{city}, {state}"
            if q not in cache:
                url = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode(
                    {"q": q, "format": "json", "limit": 1, "countrycodes": "us"}
                )
                res = get_json(url)
                if not res:
                    skipped.append(q)
                    print(f"nominatim: no result for {q}, skipping")
                    time.sleep(1.1)
                    continue
                cache[q] = [float(res[0]["lon"]), float(res[0]["lat"])]
                json.dump(cache, open(CACHE, "w"), indent=1)
                time.sleep(1.1)
            center = cache[q]
        aliases = [city.lower()]
        if city.lower().startswith("st. "):
            aliases.append("saint " + city[4:].lower())
        if pwsid == "NY7003493":
            aliases = ["new york", "new york city", "nyc"]
        if pwsid == "CA1910067":
            aliases = ["los angeles", "ladwp", "l.a."]
        entry = {
            "pwsid": pwsid,
            "systemName": name or f"{city} Water System",
            "city": city.title() if city.isupper() else city,
            "state": state,
            "aliases": sorted(set(aliases)),
            "center": [round(center[0], 4), round(center[1], 4)],
            "boundaryType": "modeled_epa" if pwsid == "NY7003493" else "unverified_fallback",
            "basins": curated.get("basins", []),
            "populationServed": pop,
            "metricsCurated": curated.get("metricsCurated", False),
        }
        if curated.get("utilityUrl"):
            entry["utilityUrl"] = curated["utilityUrl"]
        if curated.get("reportUrl"):
            entry["reportUrl"] = curated["reportUrl"]
        entries.append(entry)

    print(f"skipped (no geocode): {skipped}")
    doc = {
        "snapshotVersion": "us-systems-2026-10-v1",
        "captureTime": time.strftime("%Y-%m-%dT00:00:00Z", time.gmtime()),
        "provenanceNote": (
            "Top-100 US community water systems by population served, from EPA SDWIS "
            "(Envirofacts efservice WATER_SYSTEM: active CWS serving >100k, largest per city). "
            "Map centers geocoded via OSM Nominatim. Only the 4 curated entries ship verified "
            "basins and utility links (see verificationSources); the rest carry PWSID + city + "
            "center with pending compliance and no lab metrics. Schematic points are representative "
            "and approximate, never engineering alignments."
        ),
        "verificationSources": [
            "https://data.epa.gov/efservice (WATER_SYSTEM table)",
            "https://nominatim.openstreetmap.org (map centers)",
            "https://sdwis.waterboards.ca.gov/PDWW/JSP/WaterSystemDetail.jsp?tinwsys_is_number=2544&tinwsys_st_code=CA",
            "https://chicagoccr.org/docs/2025_WaterQualityReport.pdf",
            "https://www.ladwp.com/who-we-are/water-system/sources-supply",
            "https://www.houstonpublicworks.org/drinking-water-quality-report",
        ],
        "systems": entries,
    }
    json.dump(doc, open(OUT, "w"), indent=2)
    print(f"wrote {OUT} with {len(entries)} systems")


if __name__ == "__main__":
    main()
