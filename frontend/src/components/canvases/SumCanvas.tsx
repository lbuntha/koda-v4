/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Koda Add & Subtract — one component for both operations.
 *
 * These were two games in the picker and two entries in every lesson-planning
 * screen, and a teacher choosing between them was choosing between two spellings
 * of the same activity: a set of objects, an action performed on some of them,
 * and a number to type at the end. Everything a slide author actually sets —
 * artwork, colour, representation, whether an answer is required, who presents
 * it — was duplicated, and drifted, twice over.
 *
 * So they merge the way the counting family did: **one entry, one panel, one
 * schema, and the mechanic chosen from a dropdown.** `CountCanvas` did not
 * collapse nine mechanics into one function either — it kept nine staging
 * modules under one engine — and this keeps two, for the same reason. Adding
 * objects to a basket and crossing objects off a plate are genuinely different
 * interactions, and pretending otherwise produces a component full of `if
 * (operation === …)` in the middle of its drag maths.
 *
 * ## Which mechanic
 *
 * `config.operation` when the slide says, else the technique it was authored
 * under. That fallback is what lets every subtraction slide in the wild keep
 * opening: `SUBTRACTION_SANDBOX` is absorbed rather than retired, so its
 * questions route here and resolve to the mechanic they were written for
 * without anybody migrating any data.
 */

import React from "react";
import { CountingTechnique } from "../../types";
import { CanvasProps } from "./types";
import { AdditionCanvas } from "./AdditionCanvas";
import { SubtractionCanvas } from "./SubtractionCanvas";

export type SumOperation = "add" | "subtract";

/** What this slide is: what it says, else what it was authored as. */
export const operationFor = (question: {
  config?: Record<string, unknown>;
  technique?: string;
}): SumOperation => {
  const stated = question.config?.operation;
  if (stated === "add" || stated === "subtract") return stated;
  return question.technique === CountingTechnique.SUBTRACTION_SANDBOX ? "subtract" : "add";
};

export const SumCanvas: React.FC<CanvasProps> = props =>
  operationFor(props.question) === "subtract" ? (
    <SubtractionCanvas {...props} />
  ) : (
    <AdditionCanvas {...props} />
  );
