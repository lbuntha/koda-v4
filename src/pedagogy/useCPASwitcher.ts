/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback } from "react";

export type CPARepresentation = "concrete" | "pictorial" | "abstract";

export interface CPASwitcherState {
  representation: CPARepresentation;
  setRepresentation: (rep: CPARepresentation) => void;
  toggleNext: () => void;
  isConcrete: boolean;
  isPictorial: boolean;
  isAbstract: boolean;
}

/**
 * Custom hook for the Concrete-Pictorial-Abstract (CPA) Representation Switcher.
 * Allows early learners and teachers to morph stage assets instantly to bridge
 * physical item counting with ten-frame arrays and abstract digits.
 */
export function useCPASwitcher(defaultRep: CPARepresentation = "concrete"): CPASwitcherState {
  const [representation, setRepresentation] = useState<CPARepresentation>(defaultRep);

  const toggleNext = useCallback(() => {
    setRepresentation((prev) => {
      if (prev === "concrete") return "pictorial";
      if (prev === "pictorial") return "abstract";
      return "concrete";
    });
  }, []);

  return {
    representation,
    setRepresentation,
    toggleNext,
    isConcrete: representation === "concrete",
    isPictorial: representation === "pictorial",
    isAbstract: representation === "abstract"
  };
}
