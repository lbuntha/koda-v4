import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { SubjectsPanel } from "./SubjectsPanel";
import { DEFAULT_SUBJECTS, SUBJECT_SETTING, parseSubjects } from "../../lib/subjects";
import { System } from "../../lib/sync/system";
import { request } from "../../lib/sync";

vi.mock("../../lib/sync", () => ({ accessToken: async () => "test-token", request: vi.fn() }));
vi.mock("../../lib/skillStore", () => ({
  useInstalledSkills: () => [{ id: "counting", name: "Counting" }, { id: "observation", name: "Observation" }],
  skillTitle: (name: string) => name,
}));
vi.mock("../../skills/registry", () => ({ getSkill: (id: string) => ({ manifest: { audience: { ages: id === "counting" ? [3, 8] : [5, 12] }, status: "published" } }) }));
vi.mock("../../lib/skillRegistryApi", () => ({ SkillRegistryAPI: { get: () => undefined }, useSkillRegistryVersion: () => 0 }));

it("bulk assigns only selected skills and filters by age and subject", async () => {
  vi.mocked(request).mockResolvedValueOnce({ [SUBJECT_SETTING]: JSON.stringify(DEFAULT_SUBJECTS) });
  render(<SubjectsPanel />);
  await screen.findByLabelText("Select Counting");
  fireEvent.change(screen.getByLabelText("Filter by learner age"), { target: { value: "4" } });
  expect(screen.queryByLabelText("Select Observation")).toBeNull();
  fireEvent.click(screen.getByLabelText("Select this page"));
  fireEvent.change(screen.getByLabelText("Bulk subject"), { target: { value: "thinking" } });
  fireEvent.click(screen.getByRole("button", { name: "Assign subject" }));
  expect((screen.getByLabelText("Subject for Counting") as HTMLSelectElement).value).toBe("thinking");
  fireEvent.change(screen.getByLabelText("Filter by subject"), { target: { value: "math" } });
  expect(screen.queryByLabelText("Select Counting")).toBeNull();
});

beforeEach(() => { vi.mocked(request).mockReset(); });

it("saves a subject rename and skill assignment and updates the offline lookup immediately", async () => {
  vi.mocked(request).mockResolvedValueOnce({ [SUBJECT_SETTING]: JSON.stringify(DEFAULT_SUBJECTS) });
  vi.mocked(request).mockImplementationOnce(async (_path, options) => ({ value: (options?.body as { value: string }).value }));
  render(<SubjectsPanel />);
  const name = await screen.findByLabelText("Subject 1 name");
  fireEvent.change(name, { target: { value: "Mathematics" } });
  fireEvent.change(screen.getByLabelText("Subject for Observation"), { target: { value: "math" } });
  fireEvent.click(screen.getByRole("button", { name: "Save subjects" }));
  await screen.findByText("Subjects saved. Learn now uses these groups.");
  const saved = parseSubjects(System.snapshot()[SUBJECT_SETTING]);
  expect(saved.subjects[0].name).toBe("Mathematics");
  expect(saved.assignments.observation).toBe("math");
  expect(request).toHaveBeenLastCalledWith("/system/subjects", expect.objectContaining({ method: "PATCH" }));
});

it("does not permit overwriting settings when the initial load fails", async () => {
  vi.mocked(request).mockRejectedValueOnce(new Error("Offline"));
  render(<SubjectsPanel />);
  await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Connect to load"));
  expect((screen.getByRole("button", { name: "Save subjects" }) as HTMLButtonElement).disabled).toBe(true);
});
