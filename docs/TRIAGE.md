# Taproot Triage (`/#/triage`, `GET /api/triage`)

## Who it is for and why
State primacy agencies, utilities and technical-assistance providers already triage: EPA's Enforcement Targeting Tool (ETT) flags "priority systems" at 11+ points, and capacity-development programs refer those systems to help (e.g. MassDEP, South Dakota DANR, Delaware DHSS, NY DOH capacity reports). Community systems get a sanitary survey at least every 3 years (40 CFR 142.16), and EPA's Aug 2026 Systemic Issues Checklist asks states to track recurring problems. DWSRF Intended Use Plans rank projects by health risk, compliance and disadvantaged-community status, and at least 25% of emerging-contaminant money must go to disadvantaged or <25,000-person systems.

ETT is *reactive*: it counts unresolved violations. Taproot's forecast is *prospective*. The triage view puts the two side by side and adds county social vulnerability so the queue fits how SRF and capacity programs already decide.

## What the view shows
- Scope: all states or one state; filters: "Not flagged by EPA formula" (ETT < 11), "High social vulnerability" (county SVI ≥ 0.75), suggested first step.
- Headline tiles: systems in the national top 10% of forecast, people they serve, how many score under 11 on ETT.
- Capacity planner: "if your team can reach N systems", the share of next-year violations met by Taproot's order vs repeat-last-year vs ETT (out-of-time backtest).
- Priority queue: rank, system, people served, forecast, suggested first step, top drivers, EPA record, "Ask Taproot".
- Fairness check: recall by county SVI tercile.

## Capacity curve (backtest 2023–2025, share of next-year health-based violations caught)
| Share of systems reached | Taproot | EPA ETT | Repeat last year |
|---|---|---|---|
| 1.0% | 24% | 4% | 11% |
| 2.0% | 35% | 9% | 22% |
| 3.0% | 41% | 11% | 35% |
| 5.0% | 49% | 16% | 40% |
| 7.5% | 57% | 22% | 41% |
| 10.0% | 62% | 28% | 43% |
| 15.0% | 70% | 33% | 46% |
| 20.0% | 76% | 36% | 49% |
| 30.0% | 85% | 45% | 55% |

## Fairness (top-10% flag, by county SVI tercile, averaged 2023–2025)
| SVI tercile | Base rate | Recall | Share flagged |
|---|---|---|---|
| high | 4.2% | 66% | 10.2% |
| low | 2.7% | 51% | 8.4% |
| mid | 2.8% | 59% | 9.4% |

## Suggested first step (rule-based from the record, not engineering advice)
- `monitoring`: Monitoring and reporting support
- `lead`: Corrosion-control review and lead-line inventory
- `dbp`: Disinfection-byproduct optimization
- `micro`: Sanitary survey follow-up on bacteria
- `chem`: Treatment or blending for a regulated chemical
- `deficiency`: Close out inspection deficiencies
- `surface`: Filtration and turbidity check
- `enforcement`: Resolve open violations
- `watch`: Routine oversight

## Data
- `data/national/triage.json.gz`, built by `scripts/risk/triage_build.py` (needs `panel.parquet`, `risk.json.gz`, `backtest.json` from the risk scripts and the CDC/ATSDR SVI 2022 county CSV).
- CDC/ATSDR Social Vulnerability Index 2022, county overall percentile (RPL_THEMES), averaged over counties served.
- EPA Enforcement Targeting Tool score recomputed from SDWIS: 10 per acute health violation, 5 per other health-based, 1 per other, plus years unresolved; 11+ = priority system.
