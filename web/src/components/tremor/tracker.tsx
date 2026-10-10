// Tremor Tracker [v1.0.0], adapted for Taproot (Apache-2.0, see LICENSE-tremor.txt).
// Changes: radix-ui umbrella import, `color` is any CSS colour (Taproot tokens),
// blocks are focusable buttons so the tooltip opens by keyboard and by tap.
// Public Record: square ■ cells on a 3px gutter, optional count inside a cell,
// □ outlined empty cells, ochre outlined cells for secondary records.
import { HoverCard as HoverCardPrimitives } from 'radix-ui';
import React from 'react';
import '../../styles/record-pages-tremor.css';
import { cx } from './utils';

export interface TrackerBlockProps {
  key?: string | number;
  /** Any CSS colour, e.g. `var(--level-alert)`. No colour = empty □ cell. */
  color?: string;
  tooltip?: string;
  hoverEffect?: boolean;
  defaultBackgroundColor?: string;
  /** Short text drawn inside the cell (a count). */
  label?: string;
  /** Draw as an outlined (ochre) cell instead of a filled one. */
  outline?: boolean;
}

const Block = ({ color, tooltip, defaultBackgroundColor, label, outline }: TrackerBlockProps) => {
  const [open, setOpen] = React.useState(false);
  const empty = !color && !defaultBackgroundColor;
  return (
    <HoverCardPrimitives.Root open={open} onOpenChange={setOpen} openDelay={0} closeDelay={0}>
      <HoverCardPrimitives.Trigger asChild>
        <button
          type="button"
          aria-label={tooltip}
          onClick={() => setOpen((o) => !o)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          className="rp-trk-b"
        >
          <span data-empty={empty || undefined} data-outline={outline || undefined} style={{ background: color || defaultBackgroundColor }} aria-hidden="true">
            {label}
          </span>
        </button>
      </HoverCardPrimitives.Trigger>
      <HoverCardPrimitives.Portal>
        <HoverCardPrimitives.Content sideOffset={6} side="top" align="center" avoidCollisions collisionPadding={12} className="rp-tip">
          {tooltip}
        </HoverCardPrimitives.Content>
      </HoverCardPrimitives.Portal>
    </HoverCardPrimitives.Root>
  );
};
Block.displayName = 'Block';

interface TrackerProps extends React.HTMLAttributes<HTMLDivElement> {
  data: TrackerBlockProps[];
  /** Fill for blocks without a colour; pass '' for empty □ cells. */
  defaultBackgroundColor?: string;
  hoverEffect?: boolean;
}

export const Tracker = React.forwardRef<HTMLDivElement, TrackerProps>(
  ({ data = [], defaultBackgroundColor = 'var(--field-2)', className, hoverEffect, ...props }, ref) => (
    <div ref={ref} className={cx('rp-trk h-8', hoverEffect && 'hover', className)} {...props}>
      {data.map(({ key, ...p }, i) => (
        <Block key={key ?? i} defaultBackgroundColor={defaultBackgroundColor} hoverEffect={hoverEffect} {...p} />
      ))}
    </div>
  ),
);
Tracker.displayName = 'Tracker';
