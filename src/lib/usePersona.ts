import { useSyncExternalStore } from "react";

import { ChildSettingsAPI } from "./childSettings";
import { Personas, type KodaCharacter } from "./personas";

/**
 * The teacher this child has, kept current while a component is mounted.
 *
 * Subscribes to both halves — the roster an operator edits, and the choice a
 * parent made — so renaming a character or switching a child to a different one
 * repaints every screen that names them. Reads, never fetches: `App` refreshes
 * the roster when an account appears, beside the plan and the switchboard.
 */
export const usePersona = (): KodaCharacter => {
  useSyncExternalStore(Personas.subscribe, Personas.version, Personas.version);
  useSyncExternalStore(ChildSettingsAPI.subscribe, ChildSettingsAPI.version, ChildSettingsAPI.version);
  return Personas.current();
};

/** Every character a child may be given, live. For the pickers. */
export const usePersonaRoster = (): KodaCharacter[] => {
  useSyncExternalStore(Personas.subscribe, Personas.version, Personas.version);
  return Personas.all();
};
