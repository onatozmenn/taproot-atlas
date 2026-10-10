// Tremor Callout [v0.0.1], adapted for Taproot (Apache-2.0, see LICENSE-tremor.txt).
// Changes: variants use Taproot's level tokens (light/dark aware), `role` for
// alerts. Public Record: square box, 4px left rule in the variant colour
// (red only for errors), title + detail, optional action button on the right.
import React from 'react';
import { tv, type VariantProps } from 'tailwind-variants';
import '../../styles/record-pages-tremor.css';
import { cx } from './utils';

export const calloutVariants = tv({
  base: 'rp-callout',
  variants: {
    variant: { default: '', success: '', error: '', warning: '', neutral: '' },
  },
  defaultVariants: { variant: 'default' },
});

export interface CalloutProps extends Omit<React.ComponentPropsWithoutRef<'div'>, 'title'>, VariantProps<typeof calloutVariants> {
  title: React.ReactNode;
  icon?: React.ElementType;
  /** A button or link shown at the right (full width on phones). */
  action?: React.ReactNode;
}

export const Callout = React.forwardRef<HTMLDivElement, CalloutProps>(({ title, icon: Icon, action, className, variant, children, ...props }, ref) => (
  <div
    ref={ref}
    role={variant === 'error' ? 'alert' : undefined}
    data-variant={variant ?? 'default'}
    className={cx(calloutVariants({ variant }), !Icon && 'noicon', className)}
    {...props}
  >
    {Icon ? <Icon data-callout-icon="" className="rp-callout-ico" aria-hidden="true" /> : null}
    <p className="rp-callout-t">
      <b>{title}</b>
      {children ? <span className="rp-callout-d">{children}</span> : null}
    </p>
    {action}
  </div>
));
Callout.displayName = 'Callout';
