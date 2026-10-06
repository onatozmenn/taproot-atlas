import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { renderMarkdown } from './md';

function html(nodes: React.ReactNode[]): string {
  return renderToStaticMarkup(React.createElement(React.Fragment, null, ...nodes));
}

describe('renderMarkdown', () => {
  it('links https URLs with rel and external marker', () => {
    const out = html(renderMarkdown('[Verify](https://example.com/report)'));
    expect(out).toContain('href="https://example.com/report"');
    expect(out).toContain('rel="noreferrer"');
  });

  it('never breaks out of href on crafted model URLs', () => {
    const evil = '[click](https://example.com" onclick="alert(1) data-x=")';
    const out = html(renderMarkdown(evil));
    // Crafted URL stays plain text: no link element, no executable attribute.
    expect(out).not.toContain('<a ');
    expect(out).not.toContain('href="https://example.com"');
  });

  it('rejects javascript: URLs', () => {
    const out = html(renderMarkdown('[x](javascript:alert(1))'));
    expect(out).not.toContain('href=');
    expect(out).toContain('[x]');
  });

  it('escapes HTML in model text without innerHTML', () => {
    const out = html(renderMarkdown('<img src=x onerror=alert(1)> **bold**'));
    expect(out).not.toContain('<img');
    expect(out).toContain('&lt;img');
    expect(out).toContain('<strong>bold</strong>');
  });
});
