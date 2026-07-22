import React from "react";
import { PanelProps } from "../panelKit";

export const SubitizePanel: React.FC<PanelProps> = ({ question, update, updateConfig }) => (

                  <div className="space-y-4 bg-indigo-50/30 border border-indigo-100 p-3.5 rounded-xl">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-800 font-mono block">
                      Subitize Flash Card Speed
                    </span>
                    <div>
                      <div className="flex justify-between items-center text-xs text-indigo-900 font-medium mb-1.5">
                        <span>Flash Duration:</span>
                        <b className="font-mono bg-white px-1.5 py-0.5 rounded border border-indigo-150">{((question.config.flashDurationMs || 1500) / 1000).toFixed(1)}s</b>
                      </div>
                      <input
                        type="range"
                        min={500}
                        max={3500}
                        step={250}
                        value={question.config.flashDurationMs || 1500}
                        onChange={(e) => update({
                          config: { ...question.config, flashDurationMs: parseInt(e.target.value) }
                        })}
                        className="w-full h-1 bg-indigo-200 rounded appearance-none cursor-pointer accent-indigo-500"
                      />
                    </div>
                  </div>
);
