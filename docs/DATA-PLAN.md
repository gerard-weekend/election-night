# Election-night slideshow: data, build and display plan

Sections 1–6 cover the data, section 7 how to build it, and section 8 how it runs on the TV.

Same rule as the House swingometer: **calls come from AP via the NYT results files; vote counts come from civicAPI.** Each source is the other's fallback. The plan is based on checks of both sources on election morning (Nov 3).

## 1. Sources

All are public, need no key, and allow any webpage to read them, so everything runs in the browser and no server code is needed. "Size" is the compressed size per fetch.

| Feed | URL | Size | Used for |
|---|---|---|---|
| NYT House | `static01.nyt.com/elections-assets/pages/data/2026-11-03/results-house.json` | ~240 KB | House calls (existing) |
| NYT Senate | `…/2026-11-03/results-senate.json` | ~70 KB | Senate calls; also has a Senate balance block (`partyControlData`) and a rating per race |
| NYT California | `…/2026-11-03/results-california.json` | ~78 KB | Calls for 232 CA races: 14 props, statewide offices, House, legislature, and LA/SF/Oakland/San Diego/San Jose/Fresno local races and measures. Statewide races include county breakdowns. |
| civicAPI House | `civicapi.org/api/v2/race/87524` | ~28 KB | House votes (existing) |
| civicAPI Senate | `civicapi.org/api/v2/race/87528` | ~4 KB | Senate votes for all 35 races, one entry per state; holdover seats |
| civicAPI race by ID | `civicapi.org/api/v2/race/{id}` | small | Votes for each CA race; county breakdowns for props and statewide races |
| civicAPI search | `/race/search?startDate=2026-11-03&endDate=2026-11-03&country=US&province=CA&limit=2000` | ~55 KB | Run **once at startup** to look up the IDs of the CA races in the config (801 CA races) |

Neither source is an official, documented API. The NYT files are undocumented and could change format. Hence the fallbacks below, and manual entry.

## 2. One shared data layer, many views

```
sources/  civic.js  nyt.js            fetch, retry, back off, record health
model/    race.js                     one normalized Race shape for every office
          calls.js                    decides who called what (precedence below)
store.js                              holds all Races; views subscribe to it
views/    house/  senate/  california/   read from the store only; no fetching
shell/    rotator.js  ticker.js  breaking.js
config/   california.js  senate.js  views.js
```

**Polling runs all night for every view, not just the one on screen.** So a view is current the moment it rotates in, and a call in any race can trigger the breaking-call card and ticker. The total is roughly 0.6 MB a minute.

| Feed | Every | Notes |
|---|---|---|
| civicAPI House, Senate | 30 s | They cache for 15 s, so faster gains nothing |
| civicAPI CA races | 60 s | One request per configured race (6–16), spaced ~1 s apart |
| NYT House, Senate, California | 45 s | Three files, staggered so they don't land together |

### Normalized race

```js
{
  key: 'SEN-ME' | 'HOUSE-PA-07' | 'CA-PROP-40' | 'CA-GOV',
  office, state, label,
  candidates: [{ id, name, party: 'D'|'R'|'I'|'O'|null, votes, pct }],  // props: Yes / No
  pctIn,                      // civicAPI percent_reporting; NYT eevp as fallback
  leader,                     // candidate id; only when votes > 0
  call: { winner, source: 'AP'|'civic'|'manual'|'auto', at } | null,
  flipped,                    // winner's party ≠ seat holder's (Senate, House)
  votesFrom: 'civic'|'nyt', updatedAt, stale
}
```

### Who calls a race (same order as the House view)

1. **Manual:** you typed it.
2. **AP via NYT:** used while the NYT file has loaded successfully within the last 4 minutes. If NYT is up but hasn't called a race, it stays uncalled, even if civicAPI has called it.
3. **civicAPI's own call:** only while NYT is down.
4. **Auto-call:** House seats with no Republican on the ballot, at their state's poll close (already built).

Call reversals (AP withdrawing a call) un-call the race. The ticker should say "CALL WITHDRAWN" rather than silently dropping it.

### Votes

civicAPI first, falling back to the NYT file's own AP vote counts if civicAPI is down or obviously wrong. That covers the "major party at 0 votes" fault seen in its test data, which the House view already handles with a per-race re-check. NYT carries votes too, so votes get the same two-source safety as calls.

## 3. Joining the two sources

| Office | civicAPI side | NYT side | Join on |
|---|---|---|---|
| House | `region_results` key, `ky-01` | state + `seat_number` | District ID (done; all 435 match) |
| Senate | `region_results` key, `me` | `reporting_units[0].state_postal` | State postal code; one race per state in 2026 (FL and OH are specials) |
| CA props | race named "California Proposition 40" | `office: "Proposition"`, `seat_number: "40"` | Prop number |
| CA statewide | e.g. "California Governor" (`type: "Governor"`) | `office: "Governor"` | Office name |
| CA local | 801 races, by name and county | 21 measures + ~40 local races, by `seat` text | **Explicit IDs in `config/california.js`**. Matching names automatically is too risky on the night. |

**Matching candidates** between the two sources (needed to apply an NYT call to civicAPI vote counts):
- **Partisan races:** match by party, then by surname for top-two same-party contests and independents (Nebraska: Ricketts R vs. Osborn I).
- **Props:** Yes/No. NYT uses candidate IDs `yes`/`no`; civicAPI uses names "Yes"/"No".
- **Write-ins:** ignore them. NYT lists several write-ins in Maine, for example.

## 4. Per view

### Senate
- **Balance:** holdovers (34 D, 31 R) from civicAPI's Senate overview, cross-checked against NYT `partyControlData`, plus called races. Control lines at 51 D and 50 R (VP tiebreak). An independent winner (Osborn) is shown as independent. Who he'd caucus with is unknown, so control math shows him separately.
- **Map:** every state's status from the race model. States not up this year use their holdover party.
- **Key races:** defaults to NYT's tossup and lean ratings (AK, IA, KS, ME, OH, TX, MI, MN, NH, NE, SC). Editable in `config/senate.js`.

### California
- **Config lists the races you choose,** each with `nytRaceId` (when NYT carries it) and `civicId`. Races not in the NYT file get civicAPI counts and civicAPI's call, labeled as such.
- **Prop status:** a prop is "passing" or "failing" by Yes share, and "PASSES"/"FAILS" only once called.
- **Counties:** optional county map for one featured race, from civicAPI's county breakdown (all 58 counties for props and statewide races).
- **Two pages:** if more races are picked than fit, they alternate within the view's time slot.

### House
Unchanged, moved into the package as a view module.

## 5. Running it all night

- **Launch:** a static folder with no build step: `python3 -m http.server` in the folder, then Chrome at `localhost:8000` in full screen. A local server is needed because the code is split into modules, which browsers won't load from a file opened from disk.
- **Keep the Mac awake:** run `caffeinate -d` in a terminal. The page also requests a screen wake lock, which Chrome allows on localhost.
- **Fault tolerance:** each source fails on its own, and the last good data stays on screen. A hidden operator bar (press `O`) shows each feed's health, the manual call box and rotation controls (pause, next, pin a view).
- **Restarts:** manual calls and the last good data are saved in the browser, so a reload mid-evening comes back instantly.
- **Testing before tonight:** add `?now=` (fake clock) and `?nyt=`/`?civic=` (test files) to the address, as in the House view. Also a replay mode that plays back a recorded night, so the rotation and breaking cards can be rehearsed.

## 6. Open risks

- How often NYT updates its files during counting is unknown until tonight.
- civicAPI's own calls have no published track record; they're used only as a fallback.
- California counts for days, so most CA races will be uncalled when the party ends. The view is designed around partial counts.

---

## 7. Build notes

### Context for a new session

- **Existing House swingometer:** `/Users/gerard/Documents/Claude/personal-hobby/swingometer/swingometer.html`. It's one self-contained file (fonts embedded) that already does live House data the way this plan describes. **Treat it as the reference implementation:** its `liveCalls()`, `pollCivic()`, `pollNyt()`, manual entry and auto-call code are the patterns to lift into the shared modules. Read its `README.md` too.
- **District data:** `swingometer/Midterms 2026 Data - 2026.csv`. Columns: `State, District, Label, 2024_notionalwinner, 2024_notional_Dem_share, 2026_S_needed`. `S_needed` = −1 marks a seat with no Republican on the ballot.
- **Visual brief:** `docs/DESIGN-PROMPT.md`. Claude Design will return HTML/CSS mockups with `data-field` / `data-template` hooks. Build views so the markup can be swapped later without touching the data layer.
- **Election day is Tuesday, Nov 3, 2026.** First polls close at 6 PM ET (parts of IN and KY); the last full states close at 11 PM ET (CA, WA, OR, ID); then HI and AK.

### Folder layout

```
election-night/
  index.html                 shell: one 1920×1080 stage, loads src/main.js as an ES module
  src/
    main.js                  boot: load config, start sources, start rotator
    sources/civic.js         civicAPI fetch + parse → store
    sources/nyt.js           NYT fetch + parse → store
    model/race.js            Race shape, helpers (leader, two-party share, status)
    model/calls.js           call precedence: manual > AP via NYT (if healthy) > civic > auto
    store.js                 races by key, source health, subscribe(fn), saved to localStorage
    shell/rotator.js         view timer, transitions, pin/pause/next
    shell/ticker.js          latest calls across all offices
    shell/breaking.js        breaking-call card queue
    shell/operator.js        hidden operator bar (O key): feed health, manual calls, rotation
    shell/stage.js           scale a 1920×1080 canvas to the window (letterbox)
    views/house/             port of swingometer.html's dial (buildHybrid) as a view
    views/senate/
    views/california/
  config/
    views.js                 order, durations, enabled flags
    senate.js                key races (default: NYT tossup + lean)
    california.js            the CA races to show: { key, label, kind, nytRaceId?, civicId }
  data/house-2026.csv
  assets/fonts/              Archivo, JetBrains Mono as local woff2 (no internet needed for type)
  tools/                     helper scripts: CA race-ID lookup, replay recorder
  docs/
```

### Module contracts (keep these stable so sessions can work in parallel)

```js
// store.js
store.upsertRace(race)               // from sources; merges by race.key
store.setHealth(sourceName, { ok, lastOk, lastChange, error, test })
store.getRace(key); store.racesBy(office)          // office: 'H' | 'S' | 'G' | 'PROP' | 'LOCAL' | ...
store.subscribe(fn)                  // fn(changedKeys:Set) after each source poll
store.on('call', fn)                 // fn({ race, previous }) when a call appears, changes or is withdrawn

// a view module (views/*/index.js)
export default {
  id: 'senate', title: 'Senate',
  mount(rootEl, store),              // build DOM once
  update(changedKeys),               // cheap; called on store changes, only while mounted
  show(), hide(),                    // rotator hooks (start/stop per-view animation)
}
```

- **Views never fetch.** Sources never touch the DOM.
- **Races keep their votes from each source separately** (`votesBySource.civic` and `votesBySource.nyt`), with a chosen `votes` view on top. The fallback choice is then one function in `model/race.js`.

### Lessons from the House build (don't relearn these)

- **Animation frames pause:** browsers stop `requestAnimationFrame` when the window is covered or the display dims. Drive data updates and rendering from a 1 s `setInterval` backup as well, as `step()` does in swingometer.html, or the screen silently freezes.
- **Fetch failures:** keep the last good data on failure; never clear races because a fetch failed. Show health in the operator bar and as a subtle on-screen freshness mark.
- **civicAPI:**
  - **Test data:** it publishes rehearsal data before the night with `test_data: true`. Carry the flag through and label the screen "TEST DATA" while it's set.
  - **Overview vs. per-race:** the House overview sometimes lists a stale duplicate candidate with 0 votes. If a major party shows 0 votes in a race that's counting, re-check the per-race endpoint (`/race/{election_id}`), throttled to a few per poll and spaced about a second apart.
  - **Data types:** `region_results` keys are lowercase (`ky-01`, `ak-al`, `me`). Region `votes`/`percent` can arrive as strings, so convert to numbers.
  - **Search:** filter by date, country and state; searching by name is slow, per its docs.
- **NYT:**
  - **At-large seats:** `seat_number` is `"1"`, so map AK, DE, ND, SD, VT, WY to `-AL`.
  - **Louisiana:** House races are `race_type_id: "L"`, not `"G"`. Accept both.
  - **The national row:** skip `state_postal === 'US'` (the national House popular-vote row).
  - **Calls:** `outcome.won[0]` is a candidate ID; look up `candidate_metadata[id].party.nyt_id` (`DEM`/`GOP`/other). `outcome.winner_accepted_at[0]` is the call time.
  - **Format check:** treat it as a format change, not data, if far fewer races than expected parse. House check: fewer than 400 races.
- **Times:** all poll-close logic must check the date as well as the time, or it fires on the wrong day. Nov 3, 2026 is EST (UTC−5), since DST ended Nov 1.
- **Loading:** ES modules don't load from `file://`. Always serve over http: `python3 -m http.server` locally, or GitHub Pages.

### Testing

- **Fake time:** `?now=2026-11-03T21:30:00-05:00`.
- **Swap sources:** `?nyt=<url>`, `?civic=<url>`. Use per-office variants (`?nytSenate=`, `?nytCa=`) once split.
- **Replay:** `tools/record.mjs` saves timestamped snapshots of every feed during the night (also useful afterwards). `?replay=<folder>&speed=20` plays them back through the real parsers. Before tonight, build a synthetic replay by doctoring today's NYT files with calls, as was done for the House test.
- **Acceptance checks, per view:**
  1. Connects to real feeds and labels test data.
  2. Shows a doctored NYT call within one poll.
  3. Falls back to civicAPI calls when the NYT address is broken.
  4. Survives a 2-minute network drop without blanking.
  5. Renders at 1920×1080 with the longest real names (e.g. "Hyde-Smith", "Proposition 43: Special Taxes Approval Threshold").

### Work packages (suggested split across sessions)

| # | Package | Depends on | Output |
|---|---|---|---|
| 1 | **Core:** store, race model, call precedence, civicAPI and NYT sources for all three offices, health | none | `src/store.js`, `src/model/*`, `src/sources/*`, console-testable |
| 2 | **Shell:** stage scaling, rotator, ticker, breaking card, operator bar, wake lock | the store interface (can mock) | `index.html`, `src/shell/*`, `config/views.js` |
| 3 | **House view:** port swingometer.html onto the shared store | 1 | `src/views/house/` |
| 4 | **Senate view** | 1 (can start from a mock store) | `src/views/senate/` |
| 5 | **California view** plus `tools/ca-lookup.mjs`, which prints NYT and civicAPI IDs for the races chosen | 1 | `src/views/california/`, `config/california.js` |
| 6 | **Restyle** to Claude Design's mockups | 3, 4, 5 and the design | updated view markup and CSS |
| 7 | **Replay recorder and rehearsal** | 1, 2 | `tools/record.mjs`, replay mode |

Packages 1 and 2 first; 3, 4 and 5 in parallel after the store contract is stable.

### Still to be decided by the owner

- The California race list.
- Rotation durations (proposed below).
- Whether to move this to a GitHub repo. Recommended: private, with commits before and during the night so any break can be rolled back.

---

## 8. Display notes

### Hardware and setup on the night

- **Connection:** laptop to TV over HDMI, with the TV as the only display or mirrored. TV picture mode set to "Game" or "PC" with overscan off ("Just Scan" / "Screen Fit"), or the edges get cropped. The design keeps a 48 px safe margin anyway.
- **Browser:** Chrome full screen (`⌘⌃F`), or a kiosk window:
  `open -na "Google Chrome" --args --kiosk --app=http://localhost:8000 --user-data-dir=/tmp/election-kiosk`
  A separate browser profile means no extensions, pop-ups or sign-in banners.
- **Keep awake:** run `caffeinate -d` in a terminal. Turn off notifications (Focus: Do Not Disturb) so banners don't appear on the TV. Keep the laptop plugged in.
- **Audio:** none. The slideshow is silent.
- **Network:** fine on home Wi-Fi at about 0.6 MB a minute. Phone hotspot as a backup; feed health shows within a minute.

### Canvas and scaling

- **Design canvas:** 1920×1080, scaled uniformly to the window by `shell/stage.js` and letterboxed on the body background. Never reflow for other sizes; it's a TV, not a webpage.
- **Text sizes:** at least 22 px (18 px for secondary labels); headline numbers 96 px or larger.
- **Units:** all layout in canvas pixels inside the stage, so the design matches Claude Design's mockups exactly.
- **Burn-in:** no permanent bright white blocks. The ticker and rotation indicator move or change regularly, and the clock updates every minute.

### Rotation

| View | Default | Notes |
|---|---|---|
| House | 60 s | The flagship view; longest slot |
| Senate | 45 s | |
| California | 45 s | Two 22 s pages if more races are configured than fit |

- **Timing:** durations live in `config/views.js` and can be changed live from the operator bar. A view with nothing new since its last showing can be shortened, but never skipped. Viewers rely on the rhythm.
- **Transitions:** a crossfade or short slide under 600 ms. A view gets `show()` only after its first data has arrived. Until then it shows "Waiting for first results" in the design language, not a spinner.
- **Before polls close (before 6 PM ET):** allow a "pre-show" mode where each view shows the starting picture: the House notional baseline, Senate holdovers and ratings, CA races and props with no votes.

### Breaking-call card

- **When:** a race in the key lists (`config/senate.js`, `config/california.js`, and optionally House seats on the dial) is called, a call changes, or a call is withdrawn.
- **How:** 7 s full screen, then rotation resumes where it left off. Queue multiple calls and show each for 5 s when more than 3 are waiting, so poll-close bursts (many calls at 8:00 PM ET) don't stall the show for minutes. Calls arriving in bulk at poll close for safe seats go to the ticker only, not the card.
- **Content:** winner, party, office/state, GAIN tag if flipped, vote share and % in, "AP" (or the source actually used).
- **Never** trigger it for a leader change, only for calls.

### Operator bar (hidden, press `O`)

- **Feed health:** per feed, with last check, last change and error.
- **Manual calls:** the same syntax as the House view (`ME-S D`, `CA-PROP-40 YES`), extended to all offices.
- **Rotation:** pause, next, previous, pin a view.
- **Resets:** a "clear stale cache" button.
- **Shortcuts:** `Space` pause, `→`/`←` next/previous view, `1`–`3` pin a view, `0` unpin, `B` replay the last breaking card.

### On-screen honesty

- **Source credit:** always shown in the ticker, for example "Calls: AP via NYT · Votes: civicAPI", changing to "Calls: civicAPI" during an NYT outage.
- **Test data:** while civicAPI's flag is set, show a "TEST DATA" banner.
- **Leaders are not winners:** an uncalled leader is never styled like a winner (see the race states in DESIGN-PROMPT.md).
- **California:** "% expected vote in" is shown on every race, because California's counts move for days.
