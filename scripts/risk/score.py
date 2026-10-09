"""Fit the production model and score every system for the next calendar year.
Train T<=2023 (targets through 2024), Platt-calibrate on T=2024 (target 2025),
score T=2025 features -> P(new health-based violation in 2026)."""
import json, gzip
import numpy as np, pandas as pd, lightgbm as lgb
from sklearn.linear_model import LogisticRegression
from train import FEAT, PARAMS, ROUNDS, panel

LABELS = {
    'hb_1y': 'health-based violations last year', 'hb_3y': 'health-based violations in 3 years', 'hb_5y': 'health-based violations in 5 years',
    'hb_10y': 'health-based violations in 10 years', 'hb_years_10y': 'years with a health-based violation (of 10)',
    'mr_1y': 'missed tests or reports last year', 'mr_3y': 'missed tests or reports in 3 years', 'mr_5y': 'missed tests or reports in 5 years', 'mr_10y': 'missed tests or reports in 10 years',
    'hb5_micro': 'bacteria-rule violations (5y)', 'hb5_dbp': 'disinfection byproduct violations (5y)', 'hb5_lcr': 'lead and copper rule violations (5y)', 'hb5_chem': 'chemical limit violations (5y)',
    'any5_micro': 'bacteria-rule records (5y)', 'any5_dbp': 'disinfection byproduct records (5y)', 'any5_lcr': 'lead and copper records (5y)', 'any5_chem': 'chemical records (5y)',
    'acute_5y': 'acute (Tier 1) violations (5y)', 'tt_5y': 'treatment-technique violations (5y)', 'mcl_5y': 'limit (MCL) violations (5y)',
    'yrs_since_hb': 'years since last health-based violation', 'open_all': 'unresolved violations', 'open_hb': 'unresolved health-based violations',
    'ett': 'EPA enforcement-targeting score', 'mcl_ratio_max5': 'worst result vs. its limit (5y)', 'enf_3y': 'enforcement actions (3y)', 'enf_formal_3y': 'formal enforcement actions (3y)',
    'pb90_last': 'latest lead 90th percentile (ppb)', 'pb90_max6': 'highest lead 90th percentile, 6y (ppb)', 'pb90_exceed10': 'lead action-level exceedances', 'pb90_trend': 'change in lead 90th percentile (ppb)',
    'cu90_max6': 'highest copper 90th percentile, 6y (mg/L)', 'visits_5y': 'state inspections (5y)', 'sig_def_5y': 'significant deficiencies found (5y)', 'minor_def_5y': 'minor deficiencies found (5y)',
    'yrs_since_visit': 'years since last inspection', 'log_pop': 'population served', 'log_conn': 'service connections', 'src_surface': 'surface-water source',
    'src_gwudi': 'groundwater under surface influence', 'purchased': 'buys water from another system', 'owner_private': 'privately owned', 'owner_local': 'locally government-owned',
    'wholesaler': 'sells water to other systems', 'state': 'state',
}

tr = panel[panel['T'] <= 2023]
ca = panel[panel['T'] == 2024]
sc = panel[panel['T'] == 2025].copy()
m = lgb.train(PARAMS, lgb.Dataset(tr[FEAT], tr.y, categorical_feature=['state']), ROUNDS)
logit = lambda p: np.log(p / (1 - p)).reshape(-1, 1)
platt = LogisticRegression().fit(logit(m.predict(ca[FEAT])), ca.y)
raw = m.predict(sc[FEAT])
p = platt.predict_proba(logit(raw))[:, 1]
contrib = m.predict(sc[FEAT], pred_contrib=True)[:, :-1]
base = float(np.mean(ca.y))

sc['p'] = p
sc['pct'] = sc.p.rank(pct=True)
out = {}
for i, (pw, row) in enumerate(sc.set_index('PWSID').iterrows()):
    c = contrib[i]
    order = np.argsort(-np.abs(c))
    drivers = []
    for j in order:
        f = FEAT[j]
        if f == 'state' or abs(c[j]) < 0.05:
            continue
        val = row[f]
        drivers.append({'f': f, 'label': LABELS.get(f, f), 'value': None if pd.isna(val) else round(float(val), 2), 'dir': 'up' if c[j] > 0 else 'down', 'w': round(float(c[j]), 2)})
        if len(drivers) == 4:
            break
    out[pw] = {'p': round(float(row.p), 4), 'pct': round(float(row.pct), 3), 'drivers': drivers}

imp = pd.Series(m.feature_importance('gain'), index=FEAT).sort_values(ascending=False)
bt = json.load(open('backtest.json'))
meta = {
    'model': 'LightGBM (600 trees, 15 leaves) + Platt calibration',
    'target': 'P(new health-based SDWA violation beginning in calendar 2026)',
    'features_as_of': '2025-12-31', 'trained_on': '2010-2023 system-years (targets 2011-2024)', 'calibrated_on': 'targets 2025',
    'base_rate': round(base, 4), 'systems': len(out),
    'source': 'EPA SDWIS via ECHO SDWA download (snapshot 2026-07-09); violation code 2E (Oct-2024 lead service line inventory) excluded',
    'backtest': {k: {kk: bt[k][kk] for kk in ('model', 'model_clean', 'epa_ett', 'repeat_last_year')} for k in bt if k.startswith('predict_')},
    'calibration': bt['calibration_deciles'],
    'top_features': [{'f': f, 'label': LABELS.get(f, f), 'gain_share': round(float(g / imp.sum()), 3)} for f, g in imp.head(12).items()],
}
json.dump({'meta': meta, 'systems': out}, gzip.open('risk.json.gz', 'wt'), separators=(',', ':'))
print(meta['top_features'][:8])
print(sc.sort_values('p', ascending=False)[['PWSID', 'p', 'hb_1y', 'log_pop']].head(8))
for pw in ('IL0316000', 'NY7003493', 'MI0001800', 'AZ0407025', 'MA3035000'):
    print(pw, out.get(pw))
print('high-risk (p>=0.2):', int((sc.p >= 0.2).sum()), 'pop', int((10 ** sc[sc.p >= 0.2].log_pop).sum()))
