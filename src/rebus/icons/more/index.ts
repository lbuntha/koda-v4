/** The wider vocabulary: drawings added in themed files so each stays small. */

import { BODY } from "./body";
import { HOME } from "./home";
import { LEARN } from "./learn";
import { LIVING } from "./living";
import { MORE_THINGS } from "./things";

export const MORE: Record<string, string> = { ...BODY, ...MORE_THINGS, ...HOME, ...LIVING, ...LEARN };
