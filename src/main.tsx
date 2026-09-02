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

/* Before the first render: a child can pinch the splash screen too. Never torn
   down — it lives as long as the document does. */
blockPinchZoom();

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
        <App />
        <PwaStatus />
      </ThemeProvider>
    </MotionConfig>
  </StrictMode>,
);
