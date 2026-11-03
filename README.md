# Election night 2026

A full-screen slideshow for a living-room TV on US midterm election night,
3 November 2026. It rotates through three live views — House swingometer,
Senate, California — and refreshes itself all evening.

**Start it:**

```sh
python3 tools/serve.py          # then open http://localhost:8000/
```

Open `http://localhost:8000/control.html` on the laptop to drive it.

- **[docs/RUNBOOK.md](docs/RUNBOOK.md)** — what to type on the night, and what
  to do when something breaks. Read this first.
- **[docs/DATA-PLAN.md](docs/DATA-PLAN.md)** — the feeds, the shared data
  layer, and how it all fits together.
- **[docs/DESIGN-PROMPT.md](docs/DESIGN-PROMPT.md)** — the visual brief.

## How it is put together

Calls come from AP via the NYT results files; vote counts come from civicAPI.
Each is the other's fallback. Everything runs in the browser against public
feeds — no API keys, no server code, no build step.

```
index.html      the TV page: one 1920x1080 stage, scaled to the screen
control.html    the operator window, on the laptop; talks to the TV over a
                BroadcastChannel, so the feeds stay at one set of requests
src/sources/    civicAPI and NYT: fetch, retry, record health
src/model/      one normalized Race shape, and who gets to call a race
src/store.js    holds every race; views subscribe to it
src/views/      house, senate, california — read from the store, never fetch
config/         the California race list, Senate key races, rotation timings
tools/          server, rehearsal generator, test suites
```

Styling in `assets/placeholder.css` is deliberately plain and meant to be
replaced. Every value sits behind a `data-field` hook and every repeated row
behind `data-template`, so a redesign is a markup and CSS swap with no changes
under `src/`.

## Checks

```sh
node tools/test-calls.mjs        # 16 cases: call precedence
node tools/test-control.mjs      # 12 cases: control window drives the TV
node tools/test-resilience.mjs   # 11 cases: feed outages and a network drop
node tools/browser-check.mjs     # all three views render, console clean
node tools/smoke.mjs             # the live feeds still parse
```
