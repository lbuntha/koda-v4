"""Render the Color Sweeper planning document as standalone HTML (no dependencies)."""
from pathlib import Path
import html
import re

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'docs/COLOR_SWEEPER_BUILD_PLAN.md'
TARGET = ROOT / 'public/plans/color-sweeper.html'

def inline(value):
    value = html.escape(value)
    value = re.sub(r'`([^`]+)`', r'<code>\1</code>', value)
    value = re.sub(r'\[([^\]]+)\]\((https?://[^\s)]+)\)', r'<a href="\2">\1 ↗</a>', value)
    return re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', value)

PALETTE = {'O': ('orange', 'Orange', '●'), 'N': ('navy', 'Navy', '◆'), 'C': ('cyan', 'Cyan', '▲')}

COLOR_WORD = {'O': 'orange', 'N': 'navy', 'C': 'cyan'}
TILE = re.compile(r'([ONC])([ONC])?([0-8]|\*|!)?$')

def clue_chip(text):
    """A line, run or region clue rendered as a chip beside the grid it governs."""
    return f'<span class="clue-chip">{inline(text)}</span>'

def tile(token):
    """One grid cell. `?A` is unknown; `O2` counts its own color; `NO1` counts another."""
    if token.startswith('?'):
        name = token[1:]
        return 'unknown', 'Unknown tile ' + name, f'<b>?</b><small>{html.escape(name)}</small>'
    match = TILE.fullmatch(token)
    assert match, token
    own, counted, suffix = match.group(1), match.group(2), match.group(3) or ''
    cls, name, symbol = PALETTE[own]
    if suffix.isdigit():
        counts = COLOR_WORD[counted or own]
        label = f'{name} tile, clue counting {counts}: {suffix}'
    elif suffix == '*':
        label = name + ', outlined counting target'
    elif suffix == '!':
        label = name + ', learner-painted tile to check'
    else:
        label = name + ', fixed tile'
    cls += ' target' if suffix == '*' else ''
    cls += ' cross' if counted and counted != own else ''
    content = f'<b>{suffix if suffix.isdigit() else ""}</b><span class="color-symbol">{symbol}</span><small>{own}</small>'
    if counted and counted != own:
        # The clue counts a color its own tile is not. Without this mark the two are
        # indistinguishable on the board, which is the whole difficulty of lesson 15 onward.
        counted_cls, counted_name, counted_symbol = PALETTE[counted]
        content += f'<em class="counts {counted_cls}" title="counts {counted_name}">{counted_symbol}</em>'
    if suffix == '!':
        content += '<em class="audit-mark">!</em>'
    return cls, label, content

def board(block):
    """A worked-example board: optional header clues, a grid, optional row-gutter clues."""
    headers = [row.strip() for row in block if ':' in row and not row.strip().startswith('?')]
    grid = [row for row in block if row not in headers and row.strip()]
    rows, gutters = [], []
    for row in grid:
        cells, _, gutter = row.partition('|')
        rows.append(cells.split())
        gutters.append(gutter.strip())
    width = max(len(row) for row in rows)
    assert all(len(row) == width for row in rows), block
    assert 1 <= len(rows) <= 6 and 1 <= width <= 6, block

    rendered = [f'<figure class="board-figure" style="max-width:{min(340, 60 + 62 * width)}px">']
    for header in headers:
        rendered.append(f'<p class="board-header">{clue_chip(header)}</p>')
    rendered.append(f'<table class="puzzle-grid" aria-label="{len(rows)} by {width} example board">')
    rendered.append('<thead><tr><th scope="col"><span class="sr-only">Row / column</span></th>')
    rendered.extend(f'<th scope="col">{i + 1}</th>' for i in range(width))
    rendered.append('<th scope="col"><span class="sr-only">Row clue</span></th></tr></thead><tbody>')
    for r, row in enumerate(rows):
        rendered.append(f'<tr><th scope="row">{r + 1}</th>')
        for token in row:
            cls, label, content = tile(token)
            rendered.append(f'<td><div class="puzzle-tile {cls}" role="img" aria-label="{html.escape(label)}">{content}</div></td>')
        rendered.append(f'<td class="gutter">{clue_chip(gutters[r]) if gutters[r] else ""}</td></tr>')
    rendered.append('</tbody></table><figcaption>● O Orange &nbsp; ◆ N Navy &nbsp; ▲ C Cyan<br>'
                    '? = unknown · outline = target · ! = paint to check<br>'
                    'A small second symbol means the clue counts <em>that</em> color, not its own.'
                    '</figcaption></figure>')
    return ''.join(rendered)

lines = SOURCE.read_text().splitlines()
out, toc = [], []
i = 0
section = False
solution = False
article = False

def close_lesson():
    global solution, article
    if solution:
        out.append('</details>')
        solution = False
    if article:
        out.append('</article>')
        article = False

while i < len(lines):
    line = lines[i]
    if not line.strip():
        i += 1
        continue
    if line.startswith('```'):
        language = line[3:].strip()
        block = []
        i += 1
        while i < len(lines) and not lines[i].startswith('```'):
            block.append(lines[i])
            i += 1
        out.append(board(block) if language == 'board' else '<pre><code>' + html.escape('\n'.join(block)) + '</code></pre>')
        i += 1
        continue
    if line.startswith('# '):
        i += 1
        continue
    if line.startswith('## '):
        close_lesson()
        if section:
            out.append('</section>')
        title = line[3:]
        number = re.match(r'(\d+)\.', title)
        anchor = 'section-' + number.group(1) if number else 'status' if title.startswith('Status') else 'overview'
        out.append(f'<section id="{anchor}"><h2>{inline(title)}</h2>')
        toc.append((anchor, title))
        section = True
        if anchor == 'section-17':
            out.append('<div class="example-controls"><button type="button" id="expand-examples">Show all worked answers</button><button type="button" id="collapse-examples">Hide all worked answers</button></div><nav class="lesson-links" aria-label="Jump to a lesson example">')
            out.extend(f'<a href="#lesson-{n:02d}">{n:02d}</a>' for n in range(1, 41))
            out.append('</nav>')
        i += 1
        continue
    if line.startswith('### '):
        close_lesson()
        title = line[4:]
        lesson = re.match(r'Lesson (\d+) ', title)
        if lesson:
            n = int(lesson.group(1))
            out.append(f'<article class="lesson-example" id="lesson-{n:02d}" data-lesson="{n}"><span class="eyebrow">{"Independent practice" if n >= 31 else "Teaching technique"}</span>')
            article = True
        out.append('<h3>' + inline(title) + '</h3>')
        i += 1
        continue
    if line.startswith('|'):
        rows = []
        while i < len(lines) and lines[i].startswith('|'):
            cells = [s.strip() for s in lines[i].strip().strip('|').split('|')]
            if not all(re.fullmatch(r':?-+:?', cell) for cell in cells):
                rows.append(cells)
            i += 1
        out.append('<div class="table-wrap" role="region" aria-label="Scrollable plan table" tabindex="0"><table><thead><tr>' + ''.join('<th scope="col">' + inline(s) + '</th>' for s in rows[0]) + '</tr></thead><tbody>')
        for row in rows[1:]:
            for c, value in enumerate(row):
                value = inline(value)
                number = re.match(r'^(\d+) / ', row[c]) if c == 0 else None
                if number and 1 <= int(number.group(1)) <= 40:
                    value += f' <a class="example-link" href="#lesson-{int(number.group(1)):02d}">Worked example ↓</a>'
                row[c] = '<td>' + value + '</td>'
            out.append('<tr>' + ''.join(row) + '</tr>')
        out.append('</tbody></table></div>')
        continue
    if re.match(r'(- |\d+\. )', line):
        tag = 'ol' if re.match(r'\d+\.', line) else 'ul'
        items = []
        while i < len(lines) and re.match(r'(- |\d+\. )', lines[i]):
            items.append(re.sub(r'^(- |\d+\. )', '', lines[i]))
            i += 1
        out.append(f'<{tag}>' + ''.join('<li>' + inline(item) + '</li>' for item in items) + f'</{tag}>')
        continue
    if article and line == '**Worked reasoning:**':
        out.append('<details class="worked-answer"><summary>Show reasoning, answer and animation</summary>')
        solution = True
    paragraph = []
    while i < len(lines) and lines[i].strip() and not re.match(r'^(#|\||```|- |\d+\. )', lines[i]):
        paragraph.append(lines[i])
        i += 1
    assert paragraph, f'Unhandled Markdown: {lines[i]}'
    out.append('<p>' + inline(' '.join(paragraph)) + '</p>')
close_lesson()
if section:
    out.append('</section>')

CSS = '''
:root{color-scheme:light dark;--bg:#f6f2eb;--paper:#fffdf9;--ink:#19283b;--muted:#58616a;--line:#dcd7ce;--accent:#6743b0;--soft:#eee7f7}*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:100px}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.7 "Avenir Next",system-ui,sans-serif}header{position:sticky;top:0;z-index:5;background:var(--paper);border-bottom:1px solid var(--line)}.bar{max-width:1160px;margin:auto;padding:14px 24px;display:flex;gap:24px;align-items:center;justify-content:space-between}.brand{font-weight:750;white-space:nowrap}.brand span{color:var(--accent)}nav{display:flex;gap:20px;overflow:auto}nav a{white-space:nowrap;font-size:13px}a{color:var(--accent);text-underline-offset:4px}main{max-width:1120px;margin:auto;padding:35px 24px 60px}.intro{padding:20px 0 26px}.eyebrow{color:var(--accent);font-size:11px;font-weight:750;text-transform:uppercase;letter-spacing:1.6px}h1{font-size:clamp(42px,7vw,76px);line-height:1.05;letter-spacing:-2px;margin:18px 0}h1 span{color:#d44800}.lead{color:var(--muted);font-size:19px;max-width:670px}.pill{display:inline-block;border:1px solid var(--line);padding:5px 12px;border-radius:24px;font-size:12px;margin:4px 6px 4px 0}.actions,.example-controls{display:flex;gap:10px;flex-wrap:wrap;margin:20px 0}button,.button{font:inherit;cursor:pointer;min-height:44px;background:var(--soft);color:var(--accent);border:1px solid var(--line);border-radius:12px;padding:10px 16px;text-decoration:none;font-size:14px}.button{background:var(--accent);color:var(--paper)}section{padding-top:40px}h2{font-size:29px;line-height:1.3;margin:0 0 22px;letter-spacing:-.6px}h3{font-size:21px;line-height:1.35;margin:28px 0 14px}p{margin:0 0 16px}li{margin:8px 0}code{font-size:.86em;overflow-wrap:anywhere}pre{background:var(--soft);padding:20px;border-radius:14px;white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px}.table-wrap{max-width:100%;overflow-x:auto;margin:22px 0;border:1px solid var(--line);border-radius:15px;background:var(--paper)}table{width:100%;border-collapse:collapse;font-size:13px}th,td{padding:14px;vertical-align:top;text-align:left;min-width:115px;border-bottom:1px solid var(--line)}th{background:var(--soft);font-size:12px}tr:last-child td{border:0}.example-link{display:block;font-size:11px;margin-top:7px}.toc{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px 18px;padding:16px 0}.toc a{font-size:13px}summary{cursor:pointer;font-weight:650;min-height:44px;padding:10px 0}.lesson-links{flex-wrap:wrap;overflow:visible;gap:7px;margin:20px 0}.lesson-links a{display:grid;place-items:center;min-width:44px;min-height:44px;border-radius:10px;background:var(--soft);text-decoration:none}.lesson-example{scroll-margin-top:110px;background:var(--paper);border:1px solid var(--line);border-radius:20px;padding:26px;margin:24px 0}.lesson-example h3{margin-top:8px}.worked-answer{border-top:1px solid var(--line);margin-top:18px;padding-top:8px}.worked-answer summary{color:var(--accent)}.board-figure{margin:20px 0 24px;max-width:320px}.puzzle-grid{border-collapse:separate;border-spacing:6px;table-layout:fixed;width:100%;font-size:12px}.puzzle-grid th,.puzzle-grid td{padding:0;border:0;min-width:0;text-align:center;vertical-align:middle;background:transparent}.puzzle-grid th:first-child{width:20px}.puzzle-grid th{color:var(--muted);font-weight:500}.puzzle-tile{position:relative;display:grid;place-items:center;aspect-ratio:1;border-radius:9px;min-height:44px;font-size:25px;border:1px solid transparent}.puzzle-tile.orange{background:#ff5900;color:#19283b}.puzzle-tile.navy{background:#19283b;color:white;border-color:#76889c}.puzzle-tile.cyan{background:#2dc4d4;color:#19283b}.puzzle-tile.unknown{background:var(--bg);color:var(--ink);border:2px dashed var(--line)}.puzzle-tile small{position:absolute;left:5px;top:1px;font-size:10px;font-weight:650}.color-symbol{position:absolute;bottom:2px;right:5px;font-size:14px}.puzzle-tile b:empty+.color-symbol{position:static;font-size:23px}.puzzle-tile.target{outline:3px solid var(--accent);outline-offset:2px}.audit-mark{position:absolute;right:-4px;top:-6px;background:#fff;color:#19283b;border:2px solid #19283b;border-radius:50%;width:22px;height:22px;font-size:13px;font-style:normal;font-weight:800;line-height:18px}.clue-chip{display:inline-block;background:var(--soft);color:var(--ink);border:1px solid var(--line);border-radius:9px;padding:4px 9px;font-size:11px;font-weight:650;line-height:1.4}.board-header{margin:0 0 8px}.puzzle-grid td.gutter{width:auto;text-align:left;padding-left:4px}.puzzle-tile .counts{position:absolute;left:3px;bottom:1px;font-size:11px;font-style:normal;border-radius:4px;padding:0 2px;line-height:1.3}.puzzle-tile .counts.orange{background:#ff5900;color:#19283b}.puzzle-tile .counts.navy{background:#19283b;color:#fff}.puzzle-tile .counts.cyan{background:#2dc4d4;color:#19283b}figcaption{font-size:11px;color:var(--muted);margin-top:10px}footer{margin-top:45px;padding-top:24px;border-top:1px solid var(--line);font-size:12px;color:var(--muted)}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}:focus-visible{outline:3px solid var(--accent);outline-offset:4px}@media(prefers-color-scheme:dark){:root{--bg:#171921;--paper:#222631;--ink:#f0edf6;--muted:#b5bac8;--line:#454b59;--accent:#c2a3ff;--soft:#342c48}h1 span{color:#ff925c}.button{color:#171921}}@media(max-width:700px){.bar{align-items:start;flex-direction:column;gap:8px;padding:10px 18px}.bar nav{width:100%;gap:16px}main{padding:26px 18px}.toc{grid-template-columns:1fr}.lesson-example{padding:18px}h2{font-size:25px}h3{font-size:19px}.puzzle-grid{border-spacing:5px}.puzzle-tile{font-size:23px}.puzzle-grid th:first-child{width:16px}}@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}@media print{header,.actions,.toc,.example-controls,.lesson-links{display:none}body{background:white;color:black;font-size:11px}main{padding:0;max-width:none}h1{font-size:40px}h2{font-size:21px}h3{font-size:17px}section{padding-top:24px}.lesson-example{break-inside:avoid;padding:15px}.table-wrap{overflow:visible}table{font-size:9px}th,td{min-width:0;padding:6px}.board-figure{max-width:240px}.puzzle-tile{print-color-adjust:exact;-webkit-print-color-adjust:exact}.worked-answer summary{display:none}.puzzle-tile small,.color-symbol{visibility:visible}a{color:inherit}}
'''
NAV = ''.join(f'<a href="#{anchor}">{html.escape(title)}</a>' for anchor, title in toc)
JS = '''
const answers=()=>[...document.querySelectorAll('.worked-answer')];
document.getElementById('expand-examples').onclick=()=>answers().forEach(e=>e.open=true);
document.getElementById('collapse-examples').onclick=()=>answers().forEach(e=>e.open=false);
let printState=[];window.addEventListener('beforeprint',()=>{printState=answers().map(e=>e.open);answers().forEach(e=>e.open=true)});
window.addEventListener('afterprint',()=>answers().forEach((e,i)=>e.open=printState[i]));
document.getElementById('print-plan').onclick=()=>window.print();
'''
page = '''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Color Sweeper — build plan and progress</title><style>''' + CSS + '''</style></head><body><header><div class="bar"><div class="brand"><span>koda</span> / Color Sweeper build plan</div><nav aria-label="Plan navigation"><a href="#status">Phase 0 progress</a><a href="#section-17">Lesson examples</a><a href="#section-0">Benchmark</a><a href="#section-18">Animation</a><a href="#section-3">Lesson map</a><a href="#section-10">Build phases</a></nav></div></header><main><div class="intro"><div class="eyebrow">Standard Koda skill plan · Updated September 9, 2026</div><h1>Color Sweeper.<br><span>Build in phases.</span></h1><p class="lead">40 lesson examples, worked answers and animation specifications, benchmarked against Minesweeper, Hexcells and Tametsi. Following the standard skill guide and multiplication build plan.</p><span class="pill">Phase 0 · final validation</span><span class="pill">Phases 1–10 · not authorized</span><span class="pill">6 kinds of clue</span><span class="pill">No voice generation</span><div class="actions"><a class="button" href="#section-17">Explore every lesson</a><button type="button" id="print-plan">Print / save PDF</button></div></div><details><summary>Contents — all plan sections</summary><div class="toc">''' + NAV + '''</div></details>''' + ''.join(out) + '''<footer>Source: docs/COLOR_SWEEPER_BUILD_PLAN.md · Regenerate with python3 scripts/render-color-sweeper-plan.py · Phase 0 foundations implemented; later phases remain proposed.</footer></main><script>''' + JS + '</script></body></html>'
TARGET.write_text(page)
print('Rendered 40 lesson examples and the animation contract to', TARGET.relative_to(ROOT))
