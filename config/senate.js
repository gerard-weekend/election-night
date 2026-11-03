// The Senate races shown in the key-races panel. Defaults to the NYT tossup
// and lean ratings as of election morning. The panel is designed to hold
// 8-14, so this can be edited without breaking the layout.

export const KEY_SENATE_RACES = [
  'SEN-AK', 'SEN-IA', 'SEN-KS', 'SEN-ME', 'SEN-OH',
  'SEN-TX', 'SEN-MI', 'SEN-MN', 'SEN-NH', 'SEN-NE', 'SEN-SC',
]

// Control thresholds. Republicans hold the chamber at 50 through the VP
// tiebreak, so the two parties have different targets.
export const TO_WIN = { D: 51, R: 50 }

// Nebraska is Republican vs. independent. An independent winner is counted
// separately: who he would caucus with is not known, so the control maths
// must not silently assign him to either side.
export const INDEPENDENT_CAUCUS_UNKNOWN = true
