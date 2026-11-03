// civicAPI — the primary vote source. Never touches the DOM.
//
// Quirks this handles, learned from the House build:
//  - `region_results` keys are lowercase ('ky-01', 'ak-al', 'me')
//  - votes and percentages can arrive as strings
//  - `test_data: true` during pre-night rehearsals must be carried through
//  - the overview can carry a stale duplicate candidate at 0 votes, so a race
//    whose major party shows zero while counting is re-checked per-race

import store from '../store.js'
import { num, partyBucket, sleep, nowMs, testUrl } from '../util.js'
import { fetchJson } from './http.js'
import { CALIFORNIA_RACES } from '../../config/california.js'
import { SEAT_HOLDERS } from '../../config/senate.js'

const BASE = 'https://civicapi.org/api/v2'
export const HOUSE_ID = 87524
export const SENATE_ID = 87528

const HOUSE_EVERY = 30e3
const SENATE_EVERY = 30e3
const CA_EVERY = 60e3

const AT_LARGE = new Set(['AK', 'DE', 'ND', 'SD', 'VT', 'WY'])
export const seatId = (st, num_) =>
  AT_LARGE.has(st) ? `${st}-AL` : `${st}-${String(parseInt(num_, 10)).padStart(2, '0')}`

const detailCache = new Map()

const getJson = url => fetchJson(url, { label: 'civicAPI' })

// One civicAPI candidate list -> our reading shape. `kind` decides whether the
// entries are partisan candidates or a measure's Yes/No pair.
function toCandidates (list, kind) {
  return (list || [])
    // DATA-PLAN.md: ignore write-ins. Ohio lists three, and with every vote at
    // zero they would otherwise outrank the actual Republican nominee.
    .filter(c => !/write[- ]?in/i.test(String(c.party || '')))
    .map((c, i) => {
    const name = String(c.name || '').trim()
    const isProp = kind === 'prop' || /^(yes|no)$/i.test(name)
    return {
      id: isProp ? name.toLowerCase() : String(c.candidate_id),
      name,
      party: isProp ? null : partyBucket(c.party),
      votes: num(c.votes),
      incumbent: !!c.incumbent,
      winner: !!c.winner,
      order: i + 1,
    }
  })
}

function callFrom (cands) {
  const w = cands.find(c => c.winner)
  return w ? { party: w.party, name: w.name, winner: w.id, at: nowMs() } : null
}

function markOk (name, changed, test) {
  store.setHealth(name, {
    ok: true, lastOk: nowMs(), error: null, test: !!test,
    ...(changed ? { lastChange: nowMs() } : {}),
  })
}

function markFail (name, e) {
  store.setHealth(name, {
    ok: false,
    error: e instanceof TypeError ? 'civicAPI not reachable.' : e.message,
  })
}

// ---------------------------------------------------------------- House ----

async function pollHouse () {
  const changed = new Set()
  try {
    const j = await getJson(testUrl('civicHouse') || `${BASE}/race/${HOUSE_ID}`)
    const regions = j.region_results || {}
    if (!Object.keys(regions).length) throw new Error('civicAPI returned no districts.')

    const suspects = []
    for (const [key, reg] of Object.entries(regions)) {
      const id = `HOUSE-${key.toUpperCase()}`
      let cands = toCandidates(reg.candidates, 'race')
      const pctIn = num(reg.percent_reporting)

      // Stale-duplicate guard: a major party at zero while the race counts.
      const buckets = cands.map(c => c.party).filter(Boolean)
      const zeroMajor = pctIn > 0 && ['D', 'R'].some(p =>
        buckets.includes(p) && cands.filter(c => c.party === p).every(c => c.votes === 0))
      if (zeroMajor && reg.election_id) {
        const hit = detailCache.get(reg.election_id)
        if (hit && nowMs() - hit.at < 120e3) cands = hit.cands
        else suspects.push({ eid: reg.election_id, id })
      }

      store.observe(id, { office: 'H', state: key.slice(0, 2).toUpperCase(), label: key.toUpperCase() },
        'civic', { votes: { candidates: cands, pctIn }, call: callFrom(cands) })
      changed.add(id)
    }
    markOk('civicHouse', true, j.test_data)
    // A few per cycle, spaced out: civicAPI is a free service.
    fetchDetails(suspects.slice(0, 6))
  } catch (e) { markFail('civicHouse', e) }
  store.commit(changed)
  setTimeout(pollHouse, HOUSE_EVERY)
}

async function fetchDetails (suspects) {
  for (const { eid, id } of suspects) {
    try {
      const j = await getJson(`${BASE}/race/${eid}`)
      const cands = toCandidates(j.candidates, 'race')
      detailCache.set(eid, { at: nowMs(), cands })
      store.observe(id, null, 'civic',
        { votes: { candidates: cands, pctIn: num(j.percent_reporting) }, call: callFrom(cands) })
    } catch (e) { /* the overview reading stands */ }
    await sleep(1200)
  }
}

// --------------------------------------------------------------- Senate ----

// Seats not up this year, from the overview's party totals. Cross-checked
// against NYT partyControlData in the Senate view.
export const holdovers = { D: 0, R: 0, I: 0, O: 0 }

async function pollSenate () {
  const changed = new Set()
  try {
    const j = await getJson(testUrl('civicSenate') || `${BASE}/race/${SENATE_ID}`)
    const regions = j.region_results || {}
    if (!Object.keys(regions).length) throw new Error('civicAPI returned no Senate races.')

    for (const c of j.candidates || []) {
      const p = partyBucket(c.party)
      if (p && c.seats != null) holdovers[p] = num(c.seats)
    }

    for (const [key, reg] of Object.entries(regions)) {
      const st = key.toUpperCase()
      const id = `SEN-${st}`
      const cands = toCandidates(reg.candidates, 'race')
      store.observe(id, { office: 'S', state: st, label: reg.name || st, holder: SEAT_HOLDERS[st] || null },
        'civic', { votes: { candidates: cands, pctIn: num(reg.percent_reporting) }, call: callFrom(cands) })
      changed.add(id)
    }
    markOk('civicSenate', true, j.test_data)
  } catch (e) { markFail('civicSenate', e) }
  store.commit(changed)
  setTimeout(pollSenate, SENATE_EVERY)
}

// ----------------------------------------------------------- California ----

// One request per configured race, spaced ~1 s apart. Races with civicId null
// (the Oakland contests) are skipped — NYT is their only source.
async function pollCalifornia () {
  const changed = new Set()
  let anyOk = false, test = false
  for (const cfg of CALIFORNIA_RACES) {
    if (cfg.civicId == null) continue
    try {
      const j = await getJson(`${BASE}/race/${cfg.civicId}`)
      const cands = toCandidates(j.candidates, cfg.kind)
      store.observe(cfg.key,
        { office: cfg.kind === 'prop' ? 'PROP' : 'CA', label: cfg.label, kind: cfg.kind, state: 'CA' },
        'civic', { votes: { candidates: cands, pctIn: num(j.percent_reporting) }, call: callFrom(cands) })
      // County breakdowns, kept for the optional county map.
      const race = store.getRace(cfg.key)
      if (race && j.region_results) race.counties = j.region_results
      changed.add(cfg.key)
      anyOk = true
      test = test || !!j.test_data
      // Commit per race rather than once at the end: the full pass takes ~15 s
      // and the view should fill in as it goes, not jump all at once.
      markOk('civicCA', true, test)
      store.commit(new Set([cfg.key]))
    } catch (e) { /* one race failing must not stop the rest */ }
    await sleep(1000)
  }
  if (!anyOk) markFail('civicCA', new Error('No California race could be read.'))
  store.commit(changed)
  setTimeout(pollCalifornia, CA_EVERY)
}

export function start () {
  pollHouse()
  pollSenate()
  setTimeout(pollCalifornia, 2000)   // let the two overviews land first
}
