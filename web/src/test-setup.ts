import '@testing-library/jest-dom/vitest';

// jsdom lacks ResizeObserver (used by use-stick-to-bottom and Radix).
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}
