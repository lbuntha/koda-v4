import React from "react";
import { PanelProps } from "../panelKit";

export const GroupInTensPanel: React.FC<PanelProps> = ({ question, update, updateConfig }) => (

                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Ten-Frame Color Theme</label>
                      <select
                        value={question.config.frameColor || "indigo"}
                        onChange={(e) => update({
                          config: { ...question.config, frameColor: e.target.value as any }
                        })}
                        className="w-full text-xs p-2.5 border border-slate-200 rounded-md outline-none bg-white font-medium"
                      >
                        <option value="indigo">Classic Indigo & Pink</option>
                        <option value="emerald">Fresh Emerald & Teal</option>
                        <option value="purple">Cosmo Purple & Fuchsia</option>
                        <option value="slate">Monochrome Slate & Zinc</option>
                      </select>
                    </div>

                    <div className="flex items-center justify-between p-1 bg-slate-50/50 rounded-lg">
                      <span className="text-xs font-bold text-slate-600">Show frame index numbers</span>
                      <input
                        type="checkbox"
                        checked={question.config.showNumbersInSlots ?? false}
                        onChange={(e) => update({
                          config: { ...question.config, showNumbersInSlots: e.target.checked }
                        })}
                        className="w-4 h-4 text-indigo-600 accent-indigo-600 cursor-pointer"
                      />
                    </div>

                    <div className="flex items-center justify-between p-1 bg-slate-50/50 rounded-lg">
                      <span className="text-xs font-bold text-slate-600">Show card frame on base-10 objects</span>
                      <input
                        type="checkbox"
                        checked={question.config.showItemFrame ?? true}
                        onChange={(e) => update({
                          config: { ...question.config, showItemFrame: e.target.checked }
                        })}
                        className="w-4 h-4 text-indigo-600 accent-indigo-600 cursor-pointer"
                      />
                    </div>
                  </div>
);
