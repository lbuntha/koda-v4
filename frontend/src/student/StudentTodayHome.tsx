import React from "react";
import type { GradeBand } from "../api/auth";
import { StudentHome } from "./home/StudentHome";
import type { StudentHomeProps } from "./home/types";

/**
 * Band router for the student home. Each grade band gets its own layout, all
 * composed from the shared `home/` skeleton. Kid (playful, 1–6) and Focus
 * (professional, 10–12) fall back to the Student baseline until phases 4–5.
 */
const LAYOUTS: Record<GradeBand, React.FC<StudentHomeProps>> = {
  kid: StudentHome,
  student: StudentHome,
  focus: StudentHome,
};

export const StudentTodayHome: React.FC<StudentHomeProps> = props => {
  const Layout = LAYOUTS[props.band] ?? StudentHome;
  return <Layout {...props} />;
};
