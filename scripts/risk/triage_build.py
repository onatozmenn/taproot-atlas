"""Utility triage data: one row per scored system with forecast, EPA ETT,
county social vulnerability (CDC SVI 2022), a suggested first step, and the
backtest curves (share of next-year violations caught vs. share of systems
visited) for model, EPA ETT and repeat-last-year.

Inputs: panel.parquet + risk.json.gz (this folder), data/national/<ST>.json.gz,
CDC/ATSDR SVI 2022 county CSV.
Output: triage.json.gz -> data/national/triage.json.gz
"""
import gzip, json, glob, os, re, sys
import numpy as np, pandas as pd

REPO = sys.argv[1] if len(sys.argv) > 1 else '/workspace/projects/170d4be9-f175-45c2-b6de-86ef282eebda/taproot-atlas'
SVI = sys.argv[2] if len(sys.argv) > 2 else '/workspace/work/raw/svi_county.csv'

risk = json.load(gzip.open('risk.json.gz', 'rt'))
panel = pd.read_parquet('panel.parquet')
bt = json.load(open('backtest.json'))

# ---------- system inventory from the national shards ----------
sysinfo = {}
for f in glob.glob(f'{REPO}/data/national/*.json.gz'):
    base = os.path.basename(f)
    if not re.fullmatch(r'[0-9A-Z]{2}\.json\.gz', base):
        continue
    d = json.load(gzip.open(f, 'rt'))
    for pw, s in (d.get('systems') or {}).items():
        sy = s.get('system', {})
        ar = s.get('areas', {})
        sysinfo[pw] = dict(name=sy.get('name'), st=sy.get('state'), pop=sy.get('population'),
                           src=sy.get('primarySourceCode'), owner=sy.get('owner'),
                           counties=ar.get('counties') or [], cities=ar.get('cities') or [])

# ---------- county SVI ----------
svi = pd.read_csv(SVI, dtype=str, encoding='utf-8-sig', usecols=['ST_ABBR', 'COUNTY', 'RPL_THEMES'])
svi['r'] = pd.to_numeric(svi.RPL_THEMES, errors='coerce')
svi = svi[svi.r >= 0]
norm = lambda s: re.sub(r'\b(county|parish|borough|census area|municipality|city and borough|city)\b', '', s.lower()).replace('.', '').replace("'", '').strip()
svimap = {(r.ST_ABBR, norm(r.COUNTY)): r.r for r in svi.itertuples()}


def svi_for(info):
    vals = [svimap.get((info['st'], norm(c))) for c in info['counties']]
    vals = [v for v in vals if v is not None]
    return round(float(np.mean(vals)), 3) if vals else None


# ---------- suggested first step from drivers / record ----------
ACTIONS = {
    'monitoring': 'Monitoring and reporting support',
    'lead': 'Corrosion-control review and lead-line inventory',
    'dbp': 'Disinfection-byproduct optimization',
    'micro': 'Sanitary survey follow-up on bacteria',
    'chem': 'Treatment or blending for a regulated chemical',
    'deficiency': 'Close out inspection deficiencies',
    'surface': 'Filtration and turbidity check',
    'enforcement': 'Resolve open violations',
    'watch': 'Routine oversight',
}


def action(row, drivers):
    up = [d['f'] for d in drivers if d['dir'] == 'up']
    if row.hb5_chem > 0 or row.mcl_ratio_max5 > 1 and row.hb5_dbp == 0 and row.hb5_micro == 0:
        return 'chem'
    if row.hb5_dbp > 0 or 'any5_dbp' in up:
        return 'dbp'
    if row.hb5_micro > 0 or 'any5_micro' in up:
        return 'micro'
    if row.hb5_lcr > 0 or (row.pb90_max6 or 0) > 15 or any(f.startswith('pb90') for f in up):
        return 'lead'
    if row.open_hb > 0 or row.ett >= 11:
        return 'enforcement'
    if row.sig_def_5y > 0 or 'sig_def_5y' in up:
        return 'deficiency'
    if any(f.startswith('mr_') for f in up) or row.mr_1y > 0:
        return 'monitoring'
    if row.src_surface and 'src_surface' in up:
        return 'surface'
    return 'watch'


cur = panel[panel['T'] == 2025].set_index('PWSID')
rows = []
for pw, r in risk['systems'].items():
    info = sysinfo.get(pw)
    if info is None or pw not in cur.index:
        continue
    f = cur.loc[pw]
    city = (info['cities'][0] if info['cities'] else '') or ''
    rows.append({
        'id': pw, 'n': info['name'], 'st': info['st'], 'c': city.title() if city.isupper() else city,
        'pop': info['pop'] or 0, 'p': r['p'], 'pct': r['pct'], 'ett': int(f.ett), 'hb5': int(f.hb_5y), 'mr1': int(f.mr_1y),
        'open': int(f.open_hb), 'svi': svi_for(info), 'src': 'S' if f.src_surface else 'G', 'a': action(f, r['drivers']),
        'd': [d['f'] for d in r['drivers'][:3]], 'dv': [d['value'] for d in r['drivers'][:3]], 'dd': [d['dir'] for d in r['drivers'][:3]],
        'dl': [d['label'] for d in r['drivers'][:3]],
    })
rows.sort(key=lambda x: -x['p'])
print('rows', len(rows), 'with svi', sum(r['svi'] is not None for r in rows))

# ---------- backtest capacity curves + fairness (rolling, out of time) ----------
import lightgbm as lgb
from sklearn.linear_model import LogisticRegression
sys.path.insert(0, '.')
from train import FEAT, PARAMS, ROUNDS
panel['state'] = panel['state'].astype('category')
cuts = [0.01, 0.02, 0.03, 0.05, 0.075, 0.1, 0.15, 0.2, 0.3]
curves = {'model': [], 'ett': [], 'repeat': []}
svi_by_pw = {r['id']: r['svi'] for r in rows}
fair = []
for test_T in (2022, 2023, 2024):
    tr = panel[panel['T'] <= test_T - 2]; te = panel[panel['T'] == test_T].copy()
    m = lgb.train(PARAMS, lgb.Dataset(tr[FEAT], tr.y, categorical_feature=['state']), ROUNDS)
    te['s'] = m.predict(te[FEAT])
    rng = np.random.RandomState(test_T).rand(len(te)) * 1e-9
    y = te.y.values; P = y.sum()
    for key, score in (('model', te.s.values), ('ett', te.ett.values + rng), ('repeat', te.repeat.values + rng)):
        order = np.argsort(-score, kind='stable')
        curves[key].append([float(y[order[: int(round(len(y) * k))]].sum() / P) for k in cuts])
    te['svi'] = te.PWSID.map(svi_by_pw)
    te['grp'] = pd.cut(te.svi, [-0.01, 1 / 3, 2 / 3, 1.0], labels=['low', 'mid', 'high'])
    k = int(round(len(te) * 0.1))
    thr = np.sort(te.s.values)[-k]
    te['flag'] = te.s >= thr
    for g, sub in te.groupby('grp', observed=True):
        pos = sub[sub.y == 1]
        fair.append({'year': test_T + 1, 'svi': str(g), 'systems': int(len(sub)), 'violations': int(len(pos)),
                     'base_rate': round(float(sub.y.mean()), 4), 'recall_top10': round(float(pos.flag.mean()), 3) if len(pos) else None,
                     'flag_rate': round(float(sub.flag.mean()), 3)})
curve = {k: [round(float(np.mean([c[i] for c in v])), 3) for i in range(len(cuts))] for k, v in curves.items()}
fair_df = pd.DataFrame(fair)
fair_avg = fair_df.groupby('svi').agg(base_rate=('base_rate', 'mean'), recall_top10=('recall_top10', 'mean'), flag_rate=('flag_rate', 'mean'), systems=('systems', 'mean')).round(3)
print(curve)
print(fair_avg)

meta = {
    'year': risk['meta']['features_as_of'][:4] and int(risk['meta']['features_as_of'][:4]) + 1,
    'base_rate': risk['meta']['base_rate'],
    'actions': ACTIONS,
    'curve': {'share_visited': cuts, **curve, 'years': '2023–2025'},
    'fairness': fair_avg.reset_index().to_dict('records'),
    'svi_source': 'CDC/ATSDR Social Vulnerability Index 2022, county overall percentile (RPL_THEMES), averaged over counties served',
    'ett_note': 'EPA Enforcement Targeting Tool score recomputed from SDWIS: 10 per acute health violation, 5 per other health-based, 1 per other, plus years unresolved; 11+ = priority system.',
}
json.dump({'meta': meta, 'rows': rows}, gzip.open('triage.json.gz', 'wt'), separators=(',', ':'))
print('size', os.path.getsize('triage.json.gz'))
