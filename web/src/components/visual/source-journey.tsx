import { motion, useReducedMotion } from 'motion/react';
import { Building2Icon, DropletsIcon, FactoryIcon, HomeIcon, LayersIcon, MountainSnowIcon, WarehouseIcon } from 'lucide-react';
import { cleanProcesses } from '../../../../lib/answer-composer';
import type { WaterSystemProfile } from '../../../../types/water-intelligence';
import type { TapAnswer } from '../../api';
import { num, titleCase } from '../report/format';
import { VisualFrame, useOnScreen } from './frame';

interface Step {
  key: string;
  icon: typeof HomeIcon;
  title: string;
  detail: string;
}

function steps(answer: TapAnswer, p: WaterSystemProfile): Step[] {
  const fc = p.facilityCounts;
  const ground = /ground/i.test(p.primarySource ?? '');
  const srcCount = [fc['Intake'] ? `${fc['Intake']} intake${fc['Intake'] === 1 ? '' : 's'}` : '', fc['Well'] ? `${fc['Well']} well${fc['Well'] === 1 ? '' : 's'}` : '', fc['Reservoir'] ? `${fc['Reservoir']} reservoir${fc['Reservoir'] === 1 ? '' : 's'}` : '']
    .filter(Boolean)
    .join(' · ');
  const out: Step[] = [
    {
      key: 'source',
      icon: answer.basins.length > 0 || !ground ? MountainSnowIcon : LayersIcon,
      title: answer.basins.length > 0 ? answer.basins.slice(0, 3).join(', ') : ground ? 'Groundwater' : titleCase(p.primarySource ?? 'Local sources'),
      detail: srcCount || (ground ? 'Pumped from aquifers' : 'Drawn from rivers and lakes'),
    },
  ];
  if (answer.conveyances.length > 0) {
    out.push({ key: 'conv', icon: DropletsIcon, title: answer.conveyances.slice(0, 2).map((c) => c.name).join(', '), detail: 'Aqueducts and tunnels' });
  }
  if (p.purchasedFrom.length > 0) {
    const top = [...p.purchasedFrom].sort((a, b) => (b.population ?? 0) - (a.population ?? 0));
    out.push({
      key: 'buy',
      icon: Building2Icon,
      title: titleCase(top[0].name),
      detail: top.length > 1 ? `Wholesale supplier, plus ${top.length - 1} more` : 'Wholesale supplier',
    });
  }
  const plants = p.plants.length || (fc['Treatment Plant'] ?? 0);
  const procs = cleanProcesses(p.treatment.map((t) => t.process)).slice(0, 3);
  if (plants > 0 || procs.length > 0) {
    out.push({
      key: 'treat',
      icon: FactoryIcon,
      title: plants > 0 ? `${plants} treatment plant${plants === 1 ? '' : 's'}` : 'Treatment',
      detail: procs.length > 0 ? procs.join(' · ') : 'Filtered and disinfected',
    });
  }
  if (fc['Storage'] || fc['Pump Facility']) {
    out.push({
      key: 'store',
      icon: WarehouseIcon,
      title: [fc['Storage'] ? `${fc['Storage']} storage tank${fc['Storage'] === 1 ? '' : 's'}` : '', fc['Pump Facility'] ? `${fc['Pump Facility']} pump station${fc['Pump Facility'] === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · '),
      detail: 'Pressure and reserve across the city',
    });
  }
  out.push({
    key: 'tap',
    icon: HomeIcon,
    title: 'Your tap',
    detail: p.connections ? `One of ${num(p.connections)} service connections` : 'Service line and home plumbing',
  });
  return out;
}

/**
 * Source to tap as one pipe running down the page. Water keeps moving
 * through it, and each stop lights up as the drop reaches it.
 */
export function SourceJourney({ answer, p, sourceUrl }: { answer: TapAnswer; p: WaterSystemProfile; sourceUrl: string }) {
  const [ref, seen] = useOnScreen<HTMLOListElement>();
  const reduce = useReducedMotion();
  const s = steps(answer, p);
  return (
    <VisualFrame
      eyebrow={`From source to tap · ${p.name}`}
      headline={`${s.length} stops to your glass`}
      source="EPA SDWIS facilities and treatment · positions are schematic"
      sourceUrl={sourceUrl}
    >
      <ol ref={ref} className="relative pb-1 pl-1" aria-label="Water route">
        {/* the pipe */}
        <div className="absolute bottom-7 left-[25px] top-7 w-[6px] overflow-hidden rounded-full bg-[var(--muted)]" aria-hidden="true">
          <motion.div
            className="journey-flow absolute inset-x-0 top-0 rounded-full"
            initial={reduce ? false : { height: '0%' }}
            animate={seen ? { height: '100%' } : undefined}
            transition={{ duration: 0.45 * s.length, ease: 'linear' }}
          />
          {!reduce &&
            seen &&
            [0, 1, 2].map((k) => (
              <span key={k} className="journey-drop absolute left-1/2 size-[6px] -translate-x-1/2 rounded-full bg-white/90" style={{ animationDelay: `${0.45 * s.length + k * 0.9}s` }} />
            ))}
        </div>
        {s.map((st, i) => (
          <motion.li
            key={st.key}
            className="relative flex items-start gap-4 py-3"
            initial={reduce ? false : { opacity: 0.25 }}
            animate={seen ? { opacity: 1 } : undefined}
            transition={{ delay: 0.45 * i, duration: 0.3 }}
          >
            <motion.span
              className="relative z-10 flex size-[50px] shrink-0 items-center justify-center rounded-full border bg-card"
              initial={reduce ? false : { scale: 0.85, borderColor: 'var(--border)' }}
              animate={seen ? { scale: 1, borderColor: 'color-mix(in oklab, var(--link) 45%, transparent)' } : undefined}
              transition={{ delay: 0.45 * i, type: 'spring', stiffness: 320, damping: 18 }}
            >
              <st.icon className="size-[22px] text-[var(--link)]" strokeWidth={1.6} />
            </motion.span>
            <span className="min-w-0 pt-1.5">
              <span className="block text-[16px] font-semibold leading-snug">{st.title}</span>
              <span className="block text-[14px] leading-snug text-muted-foreground">{st.detail}</span>
            </span>
          </motion.li>
        ))}
      </ol>
    </VisualFrame>
  );
}
