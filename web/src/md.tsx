import React from 'react';

/** Minimal safe markdown renderer for Resolver-owned summaries (no deps). */
export function renderMarkdown(text: string): React.ReactNode[] {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const lines = escaped.split('\n');
  const out: React.ReactNode[] = [];
  let list: string[] = [];
  const flushList = (keyBase: string) => {
    if (list.length > 0) {
      out.push(
        <ul key={`${keyBase}-ul`}>
          {list.map((li, i) => (
            <li key={i} dangerouslySetInnerHTML={{ __html: inline(li) }} />
          ))}
        </ul>,
      );
      list = [];
    }
  };
  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('### ')) {
      flushList(`l${idx}`);
      out.push(<h4 key={idx}>{trimmed.slice(4)}</h4>);
    } else if (trimmed.startsWith('- ')) {
      list.push(trimmed.slice(2));
    } else if (trimmed === '---' || trimmed === '') {
      flushList(`l${idx}`);
      if (trimmed === '---') out.push(<hr key={idx} />);
    } else {
      flushList(`l${idx}`);
      out.push(<p key={idx} dangerouslySetInnerHTML={{ __html: inline(trimmed) }} />);
    }
  });
  flushList('end');
  return out;
}

function inline(s: string): string {
  let h = s;
  // `code` first
  h = h.replace(/`([^`]+)`/g, '<code>$1</code>');
  // links (http/https only) with external marker like America.gov ↗
  h = h.replace(
    /\[([^\]]+)\]\((https?:[^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noreferrer">$1<span class="ext" aria-hidden="true">↗</span></a>',
  );
  // bold
  h = h.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // italic *...*
  h = h.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
  return h;
}
