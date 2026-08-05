import React from "react";
import { PanelProps } from "../panelKit";

export const CountBackPanel: React.FC<PanelProps> = ({ question, update, updateConfig }) => (

                  <div className="space-y-4 bg-red-50/40 border border-red-100 p-3.5 rounded-xl">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-red-800 font-mono block">
                      Subtraction Configuration
                    </span>

                    <div>
                      <label className="text-[9px] font-bold text-red-700 uppercase tracking-wider block mb-1">Cross-Out Mark Style</label>
                      <select
                        value={question.config.crossOutStyle || "red_x"}
                        onChange={(e) => update({
                          config: { ...question.config, crossOutStyle: e.target.value as any }
                        })}
                        className="w-full text-xs p-2 border border-red-200 rounded-md bg-white font-medium outline-none"
                      >
                        <option value="red_x">Red X Overlay (✕)</option>
                        <option value="slash">Classic Slate Slash (╱)</option>
                        <option value="fade">Ghostly Fade Out</option>
                      </select>
                    </div>

                    <div>
                      <div className="flex justify-between items-center text-xs text-red-900 font-medium mb-1">
                        <span>Starting Total:</span>
                        <b className="font-mono bg-white px-1.5 py-0.5 rounded border border-red-200">{question.config.totalCount || 8}</b>
                      </div>
                      <input
                        type="range"
                        min={3}
                        max={15}
                        value={question.config.totalCount || 8}
                        onChange={(e) => {
                          const tot = parseInt(e.target.value);
                          const rem = question.config.removeCount || 3;
                          if (tot > rem) {
                            update({
                              targetCount: tot - rem,
                              config: { ...question.config, totalCount: tot }
                            });
                          }
                        }}
                        className="w-full h-1 bg-red-200 rounded appearance-none cursor-pointer accent-red-500"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between items-center text-xs text-red-900 font-medium mb-1">
                        <span>Items to Cross Out:</span>
                        <b className="font-mono bg-white px-1.5 py-0.5 rounded border border-red-200">{question.config.removeCount || 3}</b>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={Math.max(1, (question.config.totalCount || 8) - 1)}
                        value={question.config.removeCount || 3}
                        onChange={(e) => {
                          const rem = parseInt(e.target.value);
                          const tot = question.config.totalCount || 8;
                          if (tot > rem) {
                            update({
                              targetCount: tot - rem,
                              config: { ...question.config, removeCount: rem }
                            });
                          }
                        }}
                        className="w-full h-1 bg-red-200 rounded appearance-none cursor-pointer accent-red-500"
                      />
                    </div>

                    <div className="flex items-center justify-between p-1 bg-white/40 rounded-lg">
                      <span className="text-xs font-bold text-red-950">Show card frame on count back objects</span>
                      <input
                        type="checkbox"
                        checked={question.config.showItemFrame ?? true}
                        onChange={(e) => update({
                          config: { ...question.config, showItemFrame: e.target.checked }
                        })}
                        className="w-4 h-4 text-red-600 accent-red-600 cursor-pointer"
                      />
                    </div>

                    <div className="flex items-center justify-between p-1 bg-white/40 rounded-lg">
                      <span className="text-xs font-bold text-red-950">Require answer input after count back</span>
                      <input
                        type="checkbox"
                        checked={question.config.requireAnswerInput ?? true}
                        onChange={(e) => update({
                          config: { ...question.config, requireAnswerInput: e.target.checked }
                        })}
                        className="w-4 h-4 text-red-600 accent-red-600 cursor-pointer"
                      />
                    </div>
                  </div>
);
