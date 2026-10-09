import json
import numpy as np, pandas as pd, lightgbm as lgb
from sklearn.metrics import roc_auc_score, average_precision_score, brier_score_loss
from sklearn.linear_model import LogisticRegression

panel = pd.read_parquet('panel.parquet')
panel['state'] = panel['state'].astype('category')
FEAT = [c for c in panel.columns if c not in ('PWSID', 'y', 'T', 'repeat')]
PARAMS = dict(objective='binary', learning_rate=0.03, num_leaves=15, min_child_samples=60,
              feature_fraction=0.8, bagging_fraction=0.8, bagging_freq=1, lambda_l2=5.0, verbose=-1, seed=7)
ROUNDS = 600


def top_k(y, s, frac):
    k = max(1, int(round(len(s) * frac)))
    idx = np.argsort(-s, kind='stable')[:k]
    return y[idx].mean(), y[idx].sum() / max(1, y.sum())


def metrics(y, s):
    y = np.asarray(y); s = np.asarray(s, dtype=float) + np.random.RandomState(0).rand(len(s)) * 1e-9
    p5, r5 = top_k(y, s, 0.05); p10, r10 = top_k(y, s, 0.10)
    return dict(auc=round(roc_auc_score(y, s), 3), pr_auc=round(average_precision_score(y, s), 3),
                prec_top5=round(p5, 3), recall_top5=round(r5, 3), prec_top10=round(p10, 3), recall_top10=round(r10, 3),
                base_rate=round(y.mean(), 4), n=int(len(y)), positives=int(y.sum()))


def fit(train):
    d = lgb.Dataset(train[FEAT], train.y, categorical_feature=['state'])
    return lgb.train(PARAMS, d, ROUNDS)


if __name__ == '__main__':
    results = {}
    calib_rows = []
    for test_T in (2022, 2023, 2024):
        tr = panel[panel['T'] <= test_T - 2]
        ca = panel[panel['T'] == test_T - 1]
        te = panel[panel['T'] == test_T]
        m = fit(tr)
        raw_ca = m.predict(ca[FEAT]); raw_te = m.predict(te[FEAT])
        platt = LogisticRegression().fit(np.log(raw_ca / (1 - raw_ca)).reshape(-1, 1), ca.y)
        p_te = platt.predict_proba(np.log(raw_te / (1 - raw_te)).reshape(-1, 1))[:, 1]
        clean = (te.hb_1y == 0).values & (te.open_hb == 0).values
        lr_cols = ['hb_1y', 'hb_5y', 'mr_1y', 'log_pop', 'src_surface', 'purchased']
        lr = LogisticRegression(max_iter=500).fit(tr[lr_cols], tr.y)
        p_lr = lr.predict_proba(te[lr_cols])[:, 1]
        r = {
            'model': metrics(te.y, p_te),
            'model_clean': metrics(te.y[clean], p_te[clean]),
            'repeat_last_year': metrics(te.y, te.repeat),
            'epa_ett': metrics(te.y, te.ett),
            'hb_5y_count': metrics(te.y, te.hb_5y),
            'logistic_simple': metrics(te.y, p_lr),
            'brier_model': round(brier_score_loss(te.y, p_te), 4),
            'brier_base': round(brier_score_loss(te.y, np.full(len(te), ca.y.mean())), 4),
        }
        r['ett_clean'] = metrics(te.y[clean], te.ett.values[clean])
        results[f'predict_{test_T + 1}'] = r
        calib_rows.append(pd.DataFrame({'p': p_te, 'y': te.y.values}))
        print(test_T + 1, json.dumps({k: (v if not isinstance(v, dict) else {kk: v[kk] for kk in ('auc', 'pr_auc', 'prec_top10', 'recall_top10')}) for k, v in r.items()}))

    # calibration table (pooled test years)
    c = pd.concat(calib_rows)
    c['bin'] = pd.qcut(c.p, 10, labels=False, duplicates='drop')
    cal = c.groupby('bin').agg(pred=('p', 'mean'), obs=('y', 'mean'), n=('y', 'size')).round(4)
    results['calibration_deciles'] = cal.reset_index().to_dict('records')
    print(cal)

    # fairness proxy: performance by system size (small vs large)
    json.dump(results, open('backtest.json', 'w'), indent=1)
