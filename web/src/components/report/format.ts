// Display helpers for the water report. Server text is ASCII (ug/L); the UI
// renders the proper micro sign.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function unit(u: string | null | undefined): string {
  if (!u) return '';
  return u.replace(/^ug\/L$/i, 'µg/L').replace(/^ug\/l$/i, 'µg/L');
}

export function num(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '–';
  const a = Math.abs(n);
  if (a >= 1000) return Math.round(n).toLocaleString('en-US');
  if (a >= 100) return String(Math.round(n));
  if (a >= 10) return String(Math.round(n * 10) / 10);
  if (a >= 1) return String(Math.round(n * 100) / 100);
  if (a === 0) return '0';
  return String(Number(n.toPrecision(2)));
}

export function people(n: number | null | undefined): string {
  if (!n) return '–';
  if (n >= 1_000_000) return `${(Math.round(n / 100_000) / 10).toLocaleString('en-US')}M`;
  if (n >= 10_000) return `${Math.round(n / 1000).toLocaleString('en-US')}k`;
  return n.toLocaleString('en-US');
}

export function month(iso: string | null | undefined): string {
  if (!iso) return '';
  const m = iso.match(/^(\d{4})-(\d{2})/);
  return m ? `${MONTHS[Number(m[2]) - 1]} ${m[1]}` : iso;
}

export function day(iso: string | null | undefined): string {
  if (!iso) return '';
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}` : iso;
}

export function year(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 4) : '';
}

export type Level = 'alert' | 'watch' | 'ok' | 'none';

export const LEVEL_COLOR: Record<Level, string> = {
  alert: 'var(--level-alert)',
  watch: 'var(--level-watch)',
  ok: 'var(--level-ok)',
  none: 'var(--tertiary)',
};

export const LEVEL_BG: Record<Level, string> = {
  alert: 'bg-[var(--level-alert-bg)] text-[var(--level-alert)]',
  watch: 'bg-[var(--level-watch-bg)] text-[var(--level-watch)]',
  ok: 'bg-[var(--level-ok-bg)] text-[var(--level-ok)]',
  none: 'bg-secondary text-muted-foreground',
};

export function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/(^|[\s/(-])(\p{L})/gu, (_m, p: string, c: string) => p + c.toUpperCase())
    .replace(/\b(Of|And|The|For|In)\b/g, (w) => w.toLowerCase())
    .replace(/^./, (c) => c.toUpperCase());
}
