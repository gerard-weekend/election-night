// The Senate races shown in the key-races panel, in display order.

// Shown in this order, top to bottom — roughly most to least consequential,
// not alphabetical. The panel holds up to 15.
export const KEY_SENATE_RACES = [
  'SEN-MN', 'SEN-GA', 'SEN-NH', 'SEN-NC', 'SEN-MI',
  'SEN-ME', 'SEN-OH', 'SEN-AK', 'SEN-TX', 'SEN-KS',
  'SEN-IA', 'SEN-NE', 'SEN-SC', 'SEN-LA', 'SEN-MS',
]

// Control thresholds. Republicans hold the chamber at 50 through the VP
// tiebreak, so the two parties have different targets.
export const TO_WIN = { D: 51, R: 50 }

// Nebraska is Republican vs. independent. An independent winner is counted
// separately: who he would caucus with is not known, so the control maths
// must not silently assign him to either side.
export const INDEPENDENT_CAUCUS_UNKNOWN = true

// Which party currently holds each seat up in 2026. Needed to decide a flip:
// the feeds only carry an incumbent's party, and open seats (Alabama,
// Illinois, Iowa, Kentucky, Michigan, Minnesota, New Hampshire, North
// Carolina) have no incumbent on the ballot, so a flip there would otherwise
// go unmarked.
//
// Class 2, plus the Florida and Ohio specials. Cross-check: 13 D + 22 R = 35
// up, and with the 34 D / 31 R holdovers that totals 47 D / 53 R, which is
// the current chamber.
export const SEAT_HOLDERS = {
  AL: 'R', AK: 'R', AR: 'R', CO: 'D', DE: 'D', FL: 'R', GA: 'D', ID: 'R',
  IL: 'D', IA: 'R', KS: 'R', KY: 'R', LA: 'R', ME: 'R', MA: 'D', MI: 'D',
  MN: 'D', MS: 'R', MT: 'R', NE: 'R', NH: 'D', NJ: 'D', NM: 'D', NC: 'R',
  OH: 'R', OK: 'R', OR: 'D', RI: 'D', SC: 'R', SD: 'R', TN: 'R', TX: 'R',
  VA: 'D', WV: 'R', WY: 'R',
}
