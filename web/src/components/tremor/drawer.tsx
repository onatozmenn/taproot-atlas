// Tremor Drawer [v1.0.0], adapted for Taproot (Apache-2.0, see LICENSE-tremor.txt).
// Changes: radix-ui umbrella import, lucide close icon, Taproot surface tokens,
// tw-animate-css slide/fade, floating panel with safe-area padding on phones.
import { XIcon } from 'lucide-react';
import { Dialog as DrawerPrimitives } from 'radix-ui';
import * as React from 'react';
import { cx, focusRing } from './utils';

export const Drawer = (props: React.ComponentPropsWithoutRef<typeof DrawerPrimitives.Root>) => <DrawerPrimitives.Root {...props} />;
Drawer.displayName = 'Drawer';

export const DrawerTrigger = DrawerPrimitives.Trigger;
export const DrawerClose = DrawerPrimitives.Close;

const DrawerOverlay = React.forwardRef<React.ElementRef<typeof DrawerPrimitives.Overlay>, React.ComponentPropsWithoutRef<typeof DrawerPrimitives.Overlay>>(
  ({ className, ...props }, ref) => (
    <DrawerPrimitives.Overlay
      ref={ref}
      className={cx('fixed inset-0 z-50 overflow-y-auto bg-black/25 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0', className)}
      {...props}
    />
  ),
);
DrawerOverlay.displayName = 'DrawerOverlay';

export const DrawerContent = React.forwardRef<React.ElementRef<typeof DrawerPrimitives.Content>, React.ComponentPropsWithoutRef<typeof DrawerPrimitives.Content>>(
  ({ className, ...props }, ref) => (
    <DrawerPrimitives.Portal>
      <DrawerOverlay />
      <DrawerPrimitives.Content
        ref={ref}
        className={cx(
          'fixed inset-y-2 right-2 z-50 flex w-[min(340px,calc(100vw-1rem))] flex-col overflow-y-auto rounded-[24px] border border-border bg-popover p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-popover-foreground shadow-xl sm:w-[360px] sm:p-5',
          'duration-300 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-right-8 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-right-8',
          focusRing,
          className,
        )}
        {...props}
      />
    </DrawerPrimitives.Portal>
  ),
);
DrawerContent.displayName = 'DrawerContent';

export const DrawerHeader = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<'div'>>(({ children, className, ...props }, ref) => (
  <div ref={ref} className="flex items-start justify-between gap-x-4 pb-3" {...props}>
    <div className={cx('mt-1 flex flex-col gap-y-1', className)}>{children}</div>
    <DrawerPrimitives.Close asChild>
      <button type="button" aria-label="Close" className={cx('press grid size-10 shrink-0 place-items-center rounded-full hover:bg-muted', focusRing)}>
        <XIcon className="size-5" aria-hidden="true" />
      </button>
    </DrawerPrimitives.Close>
  </div>
));
DrawerHeader.displayName = 'DrawerHeader';

export const DrawerTitle = React.forwardRef<React.ElementRef<typeof DrawerPrimitives.Title>, React.ComponentPropsWithoutRef<typeof DrawerPrimitives.Title>>(
  ({ className, ...props }, ref) => <DrawerPrimitives.Title ref={ref} className={cx('text-base font-semibold text-foreground', className)} {...props} />,
);
DrawerTitle.displayName = 'DrawerTitle';

export const DrawerDescription = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitives.Description>
>(({ className, ...props }, ref) => <DrawerPrimitives.Description ref={ref} className={cx('text-muted-foreground', className)} {...props} />);
DrawerDescription.displayName = 'DrawerDescription';

export const DrawerBody = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<'div'>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cx('flex-1', className)} {...props} />
));
DrawerBody.displayName = 'DrawerBody';
