/** Fire-and-forget feedback to /api/feedback (ratings, study results). Never throws. */
export function sendFeedback(record: Record<string, unknown>): void {
  try {
    const body = JSON.stringify({ ...record, app: 'taproot-atlas', path: window.location.hash || '/' });
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      if (navigator.sendBeacon('/api/feedback', new Blob([body], { type: 'application/json' }))) return;
    }
    void fetch('/api/feedback', { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(() => {});
  } catch {
    // Feedback is optional; never break the app over it.
  }
}
