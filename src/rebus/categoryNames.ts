/**
 * A category's name as a viewer reads it: their language, else English, else its id made readable.
 *
 * Apart from `categories.ts` because it needs the language module, which the
 * Node server's bundle must never pull in (see `serverBundle.test.ts`).
 */

import { currentLanguage } from "../lib/i18n";
import { categorySnapshot, type Category } from "./categories";

export const nameOfCategory = (category: Pick<Category, "id" | "names">, language: string = currentLanguage()): string =>
  category.names[language] ?? category.names.en ?? category.id.replace(/-/g, " ");

export const categoryLabel = (id: string, language: string = currentLanguage()): string => {
  const found = categorySnapshot().find((c) => c.id === id);
  return found ? nameOfCategory(found, language) : id.replace(/-/g, " ");
};
