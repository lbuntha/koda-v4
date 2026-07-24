import React from "react";
import { CPASwitcherPill } from "../../../pedagogy";
import { PanelProps } from "../panelKit";

export const MoveAndCountPanel: React.FC<PanelProps> = ({ question, update, updateConfig }) => (

                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Source Container Label</label>
                      <input
                        type="text"
                        value={question.config.sourceBinLabel || "Uncounted Box"}
                        onChange={(e) => update({
                          config: { ...question.config, sourceBinLabel: e.target.value }
                        })}
                        className="w-full text-xs p-2.5 border border-slate-200 rounded-md bg-white font-medium"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Destination Container Label</label>
                      <input
                        type="text"
                        value={question.config.destinationBinLabel || "Counted Pond"}
                        onChange={(e) => update({
                          config: { ...question.config, destinationBinLabel: e.target.value }
                        })}
                        className="w-full text-xs p-2.5 border border-slate-200 rounded-md bg-white font-medium"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Container Color Palette</label>
                      <select
                        value={question.config.frameColor || "indigo"}
                        onChange={(e) => update({
                          config: { ...question.config, frameColor: e.target.value as any }
                        })}
                        className="w-full text-xs p-2.5 border border-slate-200 rounded-md outline-none bg-white font-medium"
                      >
                        <option value="indigo">Classic Indigo</option>
                        <option value="emerald">Nature Emerald</option>
                        <option value="pink">Sunset Pink</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Default Representation</label>
                      <CPASwitcherPill
                        representation={question.config.defaultRepresentation || "concrete"}
                        onChange={(rep) => update({
                          config: { ...question.config, defaultRepresentation: rep }
                        })}
                      />
                    </div>

                    <div className="flex items-center justify-between p-1 bg-slate-50/50 rounded-lg">
                      <span className="text-xs font-bold text-slate-600">Show card frame on move and count objects</span>
                      <input
                        type="checkbox"
                        checked={question.config.showItemFrame ?? true}
                        onChange={(e) => update({
                          config: { ...question.config, showItemFrame: e.target.checked }
                        })}
                        className="w-4 h-4 text-indigo-600 accent-indigo-600 cursor-pointer"
                      />
                    </div>

                    <div className="flex items-center justify-between p-1 bg-slate-50/50 rounded-lg">
                      <span className="text-xs font-bold text-slate-600">Require answer input after moving objects</span>
                      <input
                        type="checkbox"
                        checked={question.config.requireAnswerInput ?? true}
                        onChange={(e) => update({
                          config: { ...question.config, requireAnswerInput: e.target.checked }
                        })}
                        className="w-4 h-4 text-indigo-600 accent-indigo-600 cursor-pointer"
                      />
                    </div>
                  </div>
);
