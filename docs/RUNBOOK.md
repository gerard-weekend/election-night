# Run-book — election night, Tuesday 3 November 2026

What to type, in order, and what to do when something breaks. Everything below
was checked against the real feeds on election morning.

---

## 1. Start it

Three terminal windows, on the laptop, plugged in.

```sh
cd ~/Documents/Claude/personal-hobby/election-night

# 1. the server — NOT `python3 -m http.server`, see the warning below
python3 tools/serve.py

# 2. stop the Mac sleeping (leave it running all evening)
caffeinate -d

# 3. the TV window: an app window with no tab strip or address bar
open -na "Google Chrome" --args --app=http://localhost:8000
```

Drag that window to the TV and press `⌘⌃F` for full screen. Then open the
control window as an ordinary tab in the **same** Chrome and keep it on the
laptop screen:

    http://localhost:8000/control.html

> **Both pages must be in the same Chrome profile.** They talk over a
> BroadcastChannel, which is scoped to one profile, so the control window will
> sit on "Not connected" if the TV page is in a different one — even though
> both are on `localhost:8000`.

Two flags to avoid:

- **Do not pass `--user-data-dir`.** It creates a fresh profile, so Chrome
  boots into the profile-picker screen, and it puts the TV in a different
  profile from the control window, which breaks the link between them.
- **`--kiosk` is ignored when Chrome is already running**, because the command
  hands off to the running instance and `--kiosk` only applies at startup.
  `--app` plus `⌘⌃F` gets the same result.

Since this uses your everyday profile, keep **Do Not Disturb** on so no
notification banner lands on the TV.

> **Do not use `python3 -m http.server`.** It is single-threaded and drops
> connections when the browser requests the ~14 ES modules at once, so the
> display boots to a blank screen roughly one time in four. `tools/serve.py`
> fixes this (threading, HTTP/1.1 keep-alive, larger listen backlog) and booted
> cleanly 12 times out of 12. This is the single most likely way to lose the
> screen tonight.

Before guests arrive:

- TV picture mode to **Game** or **PC**, overscan off ("Just Scan" / "Screen Fit").
- macOS **Do Not Disturb** on, so notification banners don't appear on the TV.
- Check the control window says **Connected** and all six feeds are green.

---

## 2. What's on screen

Rotation is House → Senate → California, 60 s each, then round again.

The ticker along the bottom carries the ET clock, the latest calls across all
three offices newest-first, and an honest source credit. It reads
**"Calls: AP via NYT · Votes: civicAPI"** normally, and changes by itself to
**"Calls: civicAPI"** if the NYT files stop responding.

A race is only ever styled as won once it has been **called**. A leader is not
a winner — that distinction is deliberate and holds everywhere.

---

## 3. The control window

| Control | What it does |
|---|---|
| **Pause / Resume** | Freezes the rotation on the current view |
| **← Prev / Next →** | Step the rotation by hand |
| **House / Senate / California** | Pin a view on screen indefinitely |
| **Unpin** | Return to the timed rotation |
| **Clear stale cache** | Wipes saved races *and manual calls*, then reloads the TV. Asks first |
| **Reload TV** | Plain reload, keeps everything saved |

**Feed health** shows each of the six feeds with seconds since its last good
read. Amber past 3 minutes, red on failure. **Coverage** should read 435 / 35 / 12.

**Single-sourced races** lists Oakland Mayor, Oakland EE and Oakland FF. Those
three have no civicAPI entry at all — civicAPI's California local coverage is
Los Angeles, Orange and San Mateo counties only, and Alameda isn't in it. They
run on NYT alone, so they have no cross-check. Treat them with a little more
suspicion than the rest.

### Manual calls

Type into the box and press Enter:

```
SEN-ME D            call Maine for the Democrat
CA-PROP-40 YES      call Prop 40 as passing
HOUSE-PA-07 R       call a House seat
SEN-NE I            call Nebraska for the independent
SEN-ME Collins      a surname also works
-SEN-ME             withdraw a manual call
```

A manual call outranks everything, including AP. It is saved, so it survives a
reload. If you type one before that race's data has loaded, it is held and
applied as soon as the race appears — it is not lost.

### Keyboard, on the TV page itself

Only needed if the control window is shut: `Space` pause, `←` / `→` previous
and next, `1`–`3` pin a view, `0` unpin, `R` force a refresh, `F` full screen.

---

## 4. When something goes wrong

**The TV is blank at startup.** Almost certainly the server. Confirm you ran
`tools/serve.py` and not `python3 -m http.server`, then reload.

**"Port 8000 is already in use."** An earlier copy of the server is still
running. Find and stop it, then start again:

```sh
lsof -nP -iTCP:8000 -sTCP:LISTEN
kill <PID>
```

Or just use another port — `python3 tools/serve.py 8001` — and open
`localhost:8001` instead. Both pages must be on the **same** port or the
control window cannot reach the TV page.

**A feed goes red.** Nothing to do. Each source fails on its own and the last
good data stays on screen; the view shows "updated N min ago" in amber rather
than an error. If NYT fails, calls fall back to civicAPI automatically after
4 minutes and the ticker credit changes to say so.

**All feeds red.** Check Wi-Fi, then switch to the phone hotspot. The display
keeps showing the last good picture throughout; a 70-second blackout was
tested and it recovered on its own with no data lost.

**A call looks wrong.** Override it from the control window — manual outranks
AP. To take a call off, type `-` and the race key.

**AP withdraws a call.** Handled: the race returns to uncalled and the event is
flagged as a withdrawal rather than silently disappearing.

**The whole page is wedged.** "Reload TV". Manual calls and the last good data
are saved in the browser, so it comes back within a few seconds. Use "Clear
stale cache" only as a last resort — it discards your manual calls too.

---

## 5. What to expect from the night

- First polls close **6 PM ET** (parts of Indiana and Kentucky); the last full
  states close **11 PM ET** (California, Washington, Oregon, Idaho), then
  Hawaii and Alaska.
- Expect a burst of calls at **8 PM ET**. The ticker will fill quickly. There
  is no breaking-call interstitial, by choice, so nothing interrupts the
  rotation.
- **California counts for days.** Most California races will still be uncalled
  when the party ends, and leads can move for a week. Every California race
  shows "% expected vote in" for that reason, and partial counts are the normal
  state of that view, not a fault.
- Total network use is roughly 0.6 MB a minute.

---

## 6. If you need to change something mid-evening

- **Which California races show:** `config/california.js`. Feed IDs for all 12
  are already verified; a new race needs both a `civicId` and an `nytId`. A race
  the House or Senate feeds already poll (as with CA-11) is added with
  `existing: true` and no IDs, so it is not fetched or called twice.
- **Which Senate races are in the key panel:** `config/senate.js`. The layout
  holds 8–14 comfortably.
- **Rotation timings:** `config/views.js`.

Edit, save, press "Reload TV". There is no build step.

`index.html` is **generated** from the designer's pages in `docs/design/` by
`node tools/build-index.mjs`. Do not hand-edit it — change the design files and
re-run the generator, so a new design bundle can be dropped in whole.

---

## 7. Rehearsing

```sh
node tools/make-rehearsal.mjs     # doctors tonight's real feeds with calls
```

Then open the URL it prints. This shows the Senate view mid-evening — calls,
flips ringed in gold, an independent winner, partial counts — so you can see
what the screen looks like under load before it matters. It swaps feed URLs
only; there is no fake clock, so poll-close logic always runs on real time.

Checks worth re-running if anything is edited:

```sh
node tools/test-calls.mjs        # 16 cases: who gets to call a race
node tools/test-control.mjs      # 12 cases: control window drives the TV
node tools/test-resilience.mjs   # 11 cases: outages and a network drop
node tools/browser-check.mjs     # all three views render, console must be clean
node tools/smoke.mjs             # the live feeds still parse
```
