// lib/profile.ts — rich per-system profile from build-time EPA snapshots.
//   data/sdwis-profiles.json  ECHO SDWA bulk (SDWIS) + Envirofacts treatment
//   data/occurrence.json      SYR4 (2012-2019) + UCMR5 (2023-2025) lab results
// Deterministic only: every number here is read from those files; derived
// fields (summaries, highlights) are arithmetic over them. No network.
import type {
  LabAnalyteSummary,
  ProfileViolation,
  QualityMetricRecord,
  SdwisComplianceProfile,
  SdwisViolationRecord,
  SourceFacilitiesProfile,
  SourceFacilityRecord,
  TreatmentProfile,
  WaterSystemProfile,
} from '../types/water-intelligence.js';
import { benchmarkFor, normUnit, toBenchmarkUnit, unitLabel } from './standards.js';
import { echoReportUrl } from './echo.js';
import { stateShard, nationalIndex } from './national.js';

interface RawSystem {
  system: null | {
    name: string;
    type: string | null;
    owner: string | null;
    population: number | null;
    connections: number | null;
    primarySource: string | null;
    primarySourceCode: string;
    wholesaler: boolean;
    state: string | null;
    sourceWaterProtection: boolean;
    contact: { org?: string | null; phone: string | null; address: string | null };
    quarter: string | null;
  };
  areas: { counties: string[]; cities: string[]; zips: string[] };
  serviceAreas: string[];
  facilities: {
    activeCount?: number;
    byType?: Record<string, number>;
    sources?: Array<{ name: string; type: string | null; water: string | null; availability: string | null }>;
    sourceCount?: number;
    plants?: string[];
    purchasedFrom?: Array<{ pwsid: string; name: string; treated: string | null }>;
  };
  treatment: Array<{ process: string; objective: string | null }> | null;
  lead: Array<{ start: string | null; end: string | null; value: number; unit: string }>;
  copper: Array<{ start: string | null; end: string | null; value: number; unit: string }>;
  violations: Array<ProfileViolation & { categoryCode?: string; code?: string }>;
  visits: Array<{ date: string | null; reason: string | null; evals: Record<string, string> }>;
  visitCount?: number;
  violationTotal?: number;
  violationHealthTotal?: number;
}

interface RawAnalyte {
  name: string;
  group: LabAnalyteSummary['group'];
  dataset: 'SYR4' | 'UCMR5';
  samples: number;
  detects: number;
  unit: string | null;
  firstDate: string | null;
  lastDate: string | null;
  maxValue?: number;
  medianDetect?: number;
  top?: Array<[number, string | null]>;
  deciles?: number[];
}

interface ShardMeta {
  snapshotVersion: string;
  captureTime: string;
  sources: Record<string, string>;
}

function rawSystem(pwsid: string): { raw: RawSystem; meta: ShardMeta } | null {
  const sh = stateShard<RawSystem>(pwsid.slice(0, 2), 'profiles');
  const raw = sh?.systems[pwsid];
  return raw && raw.system ? { raw, meta: sh!.meta as unknown as ShardMeta } : null;
}

function rawOccurrence(pwsid: string): { analytes: RawAnalyte[]; meta: ShardMeta } | null {
  const sh = stateShard<{ analytes: RawAnalyte[] }>(pwsid.slice(0, 2), 'occurrence');
  const v = sh?.systems[pwsid];
  return v ? { analytes: v.analytes, meta: sh!.meta as unknown as ShardMeta } : null;
}

const SYR4_URL = 'https://www.epa.gov/dwsixyearreview/six-year-review-4-compliance-monitoring-data-2012-2019';
const UCMR5_URL = 'https://www.epa.gov/dwucmr/occurrence-data-unregulated-contaminant-monitoring-rule';
const ECHO_BULK_URL = 'https://echo.epa.gov/files/echodownloads/SDWA_latest_downloads.zip';

const EVAL_LABELS: Record<string, string> = {
  management_ops: 'management and operations',
  source_water: 'source water',
  security: 'security',
  pumps: 'pumps',
  compliance: 'monitoring and reporting',
  data_verification: 'data verification',
  treatment: 'treatment',
  finished_water_stor: 'finished-water storage',
  distribution: 'distribution system',
  financial: 'financial capacity',
};

export function profilePwsids(): string[] {
  return nationalIndex().map((r) => r.pwsid);
}

export function hasProfile(pwsid: string): boolean {
  return rawSystem(pwsid) !== null;
}

function yearsAgo(now: Date, years: number): string {
  const d = new Date(now);
  d.setUTCFullYear(d.getUTCFullYear() - years);
  return d.toISOString().slice(0, 10);
}

function round(n: number, digits = 2): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

/** "Gaseous Chlorination, Pre" -> "Gaseous chlorination" (deduped by caller). */
function cleanProcess(p: string): string {
  let s = p.replace(/,\s*(pre|post)$/i, '').trim();
  const inh = s.match(/^Inhibitor,\s*(.+)$/i);
  if (inh) s = `${inh[1]} corrosion control`;
  const act = s.match(/^(.+),\s*(Powdered|Granular)$/i);
  if (act) s = `${act[2]} ${act[1]}`;
  s = s.toLowerCase().replace(/\bph\b/, 'pH').replace(/\buv\b/, 'UV');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function prettyName(n: string): string {
  // SYR4 names are upper-case; UCMR names are already proper (PFOA, lithium).
  if (n !== n.toUpperCase()) return n.charAt(0).toUpperCase() + n.slice(1);
  if (/^PF|^HFPO|^\d/.test(n)) return n;
  return n.charAt(0) + n.slice(1).toLowerCase();
}

function summarizeLab(raw: RawAnalyte[]): LabAnalyteSummary[] {
  return raw.map((a) => {
    const b = benchmarkFor(a.name);
    const unit = normUnit(a.unit);
    const out: LabAnalyteSummary = {
      name: a.name,
      label: b?.label ?? prettyName(a.name),
      group: a.group,
      dataset: a.dataset,
      samples: a.samples,
      detects: a.detects,
      unit: unit ? unitLabel(unit) : null,
      firstDate: a.firstDate,
      lastDate: a.lastDate,
      status: a.detects > 0 ? 'detected' : 'not_detected',
    };
    if (typeof a.maxValue === 'number') out.maxValue = a.maxValue;
    if (typeof a.medianDetect === 'number') out.medianDetect = a.medianDetect;
    const conv = (v: number) => (b ? toBenchmarkUnit(v, unit, b) : v);
    let top = (a.top ?? []).map(([v, d]) => ({ value: conv(v), date: d })).filter((x): x is { value: number; date: string | null } => x.value !== null);
    if (b && top.length > 0) {
      // Values >20x the federal limit in routine compliance monitoring are
      // almost always unit-entry errors (mg/L keyed as µg/L). Keep them out
      // of max/counts and say so, rather than headline a 960 mg/L nitrate.
      const suspect = top.filter((t) => t.value > 20 * b.value);
      if (suspect.length > 0) {
        out.outlierExcluded = { value: round(suspect[0].value, 4), date: suspect[0].date };
        top = top.filter((t) => t.value <= 20 * b.value);
      }
    }
    if (top.length > 0) out.top = top.map((t) => ({ value: round(t.value, 4), date: t.date }));
    if (b) {
      out.benchmark = { value: b.value, unit: unitLabel(b.unit), kind: b.kind, note: b.note, health: b.health };
      if (a.detects > 0 && typeof a.maxValue === 'number') {
        const mx = top.length > 0 ? top[0].value : out.outlierExcluded ? null : toBenchmarkUnit(a.maxValue, unit, b);
        const md = typeof a.medianDetect === 'number' ? toBenchmarkUnit(a.medianDetect, unit, b) : null;
        if (md !== null) out.medianInBenchmarkUnit = round(md, 4);
        if (mx !== null) {
          out.maxInBenchmarkUnit = round(mx, 4);
          const above = top.filter((t) => t.value > b.value).length;
          const dec = (a.deciles ?? []).map(conv).filter((x): x is number => x !== null);
          const decAbove = dec.filter((x) => x > b.value && x <= 20 * b.value).length;
          if (above > 0) {
            out.aboveBenchmark = { count: above, atLeast: above === top.length && a.detects > top.length };
            if (decAbove > 0) out.aboveBenchmark.shareOfDetectsPct = decAbove * 10;
          }
          out.status = mx > b.value ? 'max_above_benchmark' : 'below_benchmark';
        } else {
          out.status = 'below_benchmark';
        }
      }
    }
    return out;
  });
}

const cache = new Map<string, WaterSystemProfile | null>();

export function loadProfile(pwsid: string, now: Date = new Date()): WaterSystemProfile | null {
  const key = `${pwsid}|${now.toISOString().slice(0, 10)}`;
  if (cache.has(key)) return cache.get(key) ?? null;
  const p = buildProfile(pwsid, now);
  cache.set(key, p);
  return p;
}

function buildProfile(pwsid: string, now: Date): WaterSystemProfile | null {
  const got = rawSystem(pwsid);
  if (!got) return null;
  const { raw, meta } = got;
  const sys = raw.system!;
  const occRaw = rawOccurrence(pwsid);
  const occ = occRaw?.analytes ?? [];
  const lab = summarizeLab(occ);

  // Lead / copper 90th percentile series (mg/L -> ppb).
  const toPpb = (v: number, u: string) => {
    const unit = normUnit(u) ?? 'mg/l';
    return round(unit === 'ug/l' ? v : unit === 'ng/l' ? v / 1000 : v * 1000, 2);
  };
  const lead = raw.lead.map((l) => ({ start: l.start, end: l.end, ppb: toPpb(l.value, l.unit) }));
  const copper = raw.copper.map((l) => ({ start: l.start, end: l.end, ppb: toPpb(l.value, l.unit) }));
  const seriesSummary = (s: typeof lead, al: number) => {
    if (s.length === 0) return undefined;
    const latest = s[s.length - 1];
    const mx = s.reduce((a, b) => (b.ppb > a.ppb ? b : a), s[0]);
    return { latestPpb: latest.ppb, latestPeriodEnd: latest.end, maxPpb: mx.ppb, maxPeriodEnd: mx.end, periods: s.length, periodsAboveActionLevel: s.filter((x) => x.ppb > al).length };
  };
  const ls = seriesSummary(lead, 15);
  const cs = seriesSummary(copper, 1300);

  // Violations.
  const five = yearsAgo(now, 5);
  const viol: ProfileViolation[] = raw.violations.map((v) => ({
    id: v.id,
    name: v.name,
    category: v.category,
    contaminant: v.contaminant,
    rule: v.rule,
    healthBased: v.healthBased,
    begin: v.begin,
    end: v.end,
    returnedToCompliance: v.returnedToCompliance,
    status: v.status,
    facility: v.facility,
    measure: v.measure && v.measure.trim() ? v.measure : null,
    unit: v.unit && v.unit.trim() ? v.unit : null,
    enforcement: v.enforcement ?? [],
  }));
  const recent = viol.filter((v) => (v.begin ?? '') >= five);
  const byRule = new Map<string, number>();
  for (const v of recent) {
    const r = v.rule ?? v.contaminant ?? 'Other';
    byRule.set(r, (byRule.get(r) ?? 0) + 1);
  }
  const unresolved = viol.filter((v) => v.status === 'Unaddressed' || v.status === 'Addressed').length;

  // Sanitary survey.
  const survey = raw.visits.find((v) => /sanitary survey/i.test(v.reason ?? '')) ?? raw.visits[0] ?? null;
  const findings: string[] = [];
  if (survey) {
    for (const [k, code] of Object.entries(survey.evals)) {
      const label = EVAL_LABELS[k] ?? k;
      if (code === 'S') findings.push(`significant deficiency: ${label}`);
      else if (code === 'M') findings.push(`minor deficiency: ${label}`);
      else if (code === 'R') findings.push(`recommendation: ${label}`);
    }
  }

  // Treatment (deduped plain names, objectives kept).
  const tSeen = new Set<string>();
  const treatment: WaterSystemProfile['treatment'] = [];
  for (const t of raw.treatment ?? []) {
    const proc = cleanProcess(t.process);
    if (tSeen.has(proc)) continue;
    tSeen.add(proc);
    treatment.push({ process: proc, objective: t.objective });
  }

  // Purchased-water chain, enriched from the seller's own SDWIS row.
  const purchasedFrom = (raw.facilities.purchasedFrom ?? []).map((b) => {
    const s = rawSystem(b.pwsid)?.raw.system ?? null;
    return { pwsid: b.pwsid, name: s?.name ?? b.name, treated: b.treated, population: s?.population ?? null, primarySource: s?.primarySource ?? null };
  });

  // PFAS.
  const pfasRows = lab.filter((a) => a.group === 'pfas');
  const pfasSamples = pfasRows.reduce((m, a) => Math.max(m, a.samples), 0);
  const pfasDetected = pfasRows.filter((a) => a.detects > 0).map((a) => a.name);
  const aboveMcl = pfasRows
    .filter((a) => a.status === 'max_above_benchmark' && a.benchmark)
    .map((a) => ({ name: a.label, maxNgL: round(a.maxInBenchmarkUnit ?? 0, 1), mclNgL: a.benchmark!.value }));
  const pfasDates = pfasRows.flatMap((a) => [a.firstDate, a.lastDate]).filter((x): x is string => Boolean(x)).sort();

  const profile: WaterSystemProfile = {
    pwsid,
    name: sys.name,
    state: sys.state,
    population: sys.population,
    connections: sys.connections,
    owner: sys.owner,
    primarySource: sys.primarySource,
    wholesaler: sys.wholesaler,
    utilityPhone: sys.contact?.phone ?? null,
    utilityAddress: sys.contact?.address ?? null,
    sourceWaterProtection: sys.sourceWaterProtection,
    counties: raw.areas.counties,
    citiesServed: raw.areas.cities.slice(0, 30),
    facilityCounts: raw.facilities.byType ?? {},
    sources: (raw.facilities.sources ?? []).slice(0, 25),
    sourceCount: raw.facilities.sourceCount ?? 0,
    plants: raw.facilities.plants ?? [],
    purchasedFrom,
    treatment,
    lead,
    copper,
    leadSummary: ls ? { ...ls, actionLevelPpb: 15 } : undefined,
    copperSummary: cs ? { latestPpb: cs.latestPpb, latestPeriodEnd: cs.latestPeriodEnd, maxPpb: cs.maxPpb, periods: cs.periods, periodsAboveActionLevel: cs.periodsAboveActionLevel, actionLevelPpb: 1300 } : undefined,
    violationSummary: {
      total: raw.violationTotal ?? viol.length,
      since2016: viol.filter((v) => (v.begin ?? '') >= '2016-01-01').length,
      last5Years: recent.length,
      healthBased5Years: recent.filter((v) => v.healthBased).length,
      healthBasedAllTime: raw.violationHealthTotal ?? viol.filter((v) => v.healthBased).length,
      unresolved,
      byRule5Years: [...byRule.entries()].map(([rule, count]) => ({ rule, count })).sort((a, b) => b.count - a.count).slice(0, 6),
    },
    violations: viol.slice(0, 15),
    lastSanitarySurvey: survey ? { date: survey.date, reason: survey.reason, findings } : null,
    siteVisitCount: raw.visitCount ?? raw.visits.length,
    lab,
    pfas: {
      tested: pfasRows.length > 0,
      samples: pfasSamples,
      compoundsDetected: pfasDetected,
      aboveMcl,
      window: pfasDates.length > 0 ? `${pfasDates[0]} to ${pfasDates[pfasDates.length - 1]}` : null,
    },
    highlights: [],
    provenance: {
      sdwisQuarter: sys.quarter,
      sdwisUrl: ECHO_BULK_URL,
      syr4Url: SYR4_URL,
      ucmr5Url: UCMR5_URL,
      captureTime: meta.captureTime,
      echoReportUrl: echoReportUrl(pwsid),
    },
  };
  profile.highlights = buildHighlights(profile);
  return profile;
}

function fmt(n: number): string {
  return n >= 100 ? Math.round(n).toLocaleString('en-US') : String(round(n, 2));
}

/** Deterministic key findings, ranked by public-health relevance. */
export function buildHighlights(p: WaterSystemProfile): string[] {
  const h: string[] = [];
  for (const a of p.pfas.aboveMcl.slice(0, 2)) {
    h.push(`${a.name} reached ${fmt(a.maxNgL)} ng/L in UCMR 5 testing, above the ${a.mclNgL} ng/L federal limit set in 2024 (compliance is judged on averages, due 2029).`);
  }
  if (p.pfas.tested && p.pfas.aboveMcl.length === 0) {
    h.push(
      p.pfas.compoundsDetected.length === 0
        ? `No PFAS were detected in UCMR 5 testing (${p.pfas.samples} sampling rounds).`
        : `UCMR 5 detected ${p.pfas.compoundsDetected.length} PFAS compound${p.pfas.compoundsDetected.length === 1 ? '' : 's'}, none above a federal limit.`,
    );
  }
  if (p.leadSummary) {
    const l = p.leadSummary;
    h.push(
      l.latestPpb > 15
        ? `Lead at the 90th-percentile home tap was ${fmt(l.latestPpb)} ppb in the period ending ${l.latestPeriodEnd}, above the 15 ppb action level.`
        : `Latest lead 90th percentile: ${fmt(l.latestPpb)} ppb (period ending ${l.latestPeriodEnd}), under the 15 ppb action level${l.periodsAboveActionLevel > 0 ? `; ${l.periodsAboveActionLevel} earlier period${l.periodsAboveActionLevel === 1 ? ' was' : 's were'} above it` : ''}.`,
    );
  }
  const v = p.violationSummary;
  h.push(
    v.last5Years === 0
      ? 'No SDWIS violations recorded in the last 5 years.'
      : `${v.last5Years} SDWIS violation${v.last5Years === 1 ? '' : 's'} in the last 5 years, ${v.healthBased5Years} health-based${v.unresolved > 0 ? `, ${v.unresolved} not yet resolved` : ''}.`,
  );
  const above = p.lab
    .filter((a) => a.status === 'max_above_benchmark' && a.group !== 'pfas' && a.group !== 'disinfectant_residual' && a.name !== 'LEAD' && a.name !== 'COPPER')
    .sort((x, y) => (y.aboveBenchmark?.count ?? 0) - (x.aboveBenchmark?.count ?? 0));
  for (const a of above.slice(0, 2)) {
    const n = a.aboveBenchmark ? `${a.aboveBenchmark.atLeast ? 'at least ' : ''}${a.aboveBenchmark.count} sample${a.aboveBenchmark.count === 1 ? '' : 's'}` : 'a sample';
    h.push(`${a.label}: ${n} above the ${a.benchmark?.value} ${a.benchmark?.unit} limit in 2012-2019 monitoring (highest ${fmt(a.maxInBenchmarkUnit ?? 0)}, typical ${fmt(a.medianInBenchmarkUnit ?? 0)} ${a.benchmark?.unit}).`);
  }
  const main = [...p.purchasedFrom].sort((x, y) => (y.population ?? 0) - (x.population ?? 0))[0];
  if (main && (main.population ?? 0) > (p.population ?? 0) * 0.5) {
    h.push(`Buys treated water from ${main.name}.`);
  } else if (main) {
    h.push(`Has a purchased-water connection with ${main.name}.`);
  }
  return h.slice(0, 6);
}

// ---------------------------------------------------------------------------
// Adapters: feed the profile into the existing schematic sections so every
// curated city (not only NYC) gets compliance, treatment, facilities, lead
// and occurrence cards.
// ---------------------------------------------------------------------------

const WINDOW_YEARS = 5;

export function profileCompliance(pwsid: string, captureTime: string, now: Date = new Date()): SdwisComplianceProfile | null {
  const p = loadProfile(pwsid, now);
  if (!p) return null;
  const start = yearsAgo(now, WINDOW_YEARS);
  const end = now.toISOString().slice(0, 10);
  const raw = rawSystem(pwsid)!.raw.violations;
  const records: SdwisViolationRecord[] = raw
    .filter((v) => (v.begin ?? '') >= start || (v.end === null && v.status !== 'Resolved' && v.status !== 'Archived'))
    .map((v) => ({
      violationCode: v.code ?? '',
      violationType: v.healthBased ? 'health_based' : v.categoryCode === 'MR' ? 'monitoring_and_reporting' : 'other',
      contaminantName: v.contaminant ?? undefined,
      beginDate: v.begin ?? start,
      endDate: v.end,
      complianceAchieved: Boolean(v.returnedToCompliance) || v.status === 'Resolved' || v.status === 'Archived',
    }));
  return {
    pwsid,
    queryWindow: { startDate: start, endDate: end },
    totalViolationsFound: records.length,
    records,
    echoReportUrl: echoReportUrl(pwsid),
    dataCaptureTime: captureTime || p.provenance.captureTime,
  };
}

export function profileTreatment(pwsid: string): TreatmentProfile | null {
  const p = loadProfile(pwsid);
  if (!p || p.treatment.length === 0) return null;
  return { pwsid, processes: p.treatment.map((t) => t.process.toUpperCase()), rigor: null, dataCaptureTime: p.provenance.captureTime };
}

function facilityKind(type: string | null): SourceFacilityRecord['facilityType'] {
  const t = (type ?? '').toLowerCase();
  if (t.includes('intake')) return 'intake';
  if (t.includes('well')) return 'well';
  if (t.includes('reservoir') || t.includes('spring') || t.includes('infiltration')) return 'reservoir';
  if (t.includes('treatment')) return 'treatment_plant';
  if (t.includes('consecutive') || t.includes('purchase')) return 'purchased';
  return 'other';
}

export function profileFacilities(pwsid: string): SourceFacilitiesProfile | null {
  const p = loadProfile(pwsid);
  if (!p) return null;
  const facilities: SourceFacilityRecord[] = [
    ...p.sources.map((s) => ({
      facilityName: s.name,
      facilityType: facilityKind(s.type),
      waterType: (/surface/i.test(s.water ?? '') ? 'surface' : /ground/i.test(s.water ?? '') ? 'ground' : 'unknown') as SourceFacilityRecord['waterType'],
      isSource: true,
    })),
    ...p.plants.map((n) => ({ facilityName: n, facilityType: 'treatment_plant' as const, isSource: false })),
  ];
  if (facilities.length === 0 && p.purchasedFrom.length === 0) return null;
  return {
    pwsid,
    facilities: facilities.slice(0, 30),
    sellerChain: p.purchasedFrom.map((s) => ({ pwsid: s.pwsid, systemName: s.name })),
    dataCaptureTime: p.provenance.captureTime,
    sourceVersionId: p.provenance.sdwisQuarter ?? 'sdwis',
    provenanceUrl: ECHO_BULK_URL,
  };
}

export function profileLeadMetrics(pwsid: string): QualityMetricRecord[] {
  const p = loadProfile(pwsid);
  if (!p) return [];
  const out: QualityMetricRecord[] = [];
  const prov = (period: string) => ({ sourceDocumentUrl: ECHO_BULK_URL, reportPeriod: period, captureTime: p.provenance.captureTime, sourceVersionId: `sdwis-${p.provenance.sdwisQuarter ?? ''}` });
  const last = (s: WaterSystemProfile['lead']) => s[s.length - 1];
  const l = last(p.lead);
  if (l) {
    out.push({
      parameter: 'Lead (90th percentile)',
      reportedValue: `${fmt(l.ppb)} ppb`,
      regulatoryThreshold: '15 ppb action level',
      complianceStatus: l.ppb > 15 ? 'exceeds_standard' : 'within_standard',
      testDate: l.end ?? l.start ?? '',
      provenance: prov(`LCR ${l.start ?? ''} to ${l.end ?? ''}`),
    });
  }
  const c = last(p.copper);
  if (c) {
    out.push({
      parameter: 'Copper (90th percentile)',
      reportedValue: `${fmt(c.ppb / 1000)} mg/L`,
      regulatoryThreshold: '1.3 mg/L action level',
      complianceStatus: c.ppb > 1300 ? 'exceeds_standard' : 'within_standard',
      testDate: c.end ?? c.start ?? '',
      provenance: prov(`LCR ${c.start ?? ''} to ${c.end ?? ''}`),
    });
  }
  return out;
}

/** Benchmark-carrying lab rows as metric records (detected first). */
export function profileLabMetrics(pwsid: string, dataset: 'SYR4' | 'UCMR5', limit = 6): QualityMetricRecord[] {
  const p = loadProfile(pwsid);
  if (!p) return [];
  const rank = (a: LabAnalyteSummary) =>
    a.status === 'max_above_benchmark' ? 0 : a.status === 'below_benchmark' ? 1 : a.status === 'detected' ? 2 : 3;
  const rows = p.lab
    .filter((a) => a.dataset === dataset && (a.benchmark || a.detects > 0))
    .sort((a, b) => rank(a) - rank(b) || b.detects - a.detects)
    .slice(0, limit);
  const url = dataset === 'SYR4' ? SYR4_URL : UCMR5_URL;
  return rows.map((a) => {
    const bu = a.benchmark?.unit ?? a.unit ?? '';
    const val =
      a.detects === 0
        ? `not detected in ${a.samples} samples`
        : a.maxInBenchmarkUnit !== undefined
          ? `max ${fmt(a.maxInBenchmarkUnit)} ${bu}, median ${fmt(a.medianInBenchmarkUnit ?? 0)} ${bu}`
          : `max ${fmt(a.maxValue ?? 0)} ${a.unit ?? ''}`.trim();
    return {
      parameter: a.label,
      reportedValue: val,
      regulatoryThreshold: a.benchmark ? `${a.benchmark.value} ${a.benchmark.unit} ${a.benchmark.kind === 'action_level' ? 'action level' : a.benchmark.kind === 'mrdl' ? 'MRDL' : 'MCL'}` : 'no federal MCL',
      complianceStatus: a.status === 'max_above_benchmark' ? 'sample_above_benchmark' : a.benchmark ? 'within_standard' : 'occurrence_only',
      testDate: a.lastDate ?? '',
      provenance: {
        sourceDocumentUrl: url,
        reportPeriod: dataset === 'SYR4' ? 'EPA Six-Year Review 4 (2012-2019)' : 'EPA UCMR 5 (2023-2025)',
        captureTime: p.provenance.captureTime,
        sourceVersionId: dataset === 'SYR4' ? 'syr4-2012-2019' : 'ucmr5-2023-2025',
      },
    };
  });
}



/**
 * Compact, model-friendly facts from a profile (used by the LLM narrator
 * facts message and by the grounding audit's allowed numbers/entities).
 * Only fields the answer can need; no coordinates, no personal contacts.
 */
export function profileFacts(p: WaterSystemProfile): Record<string, unknown> {
  const lab = p.lab
    .filter((a) => a.detects > 0 || a.group === 'pfas' || a.benchmark)
    .map((a) => ({
      analyte: a.label,
      dataset: a.dataset === 'SYR4' ? 'EPA Six-Year Review 4 (2012-2019)' : 'EPA UCMR 5 (2023-2025)',
      samples: a.samples,
      detects: a.detects,
      max: a.maxInBenchmarkUnit ?? a.maxValue ?? null,
      median: a.medianInBenchmarkUnit ?? a.medianDetect ?? null,
      unit: a.benchmark?.unit ?? a.unit,
      limit: a.benchmark ? `${a.benchmark.value} ${a.benchmark.unit} ${a.benchmark.kind}` : 'none',
      samplesAboveLimit: a.aboveBenchmark ? `${a.aboveBenchmark.atLeast ? '>=' : ''}${a.aboveBenchmark.count}` : 0,
      status: a.status,
      lastSample: a.lastDate,
    }));
  return {
    population: p.population,
    serviceConnections: p.connections,
    owner: p.owner,
    primarySource: p.primarySource,
    counties: p.counties,
    sources: p.sources.slice(0, 10).map((s) => `${s.name} (${s.type ?? 'source'}, ${s.water ?? ''})`),
    sourceCount: p.sourceCount,
    treatmentPlants: p.plants.slice(0, 10),
    buysWaterFrom: p.purchasedFrom.map((s) => s.name),
    treatment: p.treatment.map((t) => `${t.process}${t.objective ? ` (${t.objective})` : ''}`),
    leadNinetiethPercentilePpb: p.lead.slice(-6).map((l) => ({ periodEnd: l.end, ppb: l.ppb })),
    leadSummary: p.leadSummary ?? null,
    copperSummary: p.copperSummary ?? null,
    violationSummary: p.violationSummary,
    recentViolations: p.violations.slice(0, 8).map((v) => ({
      name: v.name,
      rule: v.rule,
      contaminant: v.contaminant,
      healthBased: v.healthBased,
      begin: v.begin,
      status: v.status,
      returnedToCompliance: v.returnedToCompliance,
    })),
    lastSanitarySurvey: p.lastSanitarySurvey,
    pfas: p.pfas,
    lab,
    keyFindings: p.highlights,
    sdwisQuarter: p.provenance.sdwisQuarter,
  };
}

/** Flatten a facts object into strings for grounding-audit allow lists. */
export function flattenFacts(v: unknown, out: string[] = []): string[] {
  if (v === null || v === undefined) return out;
  if (typeof v === 'string') out.push(v);
  else if (typeof v === 'number' || typeof v === 'boolean') out.push(String(v));
  else if (Array.isArray(v)) v.forEach((x) => flattenFacts(x, out));
  else if (typeof v === 'object') Object.values(v as Record<string, unknown>).forEach((x) => flattenFacts(x, out));
  return out;
}
