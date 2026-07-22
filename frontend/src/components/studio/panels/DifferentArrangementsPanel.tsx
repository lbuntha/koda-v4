import React from "react";
import { sounds } from "../../../sound";
import { PanelProps } from "../panelKit";

export const DifferentArrangementsPanel: React.FC<PanelProps> = ({ question, update, updateConfig }) => (

                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Arrangement Preset Layout</label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: "scatter", label: "Scatter" },
                          { id: "grid", label: "Neat Grid" },
                          { id: "circle", label: "Circular" },
                          { id: "line", label: "Row Line" }
                        ].map((lay) => {
                          const isSel = (question.config.pattern || "scatter") === lay.id;
                          return (
                            <button
                              key={lay.id}
                              onClick={() => {
                                sounds.playPop();
                                update({
                                  config: { 
                                    ...question.config, 
                                    pattern: lay.id as any,
                                    customPositions: [] // Clear custom positions so the preview follows the new layout rule!
                                  }
                                });
                              }}
                              className={`text-xs font-bold py-2 px-3 border rounded-lg text-center transition-all cursor-pointer
                                ${isSel 
                                  ? "bg-indigo-600 text-white border-indigo-600" 
                                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                                }
                              `}
                            >
                              {lay.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-1 bg-slate-50/50 rounded-lg">
                      <span className="text-xs font-bold text-slate-600">Show card frame on arrangement objects</span>
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
