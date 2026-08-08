/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The Count settings panel — one panel for the whole counting family.
 *
 * Replaces four near-identical panels. What a teacher sees follows the staging,
 * because a pattern only means something where objects lie loose and a vessel
 * only means something where there is one: showing every option for every game
 * is how the old panels ended up offering settings the canvas ignored.
 */

import React from "react";
import { CPASwitcherPill } from "../../../pedagogy";
import { PanelProps } from "../panelKit";
import { stagingFor } from "../../canvases/countStaging";

const LABEL = "text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2";
const FIELD = "w-full text-xs p-2.5 border border-slate-200 rounded-md bg-white font-medium";
const TOGGLE_ROW = "flex items-center justify-between p-1 bg-slate-50/50 rounded-lg";
const TOGGLE = "w-4 h-4 text-indigo-600 accent-indigo-600 cursor-pointer";

/** What the child does, in the teacher's words — shown under the action picker. */
const STAGING_ONE_LINER: Record<string, string> = {
  move: "Each object dragged across earns the next number. Order is the child's to choose.",
  tap: "Nothing moves. The child touches each object once, which is the harder skill.",
  lineup: "The slot decides the number, so the child has to place them in sequence.",
  container: "Free placement into one vessel — the count is all that matters, not where it lands.",
};

export const CountPanel: React.FC<PanelProps> = ({ question, update }) => {
  const config = question.config;
  const staging = stagingFor(config.staging as string | undefined, question.technique);
  const setConfig = (patch: Record<string, unknown>) =>
    update({ config: { ...config, ...patch } });

  const zones = staging.zones(config as Record<string, unknown>);
  const home = zones.find(zone => zone.role === "home");
  const target = zones.find(zone => zone.role === "target");

  return (
    <div className="space-y-4">
      {/*
        The choice that used to be four entries in the picker. Writing it into
        `config.staging` is what makes it explicit — a slide that says nothing
        still resolves through its technique id, which is how the questions
        authored before this merge keep working.
      */}
      <div>
        <label className={LABEL}>Counting Action</label>
        <select
          value={staging.id}
          onChange={e => setConfig({ staging: e.target.value })}
          className={`${FIELD} outline-none`}
        >
          <option value="move">Move — drag between two containers</option>
          <option value="tap">Tap — touch each object where it lies</option>
          <option value="lineup">Line up — drop into numbered slots, in order</option>
          <option value="container">Container — drop into one jar, basket or box</option>
        </select>
        <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed">
          {STAGING_ONE_LINER[staging.id] ?? ""}
        </p>
      </div>

      {/*
        Placeholders, not values: showing a name in an empty field claimed a
        label the canvas never renders. A teacher has to see what is on the slide.
      */}
      {home && (
        <div>
          <label className={LABEL}>Source Container Label</label>
          <input
            type="text"
            value={(config.sourceBinLabel as string) || ""}
            placeholder={home.learnerLabel}
            onChange={e => setConfig({ sourceBinLabel: e.target.value })}
            className={FIELD}
          />
        </div>
      )}

      {target && (
        <div>
          <label className={LABEL}>Destination Container Label</label>
          <input
            type="text"
            value={(config.destinationBinLabel as string) || ""}
            placeholder={target.learnerLabel}
            onChange={e => setConfig({ destinationBinLabel: e.target.value })}
            className={FIELD}
          />
        </div>
      )}

      {/* Only where objects lie loose does an arrangement mean anything. */}
      {staging.id === "tap" && (
        <div>
          <label className={LABEL}>Arrangement</label>
          <select
            value={(config.pattern as string) || "grid"}
            onChange={e => setConfig({ pattern: e.target.value })}
            className={`${FIELD} outline-none`}
          >
            <option value="grid">Grid</option>
            <option value="line">Line</option>
            <option value="ring">Ring</option>
            <option value="scatter">Scatter</option>
            <option value="wave">Wave</option>
            <option value="pairs">Pairs</option>
          </select>
        </div>
      )}

      {staging.id === "container" && (
        <div>
          <label className={LABEL}>Container Shape</label>
          <select
            value={(config.containerShape as string) || "jar"}
            onChange={e => setConfig({ containerShape: e.target.value })}
            className={`${FIELD} outline-none`}
          >
            <option value="jar">Jar</option>
            <option value="basket">Basket</option>
            <option value="box">Toy Box</option>
          </select>
        </div>
      )}

      <div>
        <label className={LABEL}>Container Color Palette</label>
        <select
          value={(config.frameColor as string) || "indigo"}
          onChange={e => setConfig({ frameColor: e.target.value })}
          className={`${FIELD} outline-none`}
        >
          <option value="indigo">Classic Indigo</option>
          <option value="emerald">Nature Emerald</option>
          <option value="purple">Deep Purple</option>
          <option value="rose">Soft Rose</option>
          <option value="pink">Sunset Pink</option>
        </select>
      </div>

      <div>
        <label className={LABEL}>Default Representation</label>
        <CPASwitcherPill
          representation={config.defaultRepresentation || "concrete"}
          onChange={rep => setConfig({ defaultRepresentation: rep })}
        />
      </div>

      <div className={TOGGLE_ROW}>
        <span className="text-xs font-bold text-slate-600">Show card frame on objects</span>
        <input
          type="checkbox"
          checked={config.showItemFrame ?? true}
          onChange={e => setConfig({ showItemFrame: e.target.checked })}
          className={TOGGLE}
        />
      </div>

      <div className={TOGGLE_ROW}>
        <span className="text-xs font-bold text-slate-600">Require answer input when finished</span>
        <input
          type="checkbox"
          checked={config.requireAnswerInput ?? true}
          onChange={e => setConfig({ requireAnswerInput: e.target.checked })}
          className={TOGGLE}
        />
      </div>
    </div>
  );
};
