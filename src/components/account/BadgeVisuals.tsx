import React from "react";
import { Award } from "lucide-react";

import { SvgAsset, useArtCategory } from "../../assets/svg";
import { BADGE_METRICS, type BadgeRule } from "../../lib/badges";
import { sidebarIcons } from "../ui/sidebarIcons";

/**
 * How a badge looks, shared by the page that defines one and the pages that
 * print it.
 *
 * Its own file so a child opening their profile does not load the editor — the
 * modal, the picker and the delete confirmations are for the one adult who sets
 * these, not for everyone who has earned one.
 */

/**
 * The built-in pictures, for a family that has drawn none of their own.
 *
 * Six rather than the whole lucide set: these are the ones that read as an
 * award at twenty pixels, and a picker with fifteen hundred entries is a
 * decision nobody wants to make about a badge called "First Steps".
 */
export const BADGE_ICONS = ["award", "star", "flame", "trophy", "zap", "sparkles"] as const;

/** The collection a family's own badge artwork lives in on the Art page. */
export const BADGE_ART_CATEGORY = "badges";

/**
 * Marks an icon as artwork rather than one of the six built-ins.
 *
 * Stored in the rule, so `art:gold-medal` says what it is wherever the document
 * is read. The alternative — looking every icon up in the art library first and
 * falling back to lucide — would let a family's asset named `star` silently
 * shadow the built-in, or fail to, depending on which loaded first.
 */
export const ART_PREFIX = "art:";

export const artIdOf = (icon: string): string | null =>
  icon.startsWith(ART_PREFIX) ? icon.slice(ART_PREFIX.length) : null;

/**
 * A badge's picture: the family's own artwork, or one of the built-in six.
 *
 * `SvgAsset` already resolves an id against the family's library, then the
 * deployment's shared one, then the bundle — so artwork drawn for a badge and
 * artwork shipped with Koda are drawn by the same path, and a family replacing
 * a picture needs no release.
 */
export const BadgeIcon: React.FC<{ icon: string; size?: number; className?: string }> = ({
  icon,
  size = 20,
  className,
}) => {
  const art = artIdOf(icon);
  if (art) {
    return (
      <SvgAsset
        id={art}
        size={size}
        // An asset deleted out from under a rule still has to draw as
        // something, and a generic award says "badge" better than a gap does.
        fallback={<Award className={className ?? "h-5 w-5"} />}
      />
    );
  }

  const Icon =
    (sidebarIcons as Record<string, React.ComponentType<{ className?: string }>>)[icon] ?? Award;
  return <Icon className={className ?? "h-5 w-5"} />;
};

/** What a rule reads as in a sentence: "7 days" rather than "streak: 7". */
export const badgeRequirement = (rule: BadgeRule): string => {
  const metric = BADGE_METRICS.find((entry) => entry.id === rule.metric);
  return `${rule.threshold} ${metric?.unit ?? ""}`.trim();
};

/**
 * Every piece of artwork a family has filed under `badges`, ready to pick.
 *
 * All three libraries, in the order `SvgAsset` resolves them, deduped by id so
 * a family asset overriding a shared one is offered once. Empty is a normal
 * state — it means nobody has drawn any yet, and the picker says so rather than
 * pretending the feature is missing.
 */
export const useBadgeArt = (): string[] => useArtCategory(BADGE_ART_CATEGORY);
