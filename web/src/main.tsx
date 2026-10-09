import React, { Suspense, lazy, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from 'next-themes';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import App from './App';
import './index.css';

const KitGallery = lazy(() => import('./components/kit/kit-gallery'));
const TriageView = lazy(() => import('./components/triage/triage-view'));

function triageState(hash: string): string | null {
  const st = new URLSearchParams(hash.split('?')[1] ?? '').get('state');
  return st && /^[A-Za-z]{2}$/.test(st) ? st.toUpperCase() : null;
}

/** `/#/kit` opens the Kit gallery, `/#/triage` the priority queue; everything else is the chat. */
function Root() {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const on = () => setHash(window.location.hash);
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  if (hash.startsWith('#/kit')) {
    return (
      <Suspense fallback={null}>
        <KitGallery />
      </Suspense>
    );
  }
  if (hash.startsWith('#/triage')) {
    return (
      <Suspense fallback={null}>
        <TriageView initialState={triageState(hash)} />
      </Suspense>
    );
  }
  return <App />;
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
