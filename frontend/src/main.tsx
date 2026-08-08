import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {AuthProvider} from './auth/AuthContext';
import {RoleRouter} from './auth/RoleRouter';
import {SvgLibraryProvider} from './assets/SvgLibraryContext';
import {GoodsAssetLibrary} from './assets/goods-sort/GoodsAssetLibrary';
import {AppSettingsProvider} from './settings/AppSettingsContext';
import {PwaPrompts} from './pwa/PwaPrompts';
import {ComponentPreview} from './student/home/shared/ComponentPreview';
import {GoodsSortPreview} from './components/canvases/GoodsSortPreview';
import {CountCratesPreview} from './components/canvases/CountCratesPreview';
import {CountLadderPreview} from './components/canvases/CountLadderPreview';
import {PuzzleKitSandbox} from './puzzles/PuzzleKitSandbox';
import './index.css';

// Zoom is held still inside an activity only — see `useZoomLock`, applied to the
// GameLauncher surface. Registering the same handlers here took ⌘/Ctrl-scroll zoom away
// from the parent, admin and studio screens too, which adults need on a laptop.

// Unlinked design gallery: /?preview=learner-cards renders the real learner cards on their own,
// so a design can be checked against a reference before a page is rebuilt around it.
//
// Development only. `import.meta.env.DEV` is statically false in a production build, so the
// branch and the gallery it imports are dropped by the bundler rather than merely hidden —
// a query string cannot reach it on a deployment.
// `?preview=goods-sort` does the same for the Goods Sort ladder: the real canvas, all
// thirty levels, no sign-in — the only practical way to watch its motion frame by frame.
// `?preview=puzzle-kit` is the bench for the shared puzzle engine — two puzzles built on
// it, plus the certification report that proves every generated level can be finished.
const preview =
  Boolean((import.meta as any).env?.DEV)
    ? new URLSearchParams(window.location.search).get('preview')
    : null;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {preview === 'learner-cards' ? <ComponentPreview /> : preview === 'goods-sort' ? <GoodsSortPreview /> : preview === 'count-crates' ? <CountCratesPreview /> : preview === 'count-ladder' ? <CountLadderPreview /> : preview === 'puzzle-kit' ? <PuzzleKitSandbox /> : (
    <AuthProvider>
      <AppSettingsProvider>
        <SvgLibraryProvider>
          {/* The zero-size sprite sheet behind every `goods:` asset id. Mounted once here
              rather than per canvas, because any activity may now draw that artwork —
              see `assetCatalog.ts`. */}
          <GoodsAssetLibrary />
          <RoleRouter />
          {/* Service worker registration + update/install/offline notices. Mounted outside
              the role screens so it survives every role switch. */}
          <PwaPrompts />
        </SvgLibraryProvider>
      </AppSettingsProvider>
    </AuthProvider>
    )}
  </StrictMode>,
);
