import React from 'react';

/** Taproot Atlas mark: watershed droplet — no flag, no eagle.
 * Navy→teal droplet, two basin flow lines converging to a tap node. */
export function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role="img"
      aria-label="Taproot Atlas logo"
      className="logo-mark"
    >
      <defs>
        <linearGradient id="ta-drop" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0a3161" />
          <stop offset="100%" stopColor="#0e8a7b" />
        </linearGradient>
      </defs>
      <path
        d="M16 2.5C16 2.5 6.5 14.2 6.5 20a9.5 9.5 0 0 0 19 0C25.5 14.2 16 2.5 16 2.5Z"
        fill="url(#ta-drop)"
      />
      <path
        d="M11 19.5c1.8-2.6 3.4-4.9 5-7.2M21 19.5c-1.8-2.6-3.4-4.9-5-7.2M12.5 22.5h7"
        stroke="#fff"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
        opacity="0.9"
      />
      <circle cx="16" cy="22.5" r="2.1" fill="#fff" />
      <circle cx="16" cy="22.5" r="0.9" fill="#0a3161" />
    </svg>
  );
}
