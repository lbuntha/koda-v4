/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Suspense wrapper for the lazily-loaded canvases and studio panels (see
 * src/techniques/*). Each game's code is fetched only when it's first opened;
 * this shows a stable, centered placeholder for the brief moment a chunk loads
 * so the studio and gameplay never flash blank.
 */

import React, { Suspense } from "react";

export const LazyBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Suspense
    fallback={
      <div className="w-full h-full min-h-[120px] flex items-center justify-center text-slate-400 text-sm font-mono animate-pulse">
        Loading…
      </div>
    }
  >
    {children}
  </Suspense>
);
