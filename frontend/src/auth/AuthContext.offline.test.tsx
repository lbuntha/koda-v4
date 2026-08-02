/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * What happens when a child opens an installed Koda with no network.
 *
 * The old boot path caught every failure the same way and cleared the tokens, so a launch
 * on a train signed the child out — and took the refresh token with it, meaning a real
 * sign-in was needed even once the network returned. A server that never answered says
 * nothing about whether the session is valid; only a server that answered 401 does.
 */

import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";

const me = vi.fn();

vi.mock("../api/auth", () => ({
  authApi: {
    me: (...args: unknown[]) => me(...args),
    logout: vi.fn(),
  },
}));

vi.mock("../api/client", async () => {
  const actual = await vi.importActual<typeof import("../api/client")>("../api/client");
  return { ...actual, isApiConfigured: () => true };
});

import { ApiError, OfflineError, tokenStore } from "../api/client";
import { accountKey, readCache, writeCache } from "../api/offlineCache";
import { AuthProvider, useAuth } from "./AuthContext";

const ACCOUNT = { id: "kid-1", name: "Robin", role: "student" as const };

const Probe: React.FC = () => {
  const { status, account, offlineSession } = useAuth();
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="name">{account?.name ?? "-"}</span>
      <span data-testid="offline">{String(offlineSession)}</span>
    </div>
  );
};

const renderApp = () => render(<AuthProvider><Probe /></AuthProvider>);

beforeEach(() => {
  localStorage.clear();
  me.mockReset();
  tokenStore.set("access-token", "refresh-token");
});

describe("opening the app with no network", () => {
  test("keeps the learner signed in on their cached identity", async () => {
    writeCache(accountKey(), ACCOUNT);
    me.mockRejectedValue(new OfflineError("/auth/me"));

    renderApp();

    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("authenticated"));
    expect(screen.getByTestId("name").textContent).toBe("Robin");
    expect(screen.getByTestId("offline").textContent).toBe("true");
    // The tokens are what let them sync when the network returns.
    expect(tokenStore.access).toBe("access-token");
    expect(tokenStore.refresh).toBe("refresh-token");
  });

  test("a rejected session still signs the learner out", async () => {
    writeCache(accountKey(), ACCOUNT);
    me.mockRejectedValue(new ApiError(401, "Not authenticated"));

    renderApp();

    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("anonymous"));
    expect(tokenStore.access).toBe(null);
    // A revoked session must not leave a usable copy of the account behind.
    expect(readCache(accountKey())).toBe(null);
  });

  test("with no cached identity there is nothing to restore", async () => {
    me.mockRejectedValue(new OfflineError("/auth/me"));

    renderApp();

    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("anonymous"));
  });

  test("a reachable server refreshes the cached identity", async () => {
    writeCache(accountKey(), { ...ACCOUNT, name: "Stale Name" });
    me.mockResolvedValue(ACCOUNT);

    renderApp();

    await waitFor(() => expect(screen.getByTestId("name").textContent).toBe("Robin"));
    expect(screen.getByTestId("offline").textContent).toBe("false");
    expect(readCache<typeof ACCOUNT>(accountKey())?.data.name).toBe("Robin");
  });
});
