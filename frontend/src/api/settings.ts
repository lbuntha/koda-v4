import { api } from "./client";

export interface AppSettings {
  sound_enabled: boolean;
  ai_model: string;
  api_key_configured: boolean;
  api_key_hint: string | null;
}

export interface AppSettingsUpdate {
  sound_enabled: boolean;
  ai_model: string;
  openai_api_key?: string;
  clear_api_key?: boolean;
}

export const settingsApi = {
  get: () => api.get<AppSettings>("/settings"),
  update: (body: AppSettingsUpdate) => api.put<AppSettings>("/settings", body),
  testAi: () => api.post<{ ok: true }>("/settings/test-ai"),
};
