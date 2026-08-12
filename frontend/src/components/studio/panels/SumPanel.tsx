/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The Koda Add & Subtract settings panel — one panel for both operations.
 *
 * The operation leads, because it decides what every field under it means: a
 * slide with an operation of `add` has two addends and a basket, one with
 * `subtract` has a minuend, a subtrahend and a plate. Showing both sets at once
 * is how the old pair of panels each ended up offering settings the other one's
 * canvas would ignore.
 *
 * What a teacher sees follows that choice, and nothing else here has to know
 * which mechanic is running.
 */

import React from "react";
import { PanelProps } from "../panelKit";
import { AdditionSandboxPanel } from "./AdditionSandboxPanel";
import { SubtractionSandboxPanel } from "./SubtractionSandboxPanel";
import { operationFor, type SumOperation } from "../../canvases/SumCanvas";

const LABEL = "text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2";
const FIELD = "w-full text-xs p-2.5 border border-slate-200 rounded-md bg-white font-medium outline-none";

export const SumPanel: React.FC<PanelProps> = props => {
  const { question, updateConfig } = props;
  const operation = operationFor(question);

  return (
    <div className="space-y-4">
      {/*
        Writing the choice into `config.operation` is what makes it explicit. A
        slide that says nothing still resolves through the technique it was
        authored under, which is how every subtraction question written before
        this merge keeps working — see `operationFor`.
      */}
      <div>
        <label className={LABEL}>Operation</label>
        <select
          value={operation}
          onChange={e => updateConfig({ operation: e.target.value as SumOperation })}
          className={FIELD}
        >
          <option value="add">Add — bring objects together and count the total</option>
          <option value="subtract">Subtract — cross some off and count what is left</option>
        </select>
        <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed">
          {operation === "subtract"
            ? "One plate of objects. The child crosses out the ones taken away, and the answer is what remains."
            : "Two groups of objects. The child drags them together into the basket, and the answer is the total."}
        </p>
      </div>

      {operation === "subtract" ? <SubtractionSandboxPanel {...props} /> : <AdditionSandboxPanel {...props} />}
    </div>
  );
};
