// Tremor Callout [v0.0.1], adapted for Taproot (Apache-2.0, see LICENSE-tremor.txt).
// Changes: variants use Taproot's level tokens (light/dark aware), larger
// type and radius to match the chat surface, `role` for alerts.
import React from 'react';
import { tv, type VariantProps } from 'tailwind-variants';
import { cx } from './utils';

export const calloutVariants = tv({
  base: 'flex flex-col overflow-hidden rounded-2xl px-4 py-3 text-[14px] leading-snug',
  variants: {
    variant: {
      default: 'bg-[color-mix(in_oklab,var(--link)_9%,transparent)] text-foreground [&_[data-callout-icon]]:text-[var(--link)]',
      success: 'bg-[var(--level-ok-bg)] text-foreground [&_[data-callout-icon]]:text-[var(--level-ok)]',
      error: 'bg-[var(--level-alert-bg)] text-foreground [&_[data-callout-icon]]:text-[var(--level-alert)]',
      warning: 'bg-[var(--level-watch-bg)] text-foreground [&_[data-callout-icon]]:text-[var(--level-watch)]',
      neutral: 'bg-muted text-foreground [&_[data-callout-icon]]:text-muted-foreground',
    },
  },
  defaultVariants: { variant: 'default' },
});

export interface CalloutProps extends React.ComponentPropsWithoutRef<'div'>, VariantProps<typeof calloutVariants> {
  title: string;
  icon?: React.ElementType;
}

export const Callout = React.forwardRef<HTMLDivElement, CalloutProps>(({ title, icon: Icon, className, variant, children, ...props }, ref) => (
  <div ref={ref} role={variant === 'error' ? 'alert' : undefined} className={cx(calloutVariants({ variant }), className)} {...props}>
    <div className="flex items-start">
      {Icon ? <Icon data-callout-icon="" className="mr-2 mt-px size-[18px] shrink-0" aria-hidden="true" /> : null}
      <span className="font-semibold">{title}</span>
    </div>
    {children ? <div className={cx('mt-1 text-muted-foreground', Icon && 'pl-[26px]')}>{children}</div> : null}
  </div>
));
Callout.displayName = 'Callout';
