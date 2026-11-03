# Data contract

Each view renders from one JSON object. Shapes below are what the **renderer** consumes. Normalise the raw sources (AP calls via NYT, vote counts via civicAPI) into these shapes in a separate adapter, so the renderers never see source-specific fields.

Conventions:
- Percentages are numbers 0–100, rendered with **one decimal** (`51.8`). % expected in is rendered as an integer (`84%`).
- `party` is one of `D`, `R`, `I` (independent/other) or `N` (nonpartisan).
- **A leader is never a winner.** Only an AP call sets `status: "called"`. Never infer a call from vote share or % in.

---

## Shared shell

```json
{
  "clock": "1:18 AM ET",
  "updatedAt": "2026-11-04T06:18:02Z",
  "lastChangeAt": "2026-11-04T06:11:40Z",
  "sourceReachable": true,
  "calls": [
    { "race": "ME Sen", "result": "Dem", "party": "D", "gain": true,  "calledAt": "…" },
    { "race": "NE Sen", "result": "GOP hold", "party": "R", "gain": false, "calledAt": "…" }
  ]
}
```

| Markup | Source |
|---|---|
| `shell.clock` | Current time in ET, `h:mm AM/PM ET`, updated every second. Not from data. |
| `shell.calls` → `shell.call` × N | Latest calls across **all offices**, newest first. `data-party` colors the result; add `<span class="gain">Gain</span>` when `gain`. Show as many as fit; overflow is clipped. |
| `call.race`, `call.result` | Race label and result text: "Dem hold", "GOP hold", "Dem" + Gain tag, "Passes", "Fails". |
| `shell.updated` / `shell.updatedText` | See freshness rules in `SHELL.md`. |
| `shell.progress` | `--progress` 0–100 across the current view's time slot. |
| `shell.view`, `shell.next`, `shell.nextIn` | Rotation labels and `m:ss` countdown. |

---

## View 1 · House (`house.html`)

```json
{
  "impliedSwing": 2.1,
  "seats": [
    { "district": "CA-22", "holder": "R", "swingToFlip": 1.4, "status": "uncalled" },
    { "district": "VA-02", "holder": "R", "swingToFlip": 2.0, "status": "called", "winner": "D" }
  ]
}
```

- `seats` covers all 435 districts. `swingToFlip` is the Dem vote-share swing in points that flips the seat. It is negative for Dem-held seats: a GOP swing of that size flips them. It comes from your existing 2024-baseline data, as in the current `swingometer.html`.
- `impliedSwing`: keep the existing swingometer's calculation. Positive means toward Democrats.

**Derivations**

| Markup | Rule |
|---|---|
| `house.dem.called` / `house.gop.called` | Count of called seats won by each party. |
| `house.dem.predicted` / `house.gop.predicted` | Called seats, plus uncalled seats projected at the implied swing. An uncalled seat projects **D** if `swingToFlip < impliedSwing`, otherwise **R**. Totals always sum to 435. |
| `house.seat` (template) | One per seat inside the axis range. `data-state`: `uncalled` (ring in the **holder's** color), `called` (fill in the winner's color) or `gain` (called with `winner ≠ holder`). `data-party` is the holder for uncalled seats and the winner otherwise. |
| Seat position | `x = 168 + (bin + 0.5) × binWidth`, where `bin = floor((swingToFlip + M) / 0.5)` and `binWidth = 1584 / (2M / 0.5)`. Stack upward from `y = 752` in steps of 33 px. Within a column, order from the bottom: `called`, `gain`, `uncalled`. |
| Axis range `M` | Default 12 (R+12 … D+12). **Auto-widen** to 15, then 20, whenever `abs(impliedSwing) > M − 2`. Never shrink during the night. When wider, shrink dots to `min(28, binWidth − 5)` px. Regenerate `house.axis` ticks for the new range. |
| `house.offAxis.dem` / `house.offAxis.gop` | Seats with `swingToFlip < −M` or `> M`. They are not drawn, only counted. |
| `house.needle`, `house.flag` | `left = 168 + (impliedSwing + M) / (2M) × 1584`. |
| `house.swing` | `D+2.1%` or `R+0.8%`, one decimal; `EVEN` when below 0.05. |
| `house.zone` | Spans from x(0) to x(impliedSwing). Dem tint when positive, `rgba(255,77,66,.13)` when negative. |

---

## View 2 · Senate (`senate.html`)

```json
{
  "holdover": { "D": 34, "R": 31 },
  "races": [
    {
      "state": "ME", "special": false, "key": true,
      "incumbentParty": "R",
      "status": "called", "winner": "D", "pctIn": 84,
      "candidates": [
        { "name": "Pelletier", "party": "D", "pct": 51.8, "votes": 342180 },
        { "name": "Caldwell",  "party": "R", "pct": 46.9, "votes": 309800 }
      ]
    }
  ]
}
```

- `races` holds all 35 contests. That includes the FL and OH specials; no state has two races this year.
- `incumbentParty` is the party holding the seat going in.
- `key: true` marks the races shown in the right-hand list.

**Race status** (`data-status` on every `.gl`):

| `data-status` | When | Look |
|---|---|---|
| `none` | No votes reported yet | Dashed ring, no party color |
| `counting` | Votes in, no AP call | Ring in the **leader's** color, filled to `--p` = `pctIn` |
| `called` | AP call, `winner == incumbentParty` | Solid disc in the winner's color (the list adds a check) |
| `gain` | AP call, `winner != incumbentParty` | As called, plus a gold ring |
| `notup` | Map only: state not up this year | Small faint disc in the holdover color (`--hold`) |

For `counting`, set `data-party` to the current leader (the highest `pct`). For `called` and `gain`, set it to the winner.

**Derivations**

| Markup | Rule |
|---|---|
| `senate.dem.won`, `senate.gop.won` | Count of called races won by each party. Independents caucusing with a party count with that party; make that mapping explicit in the adapter. |
| `senate.dem.total`, `senate.gop.total` | holdover + won. |
| `senate.undecided` | 100 − D total − R total. |
| `senate.flips.dem`, `senate.flips.gop` | Count of `gain` races won by each party. |
| `senate.seat` (template, 100) | Positions are fixed in the markup. Reassign `data-state` and `data-party` by index after sorting left to right. Indexes 0–33 are D `hold`. Then D `won`, with D `gain` seats last (nearest the centre). Then `undecided`. Then R `won`, with R `gain` first, and R `hold` as the last 31 indexes. |
| `senate.state` (map tile, 50) | Grid position is fixed. Set `data-status`, `data-party` and `--p`. The 15 not-up states and their holdovers are static (see the markup). |
| `senate.race` (key race row) | Only `key: true` races, alphabetical, **up to 15**. The leader's row goes on the left, the runner-up on the right. `race.share` `--a` = round(leader pct / (leader pct + runner-up pct) × 100). With `none`, show `—` for both percentages, `Polls open` in `race.pctIn`, and set `data-pending` on `.share`. Add the `Gain` tag after the leader's percentage when the status is `gain`. |

---

## View 3 · California (`california.html`)

```json
{
  "races": [
    { "id": "gov", "office": "Governor", "sub": "", "status": "called", "pctIn": 41, "winner": "D",
      "candidates": [ { "name": "Arguello", "party": "D", "pct": 57.2 }, { "name": "Brennan", "party": "R", "pct": 40.6 } ] },
    { "id": "oak-mayor", "office": "Oakland Mayor", "sub": "Nonpartisan", "status": "counting", "pctIn": 39,
      "candidates": [ { "name": "Bellamy", "party": "N", "pct": 50.4 }, { "name": "Okonkwo", "party": "N", "pct": 49.6 } ] }
  ],
  "measures": [
    { "id": "prop2", "label": "Prop 2", "title": "School facilities bond", "scope": "state",
      "threshold": 50, "yesPct": 55.6, "pctIn": 41, "result": "pass" }
  ]
}
```

- Layout is fixed for this mix:
  - **Statewide:** Governor (large card) and Attorney General.
  - **Local:** Oakland Mayor and CA-12 (U.S. House).
  - **Measures:** 6 statewide and 2 local.
- Measure titles must fit about 276 px at 23 px type, roughly 24 characters. Write short titles in the adapter rather than relying on truncation.

**Derivations**

| Markup | Rule |
|---|---|
| `race.glyph` | Same states as the Senate. `data-party` is the leader while counting and the winner once called. Nonpartisan races use `N` (neutral grey). |
| `race.status` | `Projected · AP` when called, otherwise `{pctIn}% in`. |
| `race.candidate` | Sorted by pct, descending. `cand.bar` `data-style`: `lead` for the first candidate; for the second, `same` if it shares the first candidate's party (top-two same-party, or nonpartisan), otherwise `trail`. `--pct` = pct. |
| `race.leadChanged` | Show when the current leader differs from the leader at the first non-zero count tonight. Store that first leader client-side. Hide otherwise. |
| `prop.bar` | `--y` = yesPct. `--t` = threshold. Set `data-threshold="supermajority"` when the threshold is above 50 (gold tick). |
| `prop.status` | `pass` → `✓ Passes` tag. `fail` → `✕ Fails` tag. Otherwise a neutral counting ring plus `{pctIn}% in`. Results come only from an AP call or the official source, never from the current Yes share. |
| `prop.yes` / `prop.no` | yesPct and 100 − yesPct, one decimal. |
