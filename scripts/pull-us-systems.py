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
    "TX0150018": {
        "basins": [{"name": "Edwards Aquifer", "at": [-98.6, 29.6]}],
        "utilityUrl": "https://www.saws.org/your-water/management-sources/",
        "reportUrl": "https://www.saws.org/your-water/management-sources/",
        "metricsCurated": False,
    },
    "MA6000000": {
        "aliases": ["chelsea", "boston", "mwra"],
        "basins": [{"name": "Quabbin Reservoir", "at": [-72.3, 42.3]}, {"name": "Wachusett Reservoir", "at": [-71.7, 42.4]}],
        "utilityUrl": "https://www.mwra.com/your-water-system",
        "reportUrl": "https://www.mwra.com/your-water-system",
        "metricsCurated": False,
    },
    "FL4130871": {
        "aliases": ["miami", "miami-dade"],
        "basins": [{"name": "Biscayne Aquifer", "at": [-80.3, 25.7]}],
        "utilityUrl": "https://www.miamidade.gov/global/water/water-supply-and-treatment.page",
        "reportUrl": "https://www.miamidade.gov/global/water/water-supply-and-treatment.page",
        "metricsCurated": False,
    },
    "MD0150005": {
        "aliases": ["laurel", "wssc"],
        "basins": [{"name": "Patuxent River", "at": [-76.7, 39.0]}, {"name": "Potomac River", "at": [-77.25, 39.0]}],
        "utilityUrl": "https://www.wsscwater.com/mywater",
        "reportUrl": "https://www.wsscwater.com/mywater",
        "metricsCurated": False,
    },
    "MD0300002": {
        "basins": [
            {"name": "Liberty Reservoir", "at": [-76.9, 39.6]},
            {"name": "Loch Raven Reservoir", "at": [-76.55, 39.45]},
            {"name": "Prettyboy Reservoir", "at": [-76.75, 39.6]},
        ],
        "utilityUrl": "https://www.baltimorecity.gov/publicworks/water-system-in-the-city/water-quality",
        "reportUrl": "https://www.baltimorecity.gov/publicworks/water-system-in-the-city/water-quality",
        "metricsCurated": False,
    },
    "PA1510001": {
        "aliases": ["philadelphia", "philly"],
        "basins": [{"name": "Delaware River", "at": [-75.05, 40.0]}, {"name": "Schuylkill River", "at": [-75.2, 40.0]}],
        "utilityUrl": "https://water.phila.gov/drinking-water/",
        "reportUrl": "https://water.phila.gov/drinking-water/",
        "metricsCurated": False,
    },
    "NV0000090": {
        "aliases": ["las vegas", "vegas", "snwa"],
        "basins": [{"name": "Lake Mead", "at": [-114.7, 36.1]}, {"name": "Colorado River", "at": [-114.6, 34.3]}],
        "utilityUrl": "https://www.snwa.com/water-resources/where-water-comes-from/",
        "reportUrl": "https://www.snwa.com/water-resources/where-water-comes-from/",
        "metricsCurated": False,
    },
    "CA0110005": {
        "aliases": ["oakland", "ebmud"],
        "basins": [{"name": "Mokelumne River", "at": [-120.85, 38.25]}],
        "utilityUrl": "https://www.ebmud.com/water/about-your-water",
        "reportUrl": "https://www.ebmud.com/water/about-your-water",
        "metricsCurated": False,
    },
    "CA3710020": {
        "basins": [{"name": "Colorado River", "at": [-114.6, 34.3]}, {"name": "State Water Project", "at": [-121.8, 38.0]}],
        "utilityUrl": "https://www.sandiego.gov/public-utilities/sustainability/water-supply",
        "reportUrl": "https://www.sandiego.gov/public-utilities/sustainability/water-supply",
        "metricsCurated": False,
    },
    "TX0570004": {
        "basins": [
            {"name": "Elm Fork Trinity River", "at": [-96.95, 32.95]},
            {"name": "Lewisville Lake", "at": [-97.0, 33.05]},
            {"name": "Ray Hubbard Lake", "at": [-96.5, 32.8]},
        ],
        "utilityUrl": "https://dallascityhall.com/departments/waterutilities/Pages/water_quality_information.aspx",
        "reportUrl": "https://dallascityhall.com/departments/waterutilities/Pages/water_quality_information.aspx",
        "metricsCurated": False,
    },
    "OH1801212": {
        "basins": [{"name": "Lake Erie", "at": [-81.9, 41.9]}],
        "utilityUrl": "https://www.clevelandwater.com/your-water/lake-erie",
        "reportUrl": "https://www.clevelandwater.com/your-water/lake-erie",
        "metricsCurated": False,
    },
    "OH2504412": {
        "basins": [
            {"name": "Scioto River", "at": [-83.05, 40.0]},
            {"name": "Big Walnut Creek", "at": [-82.8, 40.1]},
            {"name": "Alum Creek", "at": [-82.85, 40.15]},
        ],
        "utilityUrl": "https://www.columbus.gov/files/sharedassets/city/v/3/utilities/documents/water-publications/facts-on-columbus-water-reservoirs-brochure.pdf",
        "reportUrl": "https://www.columbus.gov/files/sharedassets/city/v/3/utilities/documents/water-publications/facts-on-columbus-water-reservoirs-brochure.pdf",
        "metricsCurated": False,
    },
    "CO0116001": {
        "basins": [{"name": "South Platte River", "at": [-105.0, 39.6]}, {"name": "Colorado River", "at": [-106.05, 39.6]}],
        "utilityUrl": "https://www.denverwater.org/tap/where-does-your-water-come",
        "reportUrl": "https://www.denverwater.org/tap/where-does-your-water-come",
        "metricsCurated": False,
    },
    "NC0160010": {
        "basins": [{"name": "Mountain Island Lake", "at": [-80.9, 35.4]}, {"name": "Lake Norman", "at": [-80.85, 35.55]}],
        "utilityUrl": "https://www.charlottenc.gov/water/Water-Quality",
        "reportUrl": "https://www.charlottenc.gov/water/Water-Quality",
        "metricsCurated": False,
    },
    "WA5377050": {
        "basins": [{"name": "Cedar River", "at": [-121.9, 47.35]}, {"name": "Tolt River", "at": [-121.7, 47.7]}],
        "utilityUrl": "https://www.seattle.gov/utilities/protecting-our-environment/our-water-sources",
        "reportUrl": "https://www.seattle.gov/utilities/protecting-our-environment/our-water-sources",
        "metricsCurated": False,
    },
    "TX2270001": {
        "basins": [{"name": "Colorado River", "at": [-97.8, 30.4]}, {"name": "Highland Lakes", "at": [-98.1, 30.5]}],
        "utilityUrl": "https://www.austintexas.gov/water/programs/water-quality-reports",
        "reportUrl": "https://www.austintexas.gov/water/programs/water-quality-reports",
        "metricsCurated": False,
    },
    "GA1210001": {
        "basins": [{"name": "Chattahoochee River", "at": [-84.4, 33.9]}, {"name": "Lake Lanier", "at": [-84.0, 34.1]}],
        "utilityUrl": "https://atlantawatershed.org/water-quality-faqs/",
        "reportUrl": "https://atlantawatershed.org/water-quality-faqs/",
        "metricsCurated": False,
    },
    "CA4310011": {
        "basins": [{"name": "Santa Clara Groundwater Basin", "at": [-121.9, 37.3]}, {"name": "Hetch Hetchy", "at": [-119.8, 37.95]}],
        "utilityUrl": "https://www.sjwater.com/customer-care/help-information/water-supply-faqs/",
        "reportUrl": "https://www.sjwater.com/customer-care/help-information/water-supply-faqs/",
        "metricsCurated": False,
    },
    "VA6059501": {
        "aliases": ["herndon", "fairfax water"],
        "basins": [{"name": "Potomac River", "at": [-77.25, 39.0]}, {"name": "Occoquan Reservoir", "at": [-77.3, 38.65]}],
        "utilityUrl": "https://www.fairfaxwater.org/about-us",
        "reportUrl": "https://www.fairfaxwater.org/about-us",
        "metricsCurated": False,
    },
    "NY5110526": {
        "aliases": ["hauppauge", "suffolk"],
        "basins": [{"name": "Long Island Aquifers", "at": [-72.9, 40.85]}],
        "utilityUrl": "https://www.scwa.com/sourcetotap/",
        "reportUrl": "https://www.scwa.com/sourcetotap/",
        "metricsCurated": False,
    },
    "GA1350004": {
        "aliases": ["lawrenceville", "gwinnett"],
        "basins": [{"name": "Lake Lanier", "at": [-84.0, 34.1]}],
        "utilityUrl": "https://www.gwinnettcounty.com/government/departments/water/what-we-do/drinking-water/quality",
        "reportUrl": "https://www.gwinnettcounty.com/government/departments/water/what-we-do/drinking-water/quality",
        "metricsCurated": False,
    },
    "TX2200012": {
        "basins": [
            {"name": "Eagle Mountain Lake", "at": [-97.5, 32.95]},
            {"name": "Richland Chambers Reservoir", "at": [-96.1, 31.95]},
            {"name": "Cedar Creek Reservoir", "at": [-96.25, 32.2]},
        ],
        "utilityUrl": "https://www.fortworthtexas.gov/departments/water",
        "reportUrl": "https://www.fortworthtexas.gov/departments/water",
        "metricsCurated": False,
    },
    "IN5249004": {
        "basins": [
            {"name": "White River", "at": [-86.1, 39.9]},
            {"name": "Geist Reservoir", "at": [-85.95, 39.95]},
            {"name": "Eagle Creek Reservoir", "at": [-86.3, 39.85]},
        ],
        "utilityUrl": "https://info.citizensenergygroup.com/water",
        "reportUrl": "https://info.citizensenergygroup.com/water",
        "metricsCurated": False,
    },
    "CA3810011": {
        "basins": [{"name": "Hetch Hetchy Reservoir", "at": [-119.8, 37.95]}],
        "utilityUrl": "https://www.burlingame.org/1007/Water-Quality",
        "reportUrl": "https://www.burlingame.org/1007/Water-Quality",
        "metricsCurated": False,
    },
    "FL2161328": {
        "aliases": ["jacksonville", "jea"],
        "basins": [{"name": "Floridan Aquifer", "at": [-81.6, 30.3]}],
        "utilityUrl": "https://www.jea.com/about/water_supply/",
        "reportUrl": "https://www.jea.com/about/water_supply/",
        "metricsCurated": False,
    },
    "KY0560258": {
        "basins": [{"name": "Ohio River", "at": [-85.75, 38.27]}],
        "utilityUrl": "https://louisvillewater.com/your-water/water-quality/riverbank-filtration/",
        "reportUrl": "https://louisvillewater.com/your-water/water-quality/riverbank-filtration/",
        "metricsCurated": False,
    },
    "PA1460073": {
        "aliases": ["bryn mawr"],
        "basins": [{"name": "Crum Creek", "at": [-75.35, 39.9]}, {"name": "Pickering Creek", "at": [-75.55, 40.1]}],
        "utilityUrl": "https://www.aquawater.com/all-about-water-wastewater/water-quality",
        "reportUrl": "https://www.aquawater.com/all-about-water-wastewater/water-quality",
        "metricsCurated": False,
    },
    "OH3102612": {
        "basins": [{"name": "Ohio River", "at": [-84.5, 39.1]}, {"name": "Great Miami Aquifer", "at": [-84.4, 39.35]}],
        "utilityUrl": "https://www.cincinnati-oh.gov/water/water-quality-and-treatment/water-sources-resource-protection/",
        "reportUrl": "https://www.cincinnati-oh.gov/water/water-quality-and-treatment/water-sources-resource-protection/",
        "metricsCurated": False,
    },
    "TX0710002": {
        "aliases": ["el paso"],
        "basins": [{"name": "Rio Grande", "at": [-106.45, 31.8]}, {"name": "Hueco Bolson", "at": [-106.2, 31.9]}],
        "utilityUrl": "https://www.epwater.org/our-water/water-resources",
        "reportUrl": "https://www.epwater.org/our-water/water-resources",
        "metricsCurated": False,
    },
    "FL6290327": {
        "basins": [{"name": "Hillsborough River", "at": [-82.45, 28.05]}],
        "utilityUrl": "https://www.tampa.gov/water",
        "reportUrl": "https://www.tampa.gov/water",
        "metricsCurated": False,
    },
    "GA0670003": {
        "aliases": ["marietta", "cobb"],
        "basins": [{"name": "Chattahoochee River", "at": [-84.55, 33.9]}, {"name": "Lake Allatoona", "at": [-84.7, 34.15]}],
        "utilityUrl": "https://www.cobbcounty.gov/water",
        "reportUrl": "https://www.cobbcounty.gov/water",
        "metricsCurated": False,
    },
    "PA5020039": {
        "aliases": ["elrama", "pittsburgh"],
        "basins": [{"name": "Allegheny River", "at": [-79.95, 40.45]}],
        "utilityUrl": "https://www.pgh2o.com/your-water/water-quality-treatment",
        "reportUrl": "https://www.pgh2o.com/your-water/water-quality-treatment",
        "metricsCurated": False,
    },
    "NJ0238001": {
        "aliases": ["haworth", "hackensack"],
        "basins": [{"name": "Hackensack River", "at": [-74.0, 40.95]}],
        "utilityUrl": "https://www.veolianorthamerica.com/media/press-releases/veolia-celebrates-centennial-oradell-dam",
        "reportUrl": "https://www.veolianorthamerica.com/media/press-releases/veolia-celebrates-centennial-oradell-dam",
        "metricsCurated": False,
    },
    "MA3035000": {
        "aliases": ["boston"],
        "basins": [{"name": "Quabbin Reservoir", "at": [-72.3, 42.3]}, {"name": "Wachusett Reservoir", "at": [-71.7, 42.4]}],
        "utilityUrl": "https://www.bwsc.org/environment-education/water-sewer-and-stormwater/water-system",
        "reportUrl": "https://www.bwsc.org/environment-education/water-sewer-and-stormwater/water-system",
        "metricsCurated": False,
    },
    "FL4504393": {
        "aliases": ["west palm beach", "west palm"],
        "basins": [{"name": "Grassy Waters Preserve", "at": [-80.15, 26.75]}],
        "utilityUrl": "https://www.wpb.org/Departments/Public-Utilities/Our-Watershed",
        "reportUrl": "https://www.wpb.org/Departments/Public-Utilities/Our-Watershed",
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
        if pwsid in ("NY7003493", "CA1910067", "IL0316000", "TX1010013"):
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
        if "aliases" in curated:
            aliases = curated["aliases"]
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
