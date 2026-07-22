/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Technique → Property Studio panel. Derived from the single game catalog in
 * src/techniques. To add a panel, add a manifest there — this file and
 * App.tsx never need editing.
 */

import React from "react";
import { CountingTechnique } from "../../../types";
import { PanelProps } from "../panelKit";
import { ALL_TECHNIQUES, byTechnique } from "../../../techniques";

export const TECHNIQUE_PANELS: Record<CountingTechnique, React.ComponentType<PanelProps>> =
  byTechnique(ALL_TECHNIQUES, (m) => m.panel);
