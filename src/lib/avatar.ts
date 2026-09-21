/** DiceBear's CC0 Thumbs style, addressed by the opaque seed stored in MongoDB. */
export function diceBearAvatar(seed: string): string {
  return `https://api.dicebear.com/10.x/thumbs/svg?seed=${encodeURIComponent(seed)}`;
}

const ART_AVATAR_PREFIX = "art:";

/** Persist an Art-library avatar in the existing avatarSeed field. */
export function artAvatarSeed(assetId: string): string {
  return `${ART_AVATAR_PREFIX}${assetId}`;
}

/** Return the Art asset id encoded in a saved avatar seed, if there is one. */
export function artAvatarId(seed?: string): string | undefined {
  if (!seed?.startsWith(ART_AVATAR_PREFIX)) return undefined;
  const id = seed.slice(ART_AVATAR_PREFIX.length).trim();
  return id || undefined;
}

/** A non-identifying seed suitable for persisting as a user's avatar choice. */
export function newAvatarSeed(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `a_${crypto.randomUUID().replaceAll("-", "")}`;
  }
  return `a_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}
