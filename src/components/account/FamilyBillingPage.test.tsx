import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { Billing } from "../../lib/billing";
import { FamilyBillingPage } from "./FamilyBillingPage";

vi.mock("./PlanCard", () => ({ PlanCard: () => <button type="button">Upgrade</button> }));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("shows a confirmed payment and lets parents browse older payments", async () => {
  const history = vi.spyOn(Billing, "paymentHistory")
    .mockResolvedValueOnce({
      payments: [{
        reference: "ABA-123",
        planName: "Family",
        amountCents: 500,
        currency: "USD",
        paidAt: "2026-11-26T09:15:00Z",
        status: "paid",
      }],
      hasMore: true,
    })
    .mockResolvedValueOnce({ payments: [], hasMore: false });

  render(<FamilyBillingPage />);
  expect(screen.getByRole("button", { name: "Upgrade" })).toBeTruthy();
  const table = within(await screen.findByRole("table", { name: "Payment history" }));
  expect(table.getByText("ABA-123")).toBeTruthy();
  expect(table.getByText("US$5")).toBeTruthy();
  expect(table.getByText("Paid")).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(await screen.findByText("No payments yet")).toBeTruthy();
  expect(history).toHaveBeenLastCalledWith(2, expect.any(AbortSignal));
});

it("shows an error until history loads successfully", async () => {
  vi.spyOn(Billing, "paymentHistory")
    .mockRejectedValueOnce(new Error("Offline"))
    .mockResolvedValueOnce({ payments: [], hasMore: false });

  render(<FamilyBillingPage />);
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.queryByText("No payments yet")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByText("No payments yet")).toBeTruthy();
});
