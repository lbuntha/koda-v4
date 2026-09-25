/**
 * A page for trying the letter ring by hand.
 *
 * Bundled by `scripts/build-library-pages.mjs` into a single HTML file, so it
 * runs the real component and the real Phase 0 data — not a copy of either.
 * Nothing in the app imports this.
 */
import { StrictMode, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { LetterWheel, type WheelVerdict } from "../LetterWheel";
import { TUNE } from "../tracePhysics";
import { STARTER_PASSAGES } from "../../../library/data/starterPassages";
import { buildSpellingDeck, ringOf } from "../../../library/data/spellingDeck";
import { pickExtras, spellsWord, tilesOf, whyUnspellable } from "../../../library/data/tiles";
import { unitLabel } from "../../../library/data/khmer";
import type { Language } from "../../../library/data/passage";

interface Entry { t: number; text: string }

function Demo() {
  const [source, setSource] = useState<string>(STARTER_PASSAGES[0].id);
  const [idx, setIdx] = useState(0);
  const [custom, setCustom] = useState("sheep");
  const [customLang, setCustomLang] = useState<Language>("en");
  const [seed, setSeed] = useState(0);
  const [auto, setAuto] = useState(false);
  const [hint, setHint] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [lag, setLag] = useState<number>(TUNE.tipK);
  const [whip, setWhip] = useState<number>(TUNE.whip);
  const [log, setLog] = useState<Entry[]>([]);
  const [solved, setSolved] = useState(false);
  const add = (text: string) => setLog((l) => [{ t: Date.now(), text }, ...l].slice(0, 40));

  const passage = STARTER_PASSAGES.find((p) => p.id === source);
  const deck = useMemo(() => (passage ? buildSpellingDeck(passage) : []), [passage]);
  const lang: Language = passage ? passage.language : customLang;

  const round = useMemo(() => {
    if (passage) {
      const w = deck[idx % deck.length];
      return { word: w.word, tiles: w.tiles, ring: ringOf(w), gapped: w.gapped, original: w.original, problem: null as string | null };
    }
    const problem = whyUnspellable(custom, customLang);
    const t = problem ? [] : tilesOf(custom, customLang);
    const ring = [...t, ...pickExtras(t, customLang, 1)].sort(() => Math.random() - 0.5);
    return { word: custom, tiles: t, ring, gapped: null, original: custom, problem };
    // `seed` re-deals the ring when "Next" is pressed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passage, deck, idx, custom, customLang, seed]);

  const onSubmit = (labels: string[]): WheelVerdict => {
    const ok = spellsWord(labels, round.word, lang);
    add(`onSubmit([${labels.join(", ")}]) → ${ok ? "correct" : "wrong"}`);
    if (ok) setSolved(true);
    return ok ? "correct" : "wrong";
  };
  const next = () => { setSolved(false); setIdx((i) => i + 1); setSeed((s) => s + 1); add("— next word —"); };
  const km = lang === "km";

  return (
    <div className="grid">
      <div>
        <div className="panel">
          <label>What to spell</label>
          <div className="row">
            {STARTER_PASSAGES.map((p) => (
              <button key={p.id} aria-pressed={source === p.id} onClick={() => { setSource(p.id); setIdx(0); setSolved(false); }}>
                {p.title} · {p.language.toUpperCase()}
              </button>
            ))}
            <button aria-pressed={source === "custom"} onClick={() => { setSource("custom"); setSolved(false); }}>Your own word</button>
          </div>
          {source === "custom" && (
            <div className="row" style={{ marginTop: 10 }}>
              <input value={custom} onChange={(e) => { setCustom(e.target.value.trim()); setSolved(false); }} className={customLang === "km" ? "kh" : ""} aria-label="Your word" />
              <button aria-pressed={customLang === "en"} onClick={() => setCustomLang("en")}>English</button>
              <button aria-pressed={customLang === "km"} onClick={() => { setCustomLang("km"); setCustom("ស្វាយ"); }}>ខ្មែរ</button>
            </div>
          )}
        </div>

        <div className="panel stage">
          {round.gapped ? (
            <p className={`sentence ${km ? "kh" : ""}`}>
              {round.gapped.split("___")[0]}
              <span className="gap">{solved ? round.original : " "}</span>
              {round.gapped.split("___")[1]}
            </p>
          ) : (
            <p className={`sentence ${km ? "kh" : ""}`}>Spell: <b>{round.word}</b></p>
          )}
          {round.problem ? (
            <p className="err">This word cannot go on the ring: {round.problem}</p>
          ) : (
            <LetterWheel
              tiles={round.ring}
              script={km ? "khmer" : "latin"}
              display={km ? unitLabel : undefined}
              onSubmit={onSubmit}
              onTraceChange={(l) => add(`onTraceChange([${l.join(", ")}])`)}
              onStartOver={() => add("onStartOver() — not an attempt")}
              onShuffle={() => add("onShuffle()")}
              autoSubmitAt={auto ? round.tiles.length : undefined}
              highlight={hint ? round.ring.indexOf(round.tiles[0]) : null}
              disabled={disabled}
              label="Spell the missing word"
              tune={{ tipK: lag, whip }}
            />
          )}
          <div className="row" style={{ justifyContent: "center" }}>
            {passage && <span className="muted">Word {(idx % deck.length) + 1} of {deck.length}</span>}
            <button onClick={next}>Next word ›</button>
          </div>
        </div>
      </div>

      <div>
        <div className="panel">
          <label>Options</label>
          <label className="check"><input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> Taps and keys submit on the last tile</label>
          <label className="check"><input type="checkbox" checked={hint} onChange={(e) => setHint(e.target.checked)} /> Show the hint: mark the first tile</label>
          <label className="check"><input type="checkbox" checked={disabled} onChange={(e) => setDisabled(e.target.checked)} /> Disabled</label>
          <label>Trail lag · {lag}</label>
          <input type="range" min={300} max={3000} step={50} value={lag} onChange={(e) => setLag(Number(e.target.value))} />
          <label>Bend · {whip.toFixed(2)}</label>
          <input type="range" min={0} max={0.6} step={0.02} value={whip} onChange={(e) => setWhip(Number(e.target.value))} />
        </div>
        <div className="panel">
          <div className="row" style={{ justifyContent: "space-between" }}><label style={{ margin: 0 }}>What the ring reports</label><button onClick={() => setLog([])}>Clear</button></div>
          <ol className="log">{log.map((e, i) => <li key={e.t + ":" + i} className={km ? "kh" : ""}>{e.text}</li>)}</ol>
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><Demo /></StrictMode>);
