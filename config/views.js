// Rotation order and timing. Durations can be changed live from the control
// window; these are the startup defaults.
//
// 60 s per view is the designer's default (docs/design/SHELL.md). DATA-PLAN
// proposed 60/45/45; the design's even rhythm wins, since the countdown and
// progress hairline are built around a single slot length.

export const VIEWS = [
  { id: 'house', title: 'House', duration: 60e3, enabled: true },
  { id: 'senate', title: 'Senate', duration: 60e3, enabled: true },
  { id: 'california', title: 'California', duration: 60e3, enabled: true },
]

export const MIN_DURATION = 20e3
export const TRANSITION_MS = 500      // MOTION.md: 500 ms cross-fade

// SHELL.md freshness thresholds.
export const STALE_AFTER_MS = 2 * 60e3        // no successful fetch
export const NO_CHANGE_AFTER_MS = 10 * 60e3   // no change while results move

// Long-run hygiene: nudge the whole stage every 10 minutes, up to 4 px.
export const DRIFT_EVERY_MS = 10 * 60e3
export const DRIFT_MAX_PX = 4
