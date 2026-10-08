import type { TapAnswer } from '../../api';
import type { TraceStep } from '../kit';

/** Steps shown while the answer is on its way (time-paced, honest about order). */
export const LIVE_STEPS: string[] = [
  'Reading your question',
  'Finding the public water system',
  'Pulling EPA records',
  'Checking the numbers',
  'Writing a short answer',
];
export const LIVE_DELAYS = [700, 1500, 2400, 2800];

/**
 * What Taproot actually read for this answer, from the answer itself.
 * Process only: no findings or levels, so the trace never tells the
 * user something they did not ask about.
 */
export function traceFor(answer: TapAnswer): TraceStep[] {
  if (answer.scope === 'redirect') return [];
  const p = answer.profile;
  const steps: TraceStep[] = [];
  if (answer.pwsid === 'UNKNOWN') {
    steps.push({ label: 'Looked for a public water system', detail: 'none matched' });
  } else {
    steps.push({ label: `Found ${p?.name ?? answer.systemName}`, detail: answer.pwsid, href: answer.echoUrl || undefined });
  }
  if (p) {
    steps.push({ label: 'Read federal SDWIS records', detail: p.provenance.sdwisQuarter ?? 'latest', href: p.provenance.sdwisUrl });
    if (p.lead.length > 0) steps.push({ label: 'Checked lead and copper tests', detail: `${p.lead.length} periods` });
    if (p.pfas.tested) steps.push({ label: 'Checked PFAS monitoring (UCMR 5)', detail: `${p.pfas.samples} samples`, href: p.provenance.ucmr5Url });
    if (p.lab.length > 0) steps.push({ label: 'Read lab results (Six-Year Review)', detail: `${p.lab.length} contaminants`, href: p.provenance.syr4Url });
    steps.push({ label: 'Reviewed the violation history', detail: `${p.violationSummary.since2016} since 2016` });
    if (p.serviceArea) steps.push({ label: 'Mapped the service area', detail: p.serviceArea.method === 'reported' ? 'reported' : 'EPA model', href: p.serviceArea.sourceUrl });
  } else if (answer.pwsid !== 'UNKNOWN') {
    if (answer.metrics.length) steps.push({ label: 'Read water quality results', detail: `${answer.metrics.length} results` });
    steps.push({ label: 'Checked EPA compliance', href: answer.echoUrl || undefined });
  }
  steps.push({ label: 'Wrote the answer', detail: answer.answerAuthor === 'llm' ? (answer.passedAudit ? 'AI, fact-checked' : 'AI') : 'from records' });
  return steps;
}
