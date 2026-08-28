import React, { useCallback, useEffect, useState } from "react";
import { Baby, Laptop, LogOut, RefreshCw } from "lucide-react";

import { ApiError, accessToken, request, usePermissions, useSession } from "../../lib/sync";
import { themeSystem } from "../../lib/themeSystem";
import { playSound } from "../../utils/audio";
import { UIBadge, UIButton, UIDialog, UISectionHeader } from "../ui";
import { NoAccess } from "./NoAccess";

interface Device {
  id: string;
  name: string;
  kind: "user" | "child";
  learnerId: string | null;
  learnerName: string | null;
  lastSeenAt: string | null;
  revokedAt: string | null;
  current: boolean;
}

/**
 * Every phone and tablet signed into this family, and the way to sign one out.
 *
 * The page this could not have been until sign-ins stopped writing a new row
 * each time: one laptop signed into a dozen times filled the list with a dozen
 * identical entries, and the tablet somebody had actually lost was buried in
 * them. A stable install id from the client is what makes a row mean a machine.
 *
 * A child's session sees exactly one row — their own — because the route filters
 * to it. They are shown it and not offered the button: signing their own tablet
 * out would take a parent and a fresh join code to undo, which is a hole to fall
 * into rather than a feature.
 */

const whenSeen = (iso: string | null): string => {
  if (!iso) return "never";
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "never";
  const mins = Math.floor((Date.now() - then.getTime()) / 60_000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins} minutes ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} ${days === 1 ? "day" : "days"} ago`;
  return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" }).format(then);
};

export const DevicesPage: React.FC = () => {
  const { can } = usePermissions();
  const session = useSession();
  const canList = can("device:list");
  const canRevoke = can("device:revoke");
  const isChild = Boolean(session?.learnerId);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState<Device | null>(null);

  const load = useCallback(async () => {
    if (!canList) return;
    setLoading(true);
    setError(null);
    try {
      const token = await accessToken();
      const response = await request<{ devices: Device[] }>("/devices", { token });
      // Revoked rows are history, not devices. Keeping them would put the list
      // back where it started: mostly dead entries.
      setDevices(response.devices.filter((device) => !device.revokedAt));
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setLoading(false);
    }
  }, [canList]);

  useEffect(() => void load(), [load]);

  const revoke = async (device: Device) => {
    setBusy(device.id);
    setError(null);
    try {
      const token = await accessToken();
      await request(`/devices/${device.id}`, { method: "DELETE", token });
      setDevices((current) => current.filter((item) => item.id !== device.id));
      setNotice(`${device.learnerName ?? device.name} was signed out.`);
      playSound("pop");
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setBusy(null);
      setSigningOut(null);
    }
  };

  if (!canList) {
    return (
      <NoAccess
        title="Devices"
        permission="device:list"
        what="Only family members with device access can see what is signed in."
      />
    );
  }

  return (
    <div className="min-h-full bg-white p-4 dark:bg-canvas md:p-8">
      <div className="mx-auto max-w-4xl space-y-5">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="koda-admin-page-title">Devices</h1>
            <p className="mt-1 text-sm text-[#6D6997] dark:text-muted">
              Everything signed into this family. Sign one out if it is lost, or if somebody
              should no longer have it.
            </p>
          </div>
          <UIButton variant="secondary" size="sm" icon={<RefreshCw />} onClick={() => void load()}>
            Refresh
          </UIButton>
        </header>

        {error && <p className={themeSystem.flash("error")}>{error}</p>}
        {notice && <p className={themeSystem.flash("success")}>{notice}</p>}

        <section className={themeSystem.card("default", `${themeSystem.spacing.card} space-y-4`)}>
          <UISectionHeader
            title="Signed in"
            subtitle={
              loading
                ? "Reading…"
                : `${devices.length} ${devices.length === 1 ? "device" : "devices"}`
            }
            icon={<Laptop className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}
          />

          {loading ? (
            <p className="text-sm text-muted">Loading devices…</p>
          ) : devices.length === 0 ? (
            <p className="text-sm text-muted">Nothing is signed in, which should not be possible
              from a page you are reading. Try refreshing.</p>
          ) : (
            <ul className="space-y-2">
              {devices.map((device) => {
                // A child may see their own tablet and must not be able to
                // strand it: getting back in needs a parent and a new code.
                const mayRevoke = canRevoke && !(isChild && device.current);

                return (
                  <li
                    key={device.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface-muted p-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-surface text-indigo-500">
                        {device.kind === "child" ? (
                          <Baby className="h-5 w-5" />
                        ) : (
                          <Laptop className="h-5 w-5" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-mono text-sm font-bold text-ink">
                          {device.learnerName ? `${device.learnerName}'s device` : device.name}
                        </p>
                        <p className="text-xs text-muted">
                          {device.kind === "child" ? "Child tablet" : "Grown-up sign-in"} · last
                          used {whenSeen(device.lastSeenAt)}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {device.current && <UIBadge variant="success">This one</UIBadge>}
                      {mayRevoke && (
                        <UIButton
                          variant={device.current ? "secondary" : "danger"}
                          size="sm"
                          icon={<LogOut />}
                          isLoading={busy === device.id}
                          onClick={() => setSigningOut(device)}
                        >
                          Sign out
                        </UIButton>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <p className="text-xs text-muted">
          A device listed here is one install — a browser or an app — not one sign-in. Signing one
          out ends its session immediately; getting back in needs the password, or a fresh child
          code for a tablet.
        </p>
      </div>

      <UIDialog
        isOpen={Boolean(signingOut)}
        onClose={() => setSigningOut(null)}
        title={signingOut?.current ? "Sign out this device?" : "Sign out that device?"}
        description={
          signingOut?.current
            ? "You are using this one. You will be returned to the sign-in screen."
            : `${signingOut?.learnerName ?? signingOut?.name} will be signed out straight away, and will need to sign in again.`
        }
        confirmText="Sign out"
        variant="danger"
        onConfirm={() => {
          if (signingOut) void revoke(signingOut);
        }}
      />
    </div>
  );
};
