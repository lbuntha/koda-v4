/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * In-app developer guide for adding a new counting game (technique). Opened
 * from the Instructor sidebar. Mirrors the "How to add a new game" recipe in
 * AGENTS.md so the workflow is one click away while authoring.
 */

import React from "react";
import { Dialog } from "./ui/Dialog";
import { Badge } from "./ui/Badge";
import { FolderPlus, FileCode2, ListPlus, TerminalSquare, Sparkles } from "lucide-react";

interface HowToAddGameModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const Step: React.FC<{
  n: number;
  icon: React.ReactNode;
  title: string;
  tag?: string;
  children: React.ReactNode;
}> = ({ n, icon, title, tag, children }) => (
  <div className="flex gap-3">
    <div className="flex flex-col items-center">
      <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm font-black shrink-0">
        {n}
      </div>
      <div className="flex-1 w-px bg-slate-200 my-1" />
    </div>
    <div className="flex-1 pb-5 min-w-0">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-indigo-600">{icon}</span>
        <h4 className="text-sm font-black text-slate-800 tracking-tight">{title}</h4>
        {tag && <Badge variant="secondary">{tag}</Badge>}
      </div>
      <div className="text-xs text-slate-600 leading-relaxed space-y-2">{children}</div>
    </div>
  </div>
);

const Code: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <pre className="bg-slate-900 text-slate-100 text-[11px] leading-relaxed font-mono p-3 rounded-lg overflow-x-auto whitespace-pre">
    {children}
  </pre>
);

const Path: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <code className="bg-slate-100 border border-slate-200 text-slate-800 px-1.5 py-0.5 rounded font-mono text-[11px]">
    {children}
  </code>
);

export const HowToAddGameModal: React.FC<HowToAddGameModalProps> = ({ isOpen, onClose }) => (
  <Dialog isOpen={isOpen} onClose={onClose} maxWidthClassName="max-w-lg">
    <div className="mb-5 pr-8">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles size={18} className="text-indigo-600" />
        <h3 className="text-base font-black text-slate-900 tracking-tight">How to Add a New Game</h3>
      </div>
      <p className="text-xs text-slate-500 font-medium">
        Every game lives in one file under <Path>src/techniques/</Path>. Add a game by adding a
        file — the canvas map, panel map, AI schema, picker, and gameplay launcher all update
        themselves. You never edit <Path>App.tsx</Path> or the registries.
      </p>
    </div>

    <div>
      <Step n={1} icon={<FileCode2 size={15} />} title="Build the three parts" tag="the real work">
        <p>Create the game's canvas, its settings panel, and its AI-generation schema:</p>
        <ul className="list-disc list-inside space-y-0.5 text-slate-600">
          <li><Path>src/components/canvases/YourCanvas.tsx</Path> — implements <Path>CanvasProps</Path></li>
          <li><Path>src/components/studio/panels/YourPanel.tsx</Path> — implements <Path>PanelProps</Path></li>
          <li><Path>src/components/studio/ai-generator/schemas/your.schema.ts</Path></li>
        </ul>
      </Step>

      <Step n={2} icon={<ListPlus size={15} />} title="Name the technique">
        <p>Add one value to the <Path>CountingTechnique</Path> enum in <Path>src/types.ts</Path>:</p>
        <Code>{`export enum CountingTechnique {
  // ...existing
  YOUR_GAME = "YOUR_GAME",
}`}</Code>
      </Step>

      <Step n={3} icon={<FolderPlus size={15} />} title="Write one manifest file">
        <p>
          Copy an existing file such as <Path>src/techniques/subitize.tsx</Path> to
          {" "}<Path>src/techniques/yourGame.tsx</Path> and fill it in. Canvas and panel are
          lazy-loaded, so each game ships as its own bundle chunk:
        </p>
        <Code>{`export const yourGame = defineTechnique({
  technique: CountingTechnique.YOUR_GAME,
  label: "17. Your Game",
  icon: <Star size={14} className="text-amber-500" />,
  defaultTargetCount: 5,
  component: React.lazy(() =>
    import("../components/canvases/YourCanvas")
      .then((m) => ({ default: m.YourCanvas }))),
  panel: React.lazy(() =>
    import("../components/studio/panels/YourPanel")
      .then((m) => ({ default: m.YourPanel }))),
  schema: yourSchema,
});`}</Code>
      </Step>

      <Step n={4} icon={<ListPlus size={15} />} title="Register it — one line">
        <p>
          Import it in <Path>src/techniques/index.ts</Path> and add it to the
          {" "}<Path>ALL_TECHNIQUES</Path> array in the order it should appear in the picker.
          This is the only shared line you touch.
        </p>
      </Step>

      <Step n={5} icon={<TerminalSquare size={15} />} title="Verify">
        <Code>{`npx tsc --noEmit && npm run build`}</Code>
        <p>
          If you forget to register a game, the app throws a clear error at load in dev
          (<Path>assertComplete</Path>) — so a half-wired game can't slip through.
        </p>
      </Step>
    </div>

    <div className="mt-1 rounded-xl bg-indigo-50 border border-indigo-100 p-3 text-[11px] text-indigo-900 leading-relaxed">
      <b>Why one file?</b> The canvas map, panel map, AI schema list, picker options, and the
      gameplay launcher are all <i>derived</i> from the manifests in
      {" "}<Path>src/techniques/</Path>. One source of truth means two developers can add games in
      parallel without merge conflicts.
    </div>
  </Dialog>
);
