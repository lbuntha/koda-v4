import React from "react";
import { Label, Input } from "../../ui";
import { PanelProps } from "../panelKit";

export const MultiplicationArrayPanel: React.FC<PanelProps> = ({ question, update, updateConfig }) => (

                  <div className="space-y-4 bg-emerald-50/60 p-3.5 rounded-xl">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 font-mono block">
                      Multiplication Grid Parameters
                    </span>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Rows</Label>
                        <Input
                          type="number"
                          min={1}
                          max={4}
                          value={question.config.rows ?? 3}
                          onChange={(e) => {
                            const val = Math.max(1, Math.min(4, parseInt(e.target.value) || 1));
                            const cols = question.config.cols ?? 4;
                            update({
                              targetCount: val * cols,
                              config: { ...question.config, rows: val }
                            });
                          }}
                        />
                      </div>
                      <div>
                        <Label>Columns</Label>
                        <Input
                          type="number"
                          min={1}
                          max={5}
                          value={question.config.cols ?? 4}
                          onChange={(e) => {
                            const val = Math.max(1, Math.min(5, parseInt(e.target.value) || 1));
                            const rowsVal = question.config.rows ?? 3;
                            update({
                              targetCount: rowsVal * val,
                              config: { ...question.config, cols: val }
                            });
                          }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-1 bg-white/50 rounded-lg">
                      <span className="text-xs font-bold text-emerald-950">Require answer input after array</span>
                      <input
                        type="checkbox"
                        checked={question.config.requireAnswerInput ?? true}
                        onChange={(e) => update({
                          config: { ...question.config, requireAnswerInput: e.target.checked }
                        })}
                        className="w-4 h-4 text-emerald-600 accent-emerald-600 cursor-pointer"
                      />
                    </div>
                  </div>
);
