import React from "react";
import { PanelProps } from "../panelKit";

export const CountMagnetsPanel: React.FC<PanelProps> = ({ question, update, updateConfig }) => (

                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Container Shape</label>
                      <select
                        value={question.config.containerShape || "jar"}
                        onChange={(e) => update({
                          config: { ...question.config, containerShape: e.target.value as any }
                        })}
                        className="w-full text-xs p-2.5 border border-slate-200 rounded-md bg-white font-medium outline-none"
                      >
                        <option value="jar">🍯 Kawaii Glass Jar</option>
                        <option value="basket">🧺 Kawaii Woven Basket</option>
                        <option value="box">📦 Kawaii Cardboard Box</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">
                        {question.config.containerShape === "basket" 
                          ? "Basket Label" 
                          : question.config.containerShape === "box" 
                          ? "Box Label" 
                          : "Magnetic Jar Label"}
                      </label>
                      <input
                        type="text"
                        value={question.config.jarLabel || ""}
                        placeholder={question.config.containerShape === "basket" ? "Star Basket" : question.config.containerShape === "box" ? "Star Box" : "Star Magnet Jar"}
                        onChange={(e) => update({
                          config: { ...question.config, jarLabel: e.target.value }
                        })}
                        className="w-full text-xs p-2.5 border border-slate-200 rounded-md bg-white font-medium"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Theme Color</label>
                      <select
                        value={question.config.jarColorAccent || "blue"}
                        onChange={(e) => update({
                          config: { ...question.config, jarColorAccent: e.target.value as any }
                        })}
                        className="w-full text-xs p-2.5 border border-slate-200 rounded-md bg-white font-medium outline-none"
                      >
                        <option value="blue">Electric Indigo (Blue)</option>
                        <option value="rose">Sunset Crimson (Rose)</option>
                        <option value="amber">Warm Gold (Amber)</option>
                        <option value="emerald">Forest Meadow (Emerald)</option>
                      </select>
                    </div>

                    <div className="flex items-center justify-between p-1 bg-slate-50/50 rounded-lg">
                      <span className="text-xs font-bold text-slate-600">Show card frame on magnet objects</span>
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
