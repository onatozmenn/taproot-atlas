"""Taproot risk score: system-year panel, baselines, LightGBM backtest.

Target y(T) = system has >=1 health-based SDWA violation whose compliance
period begins in calendar year T+1 (excluding violation code 2E, the
Oct-2024 lead service line inventory paperwork violation).
Features use only records with compliance period beginning <= Dec 31 of T.
"""
import json, math
import numpy as np, pandas as pd

RAW = '/workspace/work/raw/sdwa'
v = pd.read_parquet('viol_enf.parquet')
pws = pd.read_parquet('pws.parquet')
ids = set(pws.PWSID)

# ---------- violations (one row per violation) ----------
viol = v.drop_duplicates('VIOLATION_ID').copy()
viol['d'] = pd.to_datetime(viol.COMPL_PER_BEGIN_DATE, format='%m/%d/%Y', errors='coerce')
viol['rtc'] = pd.to_datetime(viol.CALCULATED_RTC_DATE, format='%m/%d/%Y', errors='coerce')
viol = viol[viol.d.notna()]
viol = viol[viol.VIOLATION_CODE != '2E']
viol['y'] = viol.d.dt.year
viol['hb'] = viol.IS_HEALTH_BASED_IND == 'Y'
viol['acute'] = viol.hb & (viol.PUBLIC_NOTIFICATION_TIER == '1')
viol['mr'] = viol.VIOLATION_CATEGORY_CODE.isin(['MR', 'MON', 'RPT'])
viol['cat'] = viol.VIOLATION_CATEGORY_CODE
rule = viol.RULE_FAMILY_CODE.fillna('')
viol['grp'] = np.select(
    [rule.str.startswith('1'), rule.str.startswith('2'), rule.str.startswith('3') & viol.RULE_CODE.isin(['350', '351', '352']),
     rule.str.startswith('3'), rule.str.startswith('4'), rule.str.startswith('5')],
    ['micro', 'dbp', 'lcr', 'chem', 'other', 'other'], 'other')

# enforcement (one row per enforcement action)
enf = v[v.ENFORCEMENT_ID.notna()] if 'ENFORCEMENT_ID' in v else v.iloc[0:0]
enf = v.dropna(subset=['ENFORCEMENT_DATE']).drop_duplicates(['PWSID', 'ENFORCEMENT_DATE', 'ENFORCEMENT_ACTION_TYPE_CODE']).copy()
enf['d'] = pd.to_datetime(enf.ENFORCEMENT_DATE, format='%m/%d/%Y', errors='coerce')
enf['formal'] = enf.ENF_ACTION_CATEGORY == 'Formal'

# ---------- lead & copper 90th percentiles ----------
lcr = pd.read_csv(f'{RAW}/SDWA_LCR_SAMPLES.csv', dtype=str, usecols=['PWSID', 'SAMPLE_ID', 'SAMPLING_END_DATE', 'CONTAMINANT_CODE', 'SAMPLE_MEASURE', 'UNIT_OF_MEASURE'])
lcr = lcr[lcr.PWSID.isin(ids)].drop_duplicates('SAMPLE_ID')
lcr['d'] = pd.to_datetime(lcr.SAMPLING_END_DATE, format='%m/%d/%Y', errors='coerce')
lcr['m'] = pd.to_numeric(lcr.SAMPLE_MEASURE, errors='coerce')
lcr.loc[lcr.UNIT_OF_MEASURE.str.lower().eq('ug/l'), 'm'] /= 1000
lcr = lcr.dropna(subset=['d', 'm'])
pb = lcr[lcr.CONTAMINANT_CODE == 'PB90']
cu = lcr[lcr.CONTAMINANT_CODE == 'CU90']

# ---------- site visits ----------
sv = pd.read_csv(f'{RAW}/SDWA_SITE_VISITS.csv', dtype=str, usecols=['PWSID', 'VISIT_ID', 'VISIT_DATE', 'VISIT_REASON_CODE', 'MANAGEMENT_OPS_EVAL_CODE', 'SOURCE_WATER_EVAL_CODE', 'TREATMENT_EVAL_CODE', 'DISTRIBUTION_EVAL_CODE', 'FINISHED_WATER_STOR_EVAL_CODE', 'PUMPS_EVAL_CODE', 'FINANCIAL_EVAL_CODE', 'COMPLIANCE_EVAL_CODE'])
sv = sv[sv.PWSID.isin(ids)].drop_duplicates('VISIT_ID')
sv['d'] = pd.to_datetime(sv.VISIT_DATE, format='%m/%d/%Y', errors='coerce')
evals = [c for c in sv.columns if c.endswith('_EVAL_CODE')]
sv['sig'] = (sv[evals] == 'S').sum(axis=1)
sv['minor'] = (sv[evals] == 'M').sum(axis=1)

# ---------- static ----------
st = pws.set_index('PWSID')
st['pop'] = pd.to_numeric(st.POPULATION_SERVED_COUNT, errors='coerce')
st['conn'] = pd.to_numeric(st.SERVICE_CONNECTIONS_COUNT, errors='coerce')
static = pd.DataFrame(index=st.index)
static['log_pop'] = np.log10(st['pop'].clip(lower=1))
static['log_conn'] = np.log10(st['conn'].clip(lower=1))
src = st.PRIMARY_SOURCE_CODE.fillna('')
static['src_surface'] = src.str.startswith('SW').astype(int)
static['src_gwudi'] = src.str.startswith('GU').astype(int)
static['purchased'] = src.str.endswith('P').astype(int)
static['owner_private'] = (st.OWNER_TYPE_CODE == 'P').astype(int)
static['owner_local'] = (st.OWNER_TYPE_CODE == 'L').astype(int)
static['wholesaler'] = (st.IS_WHOLESALER_IND == 'Y').astype(int)
static['state'] = st.PRIMACY_AGENCY_CODE.fillna('XX').str[:2]


def window(df, end, years):
    return df[(df.d > end - pd.DateOffset(years=years)) & (df.d <= end)]


def ett(vv, end):
    """EPA Enforcement Targeting Tool score at `end` (unresolved, 5y, not under formal enforcement approximated)."""
    w = window(vv, end, 5)
    open_ = w[(w.rtc.isna()) | (w.rtc > end)]
    pts = np.where(open_.acute, 10, np.where(open_.hb | open_.VIOLATION_CODE.isin(['3A', '3B', '4A']) , 5, 1))
    g = pd.DataFrame({'PWSID': open_.PWSID, 'pts': pts, 'd': open_.d})
    if g.empty:
        return pd.Series(dtype=float)
    agg = g.groupby('PWSID').agg(pts=('pts', 'sum'), oldest=('d', 'min'))
    agg['n'] = ((end - agg.oldest).dt.days / 365.25).clip(0, 5).astype(int)
    return agg.pts + agg.n


def features(T):
    end = pd.Timestamp(f'{T}-12-31')
    vv = viol[viol.d <= end]
    f = pd.DataFrame(index=static.index)
    for yrs in (1, 3, 5, 10):
        w = window(vv, end, yrs)
        f[f'hb_{yrs}y'] = w[w.hb].groupby('PWSID').size()
        f[f'mr_{yrs}y'] = w[w.mr].groupby('PWSID').size()
    w5 = window(vv, end, 5)
    for g in ('micro', 'dbp', 'lcr', 'chem'):
        f[f'hb5_{g}'] = w5[w5.hb & (w5.grp == g)].groupby('PWSID').size()
        f[f'any5_{g}'] = w5[w5.grp == g].groupby('PWSID').size()
    f['acute_5y'] = w5[w5.acute].groupby('PWSID').size()
    f['tt_5y'] = w5[w5.hb & (w5.cat == 'TT')].groupby('PWSID').size()
    f['mcl_5y'] = w5[w5.hb & (w5.cat == 'MCL')].groupby('PWSID').size()
    last_hb = vv[vv.hb].groupby('PWSID').d.max()
    f['yrs_since_hb'] = ((end - last_hb).dt.days / 365.25)
    f['hb_years_10y'] = window(vv, end, 10)[lambda x: x.hb].groupby('PWSID').y.nunique()
    open_ = vv[(vv.rtc.isna()) | (vv.rtc > end)]
    f['open_all'] = open_.groupby('PWSID').size()
    f['open_hb'] = open_[open_.hb].groupby('PWSID').size()
    f['ett'] = ett(vv, end)
    # MCL exceedance magnitude in 5y (measure / federal MCL)
    m = w5[w5.hb & (w5.cat == 'MCL')].copy()
    m['meas'] = pd.to_numeric(m.VIOL_MEASURE, errors='coerce')
    m['lim'] = pd.to_numeric(m.FEDERAL_MCL.str.extract(r'([\d.]+)')[0], errors='coerce')
    m['ratio'] = (m.meas / m.lim).replace([np.inf, -np.inf], np.nan)
    f['mcl_ratio_max5'] = m.groupby('PWSID').ratio.max().clip(upper=20)
    # enforcement
    e3 = window(enf[enf.d <= end], end, 3)
    f['enf_3y'] = e3.groupby('PWSID').size()
    f['enf_formal_3y'] = e3[e3.formal].groupby('PWSID').size()
    # lead/copper
    pbT = pb[pb.d <= end].sort_values('d')
    f['pb90_last'] = pbT.groupby('PWSID').m.last() * 1000
    f['pb90_max6'] = window(pbT, end, 6).groupby('PWSID').m.max() * 1000
    f['pb90_exceed10'] = pbT[pbT.m > 0.015].groupby('PWSID').size()
    prev = pbT.groupby('PWSID').m.apply(lambda s: s.iloc[-1] - s.iloc[-2] if len(s) > 1 else np.nan)
    f['pb90_trend'] = prev * 1000
    cuT = cu[cu.d <= end].sort_values('d')
    f['cu90_max6'] = window(cuT, end, 6).groupby('PWSID').m.max()
    # site visits
    s5 = window(sv[sv.d <= end], end, 5)
    f['visits_5y'] = s5.groupby('PWSID').size()
    f['sig_def_5y'] = s5.groupby('PWSID').sig.sum()
    f['minor_def_5y'] = s5.groupby('PWSID').minor.sum()
    last_visit = sv[sv.d <= end].groupby('PWSID').d.max()
    f['yrs_since_visit'] = (end - last_visit).dt.days / 365.25
    cnt = [c for c in f.columns if c.startswith(('hb_', 'mr_', 'hb5_', 'any5_', 'acute', 'tt_', 'mcl_5', 'open_', 'enf_', 'pb90_exceed', 'visits', 'sig_', 'minor_', 'hb_years'))]
    f[cnt] = f[cnt].fillna(0)
    f['ett'] = f['ett'].fillna(0)
    f['yrs_since_hb'] = f['yrs_since_hb'].fillna(50)
    f = f.join(static)
    # target
    nxt = viol[(viol.y == T + 1) & viol.hb]
    f['y'] = f.index.isin(nxt.PWSID).astype(int)
    f['repeat'] = f.index.isin(viol[(viol.y == T) & viol.hb].PWSID).astype(int)
    f['T'] = T
    return f


if __name__ == '__main__':
    frames = [features(T) for T in range(2010, 2026)]
    panel = pd.concat(frames).reset_index().rename(columns={'index': 'PWSID'})
    panel.to_parquet('panel.parquet')
    print(panel.groupby('T').y.mean().round(4).to_dict())
    print(panel.shape)
