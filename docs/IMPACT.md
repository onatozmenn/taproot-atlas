# Impact (`/#/impact`, `docs/impact.json`)

Built by `scripts/risk/impact.py` from the same out-of-time backtest as `docs/RISK.md`: for each forecast year the model is trained only on outcomes known two years earlier, the top 10% of community systems by forecast (968 of 9,675) is compared with the top 10% by EPA's Enforcement Targeting Tool score (recomputed from SDWIS) and by "repeat last year", and checked against which systems actually had a new health-based violation.

| Year | Systems with a new health-based violation (people served) | On Taproot's list | On EPA formula list | Only on Taproot's (people) | of those in high-SVI counties | Hit rate Taproot / EPA |
|---|---|---|---|---|---|---|
| 2023 | 342 (8.7M) | 206 (4.2M) | 93 (1.4M) | 132 (3.2M) | 49 | 21% / 10% |
| 2024 | 335 (8.0M) | 201 (4.9M) | 87 (1.1M) | 136 (4.1M) | 61 | 21% / 9% |
| 2025 | 303 (5.6M) | 201 (3.8M) | 90 (1.1M) | 130 (3.0M) | 54 | 21% / 9% |

**Headline (2025):** a list made in January 2025 from earlier records held 201 of the 303 systems that broke a health rule that year (3.8 million people served); EPA's targeting formula, with the same 968 slots, held 90 (1.1 million). 1 in 5 systems on Taproot's list had a new violation vs 1 in 11 on EPA's.

**Context (sources opened):**
- Allaire, Wu & Lall, PNAS 2018: 9–45 million people a year served by community systems with health-based violations (1982–2015); nearly 21 million in 2015. https://www.pnas.org/doi/10.1073/pnas.1719805115
- CDC (Collier et al. 2021): 7.15M waterborne illnesses, 118,000 hospitalizations, 6,630 deaths (3,300 linked to drinking water) in 2014; $3.33B direct healthcare costs. https://www.cdc.gov/healthy-water-data/waterborne-disease-in-us/results.html
- Boil-water notices cost households about $94 per incident (Heflin et al. 2014, via the Water Research meta-analysis); Portland estimated $13M (2-day) to $91M (2-week) household costs for one city-wide notice. https://www.portland.gov/sites/default/files/2021/econw_economic-effects-bwn_final_2017-1025.pdf

**What it does not show:** a list is not a prevented violation (needs a field trial with a state program); first-time violators remain hard (2025: Taproot 21 of 116, EPA formula 23); populations are current, not historical; ETT is recomputed, not EPA's internal list.
