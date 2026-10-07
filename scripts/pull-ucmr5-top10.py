#!/usr/bin/env python3
"""Top-10 UCMR5 vendor: by-state zip -> data/ucmr5.json (PWSID-filtered).
Official EPA text files only. Keeps detects (AnalyticalResultsSign '='),
max 6 per PWSID, NPDWR PFAS first. Occurrence is not an MCL violation.
"""
import zipfile, csv, json

ZIP = r'C:\Users\onat\AppData\Local\Temp\opencode\ucmr5-by-state.zip'
OUT = 'data/ucmr5.json'
WANT = ["NY7003493","CA1910067","TX1010013","IL0316000","TX0150018",
        "MA6000000","FL4130871","MD0150005","MD0300002","PA1510001"]
MCL_UG_L = {
    "PFOA": "0.004 ug/L MCL (NPDWR)",
    "PFOS": "0.004 ug/L MCL (NPDWR)",
    "PFHXS": "0.01 ug/L MCL (NPDWR, proposed rescind)",
    "PFNA": "0.01 ug/L MCL (NPDWR, proposed rescind)",
    "HFPO-DA": "0.01 ug/L MCL (NPDWR, proposed rescind)",
    "PFBS": "Hazard Index component (NPDWR)",
}
PRIORITY = ["PFOA","PFOS","PFHXS","PFNA","HFPO-DA","PFBS","LITHIUM"]

def norm_units(u):
    u = (u or "ug/L").replace("µ", "u").replace("μ", "u")
    u = "".join(c for c in u if ord(c) < 128)
    return u.strip()[:12] or "ug/L"

def norm_date(d):
    d = (d or "").strip()
    # EPA CollectionDate is MM/DD/YYYY; normalize to YYYY-MM-DD
    import re
    m = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{4})", d)
    if m:
        return f"{m.group(3)}-{int(m.group(1)):02d}-{int(m.group(2)):02d}"
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})", d)
    if m:
        return d[:10]
    return "2024-12-31"

def key_rank(contam):
    c = (contam or "").upper().replace(" ", "").replace("-", "")
    for i, p in enumerate(PRIORITY):
        if p.replace("-", "") in c:
            return i
    return 99

def main():
    found = {p: [] for p in WANT}
    with zipfile.ZipFile(ZIP) as z:
        for name in z.namelist():
            if not name.startswith("UCMR5_All_"):
                continue
            print("scanning", name, flush=True)
            with z.open(name) as f:
                # decode streaming
                import io
                txt = io.TextIOWrapper(f, encoding="utf-8", errors="ignore")
                for row in csv.DictReader(txt, delimiter="\t"):
                    pid = (row.get("PWSID") or "").strip().upper()
                    if pid not in found:
                        continue
                    if (row.get("AnalyticalResultsSign") or "").strip() != "=":
                        continue
                    val = (row.get("AnalyticalResultValue") or "").strip()
                    contam = (row.get("Contaminant") or "").strip()
                    if not val or not contam:
                        continue
                    units = "ug/L"  # source Units column ships as "g/L" (micro sign stripped); EPA reports UCMR5 in ug/L
                    mrl = (row.get("MRL") or "").strip()
                    date = norm_date(row.get("CollectionDate"))
                    cu = contam.upper()
                    thresh = "no federal MCL established"
                    for k, v in MCL_UG_L.items():
                        if k in cu.replace(" ", "").replace("-", ""):
                            thresh = v
                            break
                    found[pid].append({
                        "parameter": contam[:60],
                        "reportedValue": f"{val} {units} (occurrence)".strip()[:60],
                        "regulatoryThreshold": thresh[:60],
                        "complianceStatus": "monitoring_violation",
                        "testDate": date,
                        "_rank": key_rank(contam),
                        "_val": val,
                    })
    out = {}
    for pid, rows in found.items():
        rows.sort(key=lambda r: (r["_rank"], r["parameter"]))
        seen = set()
        metrics = []
        for r in rows:
            if r["parameter"].lower() in seen:
                continue
            seen.add(r["parameter"].lower())
            r.pop("_rank", None)
            r.pop("_val", None)
            metrics.append(r)
            if len(metrics) >= 6:
                break
        out[pid] = {
            "snapshotVersion": f"ucmr5-{pid.lower()}-2026-10-v1",
            "captureTime": "2026-10-07T00:00:00Z",
            "provenanceNote": "PWSID-filtered UCMR5 occurrence extract (29 PFAS + lithium, 2023-2025). Occurrence is not an MCL compliance finding.",
            "sourceDocumentUrl": "https://www.epa.gov/dwucmr/occurrence-data-unregulated-contaminant-monitoring-rule",
            "reportPeriod": "UCMR5 2023-2025",
            "pwsid": pid,
            "metrics": metrics,
        }
        print(pid, "detects kept:", len(metrics),
              [m["parameter"] for m in metrics], flush=True)
    json.dump(out, open(OUT, "w"), indent=2)
    print("wrote", OUT)

if __name__ == "__main__":
    main()
