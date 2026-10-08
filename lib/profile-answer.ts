// lib/profile-answer.ts — question-focused answers from the rich EPA profile.
// Every number comes from WaterSystemProfile (SDWIS + SYR4 + UCMR5). The
// voice is a calm public-service guide: direct first sentence, a few
// scannable bullets, the one caveat that matters, never a safety verdict.
import type { LabAnalyteSummary, WaterOriginSchematic, WaterSystemProfile } from '../types/water-intelligence.js';
import type { AnswerIntent } from './narrator.js';
import { plainViolation } from './plain-violation.js';

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

function violationsAbout(p: WaterSystemProfile, re: RegExp) {
  return p.violations.filter((v) => re.test(`${v.contaminant ?? ''} ${v.rule ?? ''} ${v.name ?? ''}`));
}

// ---------------------------------------------------------------------------

// Answers are deliberately short: one sentence that answers the exact
// question, plus at most one that qualifies it. The interface draws the
// chart, map or timeline for that topic, so nothing else is repeated here.

function answerLead(city: string, p: WaterSystemProfile): string[] {
  const l = p.leadSummary;
  if (!l) return [`I don't have a lead and copper result for ${city} in EPA's records.`];
  const last = p.lead[p.lead.length - 1];
  const above = l.latestPpb > 15;
  const out = [
    `**${poss(city)} latest lead result is ${fmtN(l.latestPpb)} ppb**, ${above ? 'above' : 'under'} the federal 15 ppb action level (${period(last.start, last.end)}).`,
  ];
  out.push(
    l.periodsAboveActionLevel > 0
      ? `It went over in ${l.periodsAboveActionLevel} of ${l.periods} reporting periods, peaking at ${fmtN(l.maxPpb)} ppb in ${niceMonth(l.maxPeriodEnd)}.`
      : `It has stayed under in all ${l.periods} reporting periods on record.`,
  );
  return out;
}

function answerPfas(city: string, p: WaterSystemProfile): string[] {
  const pf = { ...p.pfas, window: windowWords(p.pfas.window) };
  if (!pf.tested) return [`${city} has no PFAS results in EPA's UCMR 5 national survey yet.`];
  if (pf.aboveMcl.length > 0) {
    const top = [...pf.aboveMcl].sort((a, b) => b.maxNgL / b.mclNgL - a.maxNgL / a.mclNgL)[0];
    return [
      `**Yes. ${city} reported ${list(pf.aboveMcl.map((a) => a.name))} above the 2024 federal PFAS limits** in EPA testing (${pf.window}).`,
      `The highest was ${top.name} at ${fmtN(top.maxNgL)} ng/L, against a ${fmtN(top.mclNgL)} ng/L limit.`,
    ];
  }
  if (pf.compoundsDetected.length > 0) {
    return [`**${city} had low-level PFAS detections, none above a federal limit**, in EPA testing (${pf.window}).`];
  }
  return [`**No PFAS were detected in ${poss(city)} water** across ${pf.samples} EPA sampling rounds (${pf.window}).`];
}

function windowWords(w: string | null): string {
  const m = (w ?? '').match(/(\d{4})-\d{2}-\d{2}\s+to\s+(\d{4})-\d{2}-\d{2}/);
  if (!m) return w ?? '';
  return m[1] === m[2] ? m[1] : `${m[1]}-${m[2]}`;
}

function answerAnalytes(city: string, p: WaterSystemProfile, t: Topic): string[] {
  const rows = labFor(p, t.analytes).sort((a, b) => b.samples - a.samples);
  if (t.key === 'coliform') {
    const related = violationsAbout(p, /coliform|e\.? ?coli|microbial|surface water treatment|turbidity/i);
    if (related.length === 0) return [`**No bacteria violations are on record for ${city}** in EPA's drinking water database.`];
    const v = related[0];
    return [
      `**${city} has ${related.length} bacteria or treatment record${related.length === 1 ? '' : 's'} on file.**`,
      `The most recent began ${niceDate(v.begin)}${v.returnedToCompliance ? ` and was back in compliance ${niceDate(v.returnedToCompliance)}` : ''}.`,
    ];
  }
  const head = rows.find((a) => a.detects > 0) ?? rows[0];
  if (!head) {
    const treat =
      t.key === 'fluoride'
        ? p.treatment.filter((x) => /fluorid/i.test(x.process))
        : t.key === 'chlorine'
          ? p.treatment.filter((x) => /chlor|hypochlor|ozon|ultraviolet|uv/i.test(x.process))
          : [];
    return treat.length > 0
      ? [`I don't have ${t.name.toLowerCase()} lab results for ${city}, but the utility lists ${list(treat.map((x) => x.process.toLowerCase()))} as a treatment step.`]
      : [`I don't have ${t.name.toLowerCase()} results for ${city} in EPA's national monitoring files.`];
  }
  const years = head.firstDate && head.lastDate ? `${head.firstDate.slice(0, 4)}-${head.lastDate.slice(0, 4)}` : '';
  if (head.detects === 0) return [`**${t.name} was not detected in ${poss(city)} ${fmtN(head.samples)} samples**${years ? ` (${years})` : ''}.`];
  let unit = head.benchmark?.unit ?? head.unit ?? '';
  let max = head.maxInBenchmarkUnit ?? head.maxValue ?? 0;
  let med = head.medianInBenchmarkUnit ?? head.medianDetect ?? 0;
  let limV = head.benchmark?.value ?? 0;
  if (unit === 'ug/L' && limV >= 1000) {
    unit = 'mg/L';
    max /= 1000;
    med /= 1000;
    limV /= 1000;
  }
  const above = rows.some((a) => a.status === 'max_above_benchmark');
  const lim = head.benchmark ? `${fmtN(limV)} ${unit}` : null;
  const first = above
    ? `**Some ${poss(city)} ${head.label.toLowerCase()} samples went above the ${lim} federal limit**, though the typical level was ${fmtN(med)} ${unit}.`
    : lim
      ? `**${head.label} in ${poss(city)} water typically measured ${fmtN(med)} ${unit}**, under the ${lim} federal limit.`
      : `**${head.label} turned up in ${fmtN(head.detects)} of ${fmtN(head.samples)} ${city} samples**, typically ${fmtN(med)} ${unit}; it has no federal limit.`;
  return [first, `The highest of ${fmtN(head.samples)} samples was ${fmtN(max)} ${unit}${years ? ` (${years})` : ''}.`];
}

function answerSource(city: string, s: WaterOriginSchematic, p: WaterSystemProfile): string[] {
  const basins = s.primaryBasins;
  const kind = sourceWords(p);
  const serves = p.population ? `, serving about ${people(p.population)}` : '';
  if (basins.length > 0) {
    return [
      `**${poss(city)} water comes from ${list(basins.map((b) => (/(river|lake|reservoir|aquifer|basin|valley|bay|creek|watershed)/i.test(b) ? b : `the ${b} basin`)))}.**`,
      `${p.name} delivers it${serves}.`,
    ];
  }
  const buys = [...p.purchasedFrom].sort((a, b) => (b.population ?? 0) - (a.population ?? 0));
  if (buys.length > 0) return [`**${city} buys its water from ${list(buys.map((b) => b.name), 2)}**${serves}.`];
  const fc = p.facilityCounts;
  const from = fc['Intake'] ? `${fc['Intake']} surface intake${fc['Intake'] === 1 ? '' : 's'}` : fc['Well'] ? `${fc['Well']} wells` : '';
  return [`**${city} runs on ${kind || 'its own sources'}${from ? `, drawn through ${from}` : ''}**${serves}.`];
}

function answerPathway(city: string, s: WaterOriginSchematic, p: WaterSystemProfile): string[] {
  const src = s.primaryBasins.length > 0 ? list(s.primaryBasins, 2) : sourceWords(p) || 'local sources';
  const plants = p.plants.length || (p.facilityCounts['Treatment Plant'] ?? 0);
  const steps = [
    `**Source**: ${src}`,
    p.purchasedFrom.length > 0 ? `**Wholesale**: ${list(p.purchasedFrom.map((b) => b.name), 2)}` : '',
    plants > 0 ? `**Treatment**: ${plants} plant${plants === 1 ? '' : 's'}` : '',
    `**Your tap**${p.connections ? `: one of ${fmtN(p.connections)} connections` : ''}`,
  ].filter(Boolean);
  return [`${poss(city)} water takes ${steps.length} steps to reach you.`, '', ...steps.map((x, i) => `${i + 1}. ${x}`)];
}

function answerCompliance(city: string, p: WaterSystemProfile): string[] {
  const v = p.violationSummary;
  if (v.last5Years === 0) return [`**${city} has no drinking water violations in the last 5 years.**`];
  const out = [
    `**${city} has ${v.last5Years} violation${v.last5Years === 1 ? '' : 's'} in the last 5 years, ${v.healthBased5Years === 0 ? 'none' : v.healthBased5Years} health-based.**`,
  ];
  const hb = p.violations.find((x) => x.healthBased);
  if (v.healthBased5Years > 0 && hb) {
    out.push(`The latest: ${plainViolation(hb).title.toLowerCase()}, starting ${niceDate(hb.begin)}${hb.returnedToCompliance ? `, fixed ${niceDate(hb.returnedToCompliance)}` : v.unresolved > 0 ? ', still open' : ''}.`);
  } else if (v.unresolved > 0) out.push(`${v.unresolved} ${v.unresolved === 1 ? 'is' : 'are'} still open.`);
  else if (v.healthBased5Years === 0) out.push('All were monitoring or reporting lapses, not water above a limit.');
  return out;
}

function answerOverview(city: string, p: WaterSystemProfile, safety: boolean): string[] {
  const flags = p.findings.filter((f) => f.level === 'alert');
  const notes = p.findings.filter((f) => f.level === 'watch');
  const pre = safety ? "No record can vouch for your tap today, but " : '';
  const cap = (x: string) => (pre ? x : x.charAt(0).toUpperCase() + x.slice(1));
  if (flags.length === 0 && notes.length === 0) return [`${pre}**${cap(`nothing in EPA's records for ${city} is above a federal limit.`)}**`];
  if (flags.length === 0) {
    return [`${pre}**${cap(`nothing in ${poss(city)} EPA records is above a federal limit**`)}; ${notes.length === 1 ? 'one thing is' : `${notes.length} things are`} worth a look.`];
  }
  return [`${pre}**${cap(`${poss(city)} records flag ${flags.length === 1 ? 'one thing' : `${flags.length} things`}.`)}**`, flags[0].text];
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
      if (i > 0) lines.push('');
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
    lines.push(...answerOverview(city, p, safety));
  }
  return {
    markdown: joinAnswer(lines).replace(/\n{3,}/g, '\n\n').trim(),
    followUps: followUps(city, p, topics.length > 0 ? 'quality' : focus, asked),
    focus: topics.length > 0 ? 'quality' : focus,
    askedParameters,
  };
}

/** Sentences join into one paragraph; a numbered list keeps its lines. */
function joinAnswer(lines: string[]): string {
  const out: string[] = [];
  for (const l of lines) {
    const prev = out[out.length - 1];
    if (prev !== undefined && l && prev && !/^\d+\. /.test(l) && !/^\d+\. /.test(prev)) out[out.length - 1] = `${prev} ${l}`;
    else out.push(l);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
