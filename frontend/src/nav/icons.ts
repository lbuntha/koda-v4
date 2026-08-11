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
  BookOpen,
  Sparkles,
  Circle,
} from "lucide-react";
import type { ElementType } from "react";
import React from "react";
import { SvgLibraryAsset } from "../assets/SvgLibraryAsset";

export const SVG_ICON_PREFIX = "svg:";

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
  BookOpen,
  Sparkles,
};

/** Icon names offered when designing a menu. */
export const ICON_NAMES = Object.keys(ICON_MAP);

export const FallbackIcon = Circle;

export const resolveIcon = (name: string): ElementType => {
  if (name.startsWith(SVG_ICON_PREFIX)) {
    const assetId = name.slice(SVG_ICON_PREFIX.length);
    const LibraryIcon: React.FC<{ size?: number; className?: string }> = ({ size = 18, className }) =>
      React.createElement(SvgLibraryAsset, {
        assetId,
        size,
        className,
        fallback: React.createElement(FallbackIcon, { size, className }),
      });
    LibraryIcon.displayName = `SvgMenuIcon(${assetId})`;
    return LibraryIcon;
  }
  return ICON_MAP[name] ?? FallbackIcon;
};
