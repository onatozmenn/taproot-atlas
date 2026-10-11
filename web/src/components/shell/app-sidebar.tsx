import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  ClipboardList,
  Globe2,
  Info,
  LayoutGrid,
  Monitor,
  Moon,
  MoreHorizontal,
  PanelLeftClose,
  Search,
  Settings,
  Shield,
  SquarePen,
  Sun,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { groupLabel, type Conversation } from '../../lib/conversations';
import type { InfoDialogKind } from '../chat/info-dialogs';
import { Logo } from '../Logo';

export const APP_PAGES = [
  { href: '#/triage', label: 'Triage', hint: 'Where water teams look first', icon: ClipboardList },
  { href: '#/impact', label: 'Impact', hint: 'Checked against what happened', icon: BarChart3 },
  { href: '#/global', label: 'Global', hint: 'Beyond the U.S.', icon: Globe2 },
  { href: '#/study', label: 'Study', hint: 'Help test Taproot', icon: Users },
  { href: '#/kit', label: 'Kit', hint: 'Interface parts', icon: LayoutGrid },
] as const;

export interface AppSidebarProps {
  /** Desktop: rail expanded. Mobile: drawer shown. */
  open: boolean;
  mobile: boolean;
  onClose: () => void;
  conversations: Conversation[];
  activeId: string | null;
  onNewChat: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
  theme: string | undefined;
  onTheme: (t: string) => void;
  onInfo: (k: InfoDialogKind) => void;
}

export function AppSidebar(props: AppSidebarProps) {
  const { open, mobile, onClose, conversations, activeId } = props;
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (searching) searchRef.current?.focus();
  }, [searching]);

  // Mobile drawer: Escape closes it, and focus moves into it on open.
  useEffect(() => {
    if (!mobile || !open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    panelRef.current?.querySelector<HTMLElement>('button, a')?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [mobile, open, onClose]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? conversations.filter((c) => c.title.toLowerCase().includes(q) || c.messages.some((m) => m.text?.toLowerCase().includes(q)))
      : conversations;
    const out: Array<{ label: string; items: Conversation[] }> = [];
    for (const c of list) {
      const label = groupLabel(c.updatedAt);
      const g = out.find((x) => x.label === label);
      if (g) g.items.push(c);
      else out.push({ label, items: [c] });
    }
    return out;
  }, [conversations, query]);

  const hidden = !open;
  const after = () => {
    if (mobile) onClose();
  };

  return (
    <>
      {mobile && (
        <div className={cn('cg-scrim', open && 'show')} aria-hidden="true" onClick={onClose} />
      )}
      <aside
        ref={panelRef}
        className={cn('cg-side', mobile ? 'mobile' : 'desktop', open ? 'open' : 'closed')}
        aria-label="Sidebar"
        aria-hidden={hidden || undefined}
        {...(hidden ? { inert: '' as unknown as boolean } : {})}
      >
        <div className="cg-side-inner">
          <div className="cg-side-top">
            <button type="button" className="cg-side-logo" onClick={() => { props.onNewChat(); after(); }} aria-label="Taproot Atlas, new chat">
              <Logo size={22} />
            </button>
            <button type="button" className="cg-icon-btn" onClick={onClose} aria-label="Close sidebar">
              {mobile ? <X /> : <PanelLeftClose />}
            </button>
          </div>

          <nav className="cg-side-nav" aria-label="Chat">
            <button type="button" className="cg-side-item" onClick={() => { props.onNewChat(); after(); }}>
              <SquarePen />
              <span>New chat</span>
            </button>
            {searching ? (
              <div className="cg-side-search">
                <Search />
                <input
                  ref={searchRef}
                  type="search"
                  value={query}
                  placeholder="Search chats"
                  aria-label="Search chats"
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      e.stopPropagation();
                      setQuery('');
                      setSearching(false);
                    }
                  }}
                />
                <button type="button" aria-label="Close search" onClick={() => { setQuery(''); setSearching(false); }}>
                  <X />
                </button>
              </div>
            ) : (
              <button type="button" className="cg-side-item" onClick={() => setSearching(true)}>
                <Search />
                <span>Search chats</span>
              </button>
            )}
          </nav>

          <div className="cg-side-scroll scrollbar-thin">
            <nav className="cg-side-sec" aria-label="Taproot pages">
              <span className="cg-side-h">Explore</span>
              {APP_PAGES.map(({ href, label, hint, icon: Icon }) => (
                <a key={href} href={href} className="cg-side-item quiet" title={hint} onClick={after}>
                  <Icon />
                  <span>{label}</span>
                </a>
              ))}
            </nav>

            <section className="cg-side-sec" aria-label="Chats">
              {conversations.length === 0 ? (
                <>
                  <span className="cg-side-h">Chats</span>
                  <p className="cg-side-empty">Your chats appear here and stay in this browser.</p>
                </>
              ) : groups.length === 0 ? (
                <p className="cg-side-empty">No chats match “{query.trim()}”.</p>
              ) : (
                groups.map((g) => (
                  <div key={g.label} className="cg-side-group">
                    <span className="cg-side-h">{g.label}</span>
                    <ul>
                      {g.items.map((c) => (
                        <li key={c.id} className={cn('cg-chat', c.id === activeId && 'active')}>
                          <button
                            type="button"
                            className="cg-chat-open"
                            aria-current={c.id === activeId ? 'page' : undefined}
                            onClick={() => { props.onSelect(c.id); after(); }}
                            title={c.title}
                          >
                            {c.title}
                          </button>
                          <button type="button" className="cg-chat-del" aria-label={`Delete chat: ${c.title}`} onClick={() => props.onDelete(c.id)}>
                            <Trash2 />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </section>
          </div>

          <div className="cg-side-foot">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="cg-user-row" aria-label="Settings">
                  <span className="cg-user-av" aria-hidden="true">G</span>
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block truncate">Guest</span>
                    <span className="cg-user-sub">Chats saved in this browser</span>
                  </span>
                  <MoreHorizontal className="cg-user-more" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="cg-menu w-60">
                <DropdownMenuLabel className="flex items-center gap-2">
                  <Settings className="size-4" /> Settings
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="cg-menu-sub">Theme</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={props.theme ?? 'system'} onValueChange={props.onTheme}>
                  <DropdownMenuRadioItem value="light">
                    <Sun className="size-4" /> Light
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="dark">
                    <Moon className="size-4" /> Dark
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="system">
                    <Monitor className="size-4" /> System
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => props.onInfo('how')}>
                  <Info className="size-4" /> How Taproot works
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => props.onInfo('privacy')}>
                  <Shield className="size-4" /> Your privacy
                </DropdownMenuItem>
                {conversations.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onSelect={props.onClearAll}>
                      <Trash2 className="size-4" /> Delete all chats
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </aside>
    </>
  );
}
