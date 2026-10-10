import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { sendFeedback } from '../../feedback';
import { IcoArrow, IcoCheck, IcoExt, RecordHeader } from '../triage/record-page';

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
      <div role="radiogroup" aria-label={label} className="rp-seq" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
        {Array.from({ length: n }, (_, i) => i + 1).map((v) => (
          <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)}>
            {v}
          </button>
        ))}
      </div>
      <div className="rp-slab">
        <span>1 · {low}</span>
        <span>
          {n} · {high}
        </span>
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
  const status = started === null ? 'Not started' : outcome === null ? 'In progress' : outcome ? 'Done' : 'Couldn’t do it';
  return (
    <section className="rp-task" aria-label={`Task ${index + 1}`}>
      <div className="rp-task-h">
        <span className="rp-lbl">
          Task {index + 1} of {total}
        </span>
        <span className={`rp-mark ${outcome === false ? 'elev' : outcome ? 'blue' : 'typ'}`} data-on={outcome !== null}>
          {status}
        </span>
      </div>
      <p className="rp-task-t">{fillCity(task.prompt, city)}</p>
      {started === null ? (
        <>
          <div className="rp-task-b">
            <p>Type your question the way you’d ask a friend. There’s no wrong wording.</p>
          </div>
          <div className="rp-task-f">
            <span />
            <a href={task.open} target="_blank" rel="noreferrer" onClick={() => setStarted(performance.now())} className="rp-btn primary">
              Start: open Taproot in a new tab
              <IcoExt />
            </a>
          </div>
        </>
      ) : outcome === null ? (
        <>
          <div className="rp-task-b">
            <p>Do the task in the other tab, then come back here.</p>
          </div>
          <div className="rp-task-f">
            <button
              type="button"
              onClick={() => {
                setSeconds(Math.round((performance.now() - started) / 1000));
                setOutcome(false);
              }}
              className="rp-btn quiet"
            >
              I couldn’t do it
            </button>
            <button
              type="button"
              onClick={() => {
                setSeconds(Math.round((performance.now() - started) / 1000));
                setOutcome(true);
              }}
              className="rp-btn primary"
            >
              I did it
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="rp-task-b">
            {task.check && (
              <div className="rp-task-q">
                <b>{task.check.q}</b>
                <div className="rp-opts">
                  {task.check.options.map((o, i) => (
                    <button key={o} type="button" onClick={() => setAnswer(i)} aria-pressed={answer === i} className="rp-opt">
                      <span className="rb" aria-hidden="true" />
                      <span>{o}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="rp-task-q">
              <b>Overall, how easy or hard was this task?</b>
              <Scale n={7} value={ease} onChange={setEase} low="Very hard" high="Very easy" label="Task ease" />
            </div>
          </div>
          <div className="rp-task-f">
            <span className="rp-lbl self-center">{seconds} sec on task</span>
            <button
              type="button"
              disabled={!ready}
              onClick={() => onDone({ id: task.id, success: outcome, seconds, ease, ...(task.check && answer !== null ? { check: { answer, correct: answer === task.check.correct } } : {}) })}
              className="rp-btn primary"
            >
              Next
              <IcoArrow />
            </button>
          </div>
        </>
      )}
    </section>
  );
}

const CITY_IDEAS = ['Chicago', 'Houston', 'Phoenix', 'Atlanta'];

/** One city for all five resident tasks, so "that city" never drifts. */
function CityPick({ onPick }: { onPick: (city: string) => void }) {
  const [v, setV] = useState('');
  return (
    <section className="rp-task" aria-label="Pick a city">
      <div className="rp-task-h">
        <span className="rp-lbl">Before task 1</span>
        <span className="rp-mark typ">One city for all tasks</span>
      </div>
      <p className="rp-task-t">Pick one U.S. city to use for all five tasks.</p>
      <div className="rp-task-b">
        <p>Your own city is best. Taproot covers water systems serving 3,300 people or more.</p>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (v.trim()) onPick(v.trim().slice(0, 60));
          }}
        >
          <label htmlFor="study-city" className="sr-only">
            City
          </label>
          <input id="study-city" value={v} onChange={(e) => setV(e.target.value)} placeholder="e.g. Denver, CO" autoComplete="address-level2" className="rp-input" />
          <button type="submit" disabled={!v.trim()} className="rp-btn primary" style={{ minHeight: 44 }}>
            Use it
          </button>
        </form>
        <div className="flex flex-wrap gap-1.5">
          {CITY_IDEAS.map((c) => (
            <button key={c} type="button" onClick={() => onPick(c)} className="rp-btn quiet">
              {c}
            </button>
          ))}
        </div>
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
  const totalSteps = (tasks.length || 5) + 1;
  const stepNow = !s.role ? 0 : Math.min(totalSteps, s.step + 1);

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
    <div className="rp">
      <RecordHeader page="Study · usability test">
        {s.role && (
          <button
            type="button"
            onClick={() => {
              if (s.results.length === 0 || window.confirm('Start over? Your answers so far will be cleared.')) setS(fresh());
            }}
            className="rp-btn ghost wide"
          >
            Start over
          </button>
        )}
      </RecordHeader>
      <main className="rp-main narrow">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap justify-between gap-3">
            <span className="rp-lbl blue">/#/study · Anonymous · ID {s.pid}</span>
            <span className="rp-lbl">{finished ? 'Complete' : stepNow === 0 ? 'Choose a track' : `Step ${stepNow} of ${totalSteps}`}</span>
          </div>
          <div className="rp-prog" aria-hidden="true">
            <i style={{ width: `${finished ? 100 : (stepNow / (totalSteps + 1)) * 100}%` }} />
          </div>
        </div>

        {!s.role && (
          <>
            <header>
              <h1 className="rp-h1">
                Help us test Taproot <em>· 10 minutes</em>
              </h1>
              <p className="rp-dek">
                You’ll try five short tasks in Taproot (it opens in a second tab), rate how easy each one was, then answer ten quick statements. We test the app, not you: if something is
                hard, that’s our fault and exactly what we need to know. We record your answers and task times, nothing else.
              </p>
            </header>
            <div>
              <span className="rp-lbl mb-2 block">Choose your track</span>
              <div className="rp-track">
                {(
                  [
                    ['resident', 'I drink tap water', 'Questions about your own city’s water.'],
                    ['professional', 'I work in water', 'Utility, state program, consultant or technical assistance.'],
                  ] as Array<[Role, string, string]>
                ).map(([r, t, d]) => (
                  <button key={r} type="button" onClick={() => setS((x) => ({ ...x, role: r, step: 0, city: r === 'resident' ? undefined : x.city }))}>
                    <span className="rb" aria-hidden="true" />
                    <span>
                      <b>{t}</b>
                      <span>{d}</span>
                    </span>
                  </button>
                ))}
              </div>
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
          <section aria-label="System Usability Scale" className="flex flex-col gap-5">
            <header>
              <h1 className="rp-h1" style={{ fontSize: 'clamp(30px, 6vw, 44px)' }}>
                Last step: ten quick statements
              </h1>
              <p className="rp-dek">“The system” means Taproot. Go with your first reaction.</p>
            </header>
            <ol className="rp-sus">
              {SUS_ITEMS.map((item, i) => (
                <li key={item}>
                  <p>
                    <span>{String(i + 1).padStart(2, '0')}</span>
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
            <div>
              <label className="mb-2 block text-[15px] font-bold" htmlFor="study-comment">
                Anything that confused or annoyed you? <span className="font-normal text-ink-2">(optional)</span>
              </label>
              <textarea id="study-comment" value={s.comment} onChange={(e) => setS((x) => ({ ...x, comment: e.target.value }))} rows={3} maxLength={1000} className="rp-textarea" />
            </div>
            <div className="rp-actions justify-end">
              <button type="button" disabled={score === null} onClick={submit} className="rp-btn primary">
                Send results
                <IcoArrow />
              </button>
            </div>
          </section>
        )}

        {finished && score !== null && (
          <section aria-label="Your results" className="flex flex-col gap-6">
            <header>
              <p className="rp-kicker">
                <span className="inline-flex items-center gap-1.5">
                  <IcoCheck className="h-3.5 w-3.5" /> Sent. Thank you.
                </span>
              </p>
              <h1 className="rp-h1" style={{ fontSize: 'clamp(30px, 6vw, 48px)' }}>
                You gave Taproot {score} out of 100 ({susGrade(score)})
              </h1>
              <p className="rp-dek">The average app scores 68 on this scale; 80 and above is excellent.</p>
            </header>
            <div className="rp-grid c3">
              {[
                [`${Math.round(summary.completion * 100)}%`, 'tasks completed', 'Completion'],
                [summary.ease.toFixed(1), 'average ease (1–7)', 'Ease'],
                [summary.comprehension === null ? '–' : `${Math.round(summary.comprehension * 100)}%`, 'understood the numbers', 'Comprehension'],
              ].map(([v, l, k]) => (
                <div key={l} className="rp-tile">
                  <span className="rp-lbl">{k}</span>
                  <div className="rp-tile-v">{v}</div>
                  <p>{l}</p>
                </div>
              ))}
            </div>
            <div className="rp-actions">
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(JSON.stringify(record(), null, 1)).then(() => toast.success('Results copied'));
                }}
                className="rp-btn"
              >
                Copy results
              </button>
              <a href="#/" className="rp-btn primary">
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
