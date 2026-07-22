/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Same load/save idiom App.tsx already hand-rolls for `questions`
 * (mount-time `localStorage.getItem` → `JSON.parse` in try/catch → state or
 * fallback; a setter that writes through on every change) — factored into
 * one hook instead of copy-pasted per entity.
 *
 * This file is the entire seam a real backend replaces later: swap the two
 * `localStorage` calls below for `fetch`s and every consumer (curriculum
 * tree, student roster, anything else built on this hook) keeps working
 * unchanged.
 */

import { useState, useEffect, useRef } from "react";

export function useLocalStorageState<T>(
  key: string,
  fallback: T | (() => T)
): [T, (next: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw) as T;
    } catch (err) {
      console.warn(`Failed to load "${key}" from localStorage:`, err);
    }
    return typeof fallback === "function" ? (fallback as () => T)() : fallback;
  });

  // Avoids writing the initial (possibly-fallback) value back over whatever
  // was already in storage before the first render's effect runs.
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch (err) {
      console.warn(`Failed to save "${key}" to localStorage:`, err);
    }
  }, [key, state]);

  return [state, setState];
}
