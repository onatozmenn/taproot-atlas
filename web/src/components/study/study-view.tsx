import { CheckIcon, ExternalLinkIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { sendFeedback } from '../../feedback';
import { Logo } from '../Logo';

/* Taproot Study — a self-guided usability test anyone can run in 10 minutes.
   Route: /#/study. Task success + time + Single Ease Question per task, a
   comprehension check where it matters, then the standard 10-item System
   Usability Scale (Brooke 1996; benchmark 68 = average, Sauro & Lewis).
   Results go to /api/feedback and can be copied as JSON. */

export type Role = 'resident' | 'professional';

export interface StudyTask {
  id: string;
  prompt: string;
  open: string;
  check?: { q: string; options: string[]; correct: number };
}

export const TASKS: Record<Role, StudyTask[]> = {
  resident: [
    { id: 'lead', prompt: 'Find out whether lead has been found in {city}’s tap water.', open: '#/' },
    { id: 'source', prompt: 'Find out where {city}’s water comes from.', open: '#/' },
    { id: 'term', prompt: 'Find out what “ppb” means.', open: '#/' },
    { id: 'violations', prompt: 'Check whether {city}’s water system broke any federal rules in the last five years.', open: '#/' },
    {
      id: 'forecast',
      prompt: 'Find out how likely {city}’s water system is to break a health rule next year.',
      open: '#/',
      check: {
        q: 'What does that percentage mean?',
        options: ['A lab test result for my tap', 'A forecast from EPA records of a new health-rule violation', 'The share of homes with lead pipes', 'I am not sure'],
        correct: 1,
      },
    },
  ],
  professional: [
    { id: 'queue', prompt: 'Open the triage queue and switch it to Texas.', open: '#/triage' },
    { id: 'step', prompt: 'Find the suggested first step for the top system in Texas.', open: '#/triage?state=TX' },
    {
      id: 'capacity',
      prompt: 'Use the planner: if your team can reach 5% of systems, how much of next year’s trouble does Taproot’s order meet?',
      open: '#/triage',
      check: { q: 'Roughly what share did it show for Taproot?', options: ['About 15%', 'About 30%', 'About half', 'About 90%'], correct: 2 },
    },
    { id: 'hidden', prompt: 'Show only systems EPA’s targeting formula would not flag yet.', open: '#/triage' },
    { id: 'ask', prompt: 'Pick a system from the queue and ask Taproot about it in the chat.', open: '#/triage' },
  ],
};

export const SUS_ITEMS = [
  'I think that I would like to use this system frequently.',
  'I found the system unnecessarily complex.',
  'I thought the system was easy to use.',
  'I think that I would need the support of a technical person to be able to use this system.',
  'I found the various functions in this system were well integrated.',
  'I thought there was too much inconsistency in this system.',
  'I would imagine that most people would learn to use this system very quickly.',
  'I found the system very cumbersome to use.',
  'I felt very confident using the system.',
  'I needed to learn a lot of things before I could get going with this system.',
];

/** Standard SUS scoring: odd items (r-1), even items (5-r), sum x 2.5 → 0–100. */
export function susScore(responses: number[]): number | null {
  if (responses.length !== 10 || responses.some((r) => !(r >= 1 && r <= 5))) return null;
  const sum = responses.reduce((a, r, i) => a + (i % 2 === 0 ? r - 1 : 5 - r), 0);
  return sum * 2.5;
}

/** Sauro & Lewis curved grade (abridged). */
export function susGrade(score: number): string {
  if (score >= 84.1) return 'A+';
  if (score >= 80.8) return 'A';
  if (score >= 78.9) return 'A−';
  if (score >= 77.2) return 'B+';
  if (score >= 74.1) return 'B';
  if (score >= 72.6) return 'B−';
  if (score >= 71.1) return 'C+';
  if (score >= 65) return 'C';
  if (score >= 62.7) return 'C−';
  if (score >= 51.7) return 'D';
  return 'F';
}

interface TaskResult {
  id: string;
  success: boolean;
  seconds: number;
  ease: number;
  check?: { answer: number; correct: boolean };
}

interface StudyState {
  pid: string;
  role: Role | null;
  step: number;
  started: number | null;
  results: TaskResult[];
  sus: number[];
  comment: string;
  sent: boolean;
  /** The one U.S. city a resident uses for every task. */
  city?: string;
}

const KEY = 'taproot:study';
const fresh = (): StudyState => ({ pid: Math.random().toString(36).slice(2, 8), role: null, step: 0, started: null, results: [], sus: Array(10).fill(0), comment: '', sent: false });

function loadState(): StudyState {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...fresh(), ...(JSON.parse(raw) as StudyState) } : fresh();
  } catch {
    return fresh();
  }
}

function Scale({ n, value, onChange, low, high, label }: { n: number; value: number; onChange: (v: number) => void; low: string; high: string; label: string }) {
  return (
    <div>
      <div role="radiogroup" aria-label={label} className="flex gap-1.5">
        {Array.from({ length: n }, (_, i) => i + 1).map((v) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={value === v}
            onClick={() => onChange(v)}
            className={cn('press h-10 flex-1 rounded-xl border text-[14px] font-medium tabular-nums', value === v ? 'border-foreground bg-foreground text-background' : 'border-border')}
          >
            {v}
          </button>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[12px] text-muted-foreground">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </div>
  );
}

export const fillCity = (prompt: string, city: string) => prompt.replaceAll('{city}', city.trim() || 'Chicago');

function TaskCard({ task, index, total, city, onDone }: { task: StudyTask; index: number; total: number; city: string; onDone: (r: TaskResult) => void }) {
  const [started, setStarted] = useState<number | null>(null);
  const [outcome, setOutcome] = useState<boolean | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [ease, setEase] = useState(0);
  const [answer, setAnswer] = useState<number | null>(null);
  const ready = outcome !== null && ease > 0 && (!task.check || answer !== null);
  return (
    <section className="rounded-[28px] border bg-card px-5 py-6 sm:px-6" aria-label={`Task ${index + 1}`}>
      <div className="flex items-center gap-3">
        <p className="font-mono text-[12px] tabular-nums text-[var(--tertiary)]">
          Task {index + 1} of {total}
        </p>
        <div className="h-1 flex-1 rounded-full bg-muted" aria-hidden="true">
          <div className="h-1 rounded-full bg-[var(--link)] transition-[width] duration-500" style={{ width: `${(index / (total + 1)) * 100}%` }} />
        </div>
      </div>
      <p className="mt-2 text-[19px] font-medium leading-snug">{fillCity(task.prompt, city)}</p>
      {started === null && <p className="mt-2 text-[13.5px] text-muted-foreground">Type your question the way you’d ask a friend. There’s no wrong wording.</p>}
      {started === null ? (
        <a
          href={task.open}
          target="_blank"
          rel="noreferrer"
          onClick={() => setStarted(performance.now())}
          className="press mt-5 inline-flex h-10 items-center gap-2 rounded-full bg-foreground px-4 text-[14px] font-medium text-background"
        >
          Start: open Taproot in a new tab
          <ExternalLinkIcon className="size-4" />
        </a>
      ) : outcome === null ? (
        <div className="mt-5 flex flex-wrap gap-2">
          <p className="w-full text-[14px] text-muted-foreground">Do the task in the other tab, then come back here.</p>
          <button
            type="button"
            onClick={() => {
              setSeconds(Math.round((performance.now() - started) / 1000));
              setOutcome(true);
            }}
            className="press h-10 rounded-full bg-foreground px-4 text-[14px] font-medium text-background"
          >
            I did it
          </button>
          <button
            type="button"
            onClick={() => {
              setSeconds(Math.round((performance.now() - started) / 1000));
              setOutcome(false);
            }}
            className="press h-10 rounded-full border border-border px-4 text-[14px] font-medium"
          >
            I couldn’t do it
          </button>
        </div>
      ) : (
        <div className="mt-5 space-y-5">
          {task.check && (
            <div>
              <p className="text-[15px] font-medium">{task.check.q}</p>
              <div className="mt-2 grid gap-1.5">
                {task.check.options.map((o, i) => (
                  <button
                    key={o}
                    type="button"
                    onClick={() => setAnswer(i)}
                    aria-pressed={answer === i}
                    className={cn('press rounded-xl border px-3 py-2 text-left text-[14px]', answer === i ? 'border-foreground bg-secondary' : 'border-border')}
                  >
                    {o}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div>
            <p className="mb-2 text-[15px] font-medium">Overall, how easy or hard was this task?</p>
            <Scale n={7} value={ease} onChange={setEase} low="Very hard" high="Very easy" label="Task ease" />
          </div>
          <button
            type="button"
            disabled={!ready}
            onClick={() => onDone({ id: task.id, success: outcome, seconds, ease, ...(task.check && answer !== null ? { check: { answer, correct: answer === task.check.correct } } : {}) })}
            className="press h-10 rounded-full bg-foreground px-5 text-[14px] font-medium text-background disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </section>
  );
}

const CITY_IDEAS = ['Chicago', 'Houston', 'Phoenix', 'Atlanta'];

/** One city for all five resident tasks, so "that city" never drifts. */
function CityPick({ onPick }: { onPick: (city: string) => void }) {
  const [v, setV] = useState('');
  return (
    <section className="rounded-[28px] border bg-card px-5 py-6 sm:px-6" aria-label="Pick a city">
      <p className="text-[19px] font-medium leading-snug">Pick one U.S. city to use for all five tasks.</p>
      <p className="mt-1.5 text-[14px] text-muted-foreground">Your own city is best. Taproot covers water systems serving 3,300 people or more.</p>
      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (v.trim()) onPick(v.trim().slice(0, 60));
        }}
      >
        <label htmlFor="study-city" className="sr-only">
          City
        </label>
        <input
          id="study-city"
          value={v}
          onChange={(e) => setV(e.target.value)}
          placeholder="e.g. Denver, CO"
          autoComplete="address-level2"
          className="h-11 min-w-0 flex-1 rounded-full border border-border bg-background px-4 text-[16px] focus-visible:outline-2 focus-visible:outline-[var(--link)]"
        />
        <button type="submit" disabled={!v.trim()} className="press h-11 shrink-0 rounded-full bg-foreground px-5 text-[14px] font-medium text-background disabled:opacity-40">
          Use it
        </button>
      </form>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {CITY_IDEAS.map((c) => (
          <button key={c} type="button" onClick={() => onPick(c)} className="press h-9 rounded-full border border-border px-3.5 text-[13.5px] font-medium hover:bg-secondary">
            {c}
          </button>
        ))}
      </div>
    </section>
  );
}

export function StudyView() {
  const [s, setS] = useState<StudyState>(loadState);
  useEffect(() => {
    document.title = 'Taproot Study';
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch {
      // Private mode: the study still runs, it just won't survive a reload.
    }
  }, [s]);

  const tasks = s.role ? TASKS[s.role] : [];
  const inTasks = s.role !== null && s.step < tasks.length;
  const inSus = s.role !== null && s.step === tasks.length;
  const finished = s.role !== null && s.step > tasks.length;
  const score = susScore(s.sus);

  const summary = useMemo(() => {
    const n = s.results.length || 1;
    const checks = s.results.filter((r) => r.check);
    return {
      completion: s.results.filter((r) => r.success).length / n,
      ease: s.results.reduce((a, r) => a + r.ease, 0) / n,
      comprehension: checks.length ? checks.filter((r) => r.check!.correct).length / checks.length : null,
      minutes: s.results.reduce((a, r) => a + r.seconds, 0) / 60,
    };
  }, [s.results]);

  const record = () => ({ kind: 'study', version: 1, pid: s.pid, role: s.role, ...(s.city ? { city: s.city.slice(0, 60) } : {}), results: s.results, sus: s.sus, susScore: score, comment: s.comment.slice(0, 1000) });

  function submit() {
    if (score === null) return;
    sendFeedback(record());
    setS((x) => ({ ...x, step: x.step + 1, sent: true }));
  }

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-10 flex h-16 items-center gap-2.5 border-b border-border bg-background/85 px-5 backdrop-blur">
        <a href="#/" className="press flex items-center gap-2.5 rounded-full pr-2" aria-label="Back to Taproot Atlas">
          <Logo size={26} />
          <span className="font-display text-[20px] font-medium tracking-tight">Taproot Study</span>
        </a>
        {s.role && (
          <button
            type="button"
            onClick={() => {
              if (s.results.length === 0 || window.confirm('Start over? Your answers so far will be cleared.')) setS(fresh());
            }}
            className="press ml-auto rounded-full px-3 py-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground">
            Start over
          </button>
        )}
      </header>
      <main className="mx-auto w-full max-w-[672px] px-5 pb-24 pt-10">
        {!s.role && (
          <>
            <p className="text-[13px] font-medium text-muted-foreground">About 10 minutes · anonymous</p>
            <h1 className="mt-1 font-display text-[36px] font-medium leading-[1.08] tracking-[-0.01em]">Help us test Taproot</h1>
            <p className="mt-3 text-[16px] leading-snug text-muted-foreground">
              You’ll try five short tasks in Taproot (it opens in a second tab), rate how easy each one was, then answer ten quick statements. We test the app, not you: if something is hard, that’s our fault and
              exactly what we need to know. We record your answers and task times, nothing else.
            </p>
            <p className="mt-6 text-[15px] font-medium">Which fits you best?</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {(
                [
                  ['resident', 'I drink tap water', 'Questions about your own city’s water.'],
                  ['professional', 'I work in water', 'Utility, state program, consultant or technical assistance.'],
                ] as Array<[Role, string, string]>
              ).map(([r, t, d]) => (
                <button key={r} type="button" onClick={() => setS((x) => ({ ...x, role: r, step: 0, city: r === 'resident' ? undefined : x.city }))} className="press rounded-3xl border border-border px-4 py-4 text-left hover:bg-secondary">
                  <span className="block text-[16px] font-semibold">{t}</span>
                  <span className="mt-1 block text-[13.5px] text-muted-foreground">{d}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {inTasks && s.role === 'resident' && s.city === undefined && <CityPick onPick={(c) => setS((x) => ({ ...x, city: c }))} />}

        {inTasks && !(s.role === 'resident' && s.city === undefined) && (
          <TaskCard
            city={s.city ?? 'Chicago'}
            key={`${s.role}-${s.step}`}
            task={tasks[s.step]}
            index={s.step}
            total={tasks.length}
            onDone={(r) => setS((x) => ({ ...x, results: [...x.results, r], step: x.step + 1 }))}
          />
        )}

        {inSus && (
          <section aria-label="System Usability Scale">
            <h1 className="font-display text-[28px] font-medium tracking-tight">Last step: ten quick statements</h1>
            <p className="mt-1 text-[15px] text-muted-foreground">“The system” means Taproot. Go with your first reaction.</p>
            <ol className="mt-6 space-y-6">
              {SUS_ITEMS.map((item, i) => (
                <li key={item}>
                  <p className="mb-2 text-[15px]">
                    <span className="mr-1.5 font-mono text-[12px] text-[var(--tertiary)]">{i + 1}</span>
                    {item}
                  </p>
                  <Scale
                    n={5}
                    value={s.sus[i]}
                    onChange={(v) => setS((x) => ({ ...x, sus: x.sus.map((o, j) => (j === i ? v : o)) }))}
                    low="Strongly disagree"
                    high="Strongly agree"
                    label={`Statement ${i + 1}`}
                  />
                </li>
              ))}
            </ol>
            <label className="mt-8 block text-[15px] font-medium" htmlFor="study-comment">
              Anything that confused or annoyed you? (optional)
            </label>
            <textarea
              id="study-comment"
              value={s.comment}
              onChange={(e) => setS((x) => ({ ...x, comment: e.target.value }))}
              rows={3}
              maxLength={1000}
              className="mt-2 w-full rounded-2xl border border-border bg-background px-3 py-2 text-[15px]"
            />
            <button type="button" disabled={score === null} onClick={submit} className="press mt-4 h-10 rounded-full bg-foreground px-5 text-[14px] font-medium text-background disabled:opacity-40">
              Send results
            </button>
          </section>
        )}

        {finished && score !== null && (
          <section aria-label="Your results">
            <p className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground">
              <CheckIcon className="size-4" /> Sent. Thank you.
            </p>
            <h1 className="mt-1 font-display text-[36px] font-medium tracking-tight">
              You gave Taproot {score} out of 100 ({susGrade(score)})
            </h1>
            <p className="mt-2 text-[15px] text-muted-foreground">The average app scores 68 on this scale; 80 and above is excellent.</p>
            <div className="mt-6 grid grid-cols-3 gap-3">
              {[
                [`${Math.round(summary.completion * 100)}%`, 'tasks completed'],
                [summary.ease.toFixed(1), 'average ease (1–7)'],
                [summary.comprehension === null ? '–' : `${Math.round(summary.comprehension * 100)}%`, 'understood the numbers'],
              ].map(([v, l]) => (
                <div key={l} className="rounded-3xl bg-muted px-4 py-4">
                  <p className="font-display text-[26px] font-medium leading-none tabular-nums">{v}</p>
                  <p className="mt-1.5 text-[12.5px] text-muted-foreground">{l}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(JSON.stringify(record(), null, 1)).then(() => toast.success('Results copied'));
                }}
                className="press h-9 rounded-full border border-border px-4 text-[14px] font-medium"
              >
                Copy results
              </button>
              <a href="#/" className="press inline-flex h-9 items-center rounded-full bg-foreground px-4 text-[14px] font-medium text-background">
                Back to Taproot
              </a>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default StudyView;
