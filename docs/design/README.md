# Election Night 2026 · TV slideshow — build handoff

A full-screen slideshow for a living-room TV, run from a laptop from 6 PM ET until well after midnight. It rotates through three live views on a timer: **House → Senate → California**. Each view auto-refreshes with live results.

The design is final. Your job is to wire live data into these pages and add the rotation shell. Do not restyle.

## What's in this folder

| File | What it is |
|---|---|
| `tokens.css` | The whole design system: colors as CSS custom properties, type, race glyph states, bars, freshness, ticker, and stage scaling. Every page links it. |
| `fit.js` | Scales the fixed 1920×1080 `.stage` to the screen and letterboxes when the screen isn't 16:9. |
| `house.html` | View 1. House swingometer as a horizontal "swing strip". |
| `senate.html` | View 2. Senate hemicycle, tile map and 15 key races. Late-night sample data. |
| `california.html` | View 3. 4 races and 8 Yes/No measures. First-calls sample data. |
| `DATA-CONTRACT.md` | The JSON each view needs, how it maps to `data-field` and `data-template` in the markup, and the derivation rules. **Read this first.** |
| `SHELL.md` | Rotation, refresh, freshness, keyboard controls, safe area and burn-in. |
| `MOTION.md` | Transitions and update animations. |

Open any `.html` file directly in a browser to see it. No build step and no server needed.

## How the markup is organised

- Every page is one `<main class="stage" data-view="…">` at a fixed 1920×1080, positioned absolutely. Keep the coordinates; they are the design.
- `data-field="…"`: a slot whose text or style you update from data.
- `data-template="…"`: one repeated item (a race row, a seat, a map tile, a ticker call). The sample pages show every instance filled in. Treat the first instance of each template as the pattern: clone it, fill it, replace the set.
- State lives in data attributes, not classes. For example `data-status="counting|called|gain|none|notup"`, `data-party="D|R|I|N"` and `data-state="uncalled|called|gain"`. Set the attribute and the CSS in `tokens.css` does the rest.
- Numeric visuals use CSS custom properties set inline:
  - `--p`: % expected in. Drives the ring fill.
  - `--a`: leader's two-way share. Drives the share bar.
  - `--pct`: candidate bar width.
  - `--y` and `--t`: Yes share and pass threshold.
  - `--progress`: rotation progress.

## Sample data

All candidate names, figures and measure titles are **fictional placeholders**. The House seats are synthesized. Replace all of it with live data. Labels such as `data-district="SAMPLE-001"` exist only to show where the real identifiers go.

## Suggested build order

1. Write a renderer per view that takes the JSON in `DATA-CONTRACT.md` and produces exactly this markup. A pure `render(data)` that rebuilds the template lists is fine; the pages are small.
2. Put all three views in one page, each in its own `.stage`, and add the rotation shell from `SHELL.md`.
3. Add polling every 30 s and the freshness logic.
4. Add the motion from `MOTION.md` last.
5. Test at 1920×1080 and at 3840×2160 (a 4K TV) using browser device emulation. Then test on the real TV with its overscan setting off ("Just Scan", "Screen Fit" or "Full Pixel").
