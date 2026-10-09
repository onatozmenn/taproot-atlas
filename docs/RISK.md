# Taproot risk forecast

**Question it answers:** what is the chance that a community water system gets a *new* health-based Safe Drinking Water Act violation next calendar year?

## Data
- EPA SDWIS via the ECHO SDWA bulk download (snapshot 2026-07-09): violations & enforcement, lead/copper 90th percentiles, site visits, system inventory.
- ~9,700 community water systems serving 3,300+ people (the same set as `data/national`).
- One row per system per year, cutoffs 2010–2025 (154,800 system-years).

## Target
`y(T) = 1` if any violation with `IS_HEALTH_BASED_IND = Y` has a compliance period beginning in year T+1.
Violation code **2E** (the Oct 17 2024 lead service line inventory deadline) is excluded: it is paperwork, not water quality, and doubled 2024 counts. Base rate: ~3–5% a year.

## Features (all from records with compliance period beginning ≤ Dec 31 of T)
Health-based and monitoring/reporting counts (1/3/5/10 years), rule-family counts (bacteria, DBP, lead & copper, chemicals), acute Tier-1 count, years since last health-based violation, unresolved violations, EPA Enforcement Targeting Tool (ETT) score, worst result vs limit, enforcement actions, lead/copper 90th percentiles (latest, 6-year max, trend, exceedances), inspections and significant deficiencies, population, connections, source type, purchased water, owner type, wholesaler, state.

## Model
LightGBM (600 trees, 15 leaves, L2 5), Platt-calibrated on the following year; per-system explanations are TreeSHAP contributions (top four shown as "What moved it").

## Backtest (rolling, out of time)
Train on cutoffs ≤ T−2, calibrate on T−1, test on T. Nothing from the test year is seen in training.

| Predicting | AUC | PR-AUC | Top-10% recall | AUC, no current violation | Repeat last year (AUC / recall) | EPA ETT (AUC / recall) | Brier (model vs base rate) |
|---|---|---|---|---|---|---|---|
| 2023 | 0.864 | 0.434 | 60% | 0.802 | 0.663 / 42% | 0.593 / 29% | 0.0255 vs 0.0341 |
| 2024 | 0.873 | 0.423 | 60% | 0.803 | 0.69 / 44% | 0.593 / 25% | 0.0248 vs 0.0334 |
| 2025 | 0.907 | 0.45 | 66% | 0.858 | 0.695 / 46% | 0.602 / 31% | 0.0222 vs 0.0303 |

The model's top 10% catches about **6 in 10** of next year's health-based violations; EPA's own targeting score catches about **1 in 4**, and "flag whoever violated last year" catches about 4 in 10.

### Calibration (pooled test years, deciles)
| Decile | Predicted | Observed |
|---|---|---|
| 1 | 0.12% | 0.07% |
| 2 | 0.23% | 0.10% |
| 3 | 0.37% | 0.41% |
| 4 | 0.60% | 0.69% |
| 5 | 0.97% | 0.79% |
| 6 | 1.42% | 1.07% |
| 7 | 2.03% | 1.93% |
| 8 | 2.98% | 3.10% |
| 9 | 4.87% | 4.72% |
| 10 | 20.61% | 20.87% |

## Limits
- A forecast for a system, not a measurement of anyone's tap; household plumbing is not in the records.
- SDWIS under-reports some violations (Allaire et al. 2018 estimate 26–38% go unreported or misreported); the model learns reported violations.
- Some violations are entered late; features use compliance-period dates, so a few late entries can make history look slightly cleaner than it was at the time.
- PFAS (UCMR 5, 2023–25) and SYR4 lab data are not features yet because their sampling windows overlap the test years.

## Rebuild
```
python3 scripts/risk/extract_viol.py   # ECHO SDWA_VIOLATIONS_ENFORCEMENT.csv -> viol_enf.parquet
python3 scripts/risk/build.py          # panel.parquet
python3 scripts/risk/train.py          # backtest.json
python3 scripts/risk/score.py          # risk.json.gz -> data/national/
```
