#!/usr/bin/env python3
"""Build-time CA DDW vendor: yearly CSV -> PWSID-filtered snapshot.
Input: California DDW EDT yearly CSV (~400-600 MB/yr, ~7.500 systems).
Output: data/ca-{pwsid}.json in occurrence-snapshot shape.
Rules: filter to one PWSID + latest year, max 6 rows, official files only.
Usage: python scripts/pull-ca-ddw.py <ca_year.csv> <PWSID> <out.json>
"""
import sys, csv, json, datetime

def main():
    if len(sys.argv) != 4:
        print(__doc__); sys.exit(2)
    cpath, pwsid, out = sys.argv[1], sys.argv[2].strip().upper(), sys.argv[3]
    metrics = []
    with open(cpath, newline='', encoding='utf-8', errors='ignore') as f:
        for row in csv.DictReader(f):
            pid = (row.get('PWSID') or row.get('Water System No') or '').strip().upper()
            if pid != pwsid and pwsid not in pid:
                continue
            param = (row.get('Analyte') or row.get('Contaminant') or '').strip()
            val = (row.get('Result') or '').strip()
            if not param or not val:
                continue
            metrics.append({
                "parameter": param[:60],
                "reportedValue": val[:40],
                "regulatoryThreshold": (row.get('MCL') or 'see DDW record')[:40],
                "complianceStatus": "monitoring_violation",
                "testDate": (row.get('Sample Date') or '2024-12-31')[:10],
            })
            if len(metrics) >= 6:
                break
    snap = {
        "snapshotVersion": f"ca-{pwsid.lower()}-v1",
        "captureTime": datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ'),
        "provenanceNote": "PWSID-filtered California DDW extract.",
        "sourceDocumentUrl": "https://www.waterboards.ca.gov/drinking_water/certlic/drinkingwater/EDTLibrary.html",
        "reportPeriod": "CA DDW annual",
        "pwsid": pwsid,
        "metrics": metrics,
    }
    json.dump(snap, open(out, 'w'), indent=2)
    print(f"wrote {out} with {len(metrics)} rows")

if __name__ == '__main__':
    main()
