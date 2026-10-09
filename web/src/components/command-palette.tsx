import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

const EXAMPLE_QUESTIONS = [
  'Where does Chicago tap water come from?',
  'Any violations in the last 5 years?',
  'What is in my tap water?',
  'How does my water reach my tap?',
  'Los Angeles water?',
  'Miami tap water?',
  'Which systems in Texas are most at risk?',
];

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (question: string) => void;
}

export function CommandPalette({ open, onOpenChange, onPick }: CommandPaletteProps) {
  const [text, setText] = useState('');
  const pick = (q: string) => {
    onPick(q);
    onOpenChange(false);
    setText('');
  };
  const typed = text.trim();
  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title="Ask anything" description="Type a tap-water question or pick an example.">
      {/* cmdk's parts must live inside a <Command> root, or the palette crashes on open. */}
      <Command>
        <CommandInput placeholder="Ask about tap water…" value={text} onValueChange={setText} />
        <CommandList>
          <CommandEmpty>Type a question to ask it.</CommandEmpty>
          {typed && (
            <CommandGroup heading="Ask">
              <CommandItem value={`ask:${typed}`} onSelect={() => pick(typed)}>
                Ask “{typed}”
              </CommandItem>
            </CommandGroup>
          )}
          <CommandGroup heading="Views">
            <CommandItem
              value="view:triage priority queue utilities regulators"
              onSelect={() => {
                onOpenChange(false);
                window.location.hash = '#/triage';
              }}
            >
              Open the triage queue (for utilities and state programs)
            </CommandItem>
          </CommandGroup>
          <CommandGroup heading="Example questions">
            {EXAMPLE_QUESTIONS.map((q) => (
              <CommandItem key={q} value={q} onSelect={() => pick(q)}>
                {q}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}

export function CommandPaletteButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="outline" size="sm" onClick={onClick} aria-label="Open command palette">
      <span className="text-muted-foreground">Ask anything…</span>
      <kbd className="ml-2 rounded border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">⌘K</kbd>
    </Button>
  );
}

export function useCommandPalette(): [boolean, (open: boolean) => void] {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return [open, setOpen];
}
