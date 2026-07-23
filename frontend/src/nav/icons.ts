/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Maps icon names stored in the DB (menus.icon) to lucide components. When you
 * seed a menu with a new icon name, add it here.
 */

import {
  LayoutDashboard,
  Users,
  Baby,
  Heart,
  GraduationCap,
  Gamepad2,
  Settings,
  BarChart3,
  SlidersHorizontal,
  ListTree,
  FileText,
  Folder,
  Bell,
  Palette,
  PenTool,
  ClipboardList,
  Circle,
} from "lucide-react";
import type { ElementType } from "react";

export const ICON_MAP: Record<string, ElementType> = {
  LayoutDashboard,
  Users,
  Baby,
  Heart,
  GraduationCap,
  Gamepad2,
  Settings,
  BarChart3,
  SlidersHorizontal,
  ListTree,
  FileText,
  Folder,
  Bell,
  Palette,
  PenTool,
  ClipboardList,
};

/** Icon names offered when designing a menu. */
export const ICON_NAMES = Object.keys(ICON_MAP);

export const FallbackIcon = Circle;

export const resolveIcon = (name: string): ElementType => ICON_MAP[name] ?? FallbackIcon;
