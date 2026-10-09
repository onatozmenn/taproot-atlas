import React, { Suspense, lazy, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from 'next-themes';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import App from './App';
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
  const page = hash.startsWith('#/kit') ? (
    <KitGallery />
  ) : hash.startsWith('#/triage') ? (
    <TriageView initialState={triageState(hash)} />
  ) : hash.startsWith('#/global') ? (
    <GlobalView />
  ) : hash.startsWith('#/impact') ? (
    <ImpactView />
  ) : hash.startsWith('#/study') ? (
    <StudyView />
  ) : null;
  useEffect(() => {
    if (!page) document.title = 'Taproot Atlas';
  }, [page]);
  // The chat stays mounted under every page, so "Back to chat" returns to
  // the same conversation instead of an empty start screen.
  return (
    <>
      <div hidden={page !== null}>
        <App />
      </div>
      {page && <Suspense fallback={null}>{page}</Suspense>}
    </>
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
