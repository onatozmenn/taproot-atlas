// Tremor Slider [v1.0.0], adapted for Taproot (Apache-2.0, see LICENSE-tremor.txt).
// Changes: radix-ui umbrella import, Taproot colours, a 44px touch target
// around the thumb for phones. Public Record: 2px rule track, 4px register
// range, square 16×24 thumb, optional ticks.
import { Slider as SliderPrimitive } from 'radix-ui';
import * as React from 'react';
import '../../styles/record-pages-tremor.css';
import { cx } from './utils';

interface SliderProps extends React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> {
  ariaLabelThumb?: string;
  /** Tick positions in slider units, drawn under the track. */
  ticks?: number[];
}

export const Slider = React.forwardRef<React.ElementRef<typeof SliderPrimitive.Root>, SliderProps>(({ className, ariaLabelThumb, ticks, ...props }, ref) => {
  const value = props.value || props.defaultValue;
  const min = props.min ?? 0;
  const max = props.max ?? 100;
  return (
    <div className={className}>
      <SliderPrimitive.Root ref={ref} className="rp-slider" {...props}>
        <SliderPrimitive.Track className="rp-slider-track">
          <SliderPrimitive.Range className="rp-slider-range" />
        </SliderPrimitive.Track>
        {value?.map((_, i) => <SliderPrimitive.Thumb key={i} aria-label={ariaLabelThumb} className="rp-slider-thumb" />)}
      </SliderPrimitive.Root>
      {ticks && max > min ? (
        <div className={cx('rp-slider-ticks')} aria-hidden="true">
          {ticks.map((t) => (
            <i key={t} style={{ left: `calc(8px + (100% - 16px) * ${(t - min) / (max - min)})` }} />
          ))}
        </div>
      ) : null}
    </div>
  );
});
Slider.displayName = 'Slider';
