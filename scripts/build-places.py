#!/usr/bin/env python3
"""Build-time vendor: Census 2024 Gazetteer places + ZCTAs -> compact lookup.
Inputs: 2024_Gaz_place_national.txt, 2024_Gaz_zcta_national.txt
        (https://www.census.gov/geographies/reference-files/time-series/geo/gazetteer-files.html)
Output: data/national/places.json  {places: [[name, ST, lat, lon]], zips: {zip: [lat, lon]}}
Names drop the legal suffix (city, town, CDP, village, borough...). Coordinates
are Census internal points, used only to center the schematic map.
Usage: python scripts/build-places.py <place.txt> <zcta.txt> <out.json>
"""
import sys, csv, json, re
SUFFIX = re.compile(r"\s+(city and borough|consolidated government \(balance\)|metropolitan government \(balance\)|unified government \(balance\)|city|town|township|village|borough|CDP|municipality|comunidad|zona urbana|urban county|corporation|plantation)$", re.I)
place, zcta, out = sys.argv[1:]
places = []
with open(place, encoding='latin-1') as f:
    rd = csv.reader(f, delimiter='\t'); next(rd)
    for r in rd:
        r = [x.strip() for x in r]
        name = SUFFIX.sub('', r[3]).strip()
        name = re.sub(r"\s*\(balance\)$", '', name)
        places.append([name, r[0], round(float(r[10]), 4), round(float(r[11]), 4)])
        # "Boise City city" -> also "Boise" (people rarely say the legal name)
        if r[3].endswith(' City city') and name.endswith(' City'):
            base = name[:-5].strip()
            if len(base) >= 4:
                places.append([base, r[0], round(float(r[10]), 4), round(float(r[11]), 4)])
zips = {}
with open(zcta, encoding='latin-1') as f:
    rd = csv.reader(f, delimiter='\t'); next(rd)
    for r in rd:
        r = [x.strip() for x in r]
        zips[r[0]] = [round(float(r[5]), 3), round(float(r[6]), 3)]
# Place names that are also everyday English words ("Tell", "Okay", "Hope").
# Runtime only accepts them with a state or when typed capitalized, unless a
# large system serves them (Denver, Phoenix are common words too).
try:
    from wordfreq import top_n_list
    common_words = set(top_n_list('en', 30000))
except Exception:
    common_words = set()
common = sorted({p[0].lower() for p in places if ' ' not in p[0] and p[0].lower() in common_words})
json.dump({'commonWordPlaces': common, 'source': 'US Census Bureau 2024 Gazetteer Files', 'sourceUrl': 'https://www.census.gov/geographies/reference-files/time-series/geo/gazetteer-files.html', 'places': places, 'zips': zips}, open(out, 'w'), separators=(',', ':'))
print(len(places), 'places', len(zips), 'zips')
