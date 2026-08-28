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
  | "badges"
  | "billing"
  | "keys"
  | "system"
  | "settings";
