import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {AuthProvider} from './auth/AuthContext';
import {RoleRouter} from './auth/RoleRouter';
import {SvgLibraryProvider} from './assets/SvgLibraryContext';
import {AppSettingsProvider} from './settings/AppSettingsContext';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <AppSettingsProvider>
        <SvgLibraryProvider>
          <RoleRouter />
        </SvgLibraryProvider>
      </AppSettingsProvider>
    </AuthProvider>
  </StrictMode>,
);
