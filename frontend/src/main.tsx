import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {AuthProvider} from './auth/AuthContext';
import {RoleRouter} from './auth/RoleRouter';
import {SvgLibraryProvider} from './assets/SvgLibraryContext';
import {AppSettingsProvider} from './settings/AppSettingsContext';
import {ComponentPreview} from './student/home/shared/ComponentPreview';
import './index.css';

// Unlinked design gallery: /?preview=learner-cards renders the real learner cards on their own,
// so a design can be checked against a reference before a page is rebuilt around it.
const previewing = new URLSearchParams(window.location.search).get('preview') === 'learner-cards';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {previewing ? <ComponentPreview /> : (
    <AuthProvider>
      <AppSettingsProvider>
        <SvgLibraryProvider>
          <RoleRouter />
        </SvgLibraryProvider>
      </AppSettingsProvider>
    </AuthProvider>
    )}
  </StrictMode>,
);
