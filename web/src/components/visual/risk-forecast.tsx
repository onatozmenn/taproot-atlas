import type { WaterSystemProfile } from '../../../../types/water-intelligence';
import { RISK_BINS, driverText, riskBin, riskPos } from '../../../../lib/risk-text';
import { VisualFrame } from './frame';
import { useBoxWidth } from '../kit/motion';

function pctLabel(p: number): string {
  const x = p * 100;
  if (x < 1) return '<1';
  if (x > 95) return '>95';
  return x < 10 ? String(Math.round(x * 10) / 10) : String(Math.round(x));
}

/**
 * The forecast as a place in the crowd: every scored U.S. system is a grey
 * bar of the distribution (log scale), this system's bar is ink and a
 * register-blue rule says "you are here". Drivers list what moved it.
 */
export function RiskForecast({ p, sourceUrl, city }: { p: WaterSystemProfile; sourceUrl: string; city?: string }) {
  const r = p.risk;
  const [boxRef, W] = useBoxWidth<HTMLDivElement>(640, 220);
  if (!r) return null;
  const dist = r.distribution ?? [];
  const total = dist.reduce((a, b) => a + b, 0);
  const peak = Math.max(1, ...dist);
  const lab = pctLabel(r.probability);
  const here = riskBin(r.probability);
  const lower = Math.round((1 - r.percentile) * 100);
  const higher = Math.round(r.percentile * 100);
  const rank = r.percentile >= 0.5 ? `Higher than ${higher}% of ${total ? total.toLocaleString('en-US') : 'U.S.'} systems.` : `Lower than ${lower}% of ${total ? total.toLocaleString('en-US') : 'U.S.'} systems.`;
  const narrow = W < 460;
  const H = narrow ? 176 : 186;
  const top = 36;
  const bot = H - 34;
  const bw = W / RISK_BINS;
  const fx = riskPos(r.probability) * W;
  const baseX = riskPos(r.baseRate) * W;
  const right = fx < W * 0.6;
  const name = (city ?? p.name).toUpperCase();
  const tierWord = r.tier === 'high' ? 'High' : r.tier === 'elevated' ? 'Elevated' : r.tier === 'low' ? 'Low' : 'Typical';

  return (
    <VisualFrame
      fig={8}
      eyebrow={`Forecast · ${tierWord} risk`}
      record={p.pwsid}
      hero={lab}
      unit="%"
      headline={
        `${lab.startsWith('<') ? 'Less than 1%' : lab.startsWith('>') ? 'More than 95%' : `${lab}%`} chance of a new health-based violation in ${r.year}`
      }
      sub={`${rank} The U.S. average is ${Math.round(r.baseRate * 1000) / 10}%.`}
      note={`Forecast from EPA records, not a test of your water. Backtest ${r.backtest.years}: the top 10% caught ${Math.round(r.backtest.modelRecallTop10 * 100)}% of next-year violators (EPA targeting score: ${Math.round(r.backtest.ettRecallTop10 * 100)}%).`}
      source="Taproot model · SDWIS"
      sourceUrl={sourceUrl}
    >
      <div ref={boxRef}>
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block h-auto w-full overflow-visible" role="img" aria-label={`Forecast ${lab}% against ${total.toLocaleString('en-US')} scored systems`}>
          {dist.map((n, i) => {
            const h = Math.max(1, (n / peak) * (bot - top));
            return <rect key={i} x={i * bw + 1} y={bot - h} width={Math.max(1, bw - 2)} height={h} fill={i === here ? 'var(--ink)' : 'var(--field-2)'} />;
          })}
          <line x1={baseX} x2={baseX} y1={top - 6} y2={bot} stroke="var(--ink)" strokeDasharray="1 2" />
          <text x={baseX + (baseX > W - 90 ? -5 : 5)} y={bot - 6} textAnchor={baseX > W - 90 ? 'end' : 'start'} className="t-ink t-halo">
            U.S. avg
          </text>
          <line x1={fx} x2={fx} y1={4} y2={bot} stroke="var(--register)" strokeWidth={2} />
          <text x={right ? fx + 6 : fx - 6} y={13} textAnchor={right ? 'start' : 'end'} className="t-blue t-b t-halo">
            {name.length > 22 ? name.slice(0, 21) + '…' : name}
          </text>
          <text x={right ? fx + 6 : fx - 6} y={27} textAnchor={right ? 'start' : 'end'} className="t-blue t-halo">
            {r.percentile >= 0.5 ? `higher than ${higher}% of systems` : `lower than ${lower}% of systems`}
          </text>
          <line x1={0} x2={W} y1={bot} y2={bot} stroke="var(--ink)" />
          <text x={0} y={bot + 18} className="t-up">
            ← Lower risk
          </text>
          <text x={W} y={bot + 18} textAnchor="end" className="t-up">
            Higher risk →
          </text>
          {!narrow && (
            <text x={W / 2} y={bot + 18} textAnchor="middle" className="t-ink t-up">
              {total.toLocaleString('en-US')} systems · {r.year} forecast
            </text>
          )}
        </svg>
        {r.drivers.length > 0 && (
          <>
            <span className="rf-lbl rf-drv-h">What moved it</span>
            <div className="mt-1.5">
              {r.drivers.slice(0, 4).map((d) => {
                const t = driverText(d);
                return (
                  <div key={d.f} className="rf-drv">
                    <span>{t.charAt(0).toUpperCase() + t.slice(1)}</span>
                    <b data-dir={d.dir}>{d.dir === 'up' ? '↑ raises' : '↓ lowers'}</b>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </VisualFrame>
  );
}
