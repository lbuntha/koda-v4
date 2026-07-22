import React from "react";
import { Label, Input } from "../../ui";
import { PanelProps } from "../panelKit";

export const KodaPatternPanel: React.FC<PanelProps> = ({ question, update, updateConfig }) => (

                  <div className="space-y-4 bg-purple-50/60 p-3.5 rounded-xl">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-800 font-mono block">
                      Pattern Matcher Parameters
                    </span>
                    <div>
                      <Label>Symbol Mode (Numbers vs Emojis)</Label>
                      <select
                        value={question.config.sudokuSymbolType || "emojis"}
                        onChange={(e) => update({
                          config: { ...question.config, sudokuSymbolType: e.target.value as any }
                        })}
                        className="w-full text-xs p-2.5 border border-purple-200 rounded-md outline-none bg-white font-bold text-slate-800 cursor-pointer shadow-sm mt-1"
                      >
                        <option value="emojis">🍎 Emojis Mode (🎈, 🍪, 🚗...)</option>
                        <option value="numbers">🔢 Numbers Mode (1, 2, 3, 4...)</option>
                      </select>
                    </div>
                    <div>
                      <Label>Pattern Sequence (Comma separated — leave a slot blank or use "?" for each gap)</Label>
                      <Input
                        type="text"
                        value={(question.config.patternSequence || ["🎈", "🍪", "🎈", "🍪", "🎈", ""]).join(", ")}
                        onChange={(e) => {
                          const seq = e.target.value.split(",").map(x => x.trim());
                          update({
                            config: { ...question.config, patternSequence: seq }
                          });
                        }}
                      />
                    </div>
                    <div>
                      <Label>Correct Answers (Comma separated — one per blank, left to right)</Label>
                      <Input
                        type="text"
                        value={(
                          question.config.patternAnswers
                          ?? (question.config.patternAnswer != null ? [question.config.patternAnswer] : ["🍪"])
                        ).join(", ")}
                        onChange={(e) => {
                          // Don't filter empties here — doing so eats the comma the
                          // user just typed (it produces a trailing "" that vanishes).
                          // Blank entries are ignored by the canvas anyway.
                          const answers = e.target.value.split(",").map(x => x.trim());
                          // Write the multi-answer field and drop the legacy single
                          // field so the two can't drift out of sync.
                          const { patternAnswer, ...rest } = question.config;
                          update({
                            config: { ...rest, patternAnswers: answers }
                          });
                        }}
                      />
                    </div>
                    <div>
                      <Label>Missing Piece Choices (Comma separated)</Label>
                      <Input
                        type="text"
                        value={(question.config.sudokuOptions || ["🎈", "🍪", "🚗", "🦆"]).join(", ")}
                        onChange={(e) => {
                          // No filter while typing (it eats the comma just typed);
                          // the canvas skips blank options at render time.
                          const options = e.target.value.split(",").map(x => x.trim());
                          update({
                            config: { ...question.config, sudokuOptions: options }
                          });
                        }}
                      />
                    </div>
                  </div>
);
