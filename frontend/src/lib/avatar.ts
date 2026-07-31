/**
 * Avatar values are stored as a single free-form string on the account document
 * (`User.avatar` / `Student.avatar`), so whatever the picker hands back is what
 * renders later. The DiceBear categories in AvatarPicker are remote URLs; storing
 * one verbatim leaves the saved avatar dependent on api.dicebear.com being
 * reachable every time it is drawn. Inline those into a data: URL at save time so
 * a stored avatar keeps rendering offline. Everything else (koda-kid keys, emoji,
 * raw SVG markup) is already self-contained and passes through untouched.
 */
export const inlineRemoteAvatar = async (avatar: string): Promise<string> => {
  if (!avatar.startsWith("http://") && !avatar.startsWith("https://")) return avatar;
  try {
    const response = await fetch(avatar);
    if (!response.ok) return avatar;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(await response.text())}`;
  } catch (cause) {
    console.warn("Could not inline avatar SVG, storing the URL instead:", cause);
    return avatar;
  }
};
