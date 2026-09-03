import { accessToken, request } from "./sync";

export interface LessonAccess {
  skillId: string;
  lessonId: string;
  tier: "free" | "premium";
  allowed: boolean;
}

/** Ask the API to authorize a lesson from the subscription currently in force. */
export async function authorizeLesson(skillId: string, lessonId: string): Promise<LessonAccess> {
  const token = await accessToken();
  return request<LessonAccess>(
    `/skills/${encodeURIComponent(skillId)}/lessons/${encodeURIComponent(lessonId)}/access`,
    { token },
  );
}
