import { ApiError, request } from "./api";

/**
 * Who this device is signed in as.
 *
 * Kept in `localStorage` on purpose: the app has to work after a week in a
 * drawer with no network, so the session cannot live only in a cookie the
 * server has to reissue. Nothing here blocks play — every call fails soft, and
 * a signed-out app is exactly the app that shipped before there was a server.
 */

const STORAGE_KEY = "koda_session_v1";
const INSTALL_KEY = "koda_install_id_v1";

/**
 * A stable id for this browser or app install, minted once and kept.
 *
 * The server uses it to recognise a machine that has signed in before, so
 * signing in again rotates the device row that already exists instead of
 * writing another. Without it a device list is a login history: one laptop
 * appears once per sign-in, and the tablet somebody actually lost is buried.
 *
 * Not a secret and not an identity — it says "this install", never "this
 * person". A cleared browser simply looks like a new machine, which is the
 * honest answer.
 */
const installId = (): string | undefined => {
  try {
    const held = localStorage.getItem(INSTALL_KEY);
    if (held) return held;
    const minted = `i_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
    localStorage.setItem(INSTALL_KEY, minted);
    return minted;
  } catch {
    // A blocked store costs this install its continuity, not its session.
    return undefined;
  }
};

const ACCOUNTS_KEY = "koda_accounts_v1";

export interface Session {
  accessToken: string;
  refreshToken: string;
  /** Epoch ms. Refreshed a minute early, so a slow request does not race it. */
  expiresAt: number;
  deviceId: string;
  /** Absent for staff — an admin belongs to no family. */
  familyId?: string | null;
  role: string;
  /** "admin" or "support" for staff, "none" for everyone else. */
  platformRole?: string;
  /** The effective set: the role, plus this person's own exceptions. */
  permissions?: string[];
  userId?: string;
  email?: string;
  displayName?: string;
  familyName?: string;
  learnerId?: string;
  learnerName?: string;
  learnerBirthYear?: number;
  avatarSeed?: string;
  /** ISO timestamp this account first existed. Drawn as "Joined August 2026". */
  joinedAt?: string;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  deviceId: string;
  familyId: string | null;
  role: string;
  platformRole?: string;
  permissions?: string[];
}

export interface EmailVerificationPending {
  verificationRequired: true;
  email: string;
  emailSent: boolean;
}

interface MeOut {
  userId: string | null;
  email: string | null;
  displayName: string | null;
  avatarSeed: string;
  familyId: string | null;
  familyName: string | null;
  role: string;
  platformRole: string;
  learnerId: string | null;
  learnerName: string | null;
  learnerBirthYear: number | null;
  permissions?: string[];
  joinedAt?: string | null;
}

const listeners = new Set<() => void>();
let current: Session | null = load();
// Access-token checks happen from several stores/components at startup. Share
// one rotation request so they cannot present the same one-time refresh token
// concurrently and revoke one another.
let refreshInFlight: Promise<Session | null> | null = null;

function load(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

/**
 * `notify: false` writes the session without waking the app.
 *
 * Used on the path to a reload. Notifying re-renders every subscriber against a
 * session this document is about to throw away, and those subscribers fetch —
 * `refreshPermissions`, `refreshMenu`, `refreshSystem`. A fetch that leaves
 * with a stale access token rotates the refresh token *on the server*, and the
 * reply lands in a document that no longer exists, so the rotation is never
 * saved. That is how a switched-to account ends up holding a refresh token the
 * server has already retired, and why switching to it went to the sign-in
 * screen. Nothing needs to repaint before a reload.
 */
function store(next: Session | null, notify: boolean = true): void {
  current = next;
  try {
    if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // A blocked store must not take the app down; the session lasts this tab.
  }
  if (notify) listeners.forEach((fn) => fn());
}

function loadAccounts(): Session[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    const parsed = raw ? (JSON.parse(raw) as Session[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveAccounts(accounts: Session[]): void {
  try {
    if (accounts.length) localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
    else localStorage.removeItem(ACCOUNTS_KEY);
  } catch {
    // Account switching is a convenience; the active session still works.
  }
}

/** Keep one switch target per real account, even if a child was opened again. */
function accountIdentity(account: Session): string {
  // Name is intentionally checked first for child sessions. Older sessions
  // were stored before learnerId was persisted, so this also merges those
  // entries with the current login instead of showing the child twice.
  if (account.role === "child" || account.learnerName) {
    if (account.learnerName) {
      return `child:${account.familyId ?? ""}:${account.learnerName.trim().toLowerCase()}`;
    }
    if (account.learnerId) return `child-id:${account.learnerId}`;
  }
  if (account.email) return `user:${account.email.trim().toLowerCase()}`;
  return `device:${account.deviceId}`;
}

function uniqueAccounts(accounts: Session[], preferred?: Session | null): Session[] {
  const result: Session[] = [];
  const seen = new Set<string>();
  const ordered = preferred
    ? [preferred, ...accounts.filter((account) => account.deviceId !== preferred.deviceId)]
    : accounts;
  for (const account of ordered) {
    const identity = accountIdentity(account);
    if (seen.has(identity)) continue;
    seen.add(identity);
    result.push(account);
  }
  return result;
}

function activate(next: Session, notify: boolean = true): void {
  const accounts = uniqueAccounts(loadAccounts(), current);
  saveAccounts(uniqueAccounts([...accounts, next], next));
  store(next, notify);
}

/** Drop a switch target the server no longer honours, and repaint the list. */
function forget(deviceId: string): void {
  saveAccounts(loadAccounts().filter((account) => account.deviceId !== deviceId));
  listeners.forEach((fn) => fn());
}

function remember(next: Session): void {
  const accounts = loadAccounts();
  saveAccounts([...accounts.filter((account) => account.deviceId !== next.deviceId), next]);
}

const fromPair = (pair: TokenPair, extra: Partial<Session> = {}): Session => ({
  accessToken: pair.accessToken,
  refreshToken: pair.refreshToken,
  expiresAt: Date.now() + pair.expiresIn * 1000,
  deviceId: pair.deviceId,
  familyId: pair.familyId,
  role: pair.role,
  platformRole: pair.platformRole ?? "none",
  permissions: pair.permissions ?? [],
  ...extra,
});

/** Refresh a minute before expiry rather than after a 401. */
const isStale = (session: Session) => session.expiresAt - Date.now() < 60_000;

/** Token rotation must be serialized across tabs, not just within this module. */
async function withRefreshLock<T>(deviceId: string, work: () => Promise<T>): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.locks?.request) {
    return navigator.locks.request(`koda-refresh:${deviceId}`, work);
  }
  return work();
}

function adoptSavedRefresh(): void {
  const saved = load();
  if (current && saved?.deviceId === current.deviceId && saved.refreshToken !== current.refreshToken) {
    current = saved;
  }
}

function isCurrentSession(session: Session): boolean {
  return current?.deviceId === session.deviceId && current.refreshToken === session.refreshToken;
}

async function performRefresh(): Promise<Session | null> {
  if (!current) return null;
  const session = current;
  try {
    const pair = await request<TokenPair>("/auth/refresh", {
      method: "POST",
      body: { refreshToken: session.refreshToken },
    });
    if (!isCurrentSession(session) || !current) return current;
    const next = fromPair(pair, {
      email: current.email,
      userId: current.userId,
      displayName: current.displayName,
      familyName: current.familyName,
      learnerId: current.learnerId,
      learnerName: current.learnerName,
      learnerBirthYear: current.learnerBirthYear,
      avatarSeed: current.avatarSeed,
      joinedAt: current.joinedAt,
    });
    store(next);
    remember(next);
    return next;
  } catch (error) {
    // Offline keeps the session — the token is stale, not wrong. So does a
    // server fault: only an outright rejection means the device was revoked.
    if (!(error instanceof ApiError) || !error.isRejected) return current;
    if (!isCurrentSession(session)) return current;
    adoptSavedRefresh();
    if (!isCurrentSession(session)) return current;
    // Same treatment `verify` gives a rejected session: an account the server
    // has disowned must leave the switch list too, or it sits there as an
    // entry whose only behaviour is to sign this device out.
    forget(current.deviceId);
    store(null);
    return null;
  }
}

/**
 * Trade a *stored* account's refresh token for a live pair.
 *
 * Deliberately separate from `performRefresh`, which only ever speaks for the
 * active session: this one must not touch `current`, because the account being
 * revived is not the account this document is running as yet.
 *
 * Offline returns the target untouched — a switch with no network is still a
 * switch, and the app works signed in without a server.
 */
async function reissue(target: Session): Promise<Session | null> {
  return withRefreshLock(target.deviceId, () => {
    const active = load();
    const saved = active?.deviceId === target.deviceId
      ? active
      : loadAccounts().find((account) => account.deviceId === target.deviceId);
    return performReissue(saved ?? target);
  });
}

async function performReissue(target: Session): Promise<Session | null> {
  if (!isStale(target)) return target;
  try {
    const pair = await request<TokenPair>("/auth/refresh", {
      method: "POST",
      body: { refreshToken: target.refreshToken },
    });
    const next = fromPair(pair, {
      email: target.email,
      userId: target.userId,
      displayName: target.displayName,
      familyName: target.familyName,
      learnerId: target.learnerId,
      learnerName: target.learnerName,
      learnerBirthYear: target.learnerBirthYear,
      avatarSeed: target.avatarSeed,
      joinedAt: target.joinedAt,
    });
    // Publish the replacement before releasing the lock for another tab.
    remember(next);
    if (load()?.deviceId === target.deviceId) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // The caller can still activate the renewed session in this tab.
      }
    }
    return next;
  } catch (error) {
    if (error instanceof ApiError && !error.isRejected) return target;
    return null;
  }
}

/**
 * Open a child again from the adult who is signed in right now.
 *
 * A child session that has gone stale is not a locked door: the parent holding
 * this device may switch to their own child at any time, which is the very
 * thing `/auth/switch` exists for. So rather than sending a parent to the
 * sign-in screen because a saved tablet session aged out, ask for a new one.
 * The server still decides — a child cannot reach another child this way.
 */
async function reopenChild(target: Session): Promise<Session | null> {
  if (!target.learnerId || !current || current.learnerId) return null;
  try {
    const token = await accessToken();
    if (!token) return null;
    const pair = await request<TokenPair>(`/auth/switch/${target.learnerId}`, {
      method: "POST",
      token,
      body: { deviceName: deviceName(), installId: installId() },
    });
    return fromPair(pair, {
      learnerId: target.learnerId,
      learnerName: target.learnerName,
      learnerBirthYear: target.learnerBirthYear,
      avatarSeed: target.avatarSeed,
    });
  } catch {
    return null;
  }
}

async function refresh(): Promise<Session | null> {
  if (refreshInFlight) return refreshInFlight;
  if (!current) return null;
  const session = current;
  refreshInFlight = withRefreshLock(session.deviceId, async () => {
    if (!isCurrentSession(session)) return current;
    adoptSavedRefresh();
    if (current !== session && current && !isStale(current)) return current;
    return performRefresh();
  }).finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

/** The token to send, refreshed first if it is about to expire. */
export async function accessToken(): Promise<string | null> {
  adoptSavedRefresh();
  if (!current) return null;
  if (!isStale(current)) return current.accessToken;
  const next = await refresh();
  return next?.accessToken ?? null;
}

/**
 * One session, updated with what `/auth/me` just said.
 *
 * Shared by the three callers that ask that question — sign-in, boot
 * verification and a profile edit — because when they each kept their own copy
 * of this mapping, a field added to `MeOut` reached whichever of them was
 * remembered and silently missed the rest.
 */
function mergeProfile(session: Session, me: MeOut): Session {
  return {
    ...session,
    userId: me.userId ?? session.userId,
    email: me.email ?? undefined,
    displayName: me.displayName ?? undefined,
    familyName: me.familyName ?? undefined,
    learnerId: me.learnerId ?? session.learnerId,
    learnerName: me.learnerName ?? session.learnerName,
    learnerBirthYear: me.learnerBirthYear ?? session.learnerBirthYear,
    avatarSeed: me.avatarSeed ?? session.avatarSeed,
    role: me.role,
    platformRole: me.platformRole,
    permissions: me.permissions ?? session.permissions,
    joinedAt: me.joinedAt ?? session.joinedAt,
  };
}

async function loadProfile(session: Session): Promise<Session> {
  try {
    const me = await request<MeOut>("/auth/me", { token: session.accessToken });
    adoptSavedRefresh();
    // A slower request from the account we just left must never overwrite the
    // account that is active now.
    if (current?.deviceId !== session.deviceId) return session;
    const next = mergeProfile(current, me);
    store(next);
    remember(next);
    return next;
  } catch {
    // The tokens are good; only the display name is missing. Not worth failing.
    return session;
  }
}

/**
 * A switch crosses a security and data boundary, so rebuild the application
 * exactly as it does after opening a freshly logged-in device. This clears
 * page-local parent/child state while the boot verifier reloads the selected
 * profile, permissions, menu and family-backed stores.
 */
function restartForAccount(): void {
  if (typeof window !== "undefined") window.location.reload();
}

/**
 * Ask the server who this device is.
 *
 * The gate in App.tsx trusts `localStorage`, and `localStorage` is typed by
 * anyone with devtools — so on every boot the stored session is put to the
 * server, and a session the server does not recognise is cleared. A forged
 * entry then buys nothing: it is gone within a second of the app loading, and
 * it never bought data anyway, because every route checks the token itself.
 *
 * Offline is the case this must not punish: a failed `fetch` leaves the session
 * exactly where it is, so a tablet that signed in last week still opens.
 */
async function verify(): Promise<boolean> {
  if (!current) return false;

  const token = await accessToken();
  if (!token) return false;
  // Renewal could not reach the server. Keep offline access and do not send
  // an expired token to /me, whose rejection would erase a recoverable login.
  if (current && isStale(current)) return true;
  const session = current;

  try {
    const me = await request<MeOut>("/auth/me", { token });
    adoptSavedRefresh();
    if (!current || current !== session) return !!current;
    const next = mergeProfile(current, me);
    store(next);
    remember(next);
    return true;
  } catch (error) {
    // Anything short of a rejection leaves the session alone — a restart or a
    // 500 must not sign a child out mid-round.
    if (!(error instanceof ApiError) || !error.isRejected) return !!current;
    adoptSavedRefresh();
    if (current !== session) return !!current;
    // The server clock or a delayed request may expire an access token even
    // when our local expiry check passed. Let the refresh endpoint decide.
    if (error.code === "token_expired" || error.code === "token_invalid") {
      return !!(await refresh());
    }
    saveAccounts(loadAccounts().filter((account) => account.deviceId !== current?.deviceId));
    store(null);
    return false;
  }
}

export const SessionAPI = {
  current: (): Session | null => current,

  accounts: (): Session[] => {
    const accounts = uniqueAccounts(loadAccounts(), current);
    saveAccounts(accounts);
    return accounts;
  },

  verify,

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  async signUp(
    email: string,
    password: string,
    familyName: string,
    accountType: "parent" | "student" = "parent",
  ): Promise<Session | EmailVerificationPending> {
    const result = await request<TokenPair | EmailVerificationPending>("/auth/signup", {
      method: "POST",
      body: { email, password, familyName, accountType, deviceName: deviceName(), installId: installId() },
    });
    if ("verificationRequired" in result) return result;
    const session = fromPair(result, { email, familyName });
    activate(session);
    return loadProfile(session);
  },

  async resendVerification(email: string): Promise<void> {
    await request("/auth/email/resend", {
      method: "POST",
      body: { email },
    });
  },

  async verifyEmail(token: string): Promise<Session> {
    const pair = await request<TokenPair>("/auth/email/verify", {
      method: "POST",
      body: { token, deviceName: deviceName(), installId: installId() },
    });
    const session = fromPair(pair);
    activate(session);
    return loadProfile(session);
  },

  async signIn(email: string, password: string): Promise<Session> {
    const pair = await request<TokenPair>("/auth/login", {
      method: "POST",
      body: { email, password, deviceName: deviceName(), installId: installId() },
    });
    const session = fromPair(pair, { email });
    activate(session);
    return loadProfile(session);
  },

  async signInWithGoogle(
    credential: string,
    createAccount: boolean,
    familyName?: string,
  ): Promise<Session> {
    const pair = await request<TokenPair>("/auth/google", {
      method: "POST",
      body: {
        credential,
        createAccount,
        familyName,
        deviceName: deviceName(),
        installId: installId(),
      },
    });
    const session = fromPair(pair);
    activate(session);
    return loadProfile(session);
  },

  async join(code: string): Promise<Session> {
    const pair = await request<TokenPair>("/auth/join", {
      method: "POST",
      body: { code: code.trim().toUpperCase(), deviceName: deviceName(), installId: installId() },
    });
    const session = fromPair(pair);
    activate(session);
    return loadProfile(session);
  },

  async switchToChild(learnerId: string, learnerName?: string): Promise<Session> {
    const token = await accessToken();
    const pair = await request<TokenPair>(`/auth/switch/${learnerId}`, {
      method: "POST",
      token,
      // The install goes with a switch as much as with a sign-in: opening a
      // child on the family tablet happens every day, and a switch that named
      // no install wrote a fresh device row each of those times.
      body: { deviceName: deviceName(), installId: installId() },
    });
    const session = fromPair(pair, { learnerId, learnerName });
    activate(session, false);
    restartForAccount();
    return session;
  },

  /**
   * Make a remembered account the one this device is using.
   *
   * The stored token pair is put to the server *before* it becomes the app's
   * session, rather than after the reload — a pair saved when the account was
   * last active may be minutes or days old, and handing an expired one to a
   * reloading page is how the rotation got lost in the first place.
   */
  /**
   * Whether leaving the current session for `target` has to pass the PIN.
   *
   * Only one direction is guarded: a child's session reaching an adult's. The
   * reverse — a parent opening their child — is the gesture `switchToChild`
   * exists for and needs no ceremony. And a family with no PIN set behaves
   * exactly as it did before this existed.
   */
  async switchNeedsPin(deviceId: string): Promise<boolean> {
    const target = SessionAPI.accounts().find((account) => account.deviceId === deviceId);
    if (!target || !current?.learnerId || target.learnerId) return false;
    try {
      const token = await accessToken();
      const state = await request<{ isSet: boolean }>("/family/pin", { token });
      return state.isSet;
    } catch {
      // Offline, or the server is unhappy. A switch is a convenience and this
      // is a speed bump, not a lock — failing it closed would strand a parent
      // on a tablet with no connection.
      return false;
    }
  },

  async switchAccount(deviceId: string, pin?: string): Promise<boolean> {
    const target = SessionAPI.accounts().find((account) => account.deviceId === deviceId);
    if (!target) return false;
    if (target.deviceId === current?.deviceId) return true;

    /*
     * A child leaving for an adult's account answers for it first.
     *
     * Worth being plain about what this is: the adult's refresh token is in the
     * same `localStorage` this session can already read, so a determined grown-up
     * with the device is not stopped and is not meant to be. It is sized to the
     * threat that actually exists — a seven-year-old tapping through a menu into
     * billing.
     */
    if (await SessionAPI.switchNeedsPin(deviceId)) {
      if (!pin) {
        throw new ApiError(401, "pin_required", "Ask a grown-up for the family PIN.");
      }
      const token = await accessToken();
      // Throws on a wrong PIN, and the rate limiter answers a run of guesses.
      await request("/family/pin/verify", { method: "POST", token, body: { pin } });
    }

    const next = (await reissue(target)) ?? (await reopenChild(target));
    if (!next) {
      forget(target.deviceId);
      throw new ApiError(
        401,
        "session_expired",
        `${target.learnerName ?? target.displayName ?? target.email ?? "That account"} has to sign in again on this device.`,
      );
    }

    activate(next, false);
    restartForAccount();
    return true;
  },

  async updateAvatar(avatarSeed: string): Promise<Session> {
    const token = await accessToken();
    if (!current || !token) throw new ApiError(401, "unauthorized", "Sign in to continue.");
    const result = await request<{ avatarSeed: string }>("/auth/me/avatar", {
      method: "PATCH",
      token,
      body: { avatarSeed },
    });
    const next = { ...current, avatarSeed: result.avatarSeed };
    store(next);
    remember(next);
    return next;
  },

  /**
   * A self-service edit of the signed-in account: name, avatar, or both.
   *
   * The reply is the whole `/auth/me` profile, not the patch, so the stored
   * session is replaced with the server's answer rather than a local guess at
   * what the write did.
   */
  async updateProfile(patch: { displayName?: string; avatarSeed?: string }): Promise<Session> {
    const token = await accessToken();
    if (!current || !token) throw new ApiError(401, "unauthorized", "Sign in to continue.");
    const me = await request<MeOut>("/auth/me", { method: "PATCH", token, body: patch });
    const next = mergeProfile(current, me);
    store(next);
    remember(next);
    return next;
  },

  async signOut(): Promise<void> {
    const token = current?.accessToken;
    const signedOutDevice = current?.deviceId;
    // Local state clears either way: a person pressing "sign out" on a plane
    // means it, and the refresh token dies with the row when it next reaches us.
    store(null);
    if (signedOutDevice) {
      saveAccounts(loadAccounts().filter((account) => account.deviceId !== signedOutDevice));
    }
    if (token) {
      try {
        await request<void>("/auth/logout", { method: "POST", token });
      } catch {
        // Nothing to tell them — they are signed out here regardless.
      }
    }
  },

  refresh,
};

function deviceName(): string {
  const ua = navigator.userAgent;
  if (/iPad|Tablet/i.test(ua)) return "Tablet";
  if (/iPhone|Android/i.test(ua)) return "Phone";
  if (/Macintosh/i.test(ua)) return "Mac";
  if (/Windows/i.test(ua)) return "Windows PC";
  return "This device";
}
