// Translate the store's Race shape into the shapes DATA-CONTRACT.md defines.
//
// The contract asks for this to be a separate adapter so the renderers never
// see source-specific fields. Everything source-shaped stops here.

import { CALIFORNIA_RACES } from '../../config/california.js'
import { KEY_SENATE_RACES } from '../../config/senate.js'
import { KEY_GOVERNOR_RACES, GOVERNOR_HOLDOVERS } from '../../config/governors.js'
import { holdovers } from '../sources/civic.js'
import { partyControl } from '../sources/nyt.js'

// The store uses 'O' for anything that is not D/R/I. The contract uses 'N' for
// nonpartisan, which is what 'O' actually means in the races we show (the
// Oakland mayoral contest, and ballot measures).
export const party = p => (p === 'D' || p === 'R' || p === 'I' ? p : 'N')

/**
 * The contract's four race states. The store keeps 'called-flip'; the design
 * calls the same thing 'gain'.
 *
 * A leader is never a winner: only race.call produces 'called' or 'gain'.
 */
export function status (race) {
  if (race.call) return race.flipped ? 'gain' : 'called'
  if (race.pctIn > 0 || race.candidates.some(c => c.votes > 0)) return 'counting'
  return 'none'
}

/** The party that colours a glyph: the winner once called, else the leader. */
export function glyphParty (race) {
  if (race.call) return party(race.call.party)
  const leader = race.candidates.find(c => c.id === race.leader)
  return leader ? party(leader.party) : 'N'
}

const candidate = c => ({
  name: c.name, surname: c.surname, party: party(c.party), pct: c.pct, votes: c.votes, id: c.id,
})

/**
 * Candidates in display order. Normally that is by votes, but once AP has
 * called a race the winner goes first even if the count still shows someone
 * else ahead — which California's late mail ballots make a real possibility.
 * The Gain tag and the leader colour both hang off the first entry.
 */
function ordered (race) {
  const list = race.candidates.map(candidate)
  if (!race.call) return list
  const i = list.findIndex(c => c.id === race.call.winner)
  if (i > 0) list.unshift(list.splice(i, 1)[0])
  return list
}

// ---------------------------------------------------------------- Senate ----

export function senateData (store) {
  // Prefer NYT's own balance block, falling back to civicAPI's.
  const pc = partyControl.senate?.results?.[0]?.offices?.S?.party_balance
  const holdover = {
    D: pc ? pc.DEM.no_election : holdovers.D,
    R: pc ? pc.GOP.no_election : holdovers.R,
  }

  const races = store.racesBy('S').map(r => ({
    state: r.state,
    key: KEY_SENATE_RACES.includes(r.key),
    incumbentParty: r.holder,
    status: status(r),
    winner: r.call ? party(r.call.party) : null,
    leader: glyphParty(r),
    pctIn: r.pctIn,
    pending: r.pctIn === 0 && !r.candidates.some(c => c.votes > 0),
    candidates: ordered(r),
  }))

  const called = races.filter(r => r.status === 'called' || r.status === 'gain')
  const won = {
    D: called.filter(r => r.winner === 'D').length,
    R: called.filter(r => r.winner === 'R').length,
    I: called.filter(r => r.winner === 'I').length,
  }
  const flips = {
    D: races.filter(r => r.status === 'gain' && r.winner === 'D').length,
    R: races.filter(r => r.status === 'gain' && r.winner === 'R').length,
  }
  const total = { D: holdover.D + won.D, R: holdover.R + won.R }

  return {
    holdover, won, flips, total, races,
    // An independent is counted on his own. Who Osborn would caucus with is
    // not known, so he must not be silently assigned to either side.
    independents: won.I,
    undecided: 100 - total.D - total.R - won.I,
  }
}

// ------------------------------------------------------------- Governors ----

export function governorsData (store) {
  const races = store.racesBy('G').map(r => ({
    state: r.state,
    key: KEY_GOVERNOR_RACES.includes(r.key),
    incumbentParty: r.holder,
    status: status(r),
    winner: r.call ? party(r.call.party) : null,
    leader: glyphParty(r),
    pctIn: r.pctIn,
    candidates: ordered(r),
  }))

  const called = races.filter(r => r.status === 'called' || r.status === 'gain')
  const won = {
    D: called.filter(r => r.winner === 'D').length,
    R: called.filter(r => r.winner === 'R').length,
    I: called.filter(r => r.winner === 'I').length,
  }
  const flips = {
    D: races.filter(r => r.status === 'gain' && r.winner === 'D').length,
    R: races.filter(r => r.status === 'gain' && r.winner === 'R').length,
  }
  const holdover = GOVERNOR_HOLDOVERS
  const total = { D: holdover.D + won.D, R: holdover.R + won.R }
  return {
    holdover, won, flips, total, races,
    independents: won.I,
    // 50 governorships, not 100 seats. There is no control threshold here.
    undecided: 50 - total.D - total.R - won.I,
  }
}

// ------------------------------------------------------------ California ----

export function californiaData (store) {
  const get = cfg => {
    const r = store.getRace(cfg.key)
    if (!r) return null
    return { cfg, race: r }
  }
  const races = CALIFORNIA_RACES.filter(c => c.kind === 'race').map(get).filter(Boolean)
  const measures = CALIFORNIA_RACES.filter(c => c.kind === 'prop').map(get).filter(Boolean)

  return {
    races: races.map(({ cfg, race }) => ({
      id: cfg.key,
      office: cfg.label,
      sub: cfg.sub || '',
      status: status(race),
      glyphParty: glyphParty(race),
      pctIn: race.pctIn,
      // Before any count, show a dash rather than 0.0 for every candidate —
      // the same way the measures read.
      counted: race.candidates.some(c => c.votes > 0),
      leadChanged: race.leadChanged === true,
      candidates: ordered(race).slice(0, 2),
    })),
    measures: measures.map(({ cfg, race }) => {
      const yes = race.candidates.find(c => c.id === 'yes')
      const no = race.candidates.find(c => c.id === 'no')
      const tot = (yes?.votes || 0) + (no?.votes || 0)
      const yesPct = tot ? (100 * yes.votes) / tot : 0
      // A result comes only from a call, never from the current Yes share.
      const result = race.call ? (race.call.winner === 'yes' ? 'pass' : 'fail') : null
      return {
        id: cfg.key,
        label: cfg.label,
        title: cfg.title || '',
        scope: cfg.scope || 'state',
        threshold: cfg.threshold ?? 50,
        yesPct,
        noPct: tot ? 100 - yesPct : 0,
        counted: tot > 0,
        pctIn: race.pctIn,
        result,
      }
    }),
  }
}

// ----------------------------------------------------------------- Shell ----

// Ticker result text: "Dem hold", "GOP hold", "Dem" + Gain tag, "Passes".
const PARTY_WORD = { D: 'Dem', R: 'GOP', I: 'Ind', N: '' }

// The ticker has far less room than a view, so it gets short labels.
function tickerLabel (race) {
  if (race.short) return race.short
  if (race.office === 'S') return `${race.state} Sen`
  if (race.office === 'H') return race.key.replace(/^HOUSE-/, '')
  return race.label || race.key
}

export function callLine (race) {
  if (race.kind === 'prop') {
    return {
      race: tickerLabel(race),
      result: race.call.winner === 'yes' ? 'Passes' : 'Fails',
      party: 'N', gain: false,
    }
  }
  const p = party(race.call.party)
  const word = PARTY_WORD[p] || ''
  return {
    race: tickerLabel(race),
    result: race.flipped ? word : `${word} hold`,
    party: p,
    gain: race.flipped,
  }
}
