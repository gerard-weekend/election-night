// Governors view: which races are shown, and who holds each seat.
//
// There is no national governors feed in civicAPI — each is a separate
// statewide race — so the full field of 36 comes from NYT's results-governor
// file in one request, and civicAPI supplies vote counts for the races shown
// in detail. That keeps the usual order (calls from AP via NYT, votes from
// civicAPI) without adding 36 requests a minute to a service already
// returning intermittent 503s.

// The key-races panel, in display order, top to bottom. Holds up to 15.
export const KEY_GOVERNOR_RACES = [
  'GOV-ME', 'GOV-MI', 'GOV-AZ', 'GOV-AK', 'GOV-OR',
  'GOV-WI', 'GOV-GA', 'GOV-NV', 'GOV-OH', 'GOV-IA',
  'GOV-TX', 'GOV-FL', 'GOV-KS', 'GOV-NH',
]

// civicAPI race ids for the races above. Only these are fetched per-race;
// every other governorship takes its numbers from the NYT file.
export const CIVIC_GOVERNOR_IDS = {
  ME: 87189, MI: 87215, AZ: 86928, AK: 148898, OR: 87375,
  WI: 87491, GA: 87088, NV: 87260, OH: 87365, IA: 87152,
  TX: 55857, FL: 87069, KS: 87163, NH: 87284,
}

// Party holding each governorship going into the election. Needed to mark a
// gain: NYT only carries an incumbent's party, and 19 of these 36 are open
// seats with no incumbent on the ballot.
//
// Cross-checked against NYT's incumbent party for all 17 races that do have
// one, with no mismatches.
export const GOVERNOR_HOLDERS = {
  AL: 'R', AK: 'R', AZ: 'D', AR: 'R', CA: 'D', CO: 'D', CT: 'D', FL: 'R',
  GA: 'R', HI: 'D', IA: 'R', ID: 'R', IL: 'D', KS: 'D', MA: 'D', MD: 'D',
  ME: 'D', MI: 'D', MN: 'D', NE: 'R', NH: 'R', NM: 'D', NV: 'R', NY: 'D',
  OH: 'R', OK: 'R', OR: 'D', PA: 'D', RI: 'D', SC: 'R', SD: 'R', TN: 'R',
  TX: 'R', VT: 'R', WI: 'D', WY: 'R',
}

// The 14 governorships not up this year. 6 D + 8 R, which with the 18 D / 18 R
// up this year makes the 24 / 26 split of all 50.
export const GOVERNOR_HOLDOVERS = { D: 6, R: 8 }
