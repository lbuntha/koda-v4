import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {MotionConfig} from 'motion/react';
import App from './App.tsx';
import { ThemeProvider } from './context/ThemeContext';
import { PwaStatus } from './components/PwaStatus';
import { blockPinchZoom } from './pwa/blockPinchZoom';
// The app's own recordings — numbers, and praise that names no subject. A skill
// registers its own on import; this belongs to no skill, so it is registered here.
import './voice/common';
import './index.css';
import './library/khmerFont';
import { syncDocumentLanguage, useT } from './lib/i18n';
import { applyCachedOverrides, refreshOverrides } from './lib/i18n/overrides';

/* Before the first render: a child can pinch the splash screen too. Never torn
   down — it lives as long as the document does. */
blockPinchZoom();

/* `<html lang dir>` follows the chosen language from the first paint, so the
   right font and the right screen-reader voice are picked before React runs. */
syncDocumentLanguage();

/* Wording corrections from the Translations page: this device's copy now, so
   the first paint is already corrected, and the server's newer set after. */
applyCachedOverrides();
void refreshOverrides();

/*
 * Repaints the whole app when the language changes.
 *
 * Most screens read their words with `translate()` during render rather than
 * each subscribing through `useT`; re-rendering from the root reaches all of
 * them in one step. Creating `<App />` here, rather than receiving it as
 * `children`, is what makes React re-render it instead of reusing the element.
 */
function LanguageRoot() {
  useT();
  return (
    <>
      <App />
      <PwaStatus />
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/*
      * Honour "reduce motion" for JavaScript animation too.
      *
      * `index.css` already stops the decorative CSS animations for anybody who
      * has asked their system to — but a `motion` component animates from
      * JavaScript and sails straight past a stylesheet rule. `reducedMotion:
      * "user"` reads the same OS setting and drops every transform and fade to
      * an instant state change, which matters more here than in most apps: the
      * audience includes children who are motion-sensitive, and the person who
      * set that preference set it once and expects it to hold everywhere.
      */}
    <MotionConfig reducedMotion="user">
      <ThemeProvider>
        <LanguageRoot />
      </ThemeProvider>
    </MotionConfig>
  </StrictMode>,
);
