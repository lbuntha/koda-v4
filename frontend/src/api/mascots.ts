import { api } from "./client";
import type { MascotDocument } from "../features/koda-mascot/types";

export const mascotsApi = {
  list: () => api.get<MascotDocument[]>("/mascots"),
  create: (document: MascotDocument) => api.post<MascotDocument>("/mascots", document),
  update: (document: MascotDocument) => api.put<MascotDocument>(`/mascots/${encodeURIComponent(document.id)}`, document),
  delete: (mascotId: string) => api.del<void>(`/mascots/${encodeURIComponent(mascotId)}`),
};
