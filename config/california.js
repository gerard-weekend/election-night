// The California races shown on the California view. IDs verified against both
// live feeds on election morning — see docs/DATA-PLAN.md section 3.
//
// ORDER MATTERS. The design's layout is fixed for this exact mix
// (docs/design/DATA-CONTRACT.md): four race slots, then six statewide
// propositions and two local measures. The renderer fills those slots in the
// order below, so:
//   kind 'race' -> Governor (large card), Attorney General, Oakland Mayor, CA-11
//   kind 'prop' -> six statewide, then two local
//
// Fields:
//   civicId    civicAPI race id. null means civicAPI does not carry the race,
//              so votes come from NYT instead of the usual civicAPI-first order.
//   nytId      NYT race id, used for the AP call and as the vote fallback.
//   existing   the race is already polled under this key by another view's
//              feeds; do not fetch or seed it again.
//   sub        small grey note beside the office name.
//   short      the label used in the ticker, which has far less room.
//   title      measure title. Must fit ~276 px at 23 px type, about 24
//              characters — the designer asked for short titles written into
//              the data rather than truncated on screen. Counts are in comments.
//   threshold  share of Yes needed to pass. Above 50 draws a gold tick.
//
// civicAPI's California local coverage is Los Angeles, Orange and San Mateo
// counties ONLY. Alameda is absent, which is why the three Oakland races are
// NYT-only and carry no cross-check.

export const CALIFORNIA_RACES = [
  // ---- Races: statewide ----
  { key: 'CA-GOV', kind: 'race', label: 'Governor', short: 'CA GOV',
    civicId: 86952, nytId: 'CA-G-G-2026-11-03' },
  { key: 'CA-AG', kind: 'race', label: 'Attorney General', short: 'CA AG',
    civicId: 86950, nytId: 'CA-G-AG-2026-11-03' },

  // ---- Races: local ----
  // Oakland is in Alameda County, so civicAPI has nothing for these.
  { key: 'CA-OAK-MAYOR', kind: 'race', label: 'Oakland Mayor', sub: 'Nonpartisan',
    short: 'OAK MAYOR', civicId: null, nytId: 'CA-G-M-oakland-2026-11-03' },
  // Already polled by the House feeds under this key, so it is displayed here
  // rather than fetched again: a second copy would be called twice and appear
  // twice in the ticker. A top-two contest between two Democrats, Chan vs
  // Wiener, so the rows must be told apart by name and not by party colour.
  { key: 'HOUSE-CA-11', kind: 'race', label: 'CA-11 · U.S. House', sub: 'Top-two · D vs D',
    short: 'CA-11', civicId: null, nytId: null, existing: true },

  // ---- Measures: statewide propositions ----
  // California initiatives and constitutional amendments all pass on a simple
  // majority, so every threshold here is 50.
  { key: 'CA-PROP-3', kind: 'prop', label: 'Prop 3', short: 'CA PROP 3',
    title: 'Education funding', scope: 'state', threshold: 50,          // 17
    civicId: 150570, nytId: 'CA-I-84433-CA-2026-11-03' },
  { key: 'CA-PROP-5', kind: 'prop', label: 'Prop 5', short: 'CA PROP 5',
    title: 'Recall elections', scope: 'state', threshold: 50,           // 16
    civicId: 150572, nytId: 'CA-I-84435-CA-2026-11-03' },
  { key: 'CA-PROP-40', kind: 'prop', label: 'Prop 40', short: 'CA PROP 40',
    title: 'One-time wealth tax', scope: 'state', threshold: 50,        // 19
    civicId: 150576, nytId: 'CA-I-84439-CA-2026-11-03' },
  { key: 'CA-PROP-41', kind: 'prop', label: 'Prop 41', short: 'CA PROP 41',
    title: 'Special taxes audit', scope: 'state', threshold: 50,        // 19
    civicId: 150577, nytId: 'CA-I-84440-CA-2026-11-03' },
  { key: 'CA-PROP-42', kind: 'prop', label: 'Prop 42', short: 'CA PROP 42',
    title: 'Personal property tax', scope: 'state', threshold: 50,      // 21
    civicId: 150578, nytId: 'CA-I-84441-CA-2026-11-03' },
  { key: 'CA-PROP-45', kind: 'prop', label: 'Prop 45', short: 'CA PROP 45',
    title: 'Environmental review', scope: 'state', threshold: 50,       // 20
    civicId: 150581, nytId: 'CA-I-84444-CA-2026-11-03' },

  // ---- Measures: local ----
  // Measure FF was deliberately written as a general tax rather than a special
  // one, which keeps it on a simple majority instead of two thirds.
  { key: 'CA-OAK-EE', kind: 'prop', label: 'Oakland EE', short: 'OAK EE',
    title: 'Mayoral power', scope: 'local', threshold: 50,              // 13
    civicId: null, nytId: 'CA-I-85070-CA-2026-11-03' },
  { key: 'CA-OAK-FF', kind: 'prop', label: 'Oakland FF', short: 'OAK FF',
    title: 'Property transfer tax', scope: 'local', threshold: 50,      // 21
    civicId: null, nytId: 'CA-I-85071-CA-2026-11-03' },
]

// Dropped: Regional Transit Measure (RTM, "BART funding"). It is a five-county
// measure (Alameda, Contra Costa, San Francisco, San Mateo, Santa Clara) and no
// source reachable from the browser carries the combined total — civicAPI has
// San Mateo's share only (id 182612), NYT does not carry it, the Secretary of
// State API covers state-administered contests only, and none of the five
// county registrars send CORS headers.
