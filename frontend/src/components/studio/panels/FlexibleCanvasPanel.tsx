import React, { useState } from "react";
import { Plus, Wand2 } from "lucide-react";
import { Button } from "../../ui";
import { Label, Input } from "../../ui";
import { sounds } from "../../../sound";
import { BUILT_IN_ASSETS } from "../../../assets/assetCatalog";
import { autoArrangeLayout } from "../../canvases/flexible/layout";
import { PanelProps } from "../panelKit";

/** Vector artwork only — a flexible item falls back to its emoji when no type is chosen. */
const DRAWABLE_ASSETS = BUILT_IN_ASSETS.filter((asset) => asset.kind !== "emoji");

export const FlexibleCanvasPanel: React.FC<PanelProps> = ({ question, update, updateConfig }) => {
  const [newItemEmoji, setNewItemEmoji] = useState<string>("🍎");
  const [newTargetLabel, setNewTargetLabel] = useState<string>("🧺 Basket");

  // Every add/remove re-flows the whole canvas into a tidy default layout, so
  // authors never have to drag things into place by hand.
  const applyLayout = (items: typeof question.config.flexibleItems, targets: typeof question.config.flexibleTargets) => {
    const arranged = autoArrangeLayout(items || [], targets || []);
    updateConfig({ flexibleItems: arranged.items, flexibleTargets: arranged.targets });
  };

  const handleAddItem = () => {
    const emoji = newItemEmoji.trim() || "🍎";
    const currentItems = question.config.flexibleItems || [];
    sounds.playPop();
    applyLayout([...currentItems, {
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      emoji,
      x: 0,
      y: 0
    }], question.config.flexibleTargets);
  };

  const handleAddTarget = () => {
    const label = newTargetLabel.trim() || "Sort Bin";
    const currentTargets = question.config.flexibleTargets || [];
    sounds.playPop();
    applyLayout(question.config.flexibleItems, [...currentTargets, {
      id: `bin-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      label,
      x: 0,
      y: 0,
      width: 175,
      height: 110
    }]);
  };

  const handleAutoArrange = () => {
    sounds.playPop();
    applyLayout(question.config.flexibleItems, question.config.flexibleTargets);
  };

  const handleBindItemToBin = (itemId: string, binId: string) => {
    const currentItems = question.config.flexibleItems || [];
    sounds.playPop();
    updateConfig({
      flexibleItems: currentItems.map(item => item.id === itemId ? { ...item, targetBin: binId || undefined } : item)
    });
  };

  const handleSetItemType = (itemId: string, type: string) => {
    const currentItems = question.config.flexibleItems || [];
    sounds.playPop();
    updateConfig({
      flexibleItems: currentItems.map(item => item.id === itemId ? { ...item, type: type as any || undefined } : item)
    });
  };

  const handleClearAllItemTypes = () => {
    sounds.playTock();
    updateConfig({
      flexibleItems: (question.config.flexibleItems || []).map(item => ({ ...item, type: undefined }))
    });
  };

  const handleRemoveFlexibleItem = (itemId: string) => {
    sounds.playTock();
    applyLayout(
      (question.config.flexibleItems || []).filter(item => item.id !== itemId),
      question.config.flexibleTargets
    );
  };

  const handleRenameFlexibleTarget = (targetId: string, label: string) => {
    updateConfig({
      flexibleTargets: (question.config.flexibleTargets || []).map(t =>
        t.id === targetId ? { ...t, label } : t
      )
    });
  };

  const handleRemoveFlexibleTarget = (targetId: string) => {
    sounds.playTock();
    applyLayout(
      (question.config.flexibleItems || []).map(item =>
        item.targetBin === targetId ? { ...item, targetBin: undefined } : item
      ),
      (question.config.flexibleTargets || []).filter(t => t.id !== targetId)
    );
  };

  return (

                  <div className="space-y-4">
                    <div className="bg-indigo-50/60 border border-indigo-100 p-3 rounded-xl">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 font-mono block mb-1">
                        Flexible Question Canvas
                      </span>
                      <p className="text-[10px] font-medium text-indigo-900 leading-relaxed">
                        Design custom counting, sorting, multiple-choice, or free-form text questions. Drag items and bins directly on the canvas to place them!
                      </p>
                    </div>

                    {/* Mode selector */}
                    <div>
                      <Label>Activity Format Mode</Label>
                      <select
                        value={question.config.flexibleMode || "multichoice"}
                        onChange={(e) => update({
                          config: { ...question.config, flexibleMode: e.target.value as any }
                        })}
                        className="w-full text-xs p-2.5 border border-slate-200 rounded-md outline-none bg-white font-medium mt-1 cursor-pointer"
                      >
                        <option value="multichoice">Multiple Choice Buttons</option>
                        <option value="textinput">Freeform Text/Numeric Input</option>
                        <option value="dragmatch">Drag & Drop Sort/Match Bins</option>
                        <option value="tapcount">Interactive Click-to-Count</option>
                      </select>
                    </div>

                    {/* Background theme selector */}
                    <div>
                      <Label>Canvas Background Theme</Label>
                      <select
                        value={question.config.flexibleBgStyle || "clean"}
                        onChange={(e) => update({
                          config: { ...question.config, flexibleBgStyle: e.target.value as any }
                        })}
                        className="w-full text-xs p-2.5 border border-slate-200 rounded-md outline-none bg-white font-medium mt-1 cursor-pointer"
                      >
                        <option value="clean">Clean Slate Off-White</option>
                        <option value="board">Chalkboard Dark Slate</option>
                        <option value="grid">Blue Notebook Grid</option>
                        <option value="stars">Starry Night Deep Navy</option>
                        <option value="meadow">Grassy Meadow Green</option>
                      </select>
                    </div>

                    {/* Auto-arrange: one tap tidies items + bins into a clean layout */}
                    {((question.config.flexibleMode === "dragmatch" || question.config.flexibleMode === "tapcount")
                      && ((question.config.flexibleItems || []).length > 0 || (question.config.flexibleTargets || []).length > 0)) && (
                      <button
                        onClick={handleAutoArrange}
                        className="w-full flex items-center justify-center gap-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-md py-2 cursor-pointer transition-colors"
                        title="Tidy all items and bins into a clean default layout"
                      >
                        <Wand2 size={13} /> Auto-arrange layout
                      </button>
                    )}

                    {/* Correct answer text */}
                    {(question.config.flexibleMode === "multichoice" || question.config.flexibleMode === "textinput") && (
                      <div>
                        <Label>Expected Correct Answer</Label>
                        <Input
                          type="text"
                          value={question.config.flexibleCorrectAnswer || ""}
                          onChange={(e) => update({
                            config: { ...question.config, flexibleCorrectAnswer: e.target.value }
                          })}
                          placeholder="e.g. 5, or Apple, or White"
                          className="mt-1"
                        />
                        <span className="text-[9px] text-slate-400 font-medium block mt-1">
                          The system will validate student submissions against this exact text (case-insensitive).
                        </span>
                      </div>
                    )}

                    {/* Choice options (for Multiple Choice only) */}
                    {question.config.flexibleMode === "multichoice" && (
                      <div>
                        <Label>Choice Options (Comma Separated)</Label>
                        <Input
                          type="text"
                          value={(question.config.flexibleOptions || []).join(", ")}
                          onChange={(e) => {
                            const parsed = e.target.value.split(",").map(s => s.trim()).filter(Boolean);
                            update({
                              config: { ...question.config, flexibleOptions: parsed }
                            });
                          }}
                          placeholder="e.g. 3, 4, 5, 6"
                          className="mt-1"
                        />
                        <span className="text-[9px] text-slate-400 font-medium block mt-1">
                          List options separated by commas that students will click.
                        </span>
                      </div>
                    )}

                    {/* Add Draggable Item Section */}
                    <div className="border-t border-slate-100 pt-3.5 space-y-2">
                      <Label>Add Draggable Item (Emoji, Number, or Letter)</Label>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Input
                          type="text"
                          value={newItemEmoji}
                          onChange={(e) => setNewItemEmoji(e.target.value)}
                          className="w-16 h-8 text-center text-sm bg-white font-bold"
                          maxLength={6}
                        />
                        <div className="flex flex-col gap-1.5 flex-1">
                          {/* Emojis presets */}
                          <div className="flex flex-wrap gap-1">
                            {["🍎", "🧸", "🚗", "🎈", "⭐", "🦆"].map(emoji => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => {
                                  setNewItemEmoji(emoji);
                                  sounds.playPop();
                                }}
                                className={`w-7 h-7 text-center rounded border text-sm flex items-center justify-center hover:bg-slate-100 cursor-pointer ${
                                  newItemEmoji === emoji ? "border-indigo-500 bg-indigo-50/50" : "border-slate-200 bg-white"
                                }`}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                          {/* Alphanumeric presets */}
                          <div className="flex flex-wrap gap-1">
                            {["1", "2", "3", "A", "B", "C", "X", "Y"].map(char => (
                              <button
                                key={char}
                                type="button"
                                onClick={() => {
                                  setNewItemEmoji(char);
                                  sounds.playPop();
                                }}
                                className={`w-7 h-7 text-center rounded border text-xs font-extrabold flex items-center justify-center hover:bg-slate-100 cursor-pointer ${
                                  newItemEmoji === char ? "border-indigo-500 bg-indigo-50/50" : "border-slate-200 bg-white"
                                }`}
                              >
                                {char}
                              </button>
                            ))}
                          </div>
                        </div>
                        <Button 
                          onClick={handleAddItem}
                          size="sm"
                          className="bg-indigo-650 hover:bg-indigo-700 text-white font-bold h-8 text-[11px] px-2.5 flex items-center gap-1"
                        >
                          <Plus size={11} /> Add
                        </Button>
                      </div>
                    </div>

                    {/* Add Targets / Bins (Only in dragmatch) */}
                    {(question.config.flexibleMode === "dragmatch") && (
                      <div className="border-t border-slate-100 pt-3.5 space-y-2">
                        <Label>Add Target Sort Bin</Label>
                        <div className="flex items-center gap-1.5 mt-1">
                          <Input
                            type="text"
                            value={newTargetLabel}
                            onChange={(e) => setNewTargetLabel(e.target.value)}
                            placeholder="e.g. Toys Basket"
                            className="flex-1 h-8 text-xs bg-white font-bold"
                          />
                          <div className="flex gap-1">
                            {["🧺 Basket", "📦 Box", "🧸 Toy Box", "🍽️ Plate"].map(label => (
                              <button
                                key={label}
                                onClick={() => {
                                  setNewTargetLabel(label);
                                  sounds.playPop();
                                }}
                                className={`px-2 h-7 rounded border text-[10px] font-bold flex items-center justify-center hover:bg-slate-100 cursor-pointer ${
                                  newTargetLabel === label ? "border-indigo-500 bg-indigo-50/50" : "border-slate-200 bg-white"
                                }`}
                              >
                                {label.split(" ")[0]}
                              </button>
                            ))}
                          </div>
                          <Button 
                            onClick={handleAddTarget}
                            size="sm"
                            className="bg-indigo-650 hover:bg-indigo-700 text-white font-bold h-8 text-[11px] px-2.5 flex items-center gap-1"
                          >
                            <Plus size={11} /> Bin
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Configure Sorting Rules list (Only in dragmatch) */}
                    {(question.config.flexibleMode === "dragmatch") && (
                      <div className="border-t border-slate-100 pt-3.5 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <Label>Configure Sorting Rules</Label>
                          {(question.config.flexibleItems || []).some(i => i.type) && (
                            <button
                              onClick={handleClearAllItemTypes}
                              className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 border border-indigo-200 rounded px-2 py-0.5 cursor-pointer transition-colors"
                              title="Reset every item's Asset Type back to Emoji / Text so it shows its own emoji"
                            >
                              Reset all to emoji
                            </button>
                          )}
                        </div>
                        {!(question.config.flexibleItems || []).length ? (
                          <span className="text-[10px] font-medium text-slate-400 italic block mt-1">Add items first to assign them target bins.</span>
                        ) : (
                          <div className="border border-slate-250 bg-white rounded-xl p-2 max-h-[140px] overflow-y-auto space-y-1.5 mt-1">
                            {(question.config.flexibleItems || []).map((item) => (
                              <div key={item.id} className="flex items-center justify-between gap-2 p-1.5 border-b border-slate-50 last:border-0 text-xs">
                                <div className="flex items-center gap-1.5 font-bold text-slate-700">
                                  <span className="text-base">{item.emoji}</span>
                                  <span className="text-[9px] text-slate-400 font-mono">ID: {item.id.substring(item.id.length - 4)}</span>
                                  <button
                                    onClick={() => handleRemoveFlexibleItem(item.id)}
                                    className="w-4 h-4 bg-rose-500 text-white rounded-full flex items-center justify-center text-[9px] hover:bg-rose-600 transition-colors font-sans shadow"
                                    title="Remove this item"
                                  >
                                    ×
                                  </button>
                                </div>
                                <div className="flex gap-1.5 items-center">
                                  {/* Asset Type Dropdown */}
                                  <select
                                    value={item.type || ""}
                                    onChange={(e) => handleSetItemType(item.id, e.target.value)}
                                    className="text-[10px] border border-slate-200 rounded px-1.5 py-0.5 bg-slate-50 font-bold text-slate-600 cursor-pointer outline-none focus:border-indigo-500 w-[75px] truncate"
                                  >
                                    <option value="">Emoji / Text</option>
                                    {/* Shapes and Goods Sort sprites alike — any artwork
                                        `CountingAsset` can draw. See `assetCatalog.ts`. */}
                                    {DRAWABLE_ASSETS.map(asset => (
                                      <option key={asset.id} value={asset.id}>
                                        {asset.label}
                                      </option>
                                    ))}
                                  </select>

                                  {/* Target Bin Dropdown */}
                                  <select
                                    value={item.targetBin || ""}
                                    onChange={(e) => handleBindItemToBin(item.id, e.target.value)}
                                    className="text-[10px] border border-slate-200 rounded px-1.5 py-0.5 bg-slate-50 font-bold text-slate-600 cursor-pointer outline-none focus:border-indigo-500 w-[95px] truncate"
                                  >
                                    <option value="">(No bin - Free)</option>
                                    {(question.config.flexibleTargets || []).map(t => (
                                      <option key={t.id} value={t.id}>{t.label}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Manage Target Bins list (Only in dragmatch) */}
                    {(question.config.flexibleMode === "dragmatch" && (question.config.flexibleTargets || []).length > 0) && (
                      <div className="border-t border-slate-100 pt-3.5 space-y-2">
                        <Label>Manage Sort Bins</Label>
                        <div className="border border-slate-250 bg-white rounded-xl p-2 max-h-[120px] overflow-y-auto space-y-1.5 mt-1">
                          {(question.config.flexibleTargets || []).map((t) => (
                            <div key={t.id} className="flex items-center justify-between gap-2 p-1.5 border-b border-slate-50 last:border-0 text-xs">
                              <input
                                type="text"
                                value={t.label}
                                onChange={(e) => handleRenameFlexibleTarget(t.id, e.target.value)}
                                placeholder="Bin title"
                                className="flex-1 min-w-0 font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 outline-none focus:border-indigo-500"
                                title="Edit bin title"
                              />
                              <button
                                onClick={() => handleRemoveFlexibleTarget(t.id)}
                                className="shrink-0 w-4 h-4 bg-rose-500 text-white rounded-full flex items-center justify-center text-[9px] hover:bg-rose-600 transition-colors font-sans shadow"
                                title="Remove this bin"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
  );
};
