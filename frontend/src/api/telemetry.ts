/**
 * Crash reporting from the browser.
 *
 * Deliberately not routed through `api.post`: that wrapper refreshes tokens and retries on
 * 401, and the boundary fires exactly when the app is broken — including when auth is what
 * broke. A plain `fetch` that swallows its own failure keeps a reporting problem from
 * becoming a second crash inside the error screen.
 */

const API_URL = (import.meta as any).env?.VITE_API_URL as string | undefined;

export interface ClientErrorReport {
  message: string;
  stack?: string;
  component_stack?: string;
  surface?: string;
  path?: string;
}

/** Returns the server's reference for this crash, or null when it could not be reported. */
export async function reportClientError(report: ClientErrorReport): Promise<string | null> {
  // Always leave a trace locally, even when there is no server to tell.
  console.error(`[koda] ${report.surface ?? "app"} crashed:`, report.message);
  if (!API_URL) return null;
  try {
    const response = await fetch(`${API_URL}/client-errors`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(report),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { reference?: string };
    return body.reference ?? null;
  } catch {
    // Reporting is best-effort; the learner already has a working recovery screen.
    return null;
  }
}
