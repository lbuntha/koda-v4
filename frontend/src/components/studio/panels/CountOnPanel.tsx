import React from "react";
import { PanelProps } from "../panelKit";

export const CountOnPanel: React.FC<PanelProps> = ({ question, update, updateConfig }) => (

                  <div className="space-y-4 bg-violet-50/40 border border-violet-100 p-3.5 rounded-xl">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-violet-800 font-mono block">
                      Closed Container Style
                    </span>
                    
                    <div>
                      <label className="text-[9px] font-bold text-violet-700 uppercase tracking-wider block mb-1">Shape Variant</label>
                      <select
                        value={question.config.containerShape || "box"}
                        onChange={(e) => update({
                          config: { ...question.config, containerShape: e.target.value as any }
                        })}
                        className="w-full text-xs p-2 border border-violet-200 rounded-md bg-white font-medium outline-none"
                      >
                        <option value="box">📦 Cardboard Box</option>
                        <option value="chest">🪙 Treasure Chest</option>
                        <option value="basket">🧺 Fruit Basket</option>
                        <option value="mystery">🔮 Mystery Box</option>
                      </select>
                    </div>

                    <div>
                      <div className="flex justify-between items-center text-xs text-violet-900 font-medium mb-1">
                        <span>Items Inside:</span>
                        <b className="font-mono bg-white px-1.5 py-0.5 rounded border border-violet-200">{question.config.baseCount || 5}</b>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={10}
                        value={question.config.baseCount || 5}
                        onChange={(e) => {
                          const base = parseInt(e.target.value);
                          const ext = question.config.extraCount || 3;
                          update({
                            targetCount: base + ext,
                            config: { ...question.config, baseCount: base }
                          });
                        }}
                        className="w-full h-1 bg-violet-200 rounded appearance-none cursor-pointer accent-violet-500"
                      />
                    </div>
                    
                    <div>
                      <div className="flex justify-between items-center text-xs text-violet-900 font-medium mb-1">
                        <span>Extra Dots Outside:</span>
                        <b className="font-mono bg-white px-1.5 py-0.5 rounded border border-violet-200">{question.config.extraCount || 3}</b>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={8}
                        value={question.config.extraCount || 3}
                        onChange={(e) => {
                          const ext = parseInt(e.target.value);
                          const base = question.config.baseCount || 5;
                          update({
                            targetCount: base + ext,
                            config: { ...question.config, extraCount: ext }
                          });
                        }}
                        className="w-full h-1 bg-violet-200 rounded appearance-none cursor-pointer accent-violet-500"
                      />
                    </div>

                    <div className="flex items-center justify-between p-1 bg-white/40 rounded-lg">
                      <span className="text-xs font-bold text-amber-950">Show card frame on count on objects</span>
                      <input
                        type="checkbox"
                        checked={question.config.showItemFrame ?? true}
                        onChange={(e) => update({
                          config: { ...question.config, showItemFrame: e.target.checked }
                        })}
                        className="w-4 h-4 text-violet-600 accent-violet-600 cursor-pointer"
                      />
                    </div>

                    <div className="flex items-center justify-between p-1 bg-white/40 rounded-lg">
                      <span className="text-xs font-bold text-amber-950">Require answer input after count on</span>
                      <input
                        type="checkbox"
                        checked={question.config.requireAnswerInput ?? true}
                        onChange={(e) => update({
                          config: { ...question.config, requireAnswerInput: e.target.checked }
                        })}
                        className="w-4 h-4 text-violet-600 accent-violet-600 cursor-pointer"
                      />
                    </div>
                  </div>
);
