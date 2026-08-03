/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Suspense boundary for lazily-loaded learning canvases and studio panels.
 * Renders a structured Progressive Canvas Skeleton while chunks load over network/server.
 */

import React, { Suspense } from "react";
import { CanvasSkeleton } from "./ui/ProgressiveSkeleton";

export interface LazyBoundaryProps {
  children: React.ReactNode;
  fallbackLabel?: string;
}

export const LazyBoundary: React.FC<LazyBoundaryProps> = ({
  children,
  fallbackLabel = "Loading interactive activity…",
}) => (
  <Suspense fallback={<CanvasSkeleton label={fallbackLabel} />}>
    {children}
  </Suspense>
);
