/** Resolves true only if `promise` fulfils before `ms`; never throws. */
function settledWithin(promise: Promise<void> | undefined, ms: number): Promise<boolean> {
  if (!promise) return Promise.resolve(false);
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), ms);
    promise.then(
      () => {
        clearTimeout(timer);
        resolve(true);
      },
      () => {
        clearTimeout(timer);
        resolve(false);
      },
    );
  });
}

/** Pre-Clipboard-API copy: a hidden textarea, selected and copied. */
function legacyCopy(text: string): boolean {
  try {
    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.style.cssText = "position:fixed;top:-1000px;opacity:0";
    document.body.appendChild(field);
    field.select();
    const ok = document.execCommand("copy");
    field.remove();
    return ok;
  } catch {
    return false;
  }
}

/**
 * Copy text, and say honestly whether it worked.
 *
 * The async clipboard needs a focused document and a permission the browser can
 * refuse — and while it waits on that decision it neither resolves nor rejects,
 * which would leave the caller with no feedback at all. So it gets a deadline,
 * then the old selection-based copy, which needs neither.
 */
export async function copyText(text: string): Promise<boolean> {
  let ok = await settledWithin(navigator.clipboard?.writeText(text), 500);
  if (!ok) ok = legacyCopy(text);
  return ok;
}
