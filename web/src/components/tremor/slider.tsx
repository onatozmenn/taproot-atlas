// Tremor Slider [v1.0.0], adapted for Taproot (Apache-2.0, see LICENSE-tremor.txt).
// Changes: radix-ui umbrella import, Taproot colours, a 44px touch target
// around the thumb for phones.
import { Slider as SliderPrimitive } from 'radix-ui';
import * as React from 'react';
import { cx, focusRing } from './utils';

interface SliderProps extends React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> {
  ariaLabelThumb?: string;
}

export const Slider = React.forwardRef<React.ElementRef<typeof SliderPrimitive.Root>, SliderProps>(({ className, ariaLabelThumb, ...props }, ref) => {
  const value = props.value || props.defaultValue;
  return (
    <SliderPrimitive.Root
      ref={ref}
      className={cx(
        'relative flex h-11 cursor-pointer touch-none select-none items-center',
        "data-[orientation='horizontal']:w-full data-disabled:pointer-events-none",
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-muted ring-1 ring-inset ring-border">
        <SliderPrimitive.Range className="absolute h-full rounded-full bg-[var(--link)] data-disabled:bg-[var(--tertiary)]" />
      </SliderPrimitive.Track>
      {value?.map((_, i) => (
        <SliderPrimitive.Thumb
          key={i}
          aria-label={ariaLabelThumb}
          className={cx(
            'relative block size-5 shrink-0 rounded-full border border-border bg-background shadow-[0_1px_3px_rgb(0_0_0/0.18)] transition-transform active:scale-110',
            "before:absolute before:-inset-3 before:content-['']",
            focusRing,
            'outline-offset-0',
          )}
        />
      ))}
    </SliderPrimitive.Root>
  );
});
Slider.displayName = 'Slider';
