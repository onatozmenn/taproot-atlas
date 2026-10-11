import React, { Suspense, lazy, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from 'next-themes';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import App from './App';
import '@fontsource-variable/public-sans';
import '@fontsource-variable/source-serif-4';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/ibm-plex-mono/600.css';
import './index.css';

const KitGallery = lazy(() => import('./components/kit/kit-gallery'));
const TriageView = lazy(() => import('./components/triage/triage-view'));
const ImpactView = lazy(() => import('./components/impact/impact-view'));
const StudyView = lazy(() => import('./components/study/study-view'));
const GlobalView = lazy(() => import('./components/global/global-view'));

function triageState(hash: string): string | null {
  const st = new URLSearchParams(hash.split('?')[1] ?? '').get('state');
  return st && /^[A-Za-z]{2}$/.test(st) ? st.toUpperCase() : null;
}

/** `/#/kit` opens the Kit gallery, `/#/triage` the priority queue, `/#/impact` the backtest story, `/#/study` the usability test, `/#/global` beyond the U.S.; everything else is the chat. */
function Root() {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const on = () => setHash(window.location.hash);
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const page = hash.startsWith('#/kit')
    ? { label: 'Kit', node: <KitGallery /> }
    : hash.startsWith('#/triage')
      ? { label: 'Triage', node: <TriageView initialState={triageState(hash)} /> }
      : hash.startsWith('#/global')
        ? { label: 'Global', node: <GlobalView /> }
        : hash.startsWith('#/impact')
          ? { label: 'Impact', node: <ImpactView /> }
          : hash.startsWith('#/study')
            ? { label: 'Study', node: <StudyView /> }
            : null;
  const isChat = page === null;
  useEffect(() => {
    if (isChat) document.title = 'Taproot Atlas';
    // One product: every route wears the water shell (palette, sidebar, top
    // bar). Portals (menus, dialogs, toasts) follow <html>.
    document.documentElement.classList.add('cg-shell');
  }, [isChat]);
  // The chat stays mounted under every page (the shell shows the page in
  // place of the thread), so a sidebar chat or New chat returns to the same
  // conversation instead of an empty start screen.
  return <App page={page ? { label: page.label, node: <Suspense fallback={<PageSkeleton />}>{page.node}</Suspense> } : null} />;
}

/** Shown while a page's code loads: quiet bars where the masthead and first section will be. */
function PageSkeleton() {
  return (
    <div className="cg-page-skel" role="status" aria-label="Loading page">
      <i style={{ width: '38%', height: 28 }} />
      <i style={{ width: '72%' }} />
      <i style={{ width: '64%' }} />
      <i style={{ width: '100%', height: 160, marginTop: 24 }} />
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <TooltipProvider>
        <Root />
        <Toaster richColors position="bottom-center" />
      </TooltipProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
