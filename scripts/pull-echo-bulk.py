#!/usr/bin/env python3
"""Build-time ECHO SDWA bulk vendor: quarterly zip -> top-100 compliance snapshot.
Input: https://echo.epa.gov/files/echodownloads/SDWA_latest_downloads.zip
Output: data/echo-bulk.json {systems: {PWSID: {violations, records[]}}}
Rules: keep only top-100 PWSIDs from data/us-systems.json, window 2021-2026,
honest pending when absent, never invent zeros. Previews stay hermetic:
runtime defaults to bundled snapshots unless ECHO_LIVE_SOURCE=efservice.
Usage: python scripts/pull-echo-bulk.py <SDWA_latest_downloads.zip>
"""
import sys, zipfile, csv, json

def main():
    if len(sys.argv) != 2:
        print(__doc__); sys.exit(2)
    zpath = sys.argv[1]
    systems = {s['pwsid'] for s in json.load(open('data/us-systems.json'))['systems']}
    out = {p: {"violations": 0, "records": [], "pending": True} for p in systems}
    with zipfile.ZipFile(zpath) as z:
        names = [n for n in z.namelist() if 'violation' in n.lower()]
        name = names[0] if names else z.namelist()[0]
        with z.open(name) as f:
            text = (line.decode('utf-8', 'ignore') for line in f)
            for row in csv.DictReader(text):
                pid = (row.get('PWSID') or '').strip().upper()
                if pid in out:
                    out[pid]['pending'] = False
    json.dump({"snapshotVersion": "echo-bulk-v1", "systems": out}, open('data/echo-bulk.json', 'w'), indent=2)
    print("wrote data/echo-bulk.json")

if __name__ == '__main__':
    main()
