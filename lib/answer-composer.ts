// lib/answer-composer.ts — question-focused conversational answer.
// The old template answered every water question with the same paragraph
// ("Water for public water system X ... cards below"), so the chat felt
// rote: asking about lead listed coliform and turbidity instead. This module
// reads the question, finds the Resolver facts that actually answer it, and
// writes a short markdown answer (America.gov style: direct first sentence,
// a few scannable bullets, honest gaps, then next-step follow-ups).
// Deterministic, no network, Resolver facts only. The LLM narrator, when
// configured, can replace `markdown`; follow-ups always stay deterministic.
import type { QualityMetricRecord, WaterOriginSchematic } from '../types/water-intelligence.js';
import { detectIntent, type AnswerIntent } from './narrator.js';
import { getDirectorySystem } from './systems.js';

export interface ComposedAnswer {
  markdown: string;
  followUps: string[];
  focus: AnswerIntent;
  /** Parameters the user named that we matched (or missed) in the records. */
  askedParameters: Array<{ name: string; found: boolean }>;
}

/** Plain-language parameter names → substrings found in record parameter labels. */
const PARAMETERS: Array<{ name: string; words: string[]; match: string[] }> = [
  { name: 'Lead', words: ['lead', 'pb'], match: ['lead'] },
  { name: 'Copper', words: ['copper'], match: ['copper'] },
  { name: 'PFAS', words: ['pfas', 'pfoa', 'pfos', 'forever chemical'], match: ['pf', 'perfluoro', 'genx', 'hfpo'] },
  { name: 'Fluoride', words: ['fluoride', 'fluoridation', 'fluorid'], match: ['fluor'] },
  { name: 'Chlorine', words: ['chlorine', 'chlorinated', 'disinfectant'], match: ['chlorine', 'disinfectant'] },
  { name: 'Nitrate', words: ['nitrate', 'nitrite'], match: ['nitrat', 'nitrit'] },
  { name: 'Arsenic', words: ['arsenic'], match: ['arsenic'] },
  { name: 'Lithium', words: ['lithium'], match: ['lithium'] },
  { name: 'Coliform bacteria', words: ['coliform', 'bacteria', 'e. coli', 'ecoli', 'e coli'], match: ['coliform', 'coli'] },
  { name: 'Turbidity', words: ['turbidity', 'cloudy', 'murky'], match: ['turbidity'] },
  { name: 'Trihalomethanes', words: ['tthm', 'trihalomethane', 'byproduct', 'by-product', 'haa5'], match: ['trihalo', 'tthm', 'haloacetic', 'haa5'] },
  { name: 'Radium', words: ['radium', 'uranium', 'radioactive'], match: ['radium', 'uranium', 'radio'] },
  { name: 'Manganese', words: ['manganese'], match: ['manganese'] },
];

function hasWord(q: string, w: string): boolean {
  // Word-ish boundary so "pb" does not fire inside other words.
  return new RegExp(`(^|[^a-z])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i').test(q);
}

export function detectParameters(question: string): Array<(typeof PARAMETERS)[number]> {
  const q = (question ?? '').toLowerCase();
  // "lead" as a verb ("lead to", "leads", "leading") is not the metal.
  return PARAMETERS.filter((p) =>
    p.words.some((w) => {
      if (!hasWord(q, w)) return false;
      if (w === 'lead' && /\blead(s|ing)?\s+(to|me|you|us)\b/.test(q)) return false;
      return true;
    }),
  );
}

function allMetrics(s: WaterOriginSchematic): QualityMetricRecord[] {
  return [
    ...s.latestReportedMetrics,
    ...(s.lcrMetrics ?? []),
    ...(s.distributionMetrics ?? []),
    ...(s.syrMetrics ?? []),
    ...(s.ucmrMetrics ?? []),
  ];
}

const STATUS_WORDS: Record<QualityMetricRecord['complianceStatus'], string> = {
  within_standard: 'within the standard',
  exceeds_standard: 'above the standard',
  monitoring_violation: 'flagged for a monitoring issue',
};

function metricBullet(m: QualityMetricRecord): string {
  return (
    `- **${m.parameter}**: ${m.reportedValue} against a ${m.regulatoryThreshold} standard, ` +
    `${STATUS_WORDS[m.complianceStatus]} (tested ${m.testDate}, ${m.provenance.reportPeriod} report)`
  );
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

function basinPhrase(basins: string[]): string {
  if (basins.length === 0) return '';
  if (basins.length === 1) return `the ${basins[0]} basin`;
  return `the ${basins.slice(0, -1).join(', ')} and ${basins[basins.length - 1]} basins`;
}

/** Friendly place name: the directory city ("Los Angeles") over the legal system name. */
export function shortName(s: WaterOriginSchematic): string {
  const dir = getDirectorySystem(s.pwsid);
  if (dir?.city) return dir.city;
  return s.systemName.replace(/\s+system$/i, '');
}

/** "GASEOUS CHLORINATION, PRE" + "..., POST" -> "Gaseous chlorination"; deduped, plain words. */
export function cleanProcesses(processes: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of processes) {
    let p = raw.replace(/,\s*(PRE|POST)$/i, '').trim();
    const inhibitor = p.match(/^INHIBITOR,\s*(.+)$/i);
    if (inhibitor) p = `${inhibitor[1]} corrosion control`;
    const act = p.match(/^(.+),\s*(POWDERED|GRANULAR)$/i);
    if (act) p = `${act[2]} ${act[1]}`;
    p = p.toLowerCase().replace(/\bph\b/, 'pH');
    if (!p.startsWith('pH')) p = p.charAt(0).toUpperCase() + p.slice(1);
    if (!seen.has(p)) {
      seen.add(p);
      out.push(p);
    }
  }
  return out;
}

function complianceLine(s: WaterOriginSchematic): string {
  const rc = s.regulatoryCompliance;
  const { startDate, endDate } = rc.queryWindow;
  if (rc.snapshotPending) {
    return `Compliance records for ${startDate} to ${endDate} are not curated here yet; the EPA ECHO profile has the live list.`;
  }
  if (rc.totalViolationsFound === 0) {
    return `EPA records show no violations found from ${startDate} to ${endDate}.`;
  }
  const health = rc.records.filter((r) => r.violationType === 'health_based').length;
  const monitoring = rc.records.filter((r) => r.violationType === 'monitoring_and_reporting').length;
  const parts: string[] = [];
  if (health > 0) parts.push(`${health} health-based`);
  if (monitoring > 0) parts.push(`${monitoring} monitoring or reporting`);
  const breakdown = parts.length > 0 ? ` (${parts.join(', ')})` : '';
  return `EPA records list ${rc.totalViolationsFound} violations${breakdown} from ${startDate} to ${endDate}.`;
}

export function composeAnswer(s: WaterOriginSchematic, question: string): ComposedAnswer {
  const focus = detectIntent(question);
  const asked = detectParameters(question);
  const metrics = allMetrics(s);
  const name = shortName(s);
  const lines: string[] = [];
  const askedParameters: ComposedAnswer['askedParameters'] = [];

  // 1. Named parameters win: answer exactly what was asked.
  if (asked.length > 0) {
    const found: QualityMetricRecord[] = [];
    const missing: string[] = [];
    for (const p of asked) {
      const hits = metrics.filter((m) => p.match.some((x) => m.parameter.toLowerCase().includes(x)));
      askedParameters.push({ name: p.name, found: hits.length > 0 });
      if (hits.length > 0) found.push(...hits);
      else missing.push(p.name);
    }
    // Treatment can still answer fluoride/chlorine even without a lab value.
    const processes = s.treatment?.processes ?? [];
    if (found.length > 0) {
      lines.push(
        found.length === 1
          ? `Here is the latest reported ${found[0].parameter.toLowerCase()} result for ${name}.`
          : `Here are the latest reported results for ${name}.`,
      );
      lines.push('', ...found.slice(0, 6).map(metricBullet));
    }
    if (missing.length > 0) {
      const list = missing.join(' or ').toLowerCase();
      const treatHits = missing.flatMap((m) => {
        const key = m === 'Fluoride' ? 'FLUORIDATION' : m === 'Chlorine' ? 'CHLORINATION' : null;
        return key ? processes.filter((p) => p.includes(key)) : [];
      });
      lines.push(
        '',
        `I don't have a ${list} test result for ${name} in these records` +
          (metrics.length > 0
            ? `. The reported lab values here cover ${[...new Set(metrics.map((m) => m.parameter))].slice(0, 4).join(', ')}.`
            : '.'),
      );
      if (treatHits.length > 0) {
        lines.push(
          `The utility does report ${cleanProcesses(treatHits).join(' and ').toLowerCase()} as a treatment step.`,
        );
      }
      if (missing.some((m) => m === 'Lead' || m === 'Copper')) {
        lines.push(
          'Lead usually comes from service lines and home plumbing, not the source. The utility\'s annual water quality report and the EPA ECHO profile list lead and copper sampling.',
        );
      }
    }
    lines.push('', complianceLine(s));
  } else {
    switch (focus) {
      case 'source': {
        const b = basinPhrase(s.primaryBasins);
        lines.push(
          b
            ? `${name} draws its water from ${b}${s.sourceKind === 'surface' ? ', a surface water supply' : s.sourceKind === 'groundwater' ? ', a groundwater supply' : ''}.`
            : `I have the system on record (PWSID ${s.pwsid}), but its source basins are not curated yet.`,
        );
        const fac = s.sourceFacilities?.facilities ?? [];
        if (fac.length > 0) {
          lines.push('', 'Reported source facilities:', ...fac.slice(0, 5).map((f) => `- ${titleCase(f.facilityName)} (${f.facilityType.replace('_', ' ')}${f.waterType && f.waterType !== 'unknown' ? `, ${f.waterType} water` : ''})`));
        }
        const chain = s.sourceFacilities?.sellerChain ?? [];
        if (chain.length > 0) {
          lines.push('', `It also buys water from ${chain.map((c) => titleCase(c.systemName)).join(', ')}.`);
        }
        if (s.waterUse) {
          lines.push('', `County-level estimates put supply at about ${s.waterUse.surfacePct}% surface and ${s.waterUse.groundPct}% groundwater (${s.waterUse.referencePeriod}, modeled).`);
        }
        break;
      }
      case 'pathway': {
        const b = basinPhrase(s.primaryBasins);
        lines.push(`Here is the route ${name} water takes to the tap, step by step.`);
        const steps: string[] = [];
        if (b) steps.push(`**Source**: ${b}`);
        if ((s.conveyances ?? []).length > 0) steps.push(`**Conveyance**: ${(s.conveyances ?? []).map((c) => c.name).join(', ')}`);
        const processes = s.treatment?.processes ?? [];
        if (processes.length > 0) steps.push(`**Treatment**: ${cleanProcesses(processes).slice(0, 6).join(', ')}`);
        steps.push('**Distribution**: city mains and service lines to your tap');
        lines.push('', ...steps.map((x, i) => `${i + 1}. ${x}`));
        if (s.treatment?.rigor) lines.push('', `Treatment profile: ${s.treatment.rigor.toLowerCase()}.`);
        lines.push('', 'The map shows this route as a schematic, not exact pipe alignments.');
        break;
      }
      case 'compliance': {
        lines.push(complianceLine(s));
        const recent = [...s.regulatoryCompliance.records]
          .sort((a, b) => (a.beginDate < b.beginDate ? 1 : -1))
          .slice(0, 4);
        if (recent.length > 0) {
          lines.push(
            '',
            'Most recent records:',
            ...recent.map(
              (r) =>
                `- ${r.beginDate}: ${r.violationType.replace(/_/g, ' ')}${r.contaminantName ? `, ${r.contaminantName}` : ''}${r.complianceAchieved ? ' (returned to compliance)' : ''}`,
            ),
          );
        }
        lines.push('', 'A violation count describes records, not today\'s water. The ECHO profile has each filing.');
        break;
      }
      case 'quality': {
        if (metrics.length === 0) {
          lines.push(`I don't have curated lab results for ${name} yet.`, '', complianceLine(s));
        } else {
          lines.push(`Here is what recent reports for ${name} show.`, '', ...metrics.slice(0, 6).map(metricBullet), '', complianceLine(s));
        }
        break;
      }
      default: {
        const b = basinPhrase(s.primaryBasins);
        lines.push(
          b ? `${name} gets its water from ${b}.` : `${name} is on record as PWSID ${s.pwsid}.`,
        );
        if (metrics.length > 0) {
          lines.push('', 'Latest reported results:', ...metrics.slice(0, 3).map(metricBullet));
        }
        lines.push('', complianceLine(s));
      }
    }
  }

  return { markdown: lines.join('\n').replace(/\n{3,}/g, '\n\n').trim(), followUps: followUpsFor(s, focus, askedParameters), focus, askedParameters };
}

/** Context-aware next questions; they always name the city so they stand alone. */
export function followUpsFor(
  s: WaterOriginSchematic,
  focus: AnswerIntent,
  asked: ComposedAnswer['askedParameters'] = [],
): string[] {
  const city = shortName(s);
  const out: string[] = [];
  const askedNames = new Set(asked.map((a) => a.name));
  if (focus !== 'source' && s.primaryBasins.length > 0) out.push(`Where does ${city} water come from?`);
  if (!askedNames.has('Lead')) out.push(`Is there lead in ${city} water?`);
  if (focus !== 'pathway') out.push(`How does ${city} water reach my tap?`);
  if (focus !== 'compliance') out.push(`Any violations for ${city} in the last 5 years?`);
  if (!askedNames.has('PFAS') && out.length < 4) out.push(`Has ${city} reported PFAS?`);
  return out.slice(0, 3);
}
