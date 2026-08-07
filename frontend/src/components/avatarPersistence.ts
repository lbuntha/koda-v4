/** Freeze a remote avatar as inline SVG data so it remains available offline. */
export const persistableAvatar = async (avatar: string): Promise<string> => {
  if (!avatar.startsWith("http://") && !avatar.startsWith("https://")) return avatar;
  try {
    const response = await fetch(avatar);
    if (!response.ok) return avatar;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(await response.text())}`;
  } catch {
    return avatar;
  }
};
