// Build a doctored copy of tonight's feeds so the display can be rehearsed
// with calls, flips and partial counts before any polls close.
//
//   node tools/make-rehearsal.mjs
//
// Writes into rehearsal/ (gitignored). Then open:
//   /?nytSenate=rehearsal/nyt-senate.json&civicSenate=rehearsal/civic-senate.json
//
// It only ever swaps URLs. There is no fake clock, so poll-close logic still
// runs against the real time.

import { writeFile, mkdir } from 'node:fs/promises'

const NYT = 'https://static01.nyt.com/elections-assets/pages/data/2026-11-03'
const CIVIC = 'https://civicapi.org/api/v2'

const get = async u => (await fetch(u)).json()

// A plausible mid-evening picture: several calls, two of them flips, and the
// rest counting. Keys are state postal codes.
const SCRIPT = {
  // state: [winnerParty, demShare, repShare, pctIn, called]
  AL: ['R', 36, 62, 96, true],
  AR: ['R', 38, 60, 92, true],
  CO: ['D', 56, 42, 88, true],
  DE: ['D', 59, 39, 94, true],
  FL: ['R', 46, 53, 91, true],
  GA: ['D', 50.4, 49.0, 97, true],   // a flip
  IA: ['D', 50.9, 48.5, 89, true],   // a flip
  KY: ['R', 41, 57, 95, true],
  ME: ['R', 47, 51, 86, true],
  MI: ['D', 52, 47, 84, true],
  NE: ['I', 44, 47, 90, true],       // Osborn, independent, over Ricketts
  OH: ['D', 51, 48, 78, true],       // a flip
  SC: ['R', 44, 55, 93, true],
  TX: ['R', 48, 51, 72, true],
  KS: [null, 47, 51, 61, false],     // counting, uncalled
  NH: [null, 52, 46, 55, false],
  MN: [null, 53, 45, 48, false],
  AK: [null, 45, 49, 31, false],
}

await mkdir('rehearsal', { recursive: true })

// ---------------------------------------------------------------- NYT ----
const sen = await get(`${NYT}/results-senate.json`)
let called = 0
for (const race of sen.races) {
  const ru = (race.reporting_units || [])[0]
  if (!ru || !ru.state_postal) continue
  const plan = SCRIPT[ru.state_postal]
  if (!plan) continue
  const [winner, dShare, rShare, pctIn, isCalled] = plan

  const meta = race.candidate_metadata || {}
  const partyOf = id => (meta[id] && meta[id].party && meta[id].party.nyt_id) || ''
  const total = Math.round(ru.total_expected_vote * (pctIn / 100)) || 1_000_000

  // Give the party's share to its leading candidate only. Handing the same
  // share to every Republican made Alaska show two of them on identical vote
  // counts, which is not what a real ballot looks like.
  const used = new Set()
  for (const c of ru.candidates || []) {
    const p = partyOf(c.nyt_id)
    const main = !used.has(p)
    used.add(p)
    const full = p === 'DEM' ? dShare : p === 'GOP' ? rShare
      : p === 'IND' ? Math.max(1, 100 - dShare - rShare - 1) : 0.4
    const share = main ? full : 0.3
    c.votes = { total: Math.max(0, Math.round(total * share / 100)) }
    c.leader = false
  }
  ru.total_votes = total
  ru.eevp = pctIn

  if (isCalled) {
    // Pick the winning candidate id the same way the real file would.
    const want = winner === 'D' ? 'DEM' : winner === 'R' ? 'GOP' : 'IND'
    const id = Object.keys(meta).find(k => partyOf(k) === want)
    if (id) {
      race.outcome = {
        ...race.outcome,
        won: [id],
        called_by: ['ap'],
        winner_accepted_at: [new Date(Date.now() - Math.random() * 36e5).toISOString()],
      }
      race.race_call_status = 'called'
      called++
    }
  }
}
await writeFile('rehearsal/nyt-senate.json', JSON.stringify(sen))

// -------------------------------------------------------------- civic ----
const civ = await get(`${CIVIC}/race/${87528}`)
for (const [key, reg] of Object.entries(civ.region_results || {})) {
  const plan = SCRIPT[key.toUpperCase()]
  if (!plan) continue
  const [winner, dShare, rShare, pctIn, isCalled] = plan
  const total = 1_500_000
  const used = new Set()
  for (const c of reg.candidates || []) {
    const p = (c.party || '').toLowerCase().slice(0, 3)
    const main = !used.has(p)
    used.add(p)
    const full = p === 'dem' ? dShare : p === 'rep' ? rShare
      : p === 'ind' ? Math.max(1, 100 - dShare - rShare - 1) : 0.4
    const share = main ? full : 0.3
    c.votes = Math.max(0, Math.round(total * share / 100))
    c.percent = share
    // civicAPI's own call is deliberately left off most races: AP via NYT is
    // the authority, and this lets the fallback path be tested separately.
    c.winner = isCalled && key.toUpperCase() === 'AL'
      ? p.startsWith(winner === 'D' ? 'dem' : 'rep') : false
  }
  reg.percent_reporting = pctIn
}
await writeFile('rehearsal/civic-senate.json', JSON.stringify(civ))

console.log(`Wrote rehearsal/nyt-senate.json (${called} calls) and rehearsal/civic-senate.json`)
console.log('Open: http://localhost:8000/?nytSenate=rehearsal/nyt-senate.json&civicSenate=rehearsal/civic-senate.json')
