import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type Which = 'privacy' | 'how' | null;

export function InfoDialogs({ open, onOpenChange }: { open: Which; onOpenChange: (w: Which) => void }) {
  return (
    <>
      <Dialog open={open === 'privacy'} onOpenChange={(o) => onOpenChange(o ? 'privacy' : null)}>
        <DialogContent className="rounded-3xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold tracking-tight">Your privacy</DialogTitle>
            <DialogDescription>Taproot Atlas answers from public records. It does not need to know who you are.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-[15px] leading-relaxed">
            <section>
              <h3 className="font-semibold">Share only what's needed</h3>
              <p className="text-muted-foreground">Ask about a city or a water system. Don't include names, addresses, or account numbers.</p>
            </section>
            <section>
              <h3 className="font-semibold">Location is optional</h3>
              <p className="text-muted-foreground">If you turn on location, only the coordinates go with that question so we can find your water system. Nothing is stored.</p>
            </section>
            <section>
              <h3 className="font-semibold">Limited retention</h3>
              <p className="text-muted-foreground">Your recent questions stay in this browser only. Clear them anytime from the menu.</p>
            </section>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={open === 'how'} onOpenChange={(o) => onOpenChange(o ? 'how' : null)}>
        <DialogContent className="rounded-3xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold tracking-tight">How Taproot works</DialogTitle>
            <DialogDescription>Answers come only from public water records.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-[15px] leading-relaxed text-muted-foreground">
            <p>
              A resolver finds your public water system, then reads EPA SDWIS and ECHO records, utility water quality reports,
              and USGS context. Those facts are the only source of numbers in an answer.
            </p>
            <p>
              An AI writes the reply in plain words and every draft is checked against the records before you see it. If a
              draft adds a number or a claim that isn't in the records, you get the records-only answer instead.
            </p>
            <p>
              Results describe past testing and are never a real-time safety guarantee. Routes on the pathway are schematic.
              Check the linked EPA and utility sources for the official documents.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export type InfoDialogKind = Which;
