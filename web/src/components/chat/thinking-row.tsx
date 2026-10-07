import { useEffect, useState } from 'react';

const STEPS = [
  'Working through your request…',
  'Finding the public water system…',
  'Reading EPA and utility records…',
  'Writing a plain-language answer…',
];

/** America.gov-style loading row: one quiet status line with a moving text shimmer. */
export function ThinkingRow() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => Math.min(x + 1, STEPS.length - 1)), 1800);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="animate-message-in py-1" role="status" aria-live="polite">
      <span key={i} className="text-shimmer animate-message-action-in text-[17px]">
        {STEPS[i]}
      </span>
    </div>
  );
}
