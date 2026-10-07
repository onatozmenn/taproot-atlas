#!/usr/bin/env python3
"""Build-time vendor: EPA SYR4 (2012-2019) + UCMR5 (2023-2025) lab results
-> per-system contaminant occurrence summaries for every curated PWSID.

Inputs (official EPA downloads, put in one folder):
  _syr4_phasechem_*.zip, _syr4_rads.zip, syr4_thms.zip, syr4_haas.zip,
  syr4_disinfectant-residuals.zip   (epa.gov/dwsixyearreview)
  ucmr5-occurrence-data.zip         (epa.gov/dwucmr)
Output: data/occurrence.json
  { snapshotVersion, captureTime, provenanceNote, sources{}, systems: {
      PWSID: { analytes: [ {name, group, dataset, unit, samples, detects,
               maxValue, meanDetect, p90, firstDate, lastDate} ] } } }

Rules: no invented values; non-detects are counted, never imputed; values are
reported in the dataset's own unit (converted to one unit per analyte only
when the source mixes MG/L and UG/L). Occurrence is not a compliance finding.

Usage: python scripts/build-occurrence.py <raw-dir> <pwsid-list-file> <out.json>
"""
import sys, os, zipfile, csv, json, io, datetime, statistics
from multiprocessing import Pool

csv.field_size_limit(10_000_000)
MONTHS = {m: i + 1 for i, m in enumerate('JAN FEB MAR APR MAY JUN JUL AUG SEP OCT NOV DEC'.split())}

def syr_date(s):
    # "05-APR-17" -> 2017-04-05
    try:
        d, m, y = s.split('-')
        y = int(y); y += 2000 if y < 70 else 1900
        return f"{y:04d}-{MONTHS[m.upper()]:02d}-{int(d):02d}"
    except Exception:
        return None

def ucmr_date(s):
    # "03/14/2023" or "2023-03-14"
    s = (s or '').strip()
    if '/' in s:
        try:
            m, d, y = s.split('/'); return f"{int(y):04d}-{int(m):02d}-{int(d):02d}"
        except Exception:
            return None
    return s[:10] or None

def group_of(zipname, analyte):
    n = zipname.lower()
    if 'thms' in n: return 'disinfection_byproducts'
    if 'haas' in n: return 'disinfection_byproducts'
    if 'rads' in n: return 'radionuclides'
    if 'disinfect' in n: return 'disinfectant_residual'
    if 'ucmr5' in n: return 'pfas' if analyte.upper() != 'LITHIUM' else 'metals'
    a = analyte.upper()
    if a in {'ARSENIC','ANTIMONY','BARIUM','BERYLLIUM','CADMIUM','CHROMIUM','COPPER','LEAD','MERCURY','SELENIUM','THALLIUM','CYANIDE','ASBESTOS'}:
        return 'metals_inorganics'
    if a in {'NITRATE','NITRITE','NITRATE-NITRITE','HYBRID NITRATE','FLUORIDE'}:
        return 'nutrients_inorganics'
    return 'organic_chemicals'

TO_UG = {'UG/L': 1.0, 'MG/L': 1000.0, 'NG/L': 0.001}

class Acc:
    __slots__ = ('n', 'det', 'vals', 'unit', 'first', 'last', 'name')
    def __init__(self, name):
        self.n = 0; self.det = 0; self.vals = []; self.unit = None; self.first = None; self.last = None; self.name = name
    def add(self, date, detect, value, unit):
        self.n += 1
        if date:
            if not self.first or date < self.first: self.first = date
            if not self.last or date > self.last: self.last = date
        if detect and value is not None:
            self.det += 1
            self.vals.append((value, unit, date))

def finish(acc, group, dataset):
    vals = acc.vals
    unit = None; nums = []
    if vals:
        units = {u for _, u, _ in vals}
        if len(units) == 1:
            unit = units.pop(); pairs = [(v, dt) for v, _, dt in vals]
        elif units <= set(TO_UG):
            unit = 'UG/L'; pairs = [(v * TO_UG[u], dt) for v, u, dt in vals]
        else:
            # pick the most common unit, drop the rest
            from collections import Counter
            unit = Counter(u for _, u, _ in vals).most_common(1)[0][0]
            pairs = [(v, dt) for v, u, dt in vals if u == unit]
        nums = [v for v, _ in pairs]
    out = {
        'name': acc.name, 'group': group, 'dataset': dataset,
        'samples': acc.n, 'detects': acc.det,
        'unit': (unit or '').lower() or None,
        'firstDate': acc.first, 'lastDate': acc.last,
    }
    if nums:
        nums.sort()
        out['maxValue'] = round(nums[-1], 4)
        out['meanDetect'] = round(statistics.fmean(nums), 4)
        out['medianDetect'] = round(statistics.median(nums), 4)
        out['p90Detect'] = round(nums[min(len(nums) - 1, int(0.9 * len(nums)))], 4)
        top = sorted(pairs, key=lambda x: -x[0])[:5]
        out['top'] = [[round(v, 4), dt] for v, dt in top]
        # deciles let the runtime count samples above any benchmark
        out['deciles'] = [round(nums[min(len(nums) - 1, int(q * len(nums) / 10))], 4) for q in range(1, 10)]
    return out

def scan_syr(args):
    path, pwsids = args
    pw = set(pwsids)
    zname = os.path.basename(path)
    dataset = 'SYR4'
    res = {}
    with zipfile.ZipFile(path) as z:
        for info in z.infolist():
            if info.file_size < 1000: continue
            with z.open(info) as raw:
                txt = io.TextIOWrapper(raw, encoding='latin-1', newline='')
                rd = csv.reader(txt, delimiter='\t')
                hdr = next(rd)
                ix = {h: i for i, h in enumerate(hdr)}
                iP, iN, iD, iDet, iV, iU, iT = ix['PWSID'], ix['ANALYTE_NAME'], ix['SAMPLE_COLLECTION_DATE'], ix['DETECT'], ix['VALUE'], ix['UNIT'], ix['SAMPLE_TYPE_CODE']
                for row in rd:
                    if len(row) <= iU: continue
                    p = row[iP]
                    if p not in pw: continue
                    if row[iT] not in ('RT', ''):  # routine samples only
                        continue
                    name = row[iN].strip()
                    key = (p, name)
                    acc = res.get(key)
                    if acc is None:
                        acc = res[key] = Acc(name)
                    try:
                        v = float(row[iV]) if row[iV] != '' else None
                    except ValueError:
                        v = None
                    acc.add(syr_date(row[iD]), row[iDet] == '1', v, row[iU].strip().upper() or None)
    out = {}
    for (p, name), acc in res.items():
        out.setdefault(p, []).append(finish(acc, group_of(zname, name), dataset))
    return out

def scan_ucmr(args):
    path, pwsids = args
    pw = set(pwsids)
    res = {}
    with zipfile.ZipFile(path) as z:
        with z.open('UCMR5_All.txt') as raw:
            txt = io.TextIOWrapper(raw, encoding='latin-1', newline='')
            rd = csv.reader(txt, delimiter='\t')
            hdr = next(rd); ix = {h: i for i, h in enumerate(hdr)}
            iP, iN, iD, iS, iV, iU = ix['PWSID'], ix['Contaminant'], ix['CollectionDate'], ix['AnalyticalResultsSign'], ix['AnalyticalResultValue'], ix['Units']
            for row in rd:
                if len(row) <= iV: continue
                p = row[iP]
                if p not in pw: continue
                name = row[iN].strip()
                acc = res.get((p, name))
                if acc is None: acc = res[(p, name)] = Acc(name)
                det = row[iS].strip() == '='
                try:
                    v = float(row[iV]) if det and row[iV] else None
                except ValueError:
                    v = None
                acc.add(ucmr_date(row[iD]), det, v, (row[iU].strip().upper().replace('µ', 'U') or None))
    out = {}
    for (p, name), acc in res.items():
        out.setdefault(p, []).append(finish(acc, group_of('ucmr5', name), 'UCMR5'))
    return out

def main():
    if len([a for a in sys.argv[1:] if a != '--shard']) != 3:
        print(__doc__); sys.exit(2)
    args = sys.argv[1:]
    shard = '--shard' in args
    if shard: args.remove('--shard')
    raw, listfile, outpath = args
    pwsids = open(listfile).read().split()
    jobs = []
    for f in sorted(os.listdir(raw)):
        p = os.path.join(raw, f)
        if f.endswith('.zip') and 'syr4' in f.lower():
            jobs.append((scan_syr, (p, pwsids)))
        elif f.startswith('ucmr5') and f.endswith('.zip'):
            jobs.append((scan_ucmr, (p, pwsids)))
    systems = {p: {'analytes': []} for p in pwsids}
    with Pool(min(len(jobs), os.cpu_count() or 4)) as pool:
        results = [pool.apply_async(fn, (a,)) for fn, a in jobs]
        for r in results:
            for p, rows in r.get().items():
                systems[p]['analytes'].extend(rows)
    for p in systems:
        systems[p]['analytes'].sort(key=lambda a: (a['group'], a['name']))
    snap = {
        'snapshotVersion': 'occurrence-' + datetime.date.today().isoformat() + '-v1',
        'captureTime': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'provenanceNote': 'Aggregated from EPA Six-Year Review 4 compliance monitoring (routine samples, 2012-2019) and UCMR 5 occurrence data (2023-2025). Non-detects counted, never imputed. Occurrence is not a compliance finding.',
        'sources': {
            'SYR4': 'https://www.epa.gov/dwsixyearreview/six-year-review-4-compliance-monitoring-data-2012-2019',
            'UCMR5': 'https://www.epa.gov/dwucmr/occurrence-data-unregulated-contaminant-monitoring-rule',
        },
        'systems': systems,
    }
    if shard:
        import gzip
        os.makedirs(outpath, exist_ok=True)
        by = {}
        for p, v in systems.items():
            if v['analytes']: by.setdefault(p[:2], {})[p] = v
        meta = {k: v for k, v in snap.items() if k != 'systems'}
        for st, sy in by.items():
            with gzip.open(os.path.join(outpath, f'{st}.occ.json.gz'), 'wt', encoding='utf-8') as f:
                json.dump({**meta, 'systems': sy}, f, separators=(',', ':'))
    else:
        with open(outpath, 'w') as f:
            json.dump(snap, f, separators=(',', ':'))
    n = sum(len(s['analytes']) for s in systems.values())
    print(f'wrote {outpath}: {n} analyte summaries across {len(systems)} systems')

if __name__ == '__main__':
    main()
