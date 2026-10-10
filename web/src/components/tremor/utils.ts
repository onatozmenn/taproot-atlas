// Adapted from Tremor Raw (https://tremor.so, Apache-2.0, see LICENSE-tremor.txt).
// Changes for Taproot: colours come from Taproot's CSS tokens instead of Tremor's
// Tailwind palette, so every component follows the light/dark theme.
import clsx, { type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cx(...args: ClassValue[]) {
  return twMerge(clsx(...args));
}

export const focusRing = ['outline outline-offset-2 outline-0 focus-visible:outline-2', 'outline-[var(--link)]'];
