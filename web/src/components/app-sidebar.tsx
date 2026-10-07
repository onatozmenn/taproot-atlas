import { Droplets, Plus } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar';
import { Logo } from './Logo';

interface AppSidebarProps {
  history: string[];
  onNewQuery: () => void;
  onHistorySelect: (question: string) => void;
}

export function AppSidebar({ history, onNewQuery, onHistorySelect }: AppSidebarProps) {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild tooltip="Taproot Atlas">
              <a href="/" aria-label="Taproot Atlas home">
                <span className="flex aspect-square size-8 items-center justify-center">
                  <Logo size={26} />
                </span>
                <span className="grid flex-1 text-left text-sm leading-tight">
                  <span className="font-display truncate text-base font-medium">Taproot Atlas</span>
                  <span className="truncate text-xs text-muted-foreground">Water snapshot</span>
                </span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={onNewQuery} tooltip="New query">
                <Plus className="size-4" />
                <span>New query</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
        {history.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Recent</SidebarGroupLabel>
            <SidebarMenu>
              {history.map((q) => (
                <SidebarMenuItem key={q}>
                  <SidebarMenuButton
                    onClick={() => onHistorySelect(q)}
                    tooltip={q}
                    className="justify-start"
                  >
                    <Droplets className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{q}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter>
        <p className="px-2 text-[11px] leading-snug text-muted-foreground group-data-[collapsible=icon]:hidden">
          Reports only. Never a safety verdict. Verify at the official source.
        </p>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
