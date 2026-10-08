import React, { Suspense, lazy, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from 'next-themes';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import App from './App';
import './index.css';

const KitGallery = lazy(() => import('./components/kit/kit-gallery'));

/** `/#/kit` opens the Taproot Kit gallery; everything else is the chat. */
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
