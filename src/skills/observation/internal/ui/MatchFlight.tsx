import React from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { SvgAsset } from "../../../../assets/svg";

export interface MatchFlightBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface MatchFlightState {
  key: number;
  asset: string;
  from: MatchFlightBox;
  to: MatchFlightBox;
}

interface MatchFlightProps {
  flight: MatchFlightState | null;
  motionOK: boolean;
  artClassName?: string;
  onComplete(): void;
}

/** Carries a correctly selected scene object into its matching target card. */
export const MatchFlight: React.FC<MatchFlightProps> = ({ flight, motionOK, artClassName, onComplete }) => {
  if (!flight || !motionOK || typeof document === "undefined") return null;
  const dx = flight.to.left + flight.to.width / 2 - (flight.from.left + flight.from.width / 2);
  const dy = flight.to.top + flight.to.height / 2 - (flight.from.top + flight.from.height / 2);

  return createPortal(
    <motion.div key={flight.key} aria-hidden className="pointer-events-none fixed z-[100] grid place-items-center"
      style={{ left: flight.from.left, top: flight.from.top, width: flight.from.width, height: flight.from.height }}
      initial={{ x: 0, y: 0, scale: .9, rotate: 0, opacity: 1 }}
      animate={{ x: [0, dx * .16, dx * .68, dx], y: [0, -24, dy * .56, dy], scale: [.9, 1.18, .82, .58], rotate: [0, -7, 5, 0], opacity: [1, 1, .95, 0] }}
      transition={{ duration: .74, times: [0, .2, .72, 1], ease: ["easeOut", "easeInOut", "easeIn"] }}
      onAnimationComplete={onComplete}>
      <span className="absolute inset-[-18%] rounded-full bg-emerald-200/35 blur-lg" />
      <SvgAsset id={flight.asset} size="100%" className={artClassName} />
    </motion.div>,
    document.body,
  );
};
