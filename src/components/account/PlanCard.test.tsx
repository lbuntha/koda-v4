import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { Billing, FREE_ENTITLEMENTS, type Plan } from "../../lib/billing";
import { PlanCard } from "./PlanCard";

vi.mock("../../lib/useBilling", async () => {
  const { FREE_ENTITLEMENTS: freePlan } = await import("../../lib/billing");
  return { useBilling: () => ({ ...freePlan, has: () => false }) };
});
vi.mock("../../lib/sync", () => ({ usePermissions: () => ({ can: () => true }) }));
vi.mock("../../utils/audio", () => ({ playSound: () => {} }));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const family: Plan = {
  planId: "family",
  name: "Family",
  description: "All lessons and Ask Koda",
  learnerLimit: 3,
  priceCents: 500,
  currency: "USD",
  features: ["ai.koda", "course.premium"],
  order: 20,
};

it("reviews the selected price and submits an upgrade request without collecting payment", async () => {
  vi.spyOn(Billing, "sandboxCheckout").mockResolvedValue({ available: false, checkout: null });
  vi.spyOn(Billing, "upgradeRequest").mockResolvedValue(null);
  vi.spyOn(Billing, "plans").mockResolvedValue([
    { ...FREE_ENTITLEMENTS, name: "Free", order: 10 },
    family,
    { ...family, planId: "plus", name: "Family Plus", priceCents: 750, order: 30 },
  ]);
  const request = vi.spyOn(Billing, "requestUpgrade").mockResolvedValue({
    planId: "plus",
    planName: "Family Plus",
    requestedAt: "2026-11-26T00:00:00Z",
  });
  render(<PlanCard />);
  fireEvent.click(screen.getByRole("button", { name: "Upgrade" }));

  const review = within(await screen.findByRole("dialog", { name: "Review your upgrade" }));
  expect(await review.findByText("US$5")).toBeTruthy();
  expect(review.getByRole("heading", { name: "No charge today" })).toBeTruthy();
  expect(review.getByText("ABA PayWay · KHQR")).toBeTruthy();
  expect(review.getByText("Coming soon")).toBeTruthy();
  expect(review.getByText(/No automatic renewal/)).toBeTruthy();
  fireEvent.click(review.getByRole("radio", { name: /Family Plus/ }));
  expect(review.getByText("US$7.50")).toBeTruthy();

  fireEvent.click(review.getByRole("button", { name: "Send upgrade request" }));
  expect(await screen.findByText(/Request received for Family Plus. No payment was taken/)).toBeTruthy();
  expect(request).toHaveBeenCalledExactlyOnceWith("plus");
});

it("starts the sandbox checkout and refreshes billing only after verification", async () => {
  const checkout = {
    reference: "test-reference",
    planName: "Family",
    amountCents: 500,
    currency: "USD",
    expiresAt: "2099-11-26T00:00:00Z",
    status: "pending" as const,
    qrImage: "data:image/png;base64,abcd",
    deepLink: null,
  };
  vi.spyOn(Billing, "upgradeRequest").mockResolvedValue(null);
  vi.spyOn(Billing, "plans").mockResolvedValue([family]);
  vi.spyOn(Billing, "sandboxCheckout").mockResolvedValue({ available: true, checkout: null });
  const start = vi.spyOn(Billing, "startSandboxCheckout").mockResolvedValue(checkout);
  const check = vi.spyOn(Billing, "checkSandboxCheckout").mockResolvedValue({ ...checkout, status: "paid" });
  const refresh = vi.spyOn(Billing, "refresh").mockResolvedValue(FREE_ENTITLEMENTS);
  const confirmed = vi.fn();

  render(<PlanCard onPaymentConfirmed={confirmed} />);
  fireEvent.click(screen.getByRole("button", { name: "Upgrade" }));
  fireEvent.click(await screen.findByRole("button", { name: "Show KHQR test code" }));
  expect(await screen.findByRole("img", { name: "ABA PayWay sandbox KHQR payment code" })).toBeTruthy();
  expect(start).toHaveBeenCalledWith("family");
  expect(refresh).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Check payment" }));
  expect(await screen.findByText("Test payment confirmed. Your plan has been updated.")).toBeTruthy();
  expect(check).toHaveBeenCalledWith(checkout.reference);
  expect(refresh).toHaveBeenCalledOnce();
  expect(confirmed).toHaveBeenCalledOnce();
});
