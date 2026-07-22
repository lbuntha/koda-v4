import React from "react";
import { PanelProps } from "../panelKit";

export const LineUpAndCountPanel: React.FC<PanelProps> = ({ question, update, updateConfig }) => (

                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Slot Border Style</label>
                      <select
                        value={question.config.slotBorderStyle || "dashed"}
                        onChange={(e) => update({
                          config: { ...question.config, slotBorderStyle: e.target.value as any }
                        })}
                        className="w-full text-xs p-2.5 border border-slate-200 rounded-md outline-none bg-white font-medium"
                      >
                        <option value="dashed">Dashed Outline</option>
                        <option value="dotted">Dotted Outline</option>
                        <option value="solid">Solid Outline</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Theme Accent</label>
                      <select
                        value={question.config.frameColor || "indigo"}
                        onChange={(e) => update({
                          config: { ...question.config, frameColor: e.target.value as any }
                        })}
                        className="w-full text-xs p-2.5 border border-slate-200 rounded-md outline-none bg-white font-medium"
                      >
                        <option value="indigo">Indigo Blue</option>
                        <option value="purple">Lilac Purple</option>
                        <option value="emerald">Forest Emerald</option>
                        <option value="pink">Coral Pink</option>
                      </select>
                    </div>

                    <div className="flex items-center justify-between p-1 bg-slate-50/50 rounded-lg">
                      <span className="text-xs font-bold text-slate-600">Show index labels inside slots</span>
                      <input
                        type="checkbox"
                        checked={question.config.showNumbersInSlots ?? true}
                        onChange={(e) => update({
                          config: { ...question.config, showNumbersInSlots: e.target.checked }
                        })}
                        className="w-4 h-4 text-indigo-600 accent-indigo-600 cursor-pointer"
                      />
                    </div>

                    <div className="flex items-center justify-between p-1 bg-slate-50/50 rounded-lg">
                      <span className="text-xs font-bold text-slate-600">Show card frame on lined up objects</span>
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
