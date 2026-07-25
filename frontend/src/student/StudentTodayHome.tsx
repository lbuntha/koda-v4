import React from "react";
import type { GradeBand } from "../api/auth";
import { StudentHome } from "./home/StudentHome";
import { KidHome } from "./home/KidHome";
import { FocusHome } from "./home/FocusHome";
import type { StudentHomeProps } from "./home/types";

/**
 * Band router for the student home. Each grade band gets its own layout, all
 * composed from the shared `home/` skeleton.
 */
const LAYOUTS: Record<GradeBand, React.FC<StudentHomeProps>> = {
  kid: KidHome,
  student: StudentHome,
  focus: FocusHome,
};

export const StudentTodayHome: React.FC<StudentHomeProps> = props => {
  const Layout = LAYOUTS[props.band] ?? StudentHome;
  return <Layout {...props} />;
};
