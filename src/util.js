// Small shared helpers. No DOM, no fetching.

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
export const sleep = ms => new Promise(r => setTimeout(r, ms))

// civicAPI sends votes and percentages as strings in places. Always coerce.
export const num = v => {
  const n = typeof v === 'number' ? v : parseFloat(v)
  return Number.isFinite(n) ? n : 0
}

// The whole system reads the clock through here, so poll-close logic is
// testable without a URL parameter. In production this is just Date.now().
export const nowMs = () => Date.now()

// Election day is Tuesday Nov 3, 2026. DST ended Nov 1, so ET is EST (UTC-5).
// Poll-close checks must pin the date as well as the hour or they fire on the
// wrong day — a bug the House build hit.
export const ET_OFFSET_H = 5
export const closeMs = etHour => Date.UTC(2026, 10, 3, ET_OFFSET_H) + etHour * 3600e3

export function nowET () {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric', minute: 'numeric', hourCycle: 'h23',
    }).formatToParts(new Date(nowMs())).map(x => [x.type, x.value]),
  )
  return +p.hour + +p.minute / 60
}

export function ago (ms) {
  if (!ms) return 'never'
  const s = Math.max(0, Math.round((nowMs() - ms) / 1000))
  if (s < 90) return `${s}s ago`
  if (s < 5400) return `${Math.round(s / 60)} min ago`
  return `${Math.round(s / 3600)} h ago`
}

// Party labels differ per feed: civicAPI spells them out ("Democratic"), NYT
// uses ids ("DEM"/"GOP"). Everything downstream uses D / R / I / O.
export function partyBucket (raw) {
  if (!raw) return null
  const s = String(raw).toUpperCase()
  if (s.startsWith('DEM') || s === 'D') return 'D'
  if (s.startsWith('REP') || s === 'GOP' || s === 'R') return 'R'
  if (s.startsWith('IND') || s === 'I') return 'I'
  if (s === 'YES' || s === 'NO') return null      // ballot measures are not partisan
  return 'O'
}

// Used to match candidates across the two feeds when party alone is ambiguous
// (California top-two contests put two Democrats on the same ballot).
export function surname (name) {
  if (!name) return ''
  const parts = String(name).trim().replace(/\s+(Jr\.?|Sr\.?|I{2,}|IV)$/i, '').split(/\s+/)
  return (parts[parts.length - 1] || '').toLowerCase()
}

export const pct = (part, whole) => (whole > 0 ? (100 * part) / whole : 0)

// Test-source override, e.g. ?nytSenate=rehearsal/senate-called.json
// Used to rehearse calls before polls close. It only ever swaps a URL: there
// is no fake clock, so poll-close logic always runs against the real time.
// Returns null outside a browser, so the Node tools are unaffected.
export function testUrl (name) {
  if (typeof location === 'undefined') return null
  return new URLSearchParams(location.search).get(name)
}
