/** DiceBear's CC0 Thumbs style, addressed by the opaque seed stored in MongoDB. */
export function diceBearAvatar(seed: string): string {
  return `https://api.dicebear.com/10.x/thumbs/svg?seed=${encodeURIComponent(seed)}`;
}

/** A non-identifying seed suitable for persisting as a user's avatar choice. */
export function newAvatarSeed(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `a_${crypto.randomUUID().replaceAll("-", "")}`;
  }
  return `a_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}
