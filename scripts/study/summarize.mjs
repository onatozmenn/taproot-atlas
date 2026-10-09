#!/usr/bin/env node
// Summarize Taproot Study results. Input: a Vercel log export (or any text)
// containing `[feedback] {json}` lines, or a JSON array of copied results.
// Usage: node scripts/study/summarize.mjs logs.txt [more files…]
import { readFileSync } from 'node:fs';

const T95 = { 1: 12.71, 2: 4.3, 3: 3.18, 4: 2.78, 5: 2.57, 6: 2.45, 7: 2.36, 8: 2.31, 9: 2.26, 10: 2.23, 15: 2.13, 20: 2.09, 30: 2.04 };
const t95 = (df) => T95[df] ?? (df > 30 ? 1.96 : T95[Object.keys(T95).map(Number).filter((k) => k <= df).pop()]);

export function parseRecords(text) {
  const out = [];
  const trimmed = text.trim();
  if (trimmed.startsWith('[')) return JSON.parse(trimmed);
  if (trimmed.startsWith('{')) {
    try { return [JSON.parse(trimmed)]; } catch { /* fall through to line scan */ }
  }
  for (const m of text.matchAll(/\[feedback\]\s*(\{.*\})/g)) {
    try { out.push(JSON.parse(m[1])); } catch { /* skip broken line */ }
  }
  return out;
}

export function summarize(records) {
  const studies = records.filter((r) => r.kind === 'study' && typeof r.susScore === 'number');
  const ratings = records.filter((r) => r.kind === 'rating');
  const byPid = new Map(studies.map((s) => [s.pid, s]));
  const uniq = [...byPid.values()];
  const sus = uniq.map((s) => s.susScore);
  const n = sus.length;
  const mean = n ? sus.reduce((a, b) => a + b, 0) / n : null;
  const sd = n > 1 ? Math.sqrt(sus.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : null;
  const ci = sd !== null ? t95(n - 1) * (sd / Math.sqrt(n)) : null;
  const tasks = {};
  for (const s of uniq) for (const t of s.results ?? []) {
    const k = `${s.role}:${t.id}`;
    tasks[k] ??= { n: 0, success: 0, seconds: [], ease: 0, checks: 0, correct: 0 };
    const x = tasks[k];
    x.n++; x.success += t.success ? 1 : 0; x.seconds.push(t.seconds); x.ease += t.ease;
    if (t.check) { x.checks++; x.correct += t.check.correct ? 1 : 0; }
  }
  const taskRows = Object.entries(tasks).map(([k, x]) => ({
    task: k, n: x.n, completion: x.success / x.n,
    medianSeconds: [...x.seconds].sort((a, b) => a - b)[Math.floor(x.seconds.length / 2)],
    ease: x.ease / x.n, comprehension: x.checks ? x.correct / x.checks : null,
  }));
  return {
    participants: n,
    roles: uniq.reduce((a, s) => ({ ...a, [s.role]: (a[s.role] ?? 0) + 1 }), {}),
    sus: { mean, sd, ci95: ci, benchmark: 68 },
    tasks: taskRows,
    ratings: { up: ratings.filter((r) => r.rating === 'up').length, down: ratings.filter((r) => r.rating === 'down').length },
    comments: uniq.map((s) => s.comment).filter(Boolean),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const files = process.argv.slice(2);
  if (!files.length) { console.error('usage: summarize.mjs <log or json files…>'); process.exit(1); }
  const recs = files.flatMap((f) => parseRecords(readFileSync(f, 'utf8')));
  console.log(JSON.stringify(summarize(recs), null, 2));
}
