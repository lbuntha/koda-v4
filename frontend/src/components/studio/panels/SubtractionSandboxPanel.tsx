import React from "react";
import { Label, Input } from "../../ui";
import { CPASwitcherPill } from "../../../pedagogy";
import { ActorCastField, PanelProps } from "../panelKit";

export const SubtractionSandboxPanel: React.FC<PanelProps> = ({ question, update, updateConfig }) => (

                  <div className="space-y-4 bg-rose-50/60 p-3.5 rounded-xl">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-rose-800 font-mono block">
                      Subtraction Sandbox Parameters
                    </span>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Total Count (Minuend)</Label>
                        <Input
                          type="number"
                          min={2}
                          max={12}
                          value={question.config.minuend ?? 8}
                          onChange={(e) => {
                            const val = Math.max(2, Math.min(12, parseInt(e.target.value) || 2));
                            const sub = question.config.subtrahend ?? 3;
                            update({
                              targetCount: Math.max(1, val - sub),
                              config: { ...question.config, minuend: val, subtrahend: Math.min(sub, val - 1) }
                            });
                          }}
                        />
                      </div>
                      <div>
                        <Label>Subtract (Subtrahend)</Label>
                        <Input
                          type="number"
                          min={1}
                          max={(question.config.minuend ?? 8) - 1}
                          value={question.config.subtrahend ?? 3}
                          onChange={(e) => {
                            const minVal = question.config.minuend ?? 8;
                            const val = Math.max(1, Math.min(minVal - 1, parseInt(e.target.value) || 1));
                            update({
                              targetCount: minVal - val,
                              config: { ...question.config, subtrahend: val }
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
                    {/* Who plays each moment of the question. */}
                    <ActorCastField config={question.config} updateConfig={updateConfig} />
                  </div>
);
