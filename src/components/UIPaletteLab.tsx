import React, { useState } from "react";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Input,
  Label,
  Textarea,
  Select,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Badge
} from "./ui";
import { 
  Palette, 
  Copy, 
  Check, 
  Volume2, 
  Sparkles, 
  Code, 
  Eye, 
  FileCode, 
  Info,
  Sliders,
  Type,
  Maximize2
} from "lucide-react";
import { sounds } from "../sound";

interface UIPaletteLabProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UIPaletteLab: React.FC<UIPaletteLabProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<"colors" | "components" | "typography" | "snippets">("colors");
  const [copiedText, setCopiedText] = useState<string | null>(null);
  
  // Interactive Button Config state
  const [btnText, setBtnText] = useState("Click Me");
  const [btnVariant, setBtnVariant] = useState<"default" | "secondary" | "outline" | "ghost" | "destructive">("default");
  const [btnSize, setBtnSize] = useState<"sm" | "md" | "lg">("md");
  const [btnDisabled, setBtnDisabled] = useState(false);

  // Interactive Badge State
  const [badgeText, setBadgeText] = useState("Premium Accent");
  const [badgeVariant, setBadgeVariant] = useState<"default" | "secondary" | "success" | "warning" | "destructive" | "outline">("default");

  // Code copy helper
  const handleCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedText(id);
    sounds.playTick();
    setTimeout(() => setCopiedText(null), 2000);
  };

  if (!isOpen) return null;

  // Code templates for copying
  const buttonCode = `<Button \n  variant="${btnVariant}" \n  size="${btnSize}"\n  disabled={${btnDisabled}}\n  onClick={() => sounds.playPop()}\n>\n  ${btnText}\n</Button>`;
  
  const badgeCode = `<Badge variant="${badgeVariant}">\n  ${badgeText}\n</Badge>`;

  const cardCode = `<Card>\n  <CardHeader>\n    <CardTitle>Card Title</CardTitle>\n    <CardDescription>A descriptive label</CardDescription>\n  </CardHeader>\n  <CardContent>\n    <p className="text-sm text-slate-600">This is the visual atomic block content styled with Tailwind.</p>\n  </CardContent>\n</Card>`;

  const inputCode = `<div className="flex flex-col gap-1.5">\n  <Label>User Input</Label>\n  <Input placeholder="Enter count..." />\n</div>`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm animate-fade-in" 
      />
      
      {/* Container box with the exact color guidelines & style */}
      <div className="bg-slate-50 rounded-2xl border border-slate-200 shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col z-10 relative animate-scale-in overflow-hidden">
        
        {/* Modal Header */}
        <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-indigo-600/20">
              <Palette size={20} />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
                UI & Theme Studio Palette Lab
                <Badge variant="success" className="text-[9px] py-0 px-1.5 font-bold">Standard Spec</Badge>
              </h2>
              <p className="text-xs text-slate-500 font-medium">Preview, customize, and copy code snippets for your atomic math design system components.</p>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-xl transition-all cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tab Selector bar */}
        <div className="bg-white border-b border-slate-100 px-6 py-2.5 flex items-center justify-between shrink-0">
          <div className="flex gap-1.5">
            <button
              onClick={() => { setActiveTab("colors"); sounds.playPop(); }}
              className={`px-4 py-2 rounded-xl text-xs font-bold font-mono tracking-wider uppercase transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "colors" 
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/15" 
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
              }`}
            >
              <Palette size={14} />
              Theme Colors
            </button>
            
            <button
              onClick={() => { setActiveTab("components"); sounds.playPop(); }}
              className={`px-4 py-2 rounded-xl text-xs font-bold font-mono tracking-wider uppercase transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "components" 
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/15" 
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
              }`}
            >
              <Sliders size={14} />
              Component Sandbox
            </button>

            <button
              onClick={() => { setActiveTab("typography"); sounds.playPop(); }}
              className={`px-4 py-2 rounded-xl text-xs font-bold font-mono tracking-wider uppercase transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "typography" 
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/15" 
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
              }`}
            >
              <Type size={14} />
              Typography Specs
            </button>

            <button
              onClick={() => { setActiveTab("snippets"); sounds.playPop(); }}
              className={`px-4 py-2 rounded-xl text-xs font-bold font-mono tracking-wider uppercase transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "snippets" 
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/15" 
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
              }`}
            >
              <Code size={14} />
              Copy-Paste Code
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-slate-400">Audio Preview:</span>
            <Button 
              variant="outline" 
              size="sm" 
              className="h-8 py-0 px-2.5 text-[10px] gap-1 font-bold font-mono bg-slate-50 border-slate-200"
              onClick={() => { sounds.playSuccess(); }}
            >
              <Volume2 size={12} className="text-slate-500" />
              Test Playback Sound
            </Button>
          </div>
        </div>

        {/* Tab Contents Area */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8">
          
          {/* TAB 1: Theme Colors Swatches */}
          {activeTab === "colors" && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4 flex items-start gap-3">
                <Info size={16} className="text-indigo-600 mt-0.5 shrink-0" />
                <div className="text-xs text-indigo-900/95 leading-relaxed">
                  <strong>Color Design Specs:</strong> These brand-aligned Tailwind variables represent the high-contrast physical design board of the <strong>Counting Skills Studio</strong>. Primary purple accents prompt learning steps, Secondary hot pink anchors destructive and celebratory markers, and the soft Neutral ice-blue frames all student activities.
                </div>
              </div>

              {/* Grid Layout closely matching the attached design mockup */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                
                {/* PRIMARY SECTION */}
                <Card className="overflow-hidden border-slate-200 shadow-xs">
                  <div className="bg-indigo-600 p-5 text-white relative">
                    <span className="text-[10px] font-mono font-bold tracking-widest uppercase opacity-75">Primary Accent</span>
                    <h3 className="text-lg font-black tracking-tight mt-1">#6B46C1</h3>
                    <Badge variant="success" className="absolute top-4 right-4 bg-white/20 text-white border-transparent">Active</Badge>
                  </div>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-slate-500">indigo-50</span>
                      <div className="w-12 h-6 rounded bg-indigo-50 border border-slate-100" />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-slate-500">indigo-200</span>
                      <div className="w-12 h-6 rounded bg-indigo-200" />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-slate-500">indigo-400</span>
                      <div className="w-12 h-6 rounded bg-indigo-400" />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-slate-500">indigo-600</span>
                      <div className="w-12 h-6 rounded bg-indigo-600" />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-slate-500">indigo-800</span>
                      <div className="w-12 h-6 rounded bg-indigo-800" />
                    </div>
                  </CardContent>
                </Card>

                {/* SECONDARY SECTION */}
                <Card className="overflow-hidden border-slate-200 shadow-xs">
                  <div className="bg-rose-600 p-5 text-white relative">
                    <span className="text-[10px] font-mono font-bold tracking-widest uppercase opacity-75">Secondary Pink</span>
                    <h3 className="text-lg font-black tracking-tight mt-1">#FF2D78</h3>
                  </div>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-slate-500">rose-50</span>
                      <div className="w-12 h-6 rounded bg-rose-50 border border-slate-100" />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-slate-500">rose-100</span>
                      <div className="w-12 h-6 rounded bg-rose-100" />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-slate-500">rose-300</span>
                      <div className="w-12 h-6 rounded bg-rose-300" />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-slate-500">rose-600</span>
                      <div className="w-12 h-6 rounded bg-rose-600" />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-slate-500">rose-800</span>
                      <div className="w-12 h-6 rounded bg-rose-800" />
                    </div>
                  </CardContent>
                </Card>

                {/* TERTIARY SECTION */}
                <Card className="overflow-hidden border-slate-200 shadow-xs">
                  <div className="bg-amber-600 p-5 text-white relative">
                    <span className="text-[10px] font-mono font-bold tracking-widest uppercase opacity-75">Tertiary Gold</span>
                    <h3 className="text-lg font-black tracking-tight mt-1">#FFD600</h3>
                  </div>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-slate-500">amber-50</span>
                      <div className="w-12 h-6 rounded bg-amber-50 border border-slate-100" />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-slate-500">amber-100</span>
                      <div className="w-12 h-6 rounded bg-amber-100" />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-slate-500">amber-300</span>
                      <div className="w-12 h-6 rounded bg-amber-300" />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-slate-500">amber-600</span>
                      <div className="w-12 h-6 rounded bg-amber-600" />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-slate-500">amber-800</span>
                      <div className="w-12 h-6 rounded bg-amber-800" />
                    </div>
                  </CardContent>
                </Card>

                {/* NEUTRAL / BASE SECTION */}
                <Card className="overflow-hidden border-slate-200 shadow-xs">
                  <div className="bg-slate-700 p-5 text-white relative">
                    <span className="text-[10px] font-mono font-bold tracking-widest uppercase opacity-75">Neutral Slate</span>
                    <h3 className="text-lg font-black tracking-tight mt-1">#F0F4FF</h3>
                  </div>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-slate-500">slate-100</span>
                      <div className="w-12 h-6 rounded bg-slate-100 border border-slate-200" />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-slate-500">slate-200</span>
                      <div className="w-12 h-6 rounded bg-slate-200" />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-slate-500">slate-400</span>
                      <div className="w-12 h-6 rounded bg-slate-400" />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-slate-500">slate-600</span>
                      <div className="w-12 h-6 rounded bg-slate-600" />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-slate-500">slate-900</span>
                      <div className="w-12 h-6 rounded bg-slate-900" />
                    </div>
                  </CardContent>
                </Card>

              </div>

              {/* Real-world Interactive UI Preview Mock */}
              <div className="bg-slate-100 rounded-2xl p-6 border border-slate-200 mt-6">
                <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-500 mb-4 flex items-center gap-1.5">
                  <Sparkles size={12} className="text-indigo-600" />
                  Live Theme Component Preview Integration
                </h4>
                <div className="flex flex-wrap gap-4 items-center justify-center bg-white p-6 rounded-xl border border-slate-200/60 shadow-xs">
                  <div className="flex flex-col items-center gap-1">
                    <Button variant="default" className="shadow-lg shadow-indigo-600/10">Primary Action</Button>
                    <span className="text-[10px] font-mono text-slate-400 mt-1">#6B46C1</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <Button variant="destructive" className="shadow-lg shadow-rose-600/10">Destructive Alert</Button>
                    <span className="text-[10px] font-mono text-slate-400 mt-1">#FF2D78</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <button className="h-11 px-5 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold transition-all text-sm shadow-md shadow-amber-600/10 flex items-center justify-center gap-2">
                      Tertiary Trigger
                    </button>
                    <span className="text-[10px] font-mono text-slate-400 mt-1">#FFD600</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <Badge variant="success">Success Tag</Badge>
                    <span className="text-[10px] font-mono text-slate-400 mt-1">Status OK</span>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: Component Sandbox */}
          {activeTab === "components" && (
            <div className="space-y-8 animate-fade-in">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* Left Controller Panel */}
                <div className="space-y-6">
                  <Card className="border-slate-200">
                    <CardHeader className="pb-4">
                      <CardTitle className="text-sm font-extrabold flex items-center gap-2">
                        <Sliders size={16} className="text-indigo-600" />
                        Component Props Configurator
                      </CardTitle>
                      <CardDescription>Adjust variables to customize components and generate compliant markup.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      
                      {/* Button configuration fields */}
                      <div className="border-b border-slate-100 pb-4 space-y-4">
                        <h4 className="text-xs font-bold text-slate-700">Button Configuration</h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="flex flex-col gap-1.5">
                            <Label>Button Label</Label>
                            <Input 
                              value={btnText} 
                              onChange={(e) => setBtnText(e.target.value)} 
                              placeholder="Button content"
                            />
                          </div>
                          
                          <div className="flex flex-col gap-1.5">
                            <Label>Variant</Label>
                            <Select 
                              value={btnVariant} 
                              onChange={(e) => setBtnVariant(e.target.value as any)}
                            >
                              <option value="default">Default (Primary)</option>
                              <option value="secondary">Secondary</option>
                              <option value="outline">Outline</option>
                              <option value="ghost">Ghost</option>
                              <option value="destructive">Destructive</option>
                            </Select>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="flex flex-col gap-1.5">
                            <Label>Size</Label>
                            <Select 
                              value={btnSize} 
                              onChange={(e) => setBtnSize(e.target.value as any)}
                            >
                              <option value="sm">Small (sm)</option>
                              <option value="md">Medium (md)</option>
                              <option value="lg">Large (lg)</option>
                            </Select>
                          </div>
                          <div className="flex flex-col justify-end">
                            <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer h-11">
                              <input 
                                type="checkbox" 
                                checked={btnDisabled} 
                                onChange={(e) => setBtnDisabled(e.target.checked)}
                                className="rounded text-indigo-600 focus:ring-indigo-500/20 w-4 h-4"
                              />
                              Disabled state
                            </label>
                          </div>
                        </div>
                      </div>

                      {/* Badge configuration fields */}
                      <div className="space-y-4">
                        <h4 className="text-xs font-bold text-slate-700">Badge Configuration</h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="flex flex-col gap-1.5">
                            <Label>Badge Label</Label>
                            <Input 
                              value={badgeText} 
                              onChange={(e) => setBadgeText(e.target.value)} 
                            />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <Label>Variant</Label>
                            <Select 
                              value={badgeVariant} 
                              onChange={(e) => setBadgeVariant(e.target.value as any)}
                            >
                              <option value="default">Default</option>
                              <option value="secondary">Secondary</option>
                              <option value="success">Success</option>
                              <option value="warning">Warning</option>
                              <option value="destructive">Destructive</option>
                              <option value="outline">Outline</option>
                            </Select>
                          </div>
                        </div>
                      </div>

                    </CardContent>
                  </Card>
                </div>

                {/* Right Interactive Sandbox & Code Preview Panel */}
                <div className="space-y-6">
                  <Card className="border-slate-200">
                    <CardHeader className="pb-4">
                      <CardTitle className="text-sm font-extrabold flex items-center gap-2">
                        <Eye size={16} className="text-indigo-600" />
                        Live Interactive Sandbox
                      </CardTitle>
                      <CardDescription>Click the controls below to trigger physical synthesized sound effects.</CardDescription>
                    </CardHeader>
                    <CardContent className="bg-slate-50 border-y border-slate-150 p-6 flex flex-col items-center justify-center min-h-[160px] gap-6 rounded-b-none">
                      
                      {/* Active Button rendering based on configuration variables */}
                      <div className="flex flex-col items-center gap-1.5">
                        <Label className="text-[10px] text-slate-400">Button Preview</Label>
                        <Button 
                          variant={btnVariant} 
                          size={btnSize}
                          disabled={btnDisabled}
                          onClick={() => {
                            sounds.playPop();
                          }}
                        >
                          {btnText}
                        </Button>
                      </div>

                      {/* Active Badge rendering based on configuration variables */}
                      <div className="flex flex-col items-center gap-1.5">
                        <Label className="text-[10px] text-slate-400">Badge Preview</Label>
                        <Badge variant={badgeVariant}>
                          {badgeText}
                        </Badge>
                      </div>

                    </CardContent>
                    
                    {/* Synchronous Generated Code output block */}
                    <CardFooter className="bg-slate-900 border-none rounded-b-2xl p-4 flex flex-col items-start font-mono text-xs text-slate-300 gap-3 relative">
                      <div className="flex items-center justify-between w-full border-b border-slate-800 pb-2 text-[10px] font-bold text-slate-500">
                        <span>GENERATED REACT SNIPPET</span>
                        <button
                          onClick={() => handleCopy(buttonCode, "btnCode")}
                          className="hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          {copiedText === "btnCode" ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                          {copiedText === "btnCode" ? "Copied!" : "Copy"}
                        </button>
                      </div>
                      <pre className="overflow-x-auto w-full max-h-[120px] leading-relaxed text-indigo-300">
                        {buttonCode}
                      </pre>
                    </CardFooter>
                  </Card>
                </div>

              </div>
            </div>
          )}

          {/* TAB 3: Typography Specs */}
          {activeTab === "typography" && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4 flex items-start gap-3">
                <Info size={16} className="text-indigo-600 mt-0.5 shrink-0" />
                <div className="text-xs text-indigo-900/95 leading-relaxed">
                  <strong>Typography Guidelines:</strong> The studio standardizes on <strong>Plus Jakarta Sans</strong> for early education display layout headings. Plus Jakarta Sans offers soft, inviting geographic curvature designed for young learners. We supplement this with <strong>JetBrains Mono</strong> for game counts and developer/designer status tags.
                </div>
              </div>

              {/* Grid mirroring the attached design mockup blocks */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Headline Specifications */}
                <Card className="border-slate-200">
                  <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-3 px-5 flex flex-row items-center justify-between">
                    <span className="text-[10px] font-mono font-bold tracking-wider text-slate-500">HEADLINE SPEC</span>
                    <Badge variant="outline" className="font-mono text-[9px]">Plus Jakarta Sans</Badge>
                  </CardHeader>
                  <CardContent className="p-6 flex items-center justify-center min-h-[180px] bg-white">
                    <div className="text-center">
                      <div className="text-7xl font-extrabold text-slate-800 tracking-tight leading-none mb-1">Aa</div>
                      <p className="text-xs text-slate-500 font-medium">Tracking Tight, Extrabold, Weight 800</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Body Specifications */}
                <Card className="border-slate-200">
                  <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-3 px-5 flex flex-row items-center justify-between">
                    <span className="text-[10px] font-mono font-bold tracking-wider text-slate-500">BODY SPEC</span>
                    <Badge variant="outline" className="font-mono text-[9px]">Plus Jakarta Sans</Badge>
                  </CardHeader>
                  <CardContent className="p-6 flex items-center justify-center min-h-[180px] bg-white">
                    <div className="text-center">
                      <div className="text-5xl font-medium text-slate-600 tracking-normal leading-none mb-2">Aa</div>
                      <p className="text-xs text-slate-500 font-medium">Tracking Normal, Medium, Weight 500</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Label Specifications */}
                <Card className="border-slate-200">
                  <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-3 px-5 flex flex-row items-center justify-between">
                    <span className="text-[10px] font-mono font-bold tracking-wider text-slate-500">FORM LABEL SPEC</span>
                    <Badge variant="outline" className="font-mono text-[9px]">Plus Jakarta Sans</Badge>
                  </CardHeader>
                  <CardContent className="p-6 flex items-center justify-center min-h-[180px] bg-white">
                    <div className="text-center">
                      <div className="text-3xl font-extrabold uppercase tracking-widest text-slate-500 leading-none mb-2">Aa</div>
                      <p className="text-xs text-slate-500 font-medium">Tracking Widest, Uppercase, Font Mono</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Code Specifications */}
                <Card className="border-slate-200">
                  <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-3 px-5 flex flex-row items-center justify-between">
                    <span className="text-[10px] font-mono font-bold tracking-wider text-slate-500">TECHNIQUE DATA SPEC</span>
                    <Badge variant="outline" className="font-mono text-[9px]">JetBrains Mono</Badge>
                  </CardHeader>
                  <CardContent className="p-6 flex items-center justify-center min-h-[180px] bg-white">
                    <div className="text-center">
                      <div className="text-3xl font-mono font-bold text-indigo-600 mb-2">{"{ count: 10 }"}</div>
                      <p className="text-xs text-slate-500 font-medium">Constant Spacing, JetBrains Mono Monospace</p>
                    </div>
                  </CardContent>
                </Card>

              </div>
            </div>
          )}

          {/* TAB 4: Copy-Paste Code Snippets */}
          {activeTab === "snippets" && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4 flex items-start gap-3">
                <Info size={16} className="text-indigo-600 mt-0.5 shrink-0" />
                <div className="text-xs text-indigo-900/95 leading-relaxed">
                  <strong>Developer Best Practices:</strong> Copy these robust, fully responsive design blocks directly into your interactive counting canvas files. All components utilize high-contrast Tailwind styling and fully support responsive sizes out-of-the-box.
                </div>
              </div>

              {/* CARD BLOCK */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-mono font-extrabold text-slate-600 uppercase">1. POLISHED CONTAINER CARD</span>
                  <button
                    onClick={() => handleCopy(cardCode, "cardCode")}
                    className="text-[10px] font-mono font-bold text-indigo-600 hover:text-indigo-500 flex items-center gap-1 cursor-pointer"
                  >
                    {copiedText === "cardCode" ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                    {copiedText === "cardCode" ? "Copied!" : "Copy Code"}
                  </button>
                </div>
                <pre className="bg-slate-900 text-slate-300 font-mono text-xs p-4 rounded-xl overflow-x-auto leading-relaxed">
                  {cardCode}
                </pre>
              </div>

              {/* INPUT CONTAINER BLOCK */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-mono font-extrabold text-slate-600 uppercase">2. INPUT CONTAINER & MONOSPACE LABEL</span>
                  <button
                    onClick={() => handleCopy(inputCode, "inputCode")}
                    className="text-[10px] font-mono font-bold text-indigo-600 hover:text-indigo-500 flex items-center gap-1 cursor-pointer"
                  >
                    {copiedText === "inputCode" ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                    {copiedText === "inputCode" ? "Copied!" : "Copy Code"}
                  </button>
                </div>
                <pre className="bg-slate-900 text-slate-300 font-mono text-xs p-4 rounded-xl overflow-x-auto leading-relaxed">
                  {inputCode}
                </pre>
              </div>

              {/* TECHNIQUE CANVAS IMPLEMENTATION TIP */}
              <Card className="border-indigo-100 bg-indigo-50/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-xs font-extrabold uppercase text-indigo-800 tracking-wider flex items-center gap-2">
                    <FileCode size={14} />
                    How to expand counting techniques:
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-indigo-950 leading-relaxed space-y-2 font-medium">
                  <p>1. Open <code className="font-mono font-bold bg-indigo-100/60 px-1 py-0.5 rounded text-indigo-700">src/types.ts</code> and register your technique inside <code className="font-mono font-bold bg-indigo-100/60 px-1 py-0.5 rounded text-indigo-700">CountingTechnique</code> enum.</p>
                  <p>2. Build the canvas and use the atomic <code className="font-mono font-bold bg-indigo-100/60 px-1 py-0.5 rounded text-indigo-700">&lt;Button&gt;</code>, <code className="font-mono font-bold bg-indigo-100/60 px-1 py-0.5 rounded text-indigo-700">&lt;Badge&gt;</code> and sound indicators to ensure physical response parity.</p>
                </CardContent>
              </Card>

            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="bg-white border-t border-slate-200 px-6 py-4 flex justify-between items-center shrink-0">
          <p className="text-[10px] font-mono text-slate-400">Press ESC or click outside to dismiss the palette guide</p>
          <Button 
            onClick={onClose} 
            variant="default" 
            size="sm" 
            className="font-bold shadow-md shadow-indigo-600/10"
          >
            Close Guide
          </Button>
        </div>

      </div>
    </div>
  );
};
