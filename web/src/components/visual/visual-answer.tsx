import { detectTopics } from '../../../../lib/profile-answer';
import type { LabAnalyteSummary, WaterSystemProfile } from '../../../../types/water-intelligence';
import type { TapAnswer } from '../../api';
import { LabMeter } from './lab-meter';
import { LeadDrops } from './lead-drops';
import { PfasRings } from './pfas-rings';
import { RecordSignals } from './record-signals';
import { RiskForecast } from './risk-forecast';
import { ServiceMap } from './service-map';
import { SourceJourney } from './source-journey';
import { ViolationRiver } from './violation-river';

export type VisualKind = 'risk' | 'lead' | 'pfas' | 'lab' | 'bacteria' | 'violations' | 'journey' | 'map' | 'signals';

const LAB_ANALYTES: Record<string, string[]> = {
  copper: ['COPPER', 'COPPER, FREE'],
  nitrate: ['NITRATE', 'HYBRID NITRATE', 'NITRITE', 'NITRATE-NITRITE'],
  arsenic: ['ARSENIC'],
  dbp: ['TTHM', 'TOTAL TRIHALOMETHANES (TTHM)', 'TOTAL HALOACETIC ACIDS (HAA5)', 'HALOACETIC ACIDS (HAA5)', 'CHLOROFORM', 'BROMODICHLOROMETHANE'],
  fluoride: ['FLUORIDE'],
  chlorine: ['CHLORINE', 'CHLORAMINE', 'FREE RESIDUAL CHLORINE', 'TOTAL CHLORINE', 'RESIDUAL CHLORINE', 'CHLORINE DIOXIDE'],
  radio: ['COMBINED RADIUM (-226 & -228)', 'COMBINED URANIUM', 'GROSS ALPHA, EXCL. RADON & U', 'GROSS BETA PARTICLE ACTIVITY'],
  lithium: ['LITHIUM'],
  solvents: ['TRICHLOROETHYLENE', 'TETRACHLOROETHYLENE', 'BENZENE', 'VINYL CHLORIDE', 'CARBON TETRACHLORIDE', '1,2-DICHLOROETHANE'],
  pesticides: ['ATRAZINE', 'GLYPHOSATE', 'SIMAZINE', 'ALACHLOR', '2,4-D'],
};

export function labRows(p: WaterSystemProfile, key: string): LabAnalyteSummary[] {
  const want = new Set(LAB_ANALYTES[key] ?? []);
  return p.lab.filter((a) => want.has(a.name.toUpperCase())).sort((a, b) => b.detects - a.detects || b.samples - a.samples);
}

/** One question, one figure: pick the drawing that answers what was asked. */
export function visualKind(answer: TapAnswer): { kind: VisualKind; topic?: { key: string; name: string } } {
  const p = answer.profile;
  const q = answer.question ?? '';
  const t = detectTopics(q)[0];
  if (t && p) {
    if (t.key === 'risk') return p.risk ? { kind: 'risk' } : { kind: 'signals' };
    if (t.key === 'lead') return p.leadSummary ? { kind: 'lead' } : { kind: 'signals' };
    if (t.key === 'pfas') return { kind: 'pfas' };
    if (t.key === 'coliform') return { kind: 'bacteria', topic: t };
    if (labRows(p, t.key).length > 0) return { kind: 'lab', topic: t };
    return { kind: 'signals' };
  }
  if (answer.focus === 'compliance') return { kind: 'violations' };
  if (answer.focus === 'pathway') return { kind: 'journey' };
  if (answer.focus === 'source') return p?.serviceArea ? { kind: 'map' } : { kind: 'journey' };
  return { kind: 'signals' };
}

const BACTERIA = /coliform|e\.? ?coli|microbial|surface water treatment|turbidity|groundwater rule/i;

export function VisualAnswer({ answer, onAsk }: { answer: TapAnswer; onAsk?: (q: string) => void }) {
  const p = answer.profile;
  if (!p) return null;
  const url = p.provenance.echoReportUrl;
  const city = answer.placeName || p.name;
  const { kind, topic } = visualKind(answer);
  switch (kind) {
    case 'risk':
      return <RiskForecast p={p} sourceUrl={url} city={city} />;
    case 'lead':
      return <LeadDrops p={p} sourceUrl={url} />;
    case 'pfas':
      return <PfasRings p={p} sourceUrl={url} />;
    case 'lab':
      return <LabMeter name={topic!.name} rows={labRows(p, topic!.key)} sourceUrl={url} />;
    case 'bacteria':
      return <ViolationRiver p={p} sourceUrl={url} topicName="Bacteria" filter={(v) => BACTERIA.test(`${v.contaminant ?? ''} ${v.rule ?? ''} ${v.name ?? ''}`)} />;
    case 'violations':
      return <ViolationRiver p={p} sourceUrl={url} />;
    case 'journey':
      return <SourceJourney answer={answer} p={p} sourceUrl={url} />;
    case 'map':
      return <ServiceMap answer={answer} p={p} />;
    default:
      if (/\b(safe|drinkable|potable|healthy|quality|ok to drink|okay to drink|clean)\b/i.test(answer.question ?? '') || !p.serviceArea) {
        return <RecordSignals p={p} city={city} sourceUrl={url} onAsk={onAsk} />;
      }
      return (
        <>
          <ServiceMap answer={answer} p={p} compact />
          <RecordSignals p={p} city={city} sourceUrl={url} onAsk={onAsk} />
        </>
      );
  }
}
