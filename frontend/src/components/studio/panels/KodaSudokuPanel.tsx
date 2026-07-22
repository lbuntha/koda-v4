import React from "react";
import { Hash, Smile } from "lucide-react";
import { Label, Input } from "../../ui";
import { PanelProps } from "../panelKit";

export const KodaSudokuPanel: React.FC<PanelProps> = ({ question, update, updateConfig }) => (

                  <div className="space-y-4 bg-purple-50/60 p-3.5 rounded-xl">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-800 font-mono block">
                      Koda Sudoku Parameters
                    </span>
                    <div>
                      <Label>Symbol Mode</Label>
                      <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 p-1 rounded-2xl shadow-inner mt-1">
                        <button
                          type="button"
                          onClick={() => update({
                            config: { ...question.config, sudokuSymbolType: 'numbers' }
                          })}
                          className={`flex-1 flex items-center justify-center gap-1 px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer ${
                            (question.config.sudokuSymbolType || 'numbers') === 'numbers'
                              ? "bg-indigo-600 text-white shadow-sm"
                              : "text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          <Hash size={13} />
                          <span>Numbers</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => update({
                            config: { ...question.config, sudokuSymbolType: 'emojis' }
                          })}
                          className={`flex-1 flex items-center justify-center gap-1 px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer ${
                            (question.config.sudokuSymbolType || 'numbers') === 'emojis'
                              ? "bg-indigo-600 text-white shadow-sm"
                              : "text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          <Smile size={13} />
                          <span>Emojis</span>
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Rows</Label>
                        <Input
                          type="number"
                          min={2}
                          max={6}
                          value={question.config.rows ?? 4}
                          onChange={(e) => {
                            const val = Math.max(2, Math.min(6, parseInt(e.target.value) || 2));
                            update({
                              config: { ...question.config, rows: val }
                            });
                          }}
                        />
                      </div>
                      <div>
                        <Label>Columns</Label>
                        <Input
                          type="number"
                          min={2}
                          max={6}
                          value={question.config.cols ?? 4}
                          onChange={(e) => {
                            const val = Math.max(2, Math.min(6, parseInt(e.target.value) || 2));
                            update({
                              config: { ...question.config, cols: val }
                            });
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <Label>Pattern Emojis (Comma separated)</Label>
                      <Input
                        type="text"
                        value={(question.config.sudokuOptions || ["🍎", "🧁", "🦆", "⭐"]).join(", ")}
                        onChange={(e) => {
                          const options = e.target.value
                            .split(",")
                            .map(x => x.trim())
                            .filter(x => x !== "");
                          update({
                            config: { ...question.config, sudokuOptions: options }
                          });
                        }}
                      />
                    </div>
                  </div>
);
