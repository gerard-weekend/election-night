// The California races shown on the CA view. IDs verified against both feeds
// on election morning (Nov 3, 2026) — see docs/DATA-PLAN.md section 3.
//
// kind:    'race' (candidates) | 'prop' (Yes/No)
// civicId: civicAPI race id. null means the race is NOT in civicAPI, so votes
//          come from NYT instead of the usual civicAPI-first order.
// nytId:   NYT race id, used for the AP call and as the vote fallback.
//
// civicAPI's California local coverage is Los Angeles, Orange and San Mateo
// counties ONLY. Alameda is absent, which is why the three Oakland races are
// NYT-only and carry no cross-check.

export const CALIFORNIA_RACES = [
  // ---- Statewide offices ----
  { key: 'CA-GOV', kind: 'race', label: 'Governor',
    civicId: 86952, nytId: 'CA-G-G-2026-11-03' },
  { key: 'CA-AG',  kind: 'race', label: 'Attorney General',
    civicId: 86950, nytId: 'CA-G-AG-2026-11-03' },

  // ---- Statewide propositions ----
  { key: 'CA-PROP-3',  kind: 'prop', label: 'Prop 3',  title: 'Education Funding',
    civicId: 150570, nytId: 'CA-I-84433-CA-2026-11-03' },
  { key: 'CA-PROP-5',  kind: 'prop', label: 'Prop 5',  title: 'Recall Elections',
    civicId: 150572, nytId: 'CA-I-84435-CA-2026-11-03' },
  { key: 'CA-PROP-40', kind: 'prop', label: 'Prop 40', title: 'Wealth Tax',
    civicId: 150576, nytId: 'CA-I-84439-CA-2026-11-03' },
  { key: 'CA-PROP-41', kind: 'prop', label: 'Prop 41', title: 'Special Taxes Audit',
    civicId: 150577, nytId: 'CA-I-84440-CA-2026-11-03' },
  { key: 'CA-PROP-42', kind: 'prop', label: 'Prop 42', title: 'Property Taxes',
    civicId: 150578, nytId: 'CA-I-84441-CA-2026-11-03' },
  { key: 'CA-PROP-45', kind: 'prop', label: 'Prop 45', title: 'Environmental Reviews',
    civicId: 150581, nytId: 'CA-I-84444-CA-2026-11-03' },

  // ---- San Francisco's U.S. House seat ----
  // Already polled by the House feeds under this key, so it is shown here
  // rather than fetched again: a second copy would be called twice and appear
  // twice in the ticker. `existing` means "already in the store, just display
  // it" — it keeps both sources behind it, so it is not single-sourced.
  // A top-two contest between two Democrats, Chan vs Wiener, so the two rows
  // have to be told apart by name and not by party colour.
  { key: 'HOUSE-CA-11', kind: 'race', label: 'U.S. House CA-11', title: 'San Francisco',
    civicId: null, nytId: null, existing: true },

  // ---- Oakland (NYT only — no civicAPI coverage of Alameda County) ----
  { key: 'CA-OAK-MAYOR', kind: 'race', label: 'Oakland Mayor',
    civicId: null, nytId: 'CA-G-M-oakland-2026-11-03' },
  { key: 'CA-OAK-EE', kind: 'prop', label: 'Oakland EE', title: 'Mayoral Power',
    civicId: null, nytId: 'CA-I-85070-CA-2026-11-03' },
  { key: 'CA-OAK-FF', kind: 'prop', label: 'Oakland FF', title: 'Property Transfer Tax',
    civicId: null, nytId: 'CA-I-85071-CA-2026-11-03' },
]

// Dropped: Regional Transit Measure (RTM, "BART funding"). It is a five-county
// measure (Alameda, Contra Costa, San Francisco, San Mateo, Santa Clara) and no
// source reachable from the browser carries the combined total — civicAPI has
// San Mateo's share only (id 182612), NYT does not carry it, the Secretary of
// State API covers state-administered contests only, and none of the five
// county registrars send CORS headers.
