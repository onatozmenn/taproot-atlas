"""Impact numbers from the out-of-time backtest: for each forecast year, which
systems that went on to have a new health-based violation sat in the top 10%
of Taproot's forecast vs EPA ETT vs repeat-last-year, and how many people they serve."""
import json, gzip, sys
import numpy as np, pandas as pd, lightgbm as lgb
sys.path.insert(0, '.')
from train import FEAT, PARAMS, ROUNDS
panel = pd.read_parquet('panel.parquet'); panel['state'] = panel['state'].astype('category')
tri = json.load(gzip.open('triage.json.gz', 'rt'))['rows']
svi = {r['id']: r['svi'] for r in tri}
out = []
for T in (2022, 2023, 2024):
    tr = panel[panel['T'] <= T - 2]; te = panel[panel['T'] == T].copy()
    m = lgb.train(PARAMS, lgb.Dataset(tr[FEAT], tr.y, categorical_feature=['state']), ROUNDS)
    te['s'] = m.predict(te[FEAT]); te['pop'] = te.PWSID.map({r['id']: r['pop'] for r in tri}).fillna(0)
    rng = np.random.RandomState(T).rand(len(te)) * 1e-9
    k = int(round(len(te) * 0.1))
    def top(score):
        f = np.zeros(len(te), bool); f[np.argsort(-score, kind='stable')[:k]] = True; return f
    te['m'] = top(te.s.values); te['e'] = top(te.ett.values + rng); te['r'] = top(te.repeat.values + rng)
    v = te[te.y == 1]
    new = v[v.hb_5y == 0]
    extra = v[v.m & ~v.e]
    out.append(dict(year=T + 1, systems=len(te), visits=k, violators=len(v), people=int(v['pop'].sum()),
        model_caught=int(v.m.sum()), model_people=int(v[v.m]['pop'].sum()),
        ett_caught=int(v.e.sum()), ett_people=int(v[v.e]['pop'].sum()),
        repeat_caught=int(v.r.sum()), repeat_people=int(v[v.r]['pop'].sum()),
        extra_vs_ett=len(extra), extra_people=int(extra['pop'].sum()),
        extra_high_svi=int(sum((svi.get(p) or 0) >= 0.75 for p in extra.PWSID)),
        both=int((v.m & v.e).sum()), model_only=int((v.m & ~v.e).sum()), ett_only=int((~v.m & v.e).sum()), neither=int((~v.m & ~v.e).sum()),
        first_time=len(new), first_time_model=int(new.m.sum()), first_time_ett=int(new.e.sum()),
        hit_rate_model=round(float(te[te.m].y.mean()), 3), hit_rate_ett=round(float(te[te.e].y.mean()), 3)))
df = pd.DataFrame(out); print(df.T.to_string())
json.dump(out, open('impact.json', 'w'), indent=1)
