import React from 'react';

let keyCounter = 0;
function nextKey(prefix: string): string {
  keyCounter += 1;
  return `${prefix}-${keyCounter}`;
}

/** Only http(s) URLs with no whitespace become links. Everything else stays text. */
function toSafeHref(raw: string): string | null {
  const url = raw.trim();
  if (url.length === 0 || url.length > 2048) return null;
  if (/\s/.test(url)) return null;
  if (!/^https?:\/\//i.test(url)) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function parseInline(s: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  // Tokenize: `code`, [text](url), **bold**, *italic*. React escapes all text
  // nodes, and link hrefs are validated — no innerHTML anywhere.
  const re = /(`[^`]+`|\[[^\]]+\]\((?:https?:[^)\s]+|#\/[A-Za-z0-9/?=&_-]+)\)|\*\*[^*]+\*\*|\*[^*\n]+\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  const pushText = (t: string) => {
    if (t.length > 0) out.push(t);
  };
  while ((m = re.exec(s)) !== null) {
    pushText(s.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith('`')) {
      out.push(<code key={nextKey('c')}>{tok.slice(1, -1)}</code>);
    } else if (tok.startsWith('[')) {
      const inApp = tok.match(/^\[([^\]]+)\]\((#\/[A-Za-z0-9/?=&_-]+)\)$/);
      const lm = tok.match(/^\[([^\]]+)\]\((https?:[^)\s]+)\)$/);
      if (inApp) {
        // In-app view (the triage queue): same tab, hash route.
        out.push(
          <a key={nextKey('a')} href={inApp[2]} className="in-app-link">
            {inApp[1]}
            <span aria-hidden="true"> →</span>
          </a>,
        );
      } else if (lm) {
        const href = toSafeHref(lm[2]);
        if (href) {
          out.push(
            <a key={nextKey('a')} href={href} target="_blank" rel="noreferrer">
              {lm[1]}
              <span className="ext" aria-hidden="true">
                ↗
              </span>
            </a>,
          );
        } else {
          pushText(tok);
        }
      } else {
        pushText(tok);
      }
    } else if (tok.startsWith('**')) {
      out.push(<strong key={nextKey('b')}>{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith('*')) {
      out.push(<em key={nextKey('e')}>{tok.slice(1, -1)}</em>);
    } else {
      pushText(tok);
    }
    last = m.index + tok.length;
  }
  pushText(s.slice(last));
  return out;
}

/** Minimal safe markdown renderer for Resolver-owned summaries (no deps, no innerHTML). */
export function renderMarkdown(text: string): React.ReactNode[] {
  keyCounter = 0;
  const lines = (text ?? '').split('\n');
  const out: React.ReactNode[] = [];
  let list: string[] = [];
  let ordered = false;
  const flushList = (keyBase: string) => {
    if (list.length > 0) {
      const items = list.map((li, i) => <li key={i}>{parseInline(li)}</li>);
      out.push(ordered ? <ol key={`${keyBase}-ol`}>{items}</ol> : <ul key={`${keyBase}-ul`}>{items}</ul>);
      list = [];
    }
  };
  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('### ')) {
      flushList(`l${idx}`);
      out.push(<h4 key={idx}>{parseInline(trimmed.slice(4))}</h4>);
    } else if (trimmed.startsWith('- ')) {
      if (list.length > 0 && ordered) flushList(`l${idx}`);
      ordered = false;
      list.push(trimmed.slice(2));
    } else if (/^\d+\.\s/.test(trimmed)) {
      if (list.length > 0 && !ordered) flushList(`l${idx}`);
      ordered = true;
      list.push(trimmed.replace(/^\d+\.\s/, ''));
    } else if (trimmed === '---' || trimmed === '') {
      flushList(`l${idx}`);
      if (trimmed === '---') out.push(<hr key={idx} />);
    } else {
      flushList(`l${idx}`);
      out.push(<p key={idx}>{parseInline(trimmed)}</p>);
    }
  });
  flushList('end');
  return out;
}
