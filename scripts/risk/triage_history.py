"""Adds a ten-year record strip to every triage row: health-based (`hy`) and
monitoring/reporting (`my`) violations that began in each calendar year
2016-2025, from the same panel the forecast trains on (hb_1y / mr_1y at year T
count violations that began in year T).

Run in the risk work folder after triage_build.py:
    python triage_history.py <repo>
Rewrites <repo>/data/national/triage.json.gz in place and records the years in meta.history_years.
"""
import gzip, json, sys
import pandas as pd

REPO = sys.argv[1] if len(sys.argv) > 1 else '.'
OUT = f'{REPO}/data/national/triage.json.gz'
YEARS = list(range(2016, 2026))

panel = pd.read_parquet('panel.parquet', columns=['PWSID', 'T', 'hb_1y', 'mr_1y'])
panel = panel[panel['T'].isin(YEARS)]
hb = panel.pivot_table(index='PWSID', columns='T', values='hb_1y', aggfunc='sum').reindex(columns=YEARS).fillna(0).astype(int)
mr = panel.pivot_table(index='PWSID', columns='T', values='mr_1y', aggfunc='sum').reindex(columns=YEARS).fillna(0).astype(int)

d = json.load(gzip.open(OUT, 'rt'))
miss = 0
for r in d['rows']:
    if r['id'] in hb.index:
        r['hy'] = hb.loc[r['id']].tolist()
        r['my'] = mr.loc[r['id']].tolist()
    else:
        miss += 1
        r['hy'] = [0] * len(YEARS)
        r['my'] = [0] * len(YEARS)
d['meta']['history_years'] = YEARS
json.dump(d, gzip.open(OUT, 'wt'), separators=(',', ':'))
print('rows', len(d['rows']), 'missing', miss)
