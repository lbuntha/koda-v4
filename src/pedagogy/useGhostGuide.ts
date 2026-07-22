/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, useRef } from "react";

export interface UseGhostGuideProps {
  isPlayMode: boolean;
  isSolved: boolean;
  idleThresholdMs?: number;
  maxErrors?: number;
  /**
   * How long the hint stays on screen once shown, in ms. After this it hides
   * itself even if the student does nothing, so a guide can never sit there
   * permanently covering the activity (e.g. the Sudoku board overlay). `0`
   * keeps the old behaviour of staying until the next activity.
   */
  autoHideMs?: number;
}

export interface GhostGuideState {
  showGhostGuide: boolean;
  errorCount: number;
  triggerError: () => void;
  reportActivity: () => void;
  resetGuide: () => void;
}

/**
 * Custom hook for the Scaffolded Ghost Guide (Smart Hint System).
 * Tracks student inactivity and placement errors to reveal subtle, non-intrusive
 * visual hints inside the Stage Arena without doing the math for the student.
 */
export function useGhostGuide({
  isPlayMode,
  isSolved,
  idleThresholdMs = 10000,
  maxErrors = 2,
  autoHideMs = 4000
}: UseGhostGuideProps): GhostGuideState {
  const [showGhostGuide, setShowGhostGuide] = useState<boolean>(false);
  const [errorCount, setErrorCount] = useState<number>(0);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);

  const clearTimer = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  // Once shown, the guide fades on its own after autoHideMs — it is a nudge,
  // not a permanent banner, and on some canvases it overlaps the play area.
  const armAutoHide = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (autoHideMs <= 0) return;
    hideTimerRef.current = setTimeout(() => setShowGhostGuide(false), autoHideMs);
  }, [autoHideMs]);

  const startIdleTimer = useCallback(() => {
    clearTimer();
    if (!isPlayMode || isSolved) {
      setShowGhostGuide(false);
      return;
    }

    idleTimerRef.current = setTimeout(() => {
      setShowGhostGuide(true);
      armAutoHide();
    }, idleThresholdMs);
  }, [clearTimer, isPlayMode, isSolved, idleThresholdMs, armAutoHide]);

  const reportActivity = useCallback(() => {
    if (showGhostGuide && errorCount < maxErrors) {
      setShowGhostGuide(false);
    }
    startIdleTimer();
  }, [showGhostGuide, errorCount, maxErrors, startIdleTimer]);

  const triggerError = useCallback(() => {
    setErrorCount((prev) => {
      const next = prev + 1;
      if (next >= maxErrors) {
        setShowGhostGuide(true);
        armAutoHide();
      }
      return next;
    });
    startIdleTimer();
  }, [maxErrors, startIdleTimer, armAutoHide]);

  const resetGuide = useCallback(() => {
    setShowGhostGuide(false);
    setErrorCount(0);
    startIdleTimer();
  }, [startIdleTimer]);

  // Handle mode or solved changes
  useEffect(() => {
    if (!isPlayMode || isSolved) {
      clearTimer();
      setShowGhostGuide(false);
      setErrorCount(0);
    } else {
      startIdleTimer();
    }
    return () => {
      clearTimer();
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [isPlayMode, isSolved, startIdleTimer, clearTimer]);

  return {
    showGhostGuide,
    errorCount,
    triggerError,
    reportActivity,
    resetGuide
  };
}
