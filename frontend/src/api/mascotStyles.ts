import { api } from "./client";
import type { MascotStyleRecord } from "../admin/mascot-studio/styleModel";

export const mascotStylesApi = {
  list: () => api.get<MascotStyleRecord[]>("/mascot-styles"),
  getHiddenPresets: () => api.get<{ ids: string[] }>("/mascot-styles/hidden-presets"),
  updateHiddenPresets: (ids: string[]) => api.put<{ ids: string[] }>("/mascot-styles/hidden-presets", { ids }),
  create: (style: MascotStyleRecord) => api.post<MascotStyleRecord>("/mascot-styles", style),
  update: (style: MascotStyleRecord) => api.put<MascotStyleRecord>(`/mascot-styles/${encodeURIComponent(style.id)}`, style),
  delete: (styleId: string) => api.del<void>(`/mascot-styles/${encodeURIComponent(styleId)}`),
};
