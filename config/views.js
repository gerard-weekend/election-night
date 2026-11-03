// Rotation order and timing. Durations can be changed live from the control
// window; these are the startup defaults.
//
// The designer's default is 60 s each; these are the owner's timings. One
// full cycle is 85 s.

export const VIEWS = [
  { id: 'house', title: 'House', duration: 20e3, enabled: true },
  { id: 'senate', title: 'Senate', duration: 30e3, enabled: true },
  { id: 'governors', title: 'Governors', duration: 15e3, enabled: true },
  { id: 'california', title: 'California', duration: 20e3, enabled: true },
]

// Below the shortest configured slot, so nothing is silently lengthened.
export const MIN_DURATION = 10e3
export const TRANSITION_MS = 500      // MOTION.md: 500 ms cross-fade

// SHELL.md freshness thresholds.
export const STALE_AFTER_MS = 2 * 60e3        // no successful fetch
export const NO_CHANGE_AFTER_MS = 10 * 60e3   // no change while results move

// Long-run hygiene: nudge the whole stage every 10 minutes, up to 4 px.
export const DRIFT_EVERY_MS = 10 * 60e3
export const DRIFT_MAX_PX = 4
