import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ApiKeysPanel } from "./ApiKeysPanel";
import { request } from "../../lib/sync";

vi.mock("../../lib/sync", () => ({
  accessToken: async () => "test-token",
  request: vi.fn(),
  refreshSystem: vi.fn(async () => {}),
  usePermissions: () => ({ can: () => true }),
  ApiError: class extends Error {},
}));
vi.mock("../../lib/tutorApi", () => ({ tutorHeaders: async () => ({ Authorization: "Bearer test-token" }) }));

const secret = (id: string, label: string, env: string, hint: string | null) => ({
  id, group: "AI providers", label, description: "", type: "secret", value: null, isSet: hint !== null, hint, env,
});
const SETTINGS = [
  secret("ai.geminiApiKey", "Gemini", "GEMINI_API_KEY", "y2ms"),
  secret("ai.openaiApiKey", "OpenAI (ChatGPT)", "OPENAI_API_KEY", "CGoA"),
  secret("ai.anthropicApiKey", "Claude (Anthropic)", "ANTHROPIC_API_KEY", null),
  secret("ai.voxApiKey", "Vox voices — key", "VOX_API_KEY", null),
  secret("ai.voxApiUrl", "Vox voices — address", "VOX_API_URL", null),
  { id: "ai.pictureProvider", group: "AI defaults", label: "Book pictures", description: "", type: "text", value: "gemini", isSet: false, hint: null, options: ["gemini", "openai"] },
];
const SOURCES = [
  { id: "gemini", setting: "ai.geminiApiKey", env: "GEMINI_API_KEY", source: "saved", envSet: false },
  { id: "openai", setting: "ai.openaiApiKey", env: "OPENAI_API_KEY", source: "saved", envSet: true },
  { id: "anthropic", setting: "ai.anthropicApiKey", env: "ANTHROPIC_API_KEY", source: null, envSet: false },
  { id: "vox", setting: "ai.voxApiKey", env: "VOX_API_KEY", source: "env", envSet: true },
  { id: "voxUrl", setting: "ai.voxApiUrl", env: "VOX_API_URL", source: "env", envSet: true },
];

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.mocked(request).mockReset();
  vi.mocked(request).mockResolvedValueOnce({ settings: SETTINGS });
  fetchMock = vi.fn(async (url: string) =>
    url === "/api/ai/providers"
      ? new Response(JSON.stringify({ providers: SOURCES }))
      : new Response(JSON.stringify({ ok: false, message: "The provider refused this key." })),
  );
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const card = async (name: string) => (await screen.findByRole("heading", { name })).closest("article") as HTMLElement;

it("says where each key comes from, including a saved key hiding the deployment's", async () => {
  render(<ApiKeysPanel />);
  const openai = await card("OpenAI (ChatGPT)");
  await waitFor(() => expect(within(openai).getByText("Overrides the deployment's OPENAI_API_KEY.")).toBeTruthy());
  expect(within(openai).getByText("Saved ····CGoA")).toBeTruthy();
  expect(within(await card("Claude (Anthropic)")).getByText("Not set")).toBeTruthy();
  expect(within(await card("Vox voices")).getAllByText(/From the deployment/)).toHaveLength(2);
  expect(within(await card("Gemini")).getByText("Ask Koda")).toBeTruthy();
});

it("tests the key in use and shows the provider's refusal", async () => {
  render(<ApiKeysPanel />);
  const openai = await card("OpenAI (ChatGPT)");
  fireEvent.click(within(openai).getByRole("button", { name: "Test" }));
  await within(openai).findByText("Failed");
  expect(within(openai).getByText("The provider refused this key.")).toBeTruthy();
  expect(fetchMock).toHaveBeenCalledWith("/api/ai/providers/openai/test", expect.objectContaining({ method: "POST" }));
});

it("saves a new key and a default model through the settings API", async () => {
  vi.mocked(request).mockImplementation(async (path, options) => ({
    ...SETTINGS.find((s) => path.endsWith(s.id))!,
    ...(path.endsWith("ai.pictureProvider") ? { value: (options?.body as { value: string }).value } : { isSet: true, hint: "abcd" }),
  }));
  render(<ApiKeysPanel />);
  const claude = await card("Claude (Anthropic)");
  fireEvent.change(within(claude).getByLabelText("Claude (Anthropic)"), { target: { value: "sk-ant-test-key-1234" } });
  fireEvent.click(within(claude).getByRole("button", { name: "Save" }));
  await waitFor(() => expect(request).toHaveBeenCalledWith("/system/settings/ai.anthropicApiKey", expect.objectContaining({ method: "PATCH", body: { value: "sk-ant-test-key-1234" } })));

  fireEvent.change(await screen.findByRole("combobox"), { target: { value: "openai" } });
  await waitFor(() => expect(request).toHaveBeenCalledWith("/system/settings/ai.pictureProvider", expect.objectContaining({ body: { value: "openai" } })));
});
