/** The wider vocabulary: drawings added in themed files so each stays small. */

import { BODY } from "./body";
import { MORE_THINGS } from "./things";

export const MORE: Record<string, string> = { ...BODY, ...MORE_THINGS };
