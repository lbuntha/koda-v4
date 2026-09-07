/**
 * Every page the shell can put on screen.
 *
 * Its own module because both shells and `App` name it, and a union duplicated
 * in three files is a union that will disagree with itself the first time a
 * page is added.
 */
export type TabId =
  | "home"
  | "game"
  | "profile"
  | "skills"
  | "assets"
  | "users"
  | "roles"
  | "children"
  | "devices"
  | "menu"
  | "koda"
  | "admin"
  | "scoring"
  | "subjects"
  | "badges"
  | "billing"
  | "keys"
  // An Admin tab rather than a sidebar row, like the four above it: named
  // here because the shell has to be able to *put it on screen*, which is not
  // the same question as whether the sidebar draws a row for it.
  | "notifications"
  | "system"
  | "settings";
