# Motion

One rule: **motion marks change, never decorates.** Nothing loops, nothing flashes, and everything settles within a second.

Easing throughout: `cubic-bezier(.2, 0, 0, 1)` unless stated.

## 1 · View transition

- **Total:** 500 ms crossfade with 100 ms of overlap between the outgoing and incoming views.
- **Shift:** content drifts 24 px left as it fades. The frame itself never slides.
- **Fixed elements:** the ticker, clock and ground never move. The progress hairline resets to 0, then fills linearly over the slot.

## 2 · Race changes state

Applies to Senate and California glyphs, map tiles and Senate seats.

| Change | Animation |
|---|---|
| First votes | Dashed ring fades to the leader's ring over 400 ms. |
| Ring fills | Arc sweeps to the new % in over 600 ms. A change of leader crossfades the ring color over 400 ms. |
| Called | Ring floods to a solid disc in 350 ms and the check fades in. Then one pulse, scale 1 → 1.12 → 1, over 500 ms. Never repeats. |
| Flip | As called, then the gold ring draws clockwise over 400 ms. |
| Off-screen | A call that lands while its view is hidden plays its pulse once, when the view next appears. |
| House dots | A dot changing state pops in over 550 ms. The needle eases to the new implied swing with a gentle spring. |

## 3 · Numbers updating

| Element | Rule |
|---|---|
| Default | Crossfade over 200 ms with a 6 px vertical shift. Tabular figures, so nothing reflows. |
| Count-up | Only for seat totals and the hemicycle, at most 600 ms, and only when the value changes. |
| % in | Crossfade only. Never animate downward. |
| Bars | Width eases over 600 ms. The 50% and ⅔ ticks never move. |
| Freshness | No animation. Fresh ↔ stale is an instant swap. |
| Reduced motion | Under `prefers-reduced-motion`, every change is an instant swap. |

## Burn-in

Every 10 minutes the whole stage drifts by up to 4 px. This is imperceptible to the room and enough to spare the panel over six hours.
