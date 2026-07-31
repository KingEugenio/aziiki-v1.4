import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {IconContext} from '@phosphor-icons/react';
import App from './App.tsx';
import ErrorBoundary from './components/errors/ErrorBoundary';
import { ToastProvider } from './components/errors/ToastProvider';
import OfflineBanner from './components/errors/OfflineBanner';
import { installGlobalErrorReporting } from './lib/errorReporting';
import './index.css';

// AZIIKI ERROR SYSTEM — catches errors that happen outside any component's
// render (event handlers, timers, rejected promises), which a React
// ErrorBoundary can never see on its own. See lib/errorReporting.ts.
installGlobalErrorReporting();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Every Phosphor icon in the app defaults to the solid "fill" weight
        from here, so individual call sites never need to pass weight="fill"
        themselves - see the icon imports across src/components for the
        lucide-react -> @phosphor-icons/react name mapping. */}
    <IconContext.Provider value={{ weight: 'fill' }}>
      {/* Outermost boundary: catches a crash in App.tsx's own state/hooks,
          which is rare but would otherwise mean a fully blank white screen
          with zero recovery path. Its only extra action is a real page
          reload (not "Go to Dashboard" - if App itself is what crashed,
          there's no App state left to reset a tab on). App.tsx wraps its own
          *inner* ErrorBoundary around just the active tab's content, so a
          bug in one screen doesn't take the whole shell down with it - see
          App.tsx for that one. */}
      <ErrorBoundary
        extraActions={[
          { label: 'Reload Aziiki', onClick: () => window.location.reload(), variant: 'secondary' },
        ]}
      >
        {/* ToastProvider sits inside the crash boundary but outside App, so
            it survives an App-level crash (the crash screen itself could
            still want to surface a toast) and every screen - including the
            auth screen, which mounts before any business/tab state exists -
            can call useToast(). OfflineBanner is a sibling of App (not
            rendered from inside it) so it's guaranteed visible across every
            one of App.tsx's early-return states (auth-loading screen,
            onboarding flow, auth portal, the real app shell) without having
            to remember to add it to each one individually. */}
        <ToastProvider>
          <OfflineBanner />
          <App />
        </ToastProvider>
      </ErrorBoundary>
    </IconContext.Provider>
  </StrictMode>,
);
