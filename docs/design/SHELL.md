# Shell

## Canvas

- Each view is a fixed **1920×1080** `.stage`. `fit.js` scales it uniformly to the window and letterboxes if the screen isn't 16:9.
- Most TVs are 4K (3840×2160). That is the same 16:9 shape, so the stage scales up 2×. Everything is text, CSS and inline shapes, so it stays sharp.
- **TV-safe margin: 48 px on every edge.** Nothing essential may sit inside it. The ticker is inset to respect this.
- Run the browser in true full screen, with no browser UI.

## Rotation

- Order: **House → Senate → California**, then repeat.
- Default slot is **60 s** per view. Make it configurable.
- `shell.progress` (`--progress`) fills linearly from 0 to 100 across the slot and resets on each view change.
- `shell.nextIn` counts down as `m:ss`. `shell.next` names the next view.
- Keep all three `.stage` elements in the DOM and cross-fade between them (see `MOTION.md`). Don't re-render on switch.

## Refresh

- Poll each source every **30 s**. Update only fields whose values changed.
- A view that is off screen still updates its data. Its change animations are deferred until it is next shown (see `MOTION.md`).
- If a fetch fails, keep showing the last good data. Never blank a view.

## Freshness indicator (`shell.updated`)

| State | Condition | Display |
|---|---|---|
| Fresh | Last successful fetch ≤ 2 min ago | Filled dot · `Updated 20 s ago` |
| Stale | No successful fetch for > 2 min, **or** no data change for > 10 min while results are still coming in | Hollow dot (`data-stale` attribute) · `Last change 7 min · civicAPI` |

Stale must never look like an error to the room: no red, no motion. It is for the operator. Name the stalled source when you know which one it is.

## Keyboard (operator only)

| Key | Action |
|---|---|
| `→` / `←` | Next / previous view (resets the slot timer) |
| `Space` | Pause / resume rotation |
| `1` `2` `3` | Jump to House / Senate / California |
| `R` | Force refresh now |
| `F` | Toggle full screen |

No mouse interaction, hover states or tooltips anywhere.

## Long-run hygiene (6+ hours)

- **Burn-in:** every 10 min, translate the whole stage by a random offset of up to ±4 px. Stay within the safe margin.
- Prevent the laptop from sleeping. Use the Screen Wake Lock API where available.
- Respect `prefers-reduced-motion`: every change becomes an instant swap.
- Fonts load from Google Fonts. For resilience on a flaky connection, self-host Barlow and Barlow Condensed (weights 400–800) and point `tokens.css` at the local files.
