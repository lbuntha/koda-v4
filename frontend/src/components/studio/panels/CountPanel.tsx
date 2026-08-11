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
import { ActorCastField, PanelProps } from "../panelKit";
import { stagingFor } from "../../canvases/countStaging";
import { assetGroupSize } from "../../../assets/assetGroups";

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
  tens: "Ten-frames. The cell is the number, and a full frame is a ten — place value by position.",
  counton: "Some are already counted. The child counts on from there instead of starting at one.",
  countback: "Crossing out, from the end. The answer is what is left, not what was touched.",
  arrangements: "Same objects, a new shape each slide — the lesson is that the number does not change.",
  skipcount: "Objects come in bundles. One tap counts a whole bundle, so the child says 5, 10, 15.",
};

export const CountPanel: React.FC<PanelProps> = ({ question, update }) => {
  const config = question.config;
  const staging = stagingFor(config.staging as string | undefined, question.technique);
  const setConfig = (patch: Record<string, unknown>) =>
    update({ config: { ...config, ...patch } });

  /** Set when the chosen artwork is itself a group — a base-ten rod is ten. */
  const groupedStep = assetGroupSize(config.assetType);
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
          <option value="tens">Group in tens — fill ten-frames, one ten at a time</option>
          <option value="counton">Count on — start from a group, add more to it</option>
          <option value="countback">Count back — cross out from the end, say what is left</option>
          <option value="arrangements">Arrangements — count the same set in a new shape</option>
          <option value="skipcount">Skip count — count bundles, by 2s, 5s or 10s</option>
        </select>
        <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed">
          {STAGING_ONE_LINER[staging.id] ?? ""}
        </p>
      </div>

      {/* Who plays each moment of the question. */}
      <ActorCastField config={config} updateConfig={setConfig} />

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
      {(staging.id === "tap" || staging.id === "arrangements") && (
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
            <option value="columns">Columns</option>
            <option value="circle">Curve</option>
            <option value="dice">Dice</option>
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

      {/*
        Two actions whose board is not the slide's target count — Count On adds
        its two together, Count Back takes its goal off its total. Both are
        edited here, and the target count field above does nothing for either.
      */}
      {staging.id === "skipcount" && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={LABEL}>Objects in all</label>
            <input
              type="number"
              min={2}
              max={100}
              value={Number(config.totalCount ?? 20)}
              onChange={e => setConfig({ totalCount: Math.max(2, Number(e.target.value) || 2) })}
              className={`${FIELD} outline-none`}
            />
          </div>
          <div>
            <label className={LABEL}>Count by</label>
            {/*
              Artwork that is already a group settles this, and the field has to
              show that rather than argue with it: a base-ten rod is ten, so a
              panel still reading "Fives" would describe a board that does not
              exist. Disabled rather than hidden, so the author can see what the
              picture decided and why the choice has gone away.
            */}
            <select
              value={String(groupedStep ?? config.skipStep ?? 5)}
              onChange={e => setConfig({ skipStep: Number(e.target.value) })}
              disabled={groupedStep !== null}
              className={`${FIELD} outline-none ${groupedStep !== null ? "opacity-60 cursor-not-allowed" : ""}`}
            >
              <option value="2">Twos</option>
              <option value="5">Fives</option>
              <option value="10">Tens</option>
            </select>
          </div>
          {groupedStep !== null && (
            <p className="col-span-2 text-[11px] text-slate-500">
              This artwork is already a group of {groupedStep}, so the board counts in {groupedStep}s
              whatever this says. Pick a single object to choose your own bundle.
            </p>
          )}
        </div>
      )}

      {staging.id === "countback" && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={LABEL}>Start with</label>
            <input
              type="number"
              min={1}
              max={20}
              value={Number(config.totalCount ?? 8)}
              onChange={e => setConfig({ totalCount: Math.max(1, Number(e.target.value) || 1) })}
              className={`${FIELD} outline-none`}
            />
          </div>
          <div>
            <label className={LABEL}>Cross out</label>
            <input
              type="number"
              min={1}
              max={20}
              value={Number(config.removeCount ?? 3)}
              onChange={e => setConfig({ removeCount: Math.max(1, Number(e.target.value) || 1) })}
              className={`${FIELD} outline-none`}
            />
          </div>
        </div>
      )}

      {staging.id === "counton" && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={LABEL}>Start with</label>
            <input
              type="number"
              min={0}
              max={20}
              value={Number(config.baseCount ?? 5)}
              onChange={e => setConfig({ baseCount: Math.max(0, Number(e.target.value) || 0) })}
              className={`${FIELD} outline-none`}
            />
          </div>
          <div>
            <label className={LABEL}>Count on</label>
            <input
              type="number"
              min={1}
              max={20}
              value={Number(config.extraCount ?? 3)}
              onChange={e => setConfig({ extraCount: Math.max(1, Number(e.target.value) || 1) })}
              className={`${FIELD} outline-none`}
            />
          </div>
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
