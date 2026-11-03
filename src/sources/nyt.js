// NYT election files — AP's calls, and a second set of vote counts.
//
// Undocumented files that could change format, so each poll sanity-checks how
// many races it recognised and treats a collapse as a format change rather
// than as data. Never touches the DOM.

import store from '../store.js'
import { num, partyBucket, nowMs } from '../util.js'
import { CALIFORNIA_RACES } from '../../config/california.js'
import { seatId } from './civic.js'

const BASE = 'https://static01.nyt.com/elections-assets/pages/data/2026-11-03'
const EVERY = 45e3

// Minimum races a healthy file must yield. Below this, assume the format moved.
const MIN_HOUSE = 400
const MIN_SENATE = 30

export const partyControl = { senate: null }

async function getJson (url) {
  const r = await fetch(url, { cache: 'no-store' })
  if (!r.ok) throw new Error(`NYT answered ${r.status}.`)
  const j = await r.json()
  if (!Array.isArray(j.races)) throw new Error('NYT file format changed (no races list).')
  return j
}

// outcome.won[0] is a candidate id; its party lives in candidate_metadata.
function callOf (race) {
  const won = (race.outcome && race.outcome.won) || []
  if (!won.length) return null
  const meta = (race.candidate_metadata || {})[won[0]]
  if (!meta) return null
  const nytParty = meta.party && meta.party.nyt_id
  const name = [meta.first_name, meta.last_name].filter(Boolean).join(' ')
  const at = Date.parse((race.outcome.winner_accepted_at || [])[0]) || nowMs()
  // Ballot measures use the literal ids 'yes' / 'no'.
  if (won[0] === 'yes' || won[0] === 'no') return { winner: won[0], at }
  return { party: partyBucket(nytParty), name, at }
}

function unitCandidates (race, unit) {
  const meta = race.candidate_metadata || {}
  return (unit.candidates || []).map(c => {
    const m = meta[c.nyt_id] || {}
    const isProp = c.nyt_id === 'yes' || c.nyt_id === 'no'
    return {
      id: isProp ? c.nyt_id : c.nyt_id,
      name: isProp
        ? c.nyt_id === 'yes' ? 'Yes' : 'No'
        : [m.first_name, m.last_name].filter(Boolean).join(' ') || c.nyt_id,
      party: isProp ? null : partyBucket(m.party && m.party.nyt_id),
      votes: num(c.votes && c.votes.total),
      incumbent: !!m.incumbent,
      // NYT ranks the serious contenders 1, 2, ... and omits write-ins.
      order: m.order ?? m.ballot_order,
    }
  })
}

const topUnit = race => (race.reporting_units || [])[0] || null

function markOk (name) { store.setHealth(name, { ok: true, lastOk: nowMs(), lastChange: nowMs(), error: null }) }
function markFail (name, e) {
  store.setHealth(name, { ok: false, error: e instanceof TypeError ? 'NYT not reachable.' : e.message })
}

// ---------------------------------------------------------------- House ----

async function pollHouse () {
  const changed = new Set()
  try {
    const j = await getJson(`${BASE}/results-house.json`)
    let matched = 0
    for (const race of j.races) {
      // Louisiana House races are race_type_id 'L', not 'G'. Accept both.
      if (race.office_id !== 'H' || (race.race_type_id !== 'G' && race.race_type_id !== 'L')) continue
      const ru = topUnit(race)
      // Skip the national House popular-vote row.
      if (!ru || !ru.state_postal || ru.state_postal === 'US') continue
      const id = `HOUSE-${seatId(ru.state_postal, race.seat_number)}`
      matched++
      store.observe(id, { office: 'H', state: ru.state_postal }, 'nyt', {
        votes: { candidates: unitCandidates(race, ru), pctIn: num(ru.eevp) },
        call: callOf(race),
      })
      changed.add(id)
    }
    if (matched < MIN_HOUSE) throw new Error(`NYT format changed (only ${matched} House races recognised).`)
    markOk('nyt')
  } catch (e) { markFail('nyt', e) }
  store.commit(changed)
  setTimeout(pollHouse, EVERY)
}

// --------------------------------------------------------------- Senate ----

async function pollSenate () {
  const changed = new Set()
  try {
    const j = await getJson(`${BASE}/results-senate.json`)
    partyControl.senate = j.partyControlData || null
    let matched = 0
    for (const race of j.races) {
      if (race.office_id !== 'S') continue
      const ru = topUnit(race)
      if (!ru || !ru.state_postal || ru.state_postal === 'US') continue
      const id = `SEN-${ru.state_postal}`
      matched++
      store.observe(id, { office: 'S', state: ru.state_postal, label: ru.name }, 'nyt', {
        votes: { candidates: unitCandidates(race, ru), pctIn: num(ru.eevp) },
        call: callOf(race),
      })
      const r = store.getRace(id)
      if (r) { r.rating = race.rating || race.general_rating || null; r.callStatus = race.race_call_status }
      changed.add(id)
    }
    if (matched < MIN_SENATE) throw new Error(`NYT format changed (only ${matched} Senate races recognised).`)
    markOk('nytSenate')
  } catch (e) { markFail('nytSenate', e) }
  store.commit(changed)
  setTimeout(pollSenate, EVERY)
}

// ----------------------------------------------------------- California ----

async function pollCalifornia () {
  const changed = new Set()
  try {
    const j = await getJson(`${BASE}/results-california.json`)
    const byId = new Map(j.races.map(r => [r.nyt_id, r]))
    let matched = 0
    for (const cfg of CALIFORNIA_RACES) {
      const race = byId.get(cfg.nytId)
      if (!race) continue
      const ru = topUnit(race)
      if (!ru) continue
      matched++
      store.observe(cfg.key,
        { office: cfg.kind === 'prop' ? 'PROP' : 'CA', label: cfg.label, kind: cfg.kind, state: 'CA' },
        'nyt', {
          votes: { candidates: unitCandidates(race, ru), pctIn: num(ru.eevp) },
          call: callOf(race),
        })
      const r = store.getRace(cfg.key)
      // The three Oakland races have no civicAPI entry, so they run without a
      // cross-check. The operator bar surfaces this.
      if (r) { r.singleSourced = cfg.civicId == null; r.title = cfg.title || null }
      changed.add(cfg.key)
    }
    if (!matched) throw new Error('NYT format changed (no configured California race found).')
    markOk('nytCA')
  } catch (e) { markFail('nytCA', e) }
  store.commit(changed)
  setTimeout(pollCalifornia, EVERY)
}

export function start () {
  // Staggered so the three files do not land together.
  pollHouse()
  setTimeout(pollSenate, 15e3)
  setTimeout(pollCalifornia, 30e3)
}
