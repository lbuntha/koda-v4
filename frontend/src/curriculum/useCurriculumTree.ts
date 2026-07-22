/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useLocalStorageState } from "../hooks/useLocalStorageState";
import { CurriculumTree } from "./types";
import { EXAMPLE_TREE } from "./seedExample";

const CURRICULUM_STORAGE_KEY = "koda_curriculum_tree_v1";

/**
 * A persisted, mutable CurriculumTree. First-run users get the real
 * Grade 1 / Math / Unit 1 / "Counting & Number Sense" example rather than an
 * empty tree — CurriculumStudioPage seeds the matching EXAMPLE_QUESTIONS
 * into the question deck on the same first run, so the seeded skill shows a
 * real 10/10 instead of an empty tree next to a dangling example.
 */
export function useCurriculumTree(): {
  tree: CurriculumTree;
  setTree: (next: CurriculumTree | ((prev: CurriculumTree) => CurriculumTree)) => void;
} {
  const [tree, setTree] = useLocalStorageState<CurriculumTree>(CURRICULUM_STORAGE_KEY, EXAMPLE_TREE);
  return { tree, setTree };
}
