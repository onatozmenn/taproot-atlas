// lib/standards.ts — federal drinking-water benchmarks used to put lab
// occurrence numbers in context. Values are EPA National Primary Drinking
// Water Regulation MCLs / action levels / MRDLs (40 CFR 141), stored in the
// unit the occurrence datasets report after normalization (µg/L unless
// noted). A sample above an MCL value is NOT a violation by itself: most
// MCL compliance is a running annual average, lead/copper are 90th
// percentile action levels. Copy must say so.
//
// PFAS: the April 2024 PFAS NPDWR set MCLs for PFOA/PFOS (4.0 ng/L) and
// PFHxS/PFNA/HFPO-DA (10 ng/L). EPA proposed (May 2026) to rescind the
// PFHxS/PFNA/HFPO-DA limits and extend PFOA/PFOS compliance to 2031; until a
// final rule, the 2024 limits remain legally in effect (compliance from 2029).

export type BenchmarkKind = 'mcl' | 'action_level' | 'mrdl' | 'pfas_mcl_2024';

export interface Benchmark {
  /** Display name. */
  label: string;
  /** Benchmark value in `unit`. */
  value: number;
  unit: 'ug/l' | 'ng/l' | 'mg/l' | 'pci/l';
  kind: BenchmarkKind;
  /** Plain-language health note (EPA consumer fact sheet wording, condensed). */
  health?: string;
  /** Extra caveat shown with the benchmark. */
  note?: string;
}

const B = (label: string, value: number, unit: Benchmark['unit'], kind: BenchmarkKind, health?: string, note?: string): Benchmark => ({
  label,
  value,
  unit,
  kind,
  health,
  note,
});

/** Keys are upper-case analyte names as EPA datasets spell them. */
export const BENCHMARKS: Record<string, Benchmark> = {
  ARSENIC: B('Arsenic', 10, 'ug/l', 'mcl', 'Long-term exposure is linked to skin damage, circulatory problems and higher cancer risk.'),
  ANTIMONY: B('Antimony', 6, 'ug/l', 'mcl'),
  BARIUM: B('Barium', 2000, 'ug/l', 'mcl', 'Can raise blood pressure at high levels.'),
  BERYLLIUM: B('Beryllium', 4, 'ug/l', 'mcl'),
  CADMIUM: B('Cadmium', 5, 'ug/l', 'mcl', 'Kidney damage at long-term high exposure.'),
  CHROMIUM: B('Chromium (total)', 100, 'ug/l', 'mcl'),
  MERCURY: B('Mercury', 2, 'ug/l', 'mcl', 'Kidney damage at long-term high exposure.'),
  SELENIUM: B('Selenium', 50, 'ug/l', 'mcl'),
  THALLIUM: B('Thallium', 2, 'ug/l', 'mcl'),
  CYANIDE: B('Cyanide', 200, 'ug/l', 'mcl'),
  FLUORIDE: B('Fluoride', 4000, 'ug/l', 'mcl', 'Above 4 mg/L can cause bone disease; many utilities add about 0.7 mg/L for dental health.'),
  NITRATE: B('Nitrate (as N)', 10000, 'ug/l', 'mcl', 'Above 10 mg/L is dangerous for infants under six months (blue-baby syndrome).'),
  'HYBRID NITRATE': B('Nitrate (as N)', 10000, 'ug/l', 'mcl', 'Above 10 mg/L is dangerous for infants under six months.'),
  NITRITE: B('Nitrite (as N)', 1000, 'ug/l', 'mcl', 'Dangerous for infants at high levels.'),
  'NITRATE-NITRITE': B('Nitrate + nitrite (as N)', 10000, 'ug/l', 'mcl'),
  LEAD: B('Lead', 15, 'ug/l', 'action_level', 'No safe level for children; mostly enters water from lead service lines and plumbing.', 'Lead is regulated by a 90th-percentile action level at household taps, not a per-sample MCL.'),
  COPPER: B('Copper', 1300, 'ug/l', 'action_level', 'Short-term stomach upset; long-term liver or kidney effects at high levels.', 'Copper is regulated by a 90th-percentile action level at household taps.'),
  'TOTAL TRIHALOMETHANES (TTHM)': B('Total trihalomethanes (TTHM)', 80, 'ug/l', 'mcl', 'Disinfection byproducts; long-term exposure above the MCL is linked to higher cancer risk.', 'Compliance is a locational running annual average.'),
  'HALOACETIC ACIDS (HAA5)': B('Haloacetic acids (HAA5)', 60, 'ug/l', 'mcl', 'Disinfection byproducts; long-term exposure above the MCL is linked to higher cancer risk.', 'Compliance is a locational running annual average.'),
  'COMBINED RADIUM (-226 & -228)': B('Combined radium 226/228', 5, 'pci/l', 'mcl', 'Higher cancer risk with long-term exposure.'),
  'GROSS ALPHA, EXCL. RADON & U': B('Gross alpha', 15, 'pci/l', 'mcl'),
  'COMBINED URANIUM': B('Uranium', 30, 'ug/l', 'mcl', 'Kidney toxicity and higher cancer risk with long-term exposure.'),
  CHLORINE: B('Chlorine residual', 4000, 'ug/l', 'mrdl', 'Added to kill germs; the maximum residual disinfectant level is 4 mg/L.'),
  CHLORAMINE: B('Chloramine residual', 4000, 'ug/l', 'mrdl'),
  'FREE RESIDUAL CHLORINE': B('Free chlorine residual', 4000, 'ug/l', 'mrdl'),
  'TOTAL CHLORINE': B('Total chlorine residual', 4000, 'ug/l', 'mrdl'),
  'CHLORINE DIOXIDE': B('Chlorine dioxide', 800, 'ug/l', 'mrdl'),
  BENZENE: B('Benzene', 5, 'ug/l', 'mcl'),
  'CARBON TETRACHLORIDE': B('Carbon tetrachloride', 5, 'ug/l', 'mcl'),
  TRICHLOROETHYLENE: B('Trichloroethylene (TCE)', 5, 'ug/l', 'mcl'),
  TETRACHLOROETHYLENE: B('Tetrachloroethylene (PCE)', 5, 'ug/l', 'mcl'),
  'VINYL CHLORIDE': B('Vinyl chloride', 2, 'ug/l', 'mcl'),
  '1,2-DICHLOROETHANE': B('1,2-Dichloroethane', 5, 'ug/l', 'mcl'),
  '1,1-DICHLOROETHYLENE': B('1,1-Dichloroethylene', 7, 'ug/l', 'mcl'),
  'CIS-1,2-DICHLOROETHYLENE': B('cis-1,2-Dichloroethylene', 70, 'ug/l', 'mcl'),
  'TRANS-1,2-DICHLOROETHYLENE': B('trans-1,2-Dichloroethylene', 100, 'ug/l', 'mcl'),
  DICHLOROMETHANE: B('Dichloromethane', 5, 'ug/l', 'mcl'),
  '1,2-DICHLOROPROPANE': B('1,2-Dichloropropane', 5, 'ug/l', 'mcl'),
  ETHYLBENZENE: B('Ethylbenzene', 700, 'ug/l', 'mcl'),
  CHLOROBENZENE: B('Chlorobenzene', 100, 'ug/l', 'mcl'),
  'O-DICHLOROBENZENE': B('o-Dichlorobenzene', 600, 'ug/l', 'mcl'),
  'P-DICHLOROBENZENE': B('p-Dichlorobenzene', 75, 'ug/l', 'mcl'),
  STYRENE: B('Styrene', 100, 'ug/l', 'mcl'),
  TOLUENE: B('Toluene', 1000, 'ug/l', 'mcl'),
  '1,2,4-TRICHLOROBENZENE': B('1,2,4-Trichlorobenzene', 70, 'ug/l', 'mcl'),
  '1,1,1-TRICHLOROETHANE': B('1,1,1-Trichloroethane', 200, 'ug/l', 'mcl'),
  '1,1,2-TRICHLOROETHANE': B('1,1,2-Trichloroethane', 5, 'ug/l', 'mcl'),
  'XYLENES, TOTAL': B('Xylenes', 10000, 'ug/l', 'mcl'),
  ATRAZINE: B('Atrazine', 3, 'ug/l', 'mcl', 'Herbicide; cardiovascular and reproductive effects at long-term high exposure.'),
  ALACHLOR: B('Alachlor', 2, 'ug/l', 'mcl'),
  SIMAZINE: B('Simazine', 4, 'ug/l', 'mcl'),
  '2,4-D': B('2,4-D', 70, 'ug/l', 'mcl'),
  '2,4,5-TP': B('2,4,5-TP (Silvex)', 50, 'ug/l', 'mcl'),
  GLYPHOSATE: B('Glyphosate', 700, 'ug/l', 'mcl'),
  DALAPON: B('Dalapon', 200, 'ug/l', 'mcl'),
  DINOSEB: B('Dinoseb', 7, 'ug/l', 'mcl'),
  DIQUAT: B('Diquat', 20, 'ug/l', 'mcl'),
  ENDOTHALL: B('Endothall', 100, 'ug/l', 'mcl'),
  ENDRIN: B('Endrin', 2, 'ug/l', 'mcl'),
  HEPTACHLOR: B('Heptachlor', 0.4, 'ug/l', 'mcl'),
  'HEPTACHLOR EPOXIDE': B('Heptachlor epoxide', 0.2, 'ug/l', 'mcl'),
  HEXACHLOROBENZENE: B('Hexachlorobenzene', 1, 'ug/l', 'mcl'),
  HEXACHLOROCYCLOPENTADIENE: B('Hexachlorocyclopentadiene', 50, 'ug/l', 'mcl'),
  'BHC-GAMMA': B('Lindane', 0.2, 'ug/l', 'mcl'),
  METHOXYCHLOR: B('Methoxychlor', 40, 'ug/l', 'mcl'),
  OXAMYL: B('Oxamyl', 200, 'ug/l', 'mcl'),
  PENTACHLOROPHENOL: B('Pentachlorophenol', 1, 'ug/l', 'mcl'),
  PICLORAM: B('Picloram', 500, 'ug/l', 'mcl'),
  'TOTAL POLYCHLORINATED BIPHENYLS (PCB)': B('PCBs', 0.5, 'ug/l', 'mcl'),
  TOXAPHENE: B('Toxaphene', 3, 'ug/l', 'mcl'),
  CHLORDANE: B('Chlordane', 2, 'ug/l', 'mcl'),
  CARBOFURAN: B('Carbofuran', 40, 'ug/l', 'mcl'),
  '1,2-DIBROMO-3-CHLOROPROPANE': B('DBCP', 0.2, 'ug/l', 'mcl'),
  'ETHYLENE DIBROMIDE': B('Ethylene dibromide', 0.05, 'ug/l', 'mcl'),
  'BENZO[A]PYRENE': B('Benzo(a)pyrene', 0.2, 'ug/l', 'mcl'),
  'DI(2-ETHYLHEXYL) ADIPATE': B('DEHA', 400, 'ug/l', 'mcl'),
  'DI(2-ETHYLHEXYL) PHTHALATE': B('DEHP', 6, 'ug/l', 'mcl'),
  PFOA: B('PFOA', 4, 'ng/l', 'pfas_mcl_2024', 'A "forever chemical" linked to cancer, liver and immune effects.', 'Federal MCL of 4.0 ng/L (2024 rule; compliance due 2029, proposed extension to 2031).'),
  PFOS: B('PFOS', 4, 'ng/l', 'pfas_mcl_2024', 'A "forever chemical" linked to cancer, liver and immune effects.', 'Federal MCL of 4.0 ng/L (2024 rule; compliance due 2029, proposed extension to 2031).'),
  PFHXS: B('PFHxS', 10, 'ng/l', 'pfas_mcl_2024', undefined, '10 ng/L limit from the 2024 rule; EPA proposed rescinding it in May 2026.'),
  PFNA: B('PFNA', 10, 'ng/l', 'pfas_mcl_2024', undefined, '10 ng/L limit from the 2024 rule; EPA proposed rescinding it in May 2026.'),
  'HFPO-DA': B('HFPO-DA (GenX)', 10, 'ng/l', 'pfas_mcl_2024', undefined, '10 ng/L limit from the 2024 rule; EPA proposed rescinding it in May 2026.'),
};

const TO_UG: Record<string, number> = { 'ug/l': 1, 'mg/l': 1000, 'ng/l': 0.001 };

/** Convert `value` in `unit` to the benchmark's unit; null when incompatible. */
export function toBenchmarkUnit(value: number, unit: string | null | undefined, b: Benchmark): number | null {
  const u = normUnit(unit) ?? '';
  if (u === b.unit) return value;
  if (u in TO_UG && b.unit in TO_UG) return (value * TO_UG[u]) / TO_UG[b.unit];
  return null;
}

/** Dataset spellings that differ from the benchmark keys. */
const ALIASES: Record<string, string> = {
  TTHM: 'TOTAL TRIHALOMETHANES (TTHM)',
  'TOTAL HALOACETIC ACIDS (HAA5)': 'HALOACETIC ACIDS (HAA5)',
  'ANTIMONY, TOTAL': 'ANTIMONY',
  'BERYLLIUM, TOTAL': 'BERYLLIUM',
  'THALLIUM, TOTAL': 'THALLIUM',
  'BENZO(A)PYRENE': 'BENZO[A]PYRENE',
  'COPPER, FREE': 'COPPER',
  'RESIDUAL CHLORINE': 'CHLORINE',
};

export function benchmarkFor(analyte: string): Benchmark | null {
  const k = analyte.trim().toUpperCase();
  return BENCHMARKS[ALIASES[k] ?? k] ?? null;
}

/** Normalize unit spellings (µg/l, μg/l, UG/L) to lower-case ascii. */
export function normUnit(u: string | null | undefined): string | null {
  if (!u) return null;
  return u.trim().toLowerCase().replace(/^[µμ]/, 'u');
}

/** Human unit label. */
export function unitLabel(u: string | null | undefined): string {
  switch (normUnit(u) ?? '') {
    case 'ug/l':
      return 'ug/L';
    case 'mg/l':
      return 'mg/L';
    case 'ng/l':
      return 'ng/L';
    case 'pci/l':
      return 'pCi/L';
    default:
      return u ?? '';
  }
}
