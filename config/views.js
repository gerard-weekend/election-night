// Rotation order and timing. Durations can be changed live from the control
// window; these are the startup defaults.

export const VIEWS = [
  { id: 'house',      title: 'House',      duration: 60e3, enabled: true },
  { id: 'senate',     title: 'Senate',     duration: 45e3, enabled: true },
  { id: 'california', title: 'California', duration: 45e3, enabled: true },
]

// A view with nothing new since it was last shown can be shortened, but never
// skipped — the rhythm is what makes the room able to follow it.
export const MIN_DURATION = 20e3
export const TRANSITION_MS = 450
