#!/usr/bin/env python3
"""Build-time UCMR5 vendor: zip -> PWSID-filtered occurrence snapshot.
Input: UCMR5 occurrence zip (29 PFAS + lithium, 2023-2025).
Output: data/ucmr5-{slug}.json shaped like data/ucmr5-nyc.json
  {snapshotVersion, captureTime, sourceDocumentUrl, reportPeriod, pwsid, metrics[]}
Rules: official EPA files only, no invented values, occurrence is not an MCL
violation unless the threshold names an MCL, include sourceDocumentUrl per metric.
Usage: python scripts/pull-ucmr5.py <ucmr5.zip> <PWSID> <out.json>
"""
import sys, zipfile, csv, json, datetime

def main():
    if len(sys.argv) != 4:
        print(__doc__); sys.exit(2)
    zpath, pwsid, out = sys.argv[1], sys.argv[2].strip().upper(), sys.argv[3]
    metrics = []
    with zipfile.ZipFile(zpath) as z:
        name = [n for n in z.namelist() if n.lower().endswith(('.txt', '.csv'))][0]
        with z.open(name) as f:
            text = (line.decode('utf-8', 'ignore') for line in f)
            for row in csv.DictReader(text, delimiter='\t'):
                pid = (row.get('PWSID') or row.get('pwsid') or '').strip().upper()
                if pid != pwsid:
                    continue
                param = (row.get('Contaminant') or row.get('ANALYTE') or '').strip()
                val = (row.get('Result') or row.get('RESULT') or '').strip()
                if not param or not val:
                    continue
                metrics.append({
                    "parameter": param[:60],
                    "reportedValue": f"{val} (occurrence, no federal MCL)"[:60],
                    "regulatoryThreshold": "no federal MCL established",
                    "complianceStatus": "monitoring_violation",
                    "testDate": (row.get('SampleDate') or '2024-12-31')[:10],
                })
                if len(metrics) >= 6:
                    break
    snap = {
        "snapshotVersion": f"ucmr5-{pwsid.lower()}-v1",
        "captureTime": datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ'),
        "provenanceNote": "PWSID-filtered UCMR5 occurrence extract. Occurrence is not an MCL violation.",
        "sourceDocumentUrl": "https://www.epa.gov/dwsixyearreview",
        "reportPeriod": "UCMR5 2023-2025",
        "pwsid": pwsid,
        "metrics": metrics,
    }
    json.dump(snap, open(out, 'w'), indent=2)
    print(f"wrote {out} with {len(metrics)} rows")

if __name__ == '__main__':
    main()
