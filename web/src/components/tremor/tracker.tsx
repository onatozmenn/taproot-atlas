// Tremor Tracker [v1.0.0], adapted for Taproot (Apache-2.0, see LICENSE-tremor.txt).
// Changes: radix-ui umbrella import, `color` is any CSS colour (Taproot tokens),
// blocks are focusable buttons so the tooltip opens by keyboard and by tap.
import { HoverCard as HoverCardPrimitives } from 'radix-ui';
import React from 'react';
import { cx, focusRing } from './utils';

export interface TrackerBlockProps {
  key?: string | number;
  /** Any CSS colour, e.g. `var(--level-alert)`. */
  color?: string;
  tooltip?: string;
  hoverEffect?: boolean;
  defaultBackgroundColor?: string;
}

const Block = ({ color, tooltip, defaultBackgroundColor, hoverEffect }: TrackerBlockProps) => {
  const [open, setOpen] = React.useState(false);
  return (
    <HoverCardPrimitives.Root open={open} onOpenChange={setOpen} openDelay={0} closeDelay={0}>
      <HoverCardPrimitives.Trigger asChild>
        <button
          type="button"
          aria-label={tooltip}
          onClick={() => setOpen((o) => !o)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          className={cx('size-full overflow-hidden rounded-[2px] px-[1px] first:pl-0 last:pr-0', focusRing, 'outline-offset-1')}
        >
          <span
            className={cx('block size-full rounded-[3px] transition-opacity', hoverEffect && 'hover:opacity-60')}
            style={{ background: color || defaultBackgroundColor }}
          />
        </button>
      </HoverCardPrimitives.Trigger>
      <HoverCardPrimitives.Portal>
        <HoverCardPrimitives.Content
          sideOffset={8}
          side="top"
          align="center"
          avoidCollisions
          collisionPadding={12}
          className="z-50 w-auto max-w-[240px] rounded-lg bg-foreground px-2.5 py-1.5 text-[13px] leading-snug text-background shadow-md"
        >
          {tooltip}
        </HoverCardPrimitives.Content>
      </HoverCardPrimitives.Portal>
    </HoverCardPrimitives.Root>
  );
};
Block.displayName = 'Block';

interface TrackerProps extends React.HTMLAttributes<HTMLDivElement> {
  data: TrackerBlockProps[];
  defaultBackgroundColor?: string;
  hoverEffect?: boolean;
}

export const Tracker = React.forwardRef<HTMLDivElement, TrackerProps>(
  ({ data = [], defaultBackgroundColor = 'var(--muted)', className, hoverEffect, ...props }, ref) => (
    <div ref={ref} className={cx('group flex h-8 w-full items-center', className)} {...props}>
      {data.map(({ key, ...p }, i) => (
        <Block key={key ?? i} defaultBackgroundColor={defaultBackgroundColor} hoverEffect={hoverEffect} {...p} />
      ))}
    </div>
  ),
);
Tracker.displayName = 'Tracker';
