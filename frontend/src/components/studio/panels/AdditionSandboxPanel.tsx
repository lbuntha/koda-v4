import React from "react";
import { Label, Input } from "../../ui";
import { CPASwitcherPill } from "../../../pedagogy";
import { PanelProps } from "../panelKit";

export const AdditionSandboxPanel: React.FC<PanelProps> = ({ question, update, updateConfig }) => (

                  <div className="space-y-4 bg-sky-50/60 p-3.5 rounded-xl">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-sky-800 font-mono block">
                      Addition Sandbox Parameters
                    </span>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Group 1 (Addend 1)</Label>
                        <Input
                          type="number"
                          min={1}
                          max={6}
                          value={question.config.addend1 ?? 3}
                          onChange={(e) => {
                            const val = Math.max(1, Math.min(6, parseInt(e.target.value) || 1));
                            update({
                              targetCount: val + (question.config.addend2 ?? 2),
                              config: { ...question.config, addend1: val }
                            });
                          }}
                        />
                      </div>
                      <div>
                        <Label>Group 2 (Addend 2)</Label>
                        <Input
                          type="number"
                          min={1}
                          max={6}
                          value={question.config.addend2 ?? 2}
                          onChange={(e) => {
                            const val = Math.max(1, Math.min(6, parseInt(e.target.value) || 1));
                            update({
                              targetCount: (question.config.addend1 ?? 3) + val,
                              config: { ...question.config, addend2: val }
                            });
                          }}
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Default Representation</Label>
                      <CPASwitcherPill
                        className="mt-1"
                        representation={question.config.defaultRepresentation || "concrete"}
                        onChange={(rep) => update({
                          config: { ...question.config, defaultRepresentation: rep }
                        })}
                      />
                    </div>

                    <div className="flex items-center justify-between p-1 bg-white/50 rounded-lg">
                      <span className="text-xs font-bold text-sky-950">Require answer input after adding</span>
                      <input
                        type="checkbox"
                        checked={question.config.requireAnswerInput ?? true}
                        onChange={(e) => update({
                          config: { ...question.config, requireAnswerInput: e.target.checked }
                        })}
                        className="w-4 h-4 text-sky-600 accent-sky-600 cursor-pointer"
                      />
                    </div>
                  </div>
);
