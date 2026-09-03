import React, { useCallback, useEffect, useState } from "react";
import { Baby, BellOff, ChevronLeft, ChevronRight, Laptop, LogOut, RefreshCw } from "lucide-react";

import { ApiError, accessToken, request, usePermissions, useSession } from "../../lib/sync";
import { themeSystem } from "../../lib/themeSystem";
import { playSound } from "../../utils/audio";
import { UIBadge, UIButton, UIDialog, UISectionHeader } from "../ui";
import { NoAccess } from "./NoAccess";
import { disableNotifications } from "../../lib/push";

interface Device {
  id: string;
  name: string;
  kind: "user" | "child";
  learnerId: string | null;
  learnerName: string | null;
  lastSeenAt: string | null;
  createdAt: string | null;
  revokedAt: string | null;
  current: boolean;
  /** Whether this browser currently holds a notification token. */
  notifications: boolean;
}

interface DevicePage {
  devices: Device[];
  page: number;
  pageSize: number;
  total: number;
  pages: number;
}

/**
 * Every phone and tablet signed into this family, and the way to sign one out.
 *
 * The page this could not have been until sign-ins stopped writing a new row
 * each time: one laptop signed into a dozen times filled the list with a dozen
 * identical entries, and the tablet somebody had actually lost was buried in
 * them. A stable install id from the client is what makes a row mean a machine.
 *
 * Three things keep the list readable now that a family can still accumulate
 * rows: the server retires sessions that have aged past the refresh lifetime,
 * hands back one page at a time newest-used first, and offers the one gesture
 * that resolves a list somebody has lost track of entirely — sign the rest out
 * and let the machines still in use come back.
 *
 * A child's session sees exactly one row — their own — because the route asks
 * for it directly. They are shown it and not offered the button: signing their
 * own tablet out would take a parent and a fresh join code to undo, which is a
 * hole to fall into rather than a feature.
 */

const PAGE_SIZE = 10;

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

export interface DevicesPageProps {
  /**
   * Drawn inside another page rather than as a page of its own.
   *
   * Settings owns the heading and the gutters when this is set, so both are
   * dropped here — a second `<h1>` under the Settings title, and a second set
   * of page margins inside them, is what embedding one whole page in another
   * usually looks like.
   */
  embedded?: boolean;
}

export const DevicesPage: React.FC<DevicesPageProps> = ({ embedded = false }) => {
  const { can } = usePermissions();
  const session = useSession();
  const canList = can("device:list");
  const canRevoke = can("device:revoke");
  const isChild = Boolean(session?.learnerId);
  const [result, setResult] = useState<DevicePage | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState<Device | null>(null);
  const [signingOutRest, setSigningOutRest] = useState(false);

  const load = useCallback(async () => {
    if (!canList) return;
    setLoading(true);
    setError(null);
    try {
      const token = await accessToken();
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      setResult(await request<DevicePage>(`/devices?${params}`, { token }));
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setLoading(false);
    }
  }, [canList, page]);

  useEffect(() => void load(), [load]);

  const devices = result?.devices ?? [];
  const total = result?.total ?? 0;
  const pages = result?.pages ?? 1;

  /**
   * Stop one browser being notified, without signing it out.
   *
   * One-way on purpose. A token can only be minted by the browser that holds
   * the permission, so there is no "turn it back on from here" to offer — the
   * row says where to do it instead of drawing a switch that would do nothing.
   *
   * The device you are holding is the exception, and takes the normal path:
   * that one also has a token remembered in this browser's own storage, and
   * deleting the row without clearing it would leave the Settings switch
   * reading "on" and the next launch quietly registering again.
   */
  const silence = async (device: Device) => {
    setBusy(device.id);
    setError(null);
    try {
      if (device.current) {
        await disableNotifications();
      } else {
        const token = await accessToken();
        await request(`/devices/${device.id}/notifications`, { method: "DELETE", token });
      }
      setNotice(
        device.current
          ? "This device will not be notified any more."
          : `${device.name} will not be notified any more.`,
      );
      playSound("pop");
      await load();
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setBusy(null);
    }
  };

  const revoke = async (device: Device) => {
    setBusy(device.id);
    setError(null);
    try {
      const token = await accessToken();
      await request(`/devices/${device.id}`, { method: "DELETE", token });
      setNotice(`${device.learnerName ?? device.name} was signed out.`);
      playSound("pop");
      // Reloaded rather than spliced out of the list held here: a row leaving
      // pulls one up from the next page, and a page that quietly shrinks by
      // one every time is how a list stops matching the count above it. The
      // last page emptying is the one case that has to move the cursor.
      if (devices.length === 1 && page > 1) setPage((value) => value - 1);
      else await load();
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setBusy(null);
      setSigningOut(null);
    }
  };

  const revokeRest = async () => {
    setBusy("rest");
    setError(null);
    try {
      const token = await accessToken();
      const { signedOut } = await request<{ signedOut: number }>("/devices", {
        method: "DELETE",
        token,
      });
      setNotice(
        signedOut === 0
          ? "Nothing else was signed in."
          : `${signedOut} ${signedOut === 1 ? "session was" : "sessions were"} signed out.`,
      );
      playSound("pop");
      if (page === 1) await load();
      else setPage(1);
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setBusy(null);
      setSigningOutRest(false);
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
    <div className={embedded ? "" : "min-h-full bg-white p-4 dark:bg-canvas md:p-8"}>
      <div className={embedded ? "space-y-5" : "mx-auto max-w-4xl space-y-5"}>
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            {embedded ? (
              <h2 className={themeSystem.list.groupLabel}>Devices</h2>
            ) : (
              <h1 className="koda-admin-page-title">Devices</h1>
            )}
            <p className="mt-1 text-sm text-[#6D6997] dark:text-muted">
              Everything signed into this family. Sign out anything lost, or in the wrong
              hands.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {canRevoke && !isChild && total > 1 && (
              <UIButton
                variant="secondary"
                size="sm"
                icon={<LogOut />}
                isLoading={busy === "rest"}
                onClick={() => setSigningOutRest(true)}
              >
                Sign out the rest
              </UIButton>
            )}
            <UIButton
              variant="secondary"
              size="sm"
              icon={<RefreshCw />}
              onClick={() => void load()}
            >
              Refresh
            </UIButton>
          </div>
        </header>

        {error && <p className={themeSystem.flash("error")}>{error}</p>}
        {notice && <p className={themeSystem.flash("success")}>{notice}</p>}

        <section className={themeSystem.card("default", `${themeSystem.spacing.card} space-y-4`)}>
          <UISectionHeader
            title="Signed in"
            subtitle={
              loading
                ? "Reading…"
                : `${total} ${total === 1 ? "device" : "devices"}${
                    pages > 1 ? ` · page ${result?.page ?? page} of ${pages}` : ""
                  }`
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
                      {device.notifications && (
                        <UIButton
                          variant="secondary"
                          size="sm"
                          icon={<BellOff />}
                          isLoading={busy === device.id}
                          onClick={() => void silence(device)}
                        >
                          Notifications on
                        </UIButton>
                      )}
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

          {pages > 1 && (
            <div className="flex flex-col gap-2 border-t border-line pt-3 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
              <span>
                {total} devices · page {result?.page ?? page} of {pages}
              </span>
              <div className="flex items-center gap-2">
                <UIButton
                  variant="secondary"
                  size="sm"
                  icon={<ChevronLeft />}
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((value) => value - 1)}
                >
                  Previous
                </UIButton>
                <UIButton
                  variant="secondary"
                  size="sm"
                  iconRight={<ChevronRight />}
                  disabled={page >= pages || loading}
                  onClick={() => setPage((value) => value + 1)}
                >
                  Next
                </UIButton>
              </div>
            </div>
          )}
        </section>

        <p className="text-xs text-muted">
          Each row is one browser or app. Signing out ends that session at once — getting back
          in needs the password, or a new child code. Unused devices sign out on their own.
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

      <UIDialog
        isOpen={signingOutRest}
        onClose={() => setSigningOutRest(false)}
        title="Sign out every other device?"
        description={`Everything except the one you are using now will be signed out straight away — ${
          total - 1
        } ${total - 1 === 1 ? "session" : "sessions"}. Each will need to sign in again, and a child's tablet will need a fresh join code.`}
        confirmText="Sign them out"
        variant="danger"
        onConfirm={() => void revokeRest()}
      />
    </div>
  );
};
