import React, { createContext, useContext, useMemo } from "react";

/**
 * Who the canvas is drawing for.
 *
 * Twenty-six canvases share `SharedCanvasLayout`, so threading a `learnerMode` prop through
 * every one of them to change two lines of chrome would be twenty-six edits for a decision
 * none of those components make. The launcher already knows the audience; this carries it
 * down without touching anything in between.
 *
 * Default is `false` — the studio, the designer and any canvas rendered outside a launcher
 * keep the full authoring presentation, which is what those surfaces want.
 */
export interface CanvasAudience {
  /** A child is looking at this, not an adult authoring it. */
  learnerMode: boolean;
}

const CanvasAudienceContext = createContext<CanvasAudience>({ learnerMode: false });

export const CanvasAudienceProvider: React.FC<{
  learnerMode: boolean;
  children: React.ReactNode;
}> = ({ learnerMode, children }) => {
  const value = useMemo(() => ({ learnerMode }), [learnerMode]);
  return (
    <CanvasAudienceContext.Provider value={value}>{children}</CanvasAudienceContext.Provider>
  );
};

export function useCanvasAudience(): CanvasAudience {
  return useContext(CanvasAudienceContext);
}
