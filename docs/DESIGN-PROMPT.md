# Design prompt for Claude Design

Paste everything below the line into Claude Design. Attach `swingometer.html` (or a screenshot of it running) as the visual reference for the House view, which is already designed and built.

---

## Brief: election-night TV slideshow, 2026 U.S. midterms

I'm hosting an election-night watch party. A laptop plugged into a living-room TV will run a full-screen slideshow all evening, from 6 PM ET until well after midnight. It rotates through three live data views on a timer, and every view auto-refreshes with real results. I need the visual design for the whole system: the shared shell and the two new views. The third view, a House swingometer, already exists, and the new work must look like part of the same broadcast.

### Who's watching and how

- Viewed from 2–4 m away on a 55–65" TV, by people talking, eating and glancing up. Every key number must read from across the room in under two seconds.
- No interaction during the show. Nobody touches it except me, occasionally, with a keyboard.
- It runs for 6+ hours. Avoid anything that becomes irritating on repeat (constant motion, looping sounds, flashing) and anything that burns in. No static bright white areas larger than a card.

### Canvas

- Fixed 1920×1080 design canvas, scaled to fit the screen (letterboxed if needed). Design at 1920×1080 exactly.
- Keep a TV-safe margin: no essential content within 48 px of any edge.
- Minimum type size is 22 px at 1080p for anything meant to be read. Labels can go to 18 px if they're secondary. Headline numbers should be 96 px or larger.

### Visual system (inherit from the existing House swingometer)

- **Typeface:** Archivo throughout (Google Fonts, variable width and weight). Use condensed width (about 70–78%) and heavy weight for numbers, and normal width with generous letter-spacing (0.12–0.2 em) for uppercase labels. Monospace (JetBrains Mono) only for timestamps and tickers.
- **Party colors:**
  - Democrat `#1560d4`. Republican `#d7262e`.
  - Independent or other: propose one that's clearly distinct from both and from gold (violet is a likely answer). It's needed for Nebraska's Senate race, a Republican vs. an independent.
  - "Changed hands" (a gain or flip) is marked with gold `#e3a50a`, always as a ring, outline or tag, never a fill.
- **States of a race** are the most important thing to get right. They must be distinguishable at a glance, and also for color-blind viewers (use pattern or weight, not hue alone):
  1. **No votes yet**: neutral.
  2. **Counting, uncalled**: tinted or hatched in the current leader's color, with "% expected vote in".
  3. **Called**: solid fill in the winner's color with a check or "PROJECTED WINNER" tag, plus the call source in small print ("AP").
  4. **Called and flipped**: as called, plus the gold mark.
- **Ground:** the House view is a light broadcast look (pale cool grey, glossy hexagons, a navy ticker bar with a gold clock box). Either keep the new views in the same light family or propose a consistent darker treatment for all three, which may be better for a TV in a dim room. If you propose dark, show the House view adapted too.

### Shared shell (on every view)

- **Bottom ticker bar** (navy, like the House view): the ET clock in a gold box at left; the latest race calls scrolling or stepping across, across all offices, newest first, with party-colored text; the data source credit at right ("Calls: AP via NYT · Votes: civicAPI").
- **Rotation indicator:** which view this is, how long until the next one, and what's next ("NEXT: SENATE"). Subtle, so it doesn't compete with data.
- **Freshness:** a small "updated 20 s ago" per view. It needs a clearly different look when data is stale (no change for several minutes, or a source unreachable). It must never read as an error to the room, only to me.
- **Breaking call interstitial:** when a race I've marked as key is called (a Senate race, or a California race I've picked), a 6–8 second full-screen card interrupts the rotation. It shows the winner's name, party, office, state, a "GAIN" tag if it flipped, and the vote share. This is the one moment where bold motion is welcome. Design the card and its entrance and exit.
- **Transitions between views:** quick and calm (under 600 ms). No spinning or 3D.

### View 1: House swingometer (exists)

Treat it as fixed. Only adapt it if the system needs it (ticker, rotation indicator, dark mode). It's a pendulum dial of all 435 districts placed by the swing needed to flip them, a needle showing the implied national swing, hexagon totals for called and predicted seats, and a dotted line marking the swing at which House control flips.

### View 2: U.S. Senate

Content:
- **Senate balance:** 100 seats; 65 aren't up this year (34 D, 31 R). Control takes 51 for Democrats; Republicans hold it at 50 through the VP tiebreak. Show seats won so far plus holdovers per party, the 50 and 51 lines, and the count still undecided. This should be the headline element.
- **Map of all 50 states**, colored by: not up this year (muted, holdover party hinted), no votes, counting (leader tint), called, and flipped. **I'd like a tile or hex cartogram** (equal-size states, which reads better on TV) rather than a geographic map, unless you make a strong case otherwise. The 35 races include two specials (Florida, Ohio), but no state has two Senate races this year.
- **Key races panel:** about 11 races (tossup and lean: AK, IA, KS, ME, OH, TX, MI, MN, NH, NE, SC). Each shows the state, the two leading candidates (last name, party, vote %, vote count), % expected vote in, a lead bar, and status. Nebraska is Republican vs. independent. All 11 must fit without scrolling; design it so 8–14 races would also fit.
- **Optional, if it helps the story:** "flips so far" (e.g. D +1, R +0).

### View 3: California

Content I'll choose from (design for a variable mix of these):
- **Ballot propositions:** up to 14 statewide props, each with a number, short title, Yes % vs. No %, and % reporting. A called prop shows "PASSES" or "FAILS". Yes/No colors must not be the party colors. Propose a neutral pair (e.g. green/grey, or ink/outline), and remember props are often close to 50/50 for hours.
- **Statewide races:** Governor (D vs. R this year), Lt. Governor, Attorney General, Secretary of State, and others. California's top-two system means some contests are two Democrats (or two Republicans), so the design can't depend on party colors to tell the two candidates apart.
- **Local races and measures:** for example the Los Angeles mayor and city measures, San Francisco measures, San Diego and San Jose council seats. Some will have only vote counts and no call.
- **Optional:** a California county map for one featured race or prop (counts by county are available), colored by leader.
- California counts slowly. Many races will sit at 30–60% counted all night, and leads can change for days. The design should make "early, partial count" feel normal, not broken.

Plan for 6–16 items on this view. If more than fit, show two pages that alternate within the view's time slot.

### What I need from you

1. A design system sheet: colors (as CSS custom properties), type scale, the four race states, the Yes/No pair, the independent color, and the gold flip mark.
2. Full-canvas 1920×1080 mockups with realistic sample data:
   - Senate: early night (few calls) and late night (most called, one flip).
   - California: an early partial count, and one with a few calls.
   - The breaking-call card.
   - The House view adapted to the shell (ticker and rotation indicator).
3. The same frames as static HTML/CSS: one file per view; no framework; SVG for the map and charts; CSS variables for every color. Please mark data slots with `data-field` attributes (e.g. `data-field="senate.dem.total"`) and repeatable rows with `data-template`, so I can wire live data straight into your markup.
4. A short motion spec: the view transition, the breaking-call card, a seat changing state, and numbers updating (a count-up or a crossfade; no long tweens on numbers that update every 30 seconds).

### Avoid

- Scroll, hover-only information, tooltips (nobody's holding a mouse).
- Tiny "percent reporting" text. It's essential context and should be readable.
- Red/green as the only signal anywhere.
- Fake precision (one decimal is enough for percentages).
- Anything that implies a call that hasn't happened. A leader is not a winner.
