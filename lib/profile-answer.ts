// lib/profile-answer.ts — question-focused answers from the rich EPA profile.
// Every number comes from WaterSystemProfile (SDWIS + SYR4 + UCMR5). The
// voice is a calm public-service guide: direct first sentence, a few
// scannable bullets, the one caveat that matters, never a safety verdict.
import type { LabAnalyteSummary, WaterOriginSchematic, WaterSystemProfile } from '../types/water-intelligence.js';
import type { AnswerIntent } from './narrator.js';

export interface ProfileAnswer {
  markdown: string;
  followUps: string[];
  focus: AnswerIntent;
  askedParameters: Array<{ name: string; found: boolean }>;
}

interface Topic {
  key: string;
  name: string;
  words: RegExp;
  analytes: string[];
}

/** Topics a question can name. `analytes` are upper-case dataset names. */
const TOPICS: Topic[] = [
  { key: 'lead', name: 'Lead', words: /\b(lead|pb|service lines?)\b(?!\s+(to|me|you|us)\b)/i, analytes: ['LEAD'] },
  { key: 'copper', name: 'Copper', words: /\bcopper\b/i, analytes: ['COPPER', 'COPPER, FREE'] },
  { key: 'pfas', name: 'PFAS', words: /\b(pfas|pfoa|pfos|pfhxs|pfna|genx|hfpo|forever chemicals?)\b/i, analytes: [] },
  { key: 'nitrate', name: 'Nitrate', words: /\bnitr(ate|ite)s?\b/i, analytes: ['NITRATE', 'HYBRID NITRATE', 'NITRITE', 'NITRATE-NITRITE'] },
  { key: 'arsenic', name: 'Arsenic', words: /\barsenic\b/i, analytes: ['ARSENIC'] },
  { key: 'dbp', name: 'Disinfection byproducts', words: /\b(tthm|trihalomethanes?|haa5|haloacetic|byproducts?|by-products?|chloroform)\b/i, analytes: ['TTHM', 'TOTAL TRIHALOMETHANES (TTHM)', 'TOTAL HALOACETIC ACIDS (HAA5)', 'HALOACETIC ACIDS (HAA5)', 'CHLOROFORM', 'BROMODICHLOROMETHANE', 'BROMOFORM', 'DIBROMOCHLOROMETHANE'] },
  { key: 'fluoride', name: 'Fluoride', words: /\bfluorid(e|ation)\b/i, analytes: ['FLUORIDE'] },
  { key: 'chlorine', name: 'Chlorine', words: /\b(chlorine|chloramines?|disinfect\w*)\b/i, analytes: ['CHLORINE', 'CHLORAMINE', 'FREE RESIDUAL CHLORINE', 'TOTAL CHLORINE', 'RESIDUAL CHLORINE', 'CHLORINE DIOXIDE'] },
  { key: 'radio', name: 'Radioactivity', words: /\b(radium|uranium|radioactiv\w*|radionuclides?|gross alpha)\b/i, analytes: ['COMBINED RADIUM (-226 & -228)', 'COMBINED URANIUM', 'GROSS ALPHA, EXCL. RADON & U', 'GROSS BETA PARTICLE ACTIVITY'] },
  { key: 'lithium', name: 'Lithium', words: /\blithium\b/i, analytes: ['LITHIUM'] },
  { key: 'coliform', name: 'Bacteria', words: /\b(coliform|bacteria|e\.?\s?coli|microb\w*|germs?|boil)\b/i, analytes: [] },
  { key: 'solvents', name: 'Industrial solvents', words: /\b(tce|pce|trichloroethylene|tetrachloroethylene|benzene|vinyl chloride|solvents?|vocs?)\b/i, analytes: ['TRICHLOROETHYLENE', 'TETRACHLOROETHYLENE', 'BENZENE', 'VINYL CHLORIDE', 'CARBON TETRACHLORIDE', '1,2-DICHLOROETHANE'] },
  { key: 'pesticides', name: 'Pesticides', words: /\b(pesticides?|herbicides?|atrazine|glyphosate|weed ?killer)\b/i, analytes: ['ATRAZINE', 'GLYPHOSATE', 'SIMAZINE', 'ALACHLOR', '2,4-D'] },
];

export function detectTopics(question: string): Topic[] {
  return TOPICS.filter((t) => t.words.test(question ?? ''));
}

const fmtN = (n: number): string => {
  if (!Number.isFinite(n)) return String(n);
  if (Math.abs(n) >= 1000) return Math.round(n).toLocaleString('en-US');
  if (Math.abs(n) >= 10) return String(Math.round(n * 10) / 10);
  return String(Math.round(n * 100) / 100);
};

const people = (n: number | null): string => {
  if (!n) return '';
  if (n >= 1_000_000) return `${fmtN(Math.round(n / 100_000) / 10)} million people`;
  if (n >= 10_000) return `${fmtN(Math.round(n / 1000))},000 people`;
  return `${fmtN(n)} people`;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function niceDate(iso: string | null | undefined): string {
  if (!iso) return 'an unrecorded date';
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}`;
}
function niceMonth(iso: string | null | undefined): string {
  if (!iso) return '';
  const m = iso.match(/^(\d{4})-(\d{2})/);
  return m ? `${MONTHS[Number(m[2]) - 1]} ${m[1]}` : iso;
}
function period(start: string | null, end: string | null): string {
  if (start && end) return `${niceMonth(start)} to ${niceMonth(end)}`;
  return niceMonth(end ?? start);
}

/** "Des Moines" -> "Des Moines'", "Chicago" -> "Chicago's". */
export function poss(name: string): string {
  return /s$/i.test(name) ? `${name}'` : `${name}'s`;
}

function sourceWords(p: WaterSystemProfile): string {
  const s = (p.primarySource ?? '').toLowerCase();
  if (!s) return '';
  const m = s.match(/^(.*?)\s+purchased$/);
  return m ? `purchased ${m[1]}` : s;
}

function list(items: string[], max = 4): string {
  const xs = items.slice(0, max);
  const more = items.length - xs.length;
  const tail = more > 0 ? ` and ${more} more` : '';
  if (xs.length <= 1) return xs.join('') + tail;
  if (more > 0) return `${xs.join(', ')}${tail}`;
  return `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
}

function labFor(p: WaterSystemProfile, analytes: string[]): LabAnalyteSummary[] {
  const want = new Set(analytes);
  return p.lab.filter((a) => want.has(a.name.toUpperCase()));
}

function labBullet(a: LabAnalyteSummary): string {
  const range = a.firstDate && a.lastDate ? `${a.firstDate.slice(0, 4)}-${a.lastDate.slice(0, 4)}` : '';
  const src = a.dataset === 'SYR4' ? `EPA compliance monitoring${range ? `, ${range}` : ''}` : `EPA UCMR 5${range ? `, ${range}` : ''}`;
  if (a.detects === 0) return `- **${a.label}**: not detected in ${fmtN(a.samples)} samples (${src})`;
  const unit = a.benchmark?.unit ?? a.unit ?? '';
  const max = a.maxInBenchmarkUnit ?? a.maxValue;
  const med = a.medianInBenchmarkUnit ?? a.medianDetect;
  let s = `- **${a.label}**: found in ${fmtN(a.detects)} of ${fmtN(a.samples)} samples, typically ${fmtN(med ?? 0)} ${unit}, highest ${fmtN(max ?? 0)} ${unit}`;
  if (a.benchmark) {
    const lim = `${fmtN(a.benchmark.value)} ${a.benchmark.unit}`;
    const kind = a.benchmark.kind === 'action_level' ? 'action level' : a.benchmark.kind === 'mrdl' ? 'disinfectant limit' : 'federal limit';
    if (a.status === 'max_above_benchmark' && a.aboveBenchmark) {
      s += `; ${a.aboveBenchmark.atLeast ? 'at least ' : ''}${a.aboveBenchmark.count} sample${a.aboveBenchmark.count === 1 ? '' : 's'} above the ${lim} ${kind}`;
    } else {
      s += ` vs a ${lim} ${kind}`;
    }
  }
  return `${s} (${src})`;
}

function violationsAbout(p: WaterSystemProfile, re: RegExp) {
  return p.violations.filter((v) => re.test(`${v.contaminant ?? ''} ${v.rule ?? ''} ${v.name ?? ''}`));
}

function violationBullet(v: WaterSystemProfile['violations'][number]): string {
  const what = v.name ?? v.contaminant ?? 'Violation';
  const about = v.contaminant && v.name && !v.name.toLowerCase().includes(v.contaminant.toLowerCase()) ? ` (${v.contaminant})` : '';
  const state = v.returnedToCompliance
    ? `back in compliance ${niceDate(v.returnedToCompliance)}`
    : v.status === 'Resolved' || v.status === 'Archived'
      ? 'resolved'
      : 'not yet resolved';
  return `- ${niceDate(v.begin)}: **${what}**${about}, ${v.healthBased ? 'health-based' : 'paperwork or monitoring'}, ${state}`;
}

// ---------------------------------------------------------------------------

function answerLead(city: string, p: WaterSystemProfile): string[] {
  const out: string[] = [];
  const l = p.leadSummary;
  if (!l) {
    out.push(`I don't have a lead and copper summary for ${city} in the federal records.`);
  } else {
    const above = l.latestPpb > 15;
    out.push(
      `**${poss(city)} latest lead result is ${fmtN(l.latestPpb)} ppb**, ${above ? 'above' : 'under'} the federal 15 ppb action level (90th percentile of sampled home taps, ${period(p.lead[p.lead.length - 1].start, p.lead[p.lead.length - 1].end)}).`,
      '',
    );
    const byEnd = new Map<string, number>();
    for (const x of p.lead) byEnd.set(niceMonth(x.end), x.ppb);
    const recent = [...byEnd.entries()].slice(-4).map(([k, v]) => `${fmtN(v)} (${k})`);
    if (recent.length > 1) out.push(`- **Recent trend, ppb**: ${recent.join(', ')}`);
    out.push(
      l.periodsAboveActionLevel > 0
        ? `- **Above the action level** in ${l.periodsAboveActionLevel} of ${l.periods} reported periods; the highest was ${fmtN(l.maxPpb)} ppb (${niceMonth(l.maxPeriodEnd)})`
        : `- **Never above the action level** in ${l.periods} reported periods; the highest was ${fmtN(l.maxPpb)} ppb (${niceMonth(l.maxPeriodEnd)})`,
    );
    if (p.copperSummary) {
      out.push(`- **Copper**: ${fmtN(p.copperSummary.latestPpb / 1000)} mg/L latest vs a 1.3 mg/L action level`);
    }
  }
  const lsl = violationsAbout(p, /lead and copper|lsl|service line/i).slice(0, 2);
  for (const v of lsl) out.push(violationBullet(v));
  if (p.treatment.some((t) => /corrosion|orthophosphate|inhibitor|ph adjust/i.test(`${t.process} ${t.objective ?? ''}`))) {
    out.push('- **Corrosion control**: the utility reports treatment that keeps lead from leaching out of pipes');
  }
  out.push(
    '',
    "Lead rarely comes from the source water; it leaches from lead service lines and older plumbing, so one home can differ from the city average. If your water sat for hours, run the cold tap first, and a filter certified to NSF/ANSI 53 removes lead.",
  );
  return out;
}

function answerPfas(city: string, p: WaterSystemProfile): string[] {
  const out: string[] = [];
  const pf = p.pfas;
  const rows = p.lab.filter((a) => a.group === 'pfas');
  if (!pf.tested) {
    out.push(`${city} has no PFAS results in EPA's UCMR 5 national survey yet.`);
    return out;
  }
  if (pf.aboveMcl.length > 0) {
    out.push(
      `**Yes. ${city} reported ${list(pf.aboveMcl.map((a) => a.name))} above the new federal PFAS limits** in EPA's UCMR 5 testing (${pf.window}).`,
      '',
    );
  } else if (pf.compoundsDetected.length > 0) {
    out.push(
      `**${city} had low-level PFAS detections, none above a federal limit**, in EPA's UCMR 5 testing (${pf.window}).`,
      '',
    );
  } else {
    out.push(
      `**No PFAS were detected in ${poss(city)} water** in EPA's UCMR 5 testing: 29 compounds checked over ${pf.samples} sampling rounds (${pf.window}).`,
    );
    return [...out, '', 'UCMR 5 is a one-time national survey; results reflect samples at the treatment plant or entry points, not every tap.'];
  }
  const detected = rows.filter((a) => a.detects > 0).sort((a, b) => (b.maxInBenchmarkUnit ?? 0) - (a.maxInBenchmarkUnit ?? 0) || b.detects - a.detects);
  for (const a of detected.slice(0, 5)) {
    const ng = a.unit === 'ug/L' ? (a.maxValue ?? 0) * 1000 : a.maxValue ?? 0;
    const max = a.maxInBenchmarkUnit ?? ng;
    const lim = a.benchmark ? ` vs a ${fmtN(a.benchmark.value)} ng/L limit` : ', no federal limit';
    out.push(`- **${a.label}**: highest ${fmtN(max)} ng/L, found in ${a.detects} of ${a.samples} samples${lim}`);
  }
  if (detected.length > 5) out.push(`- ${detected.length - 5} more PFAS compounds detected at lower levels`);
  out.push(
    '',
    'The 2024 rule judges compliance on a running annual average starting in 2029; EPA proposed in May 2026 to keep the 4 ng/L PFOA and PFOS limits but drop the PFHxS, PFNA and GenX limits. Reverse osmosis and certified activated-carbon filters reduce PFAS at home.',
  );
  return out;
}

function answerAnalytes(city: string, p: WaterSystemProfile, t: Topic): string[] {
  const out: string[] = [];
  const rows = labFor(p, t.analytes).sort((a, b) => b.samples - a.samples);
  const related =
    t.key === 'coliform'
      ? violationsAbout(p, /coliform|e\.? ?coli|microbial|surface water treatment|turbidity/i)
      : violationsAbout(p, t.words);
  const treat =
    t.key === 'fluoride'
      ? p.treatment.filter((x) => /fluorid/i.test(x.process))
      : t.key === 'chlorine'
        ? p.treatment.filter((x) => /chlor|hypochlor|ozon|ultraviolet|uv/i.test(x.process))
        : [];
  const headRow = rows.find((a) => a.detects > 0) ?? rows[0];
  if (t.key === 'coliform') {
    out.push(
      related.length === 0
        ? `**No bacteria or treatment-technique violations are on record for ${city}** in EPA's drinking water database.`
        : `**${city} has ${related.length} bacteria or surface-water-treatment record${related.length === 1 ? '' : 's'}** in EPA's database; the most recent are below.`,
    );
  } else if (headRow) {
    const above = rows.some((a) => a.status === 'max_above_benchmark');
    const any = rows.some((a) => a.detects > 0);
    out.push(
      !any
        ? `**${t.name} was not detected in ${poss(city)} compliance samples** (${headRow.firstDate?.slice(0, 4)}-${headRow.lastDate?.slice(0, 4)}).`
        : above
          ? `**${city} reported some ${t.name.toLowerCase()} samples above the federal limit**, though typical levels were lower.`
          : `**${t.name} shows up in ${poss(city)} water at levels under the federal limit.**`,
    );
  } else if (treat.length > 0) {
    out.push(`I don't have ${t.name.toLowerCase()} lab samples for ${city}, but the utility reports ${list(treat.map((x) => x.process.toLowerCase()))} as a treatment step.`);
  } else {
    out.push(`I don't have ${t.name.toLowerCase()} results for ${city} in EPA's national monitoring files.`);
  }
  if (rows.length > 0) out.push('', ...rows.slice(0, 4).map(labBullet));
  if (treat.length > 0 && headRow) out.push(`- **Treatment**: ${list(treat.map((x) => x.process.toLowerCase()))}`);
  const cutoff = `${new Date().getUTCFullYear() - 15}`;
  const recentRel = related.filter((v) => (v.begin ?? '') >= cutoff);
  for (const v of recentRel.slice(0, 3)) out.push(violationBullet(v));
  if (recentRel.length === 0 && related.length > 0 && t.key !== 'coliform') {
    out.push(`- **No related violations in the last 15 years**; the most recent was in ${(related[0].begin ?? '').slice(0, 4)}`);
  }
  const health = rows.find((a) => a.benchmark?.health)?.benchmark?.health;
  const note = rows.find((a) => a.benchmark?.note)?.benchmark?.note;
  const outlier = rows.find((a) => a.outlierExcluded);
  const tail: string[] = [];
  if (health) tail.push(health);
  if (note && rows.some((a) => a.status === 'max_above_benchmark')) tail.push(note);
  if (outlier) tail.push(`One reported value (${fmtN(outlier.outlierExcluded!.value)} ${outlier.benchmark?.unit}) looks like a unit-entry error and is left out.`);
  if (rows.length > 0 && rows[0].dataset === 'SYR4') tail.push('These are 2012-2019 EPA compliance samples, the latest national release.');
  if (tail.length > 0) out.push('', tail.join(' '));
  return out;
}

function answerSource(city: string, s: WaterOriginSchematic, p: WaterSystemProfile): string[] {
  const out: string[] = [];
  const basins = s.primaryBasins;
  const kind = sourceWords(p);
  const serves = p.population ? ` serves about ${people(p.population)}` : '';
  out.push(
    basins.length > 0
      ? `**${poss(city)} water comes from ${list(basins.map((b) => (/(river|lake|reservoir|aquifer|basin|valley|bay|creek|watershed)/i.test(b) ? b : `the ${b} basin`)))}.** ${p.name}${serves}${kind ? ` and is classed as ${kind}` : ''}.`
      : `**${p.name}${serves} using ${kind || 'its own sources'}.**`,
    '',
  );
  const fc = p.facilityCounts;
  const intakes = fc['Intake'] ?? 0;
  const wells = fc['Well'] ?? 0;
  const counts: string[] = [];
  if (intakes) counts.push(`${intakes} surface intake${intakes === 1 ? '' : 's'}`);
  if (wells) counts.push(`${wells} well${wells === 1 ? '' : 's'}`);
  if (fc['Reservoir']) counts.push(`${fc['Reservoir']} reservoir${fc['Reservoir'] === 1 ? '' : 's'}`);
  if (counts.length > 0) out.push(`- **Active sources**: ${list(counts)}`);
  const named = p.sources.filter((x) => !/^(well|intake)\s*#?\d+$/i.test(x.name)).slice(0, 4).map((x) => x.name);
  if (named.length > 0) out.push(`- **Named sources**: ${list(named)}`);
  if (p.plants.length > 0) out.push(`- **Treatment plants**: ${list(p.plants, 3)}`);
  const buys = [...p.purchasedFrom].sort((a, b) => (b.population ?? 0) - (a.population ?? 0));
  if (buys.length > 0) out.push(`- **Also buys water from**: ${list(buys.map((b) => b.name), 3)}`);
  if (p.counties.length > 0) out.push(`- **Serves**: ${list(p.counties.map((c) => `${c} County`), 3)}${p.state ? `, ${p.state}` : ''}`);
  if (s.waterUse) out.push(`- **County supply mix (modeled)**: about ${s.waterUse.surfacePct}% surface, ${s.waterUse.groundPct}% groundwater`);
  if (p.sourceWaterProtection) out.push('- **Source water protection plan** on file with the state');
  return out;
}

function groupTreatment(p: WaterSystemProfile): string[] {
  const by = new Map<string, string[]>();
  for (const t of p.treatment) {
    const k = t.objective ?? 'Other';
    const arr = by.get(k) ?? [];
    if (!arr.includes(t.process.toLowerCase())) arr.push(t.process.toLowerCase());
    by.set(k, arr);
  }
  return [...by.entries()].map(([k, v]) => `${k.toLowerCase()}: ${list(v, 3)}`);
}

function answerPathway(city: string, s: WaterOriginSchematic, p: WaterSystemProfile): string[] {
  const out: string[] = [`Here is how ${poss(city)} water gets to your tap.`, ''];
  const steps: string[] = [];
  const src = s.primaryBasins.length > 0 ? list(s.primaryBasins) : (p.primarySource ?? 'local sources');
  const fc = p.facilityCounts;
  const srcCount = [fc['Intake'] ? `${fc['Intake']} intakes` : '', fc['Well'] ? `${fc['Well']} wells` : ''].filter(Boolean).join(' and ');
  steps.push(`**Source**: ${src}${srcCount ? `, drawn through ${srcCount}` : ''}`);
  if ((s.conveyances ?? []).length > 0) steps.push(`**Conveyance**: ${list((s.conveyances ?? []).map((c) => c.name), 3)}`);
  if (p.purchasedFrom.length > 0) steps.push(`**Wholesale supply**: treated water bought from ${list([...p.purchasedFrom].sort((a, b) => (b.population ?? 0) - (a.population ?? 0)).map((b) => b.name), 2)}`);
  const g = groupTreatment(p);
  if (p.plants.length > 0 || g.length > 0) {
    steps.push(`**Treatment**${p.plants.length > 0 ? ` at ${list(p.plants, 2)}` : ''}${g.length > 0 ? `: ${g.slice(0, 4).join('; ')}` : ''}`);
  }
  const dist: string[] = [];
  if (fc['Storage']) dist.push(`${fc['Storage']} storage tanks`);
  if (fc['Pump Facility']) dist.push(`${fc['Pump Facility']} pump stations`);
  if (p.connections) dist.push(`${fmtN(p.connections)} service connections`);
  steps.push(`**Distribution**: city mains${dist.length > 0 ? ` with ${list(dist)}` : ''}`);
  steps.push('**Your tap**: the service line and home plumbing, where lead can enter');
  out.push(...steps.map((x, i) => `${i + 1}. ${x}`));
  out.push('', 'The map draws this route as a schematic; exact pipe alignments and intake locations are not published.');
  return out;
}

function answerCompliance(city: string, p: WaterSystemProfile): string[] {
  const v = p.violationSummary;
  const out: string[] = [];
  out.push(
    v.last5Years === 0
      ? `**${city} has no drinking water violations on record in the last 5 years.**`
      : `**${city} has ${v.last5Years} violation${v.last5Years === 1 ? '' : 's'} on record in the last 5 years, ${v.healthBased5Years === 0 ? 'none' : v.healthBased5Years} health-based.**${v.healthBased5Years === 0 ? ' The rest are monitoring or reporting lapses.' : ''}`,
    '',
  );
  const recent = p.violations.slice(0, 4);
  if (recent.length > 0) out.push(...recent.map(violationBullet));
  if (v.unresolved > 0) out.push(`- **Still open**: ${v.unresolved}`);
  if (p.lastSanitarySurvey?.date) {
    const sig = p.lastSanitarySurvey.findings.filter((f) => f.startsWith('significant'));
    out.push(
      `- **Last state inspection** (${p.lastSanitarySurvey.reason?.toLowerCase() ?? 'site visit'}): ${niceDate(p.lastSanitarySurvey.date)}${sig.length > 0 ? `, ${sig.length} significant deficienc${sig.length === 1 ? 'y' : 'ies'} (${list(sig.map((x) => x.replace('significant deficiency: ', '')), 3)})` : ', no significant deficiencies'}`,
    );
  }
  out.push('', `All-time, EPA lists ${v.total} records for this system, ${v.healthBasedAllTime} of them health-based. A record describes a past period, not today's water.`);
  return out;
}

function answerOverview(city: string, s: WaterOriginSchematic, p: WaterSystemProfile): string[] {
  const out: string[] = [];
  const src = s.primaryBasins.length > 0 ? `from ${list(s.primaryBasins, 3)}` : p.primarySource ? `from ${sourceWords(p)}` : '';
  out.push(
    `Here is what EPA's records say about ${poss(city)} tap water${p.population ? `, which reaches about ${people(p.population)}` : ''}${src ? ` ${src}` : ''}.`,
    '',
    ...p.highlights.slice(0, 5).map((h) => `- ${h}`),
    '',
    "These are records, not a live reading of your tap. Ask me about any of them, like lead, PFAS or violations, and I'll go deeper.",
  );
  return out;
}

function followUps(city: string, p: WaterSystemProfile, focus: AnswerIntent, asked: Set<string>): string[] {
  const out: string[] = [];
  const push = (q: string) => {
    if (!out.includes(q)) out.push(q);
  };
  if (p.pfas.aboveMcl.length > 0 && !asked.has('pfas')) push(`Which PFAS were found in ${city}?`);
  if (!asked.has('lead')) push(`Is there lead in ${city} water?`);
  const dbp = p.lab.find((a) => /TTHM|HAA5/.test(a.name) && a.status === 'max_above_benchmark');
  if (dbp && !asked.has('dbp')) push(`What are disinfection byproducts in ${city}?`);
  if (focus !== 'source') push(`Where does ${city} water come from?`);
  if (focus !== 'compliance') push(`Any violations for ${city} in the last 5 years?`);
  if (focus !== 'pathway') push(`How does ${city} water reach my tap?`);
  if (!asked.has('pfas')) push(`Has ${city} reported PFAS?`);
  return out.slice(0, 3);
}

/** Main entry: null when the schematic has no profile. */
export function composeProfileAnswer(
  s: WaterOriginSchematic,
  question: string,
  city: string,
  focus: AnswerIntent,
): ProfileAnswer | null {
  const p = s.profile;
  if (!p) return null;
  const topics = detectTopics(question);
  const lines: string[] = [];
  const asked = new Set(topics.map((t) => t.key));
  const askedParameters = topics.map((t) => ({ name: t.name, found: true }));
  const safety = /\b(safe|drinkable|potable|healthy|quality|ok to drink|okay to drink|clean)\b/i.test(question);

  if (topics.length > 0) {
    topics.slice(0, 2).forEach((t, i) => {
      if (i > 0) lines.push('', '---', '');
      if (t.key === 'lead') lines.push(...answerLead(city, p));
      else if (t.key === 'pfas') lines.push(...answerPfas(city, p));
      else lines.push(...answerAnalytes(city, p, t));
    });
  } else if (focus === 'compliance') {
    lines.push(...answerCompliance(city, p));
  } else if (focus === 'pathway') {
    lines.push(...answerPathway(city, s, p));
  } else if (focus === 'source') {
    lines.push(...answerSource(city, s, p));
  } else {
    lines.push(...answerOverview(city, s, p));
    if (safety) {
      lines.splice(0, 1, `No record can promise what comes out of your tap today, but here is what EPA's records show for ${city}${p.population ? `, which serves about ${people(p.population)}` : ''}.`);
    }
  }
  return {
    markdown: lines.join('\n').replace(/\n{3,}/g, '\n\n').trim(),
    followUps: followUps(city, p, topics.length > 0 ? 'quality' : focus, asked),
    focus: topics.length > 0 ? 'quality' : focus,
    askedParameters,
  };
}
