// The one normalized Race shape every office uses, plus the rules for picking
// which source's votes to believe. No DOM, no fetching.

import { num, pct, partyBucket, surname, nowMs } from '../util.js'

/** @typedef {'H'|'S'|'G'|'PROP'|'LOCAL'} Office */

export function makeRace (key, { office, state = null, label = '', kind = 'race', holder = null }) {
  return {
    key, office, state, label, kind,
    // Each source's reading is kept whole and separate. The chosen `votes`
    // view is derived, so the fallback rule stays one function (chooseVotes).
    votesBySource: { civic: null, nyt: null },
    callBySource: { nyt: null, civic: null, manual: null, auto: null },
    candidates: [], pctIn: 0, leader: null, call: null,
    flipped: false, holder,
    votesFrom: null, updatedAt: 0, stale: false, test: false,
    // Races with only one feed (the Oakland contests) get no cross-check, and
    // the operator bar says so.
    singleSourced: false,
  }
}

// A source reading: { candidates: [{id,name,party,votes}], pctIn, at }
export function readingIsUsable (r) {
  if (!r || !Array.isArray(r.candidates) || !r.candidates.length) return false
  // The "major party at 0 votes while counting" fault seen in civicAPI's test
  // data. Treat the reading as suspect so the other source can stand in.
  if (r.pctIn > 0) {
    const buckets = r.candidates.map(c => partyBucket(c.party)).filter(Boolean)
    for (const p of ['D', 'R']) {
      if (!buckets.includes(p)) continue
      const total = r.candidates
        .filter(c => partyBucket(c.party) === p)
        .reduce((a, c) => a + num(c.votes), 0)
      if (total === 0) return false
    }
  }
  return true
}

// civicAPI first, NYT as fallback — the order DATA-PLAN.md specifies. Races
// with no civicAPI entry at all fall straight through to NYT.
export function chooseVotes (race) {
  const { civic, nyt } = race.votesBySource
  if (readingIsUsable(civic)) return { reading: civic, from: 'civic' }
  if (readingIsUsable(nyt)) return { reading: nyt, from: 'nyt' }
  if (civic) return { reading: civic, from: 'civic' }
  if (nyt) return { reading: nyt, from: 'nyt' }
  return { reading: null, from: null }
}

// Before any votes are counted every candidate sits at zero, so sorting by
// votes alone leaves raw ballot order — which put a write-in opposite Sherrod
// Brown and the Legal Marijuana candidate opposite Pete Ricketts.
//
// NYT ranks the serious contenders 1, 2, 3 and is the best signal available,
// so where we have it we use it; otherwise major parties rank first, then the
// feed's own sequence. Once real votes arrive they dominate, as they should.
const PARTY_RANK = { D: 0, R: 0, I: 1, O: 2 }

export function rankCandidates (a, b) {
  return (b.votes - a.votes)
    || ((a.rank ?? 99) - (b.rank ?? 99))
    || ((PARTY_RANK[a.party] ?? 0) - (PARTY_RANK[b.party] ?? 0))
    || ((a.order ?? 99) - (b.order ?? 99))
}

/**
 * Map NYT's ranking onto whichever candidate list we are displaying.
 *
 * Assigned greedily in NYT's own order, each NYT entry claiming one candidate,
 * because Alaska puts two Republicans named Sullivan on the ballot — the
 * incumbent and a near-namesake. Matching on surname alone would let the
 * decoy take the incumbent's rank and push Peltola out of the top two.
 */
function rankBySource (shown, nytReading) {
  const ranks = new Map()
  if (!nytReading || !Array.isArray(nytReading.candidates)) return ranks
  const pool = shown.map((c, i) => ({ c, i }))
  const nyt = [...nytReading.candidates].sort((a, b) => (a.order ?? 99) - (b.order ?? 99))

  for (const n of nyt) {
    const sn = surname(n.name)
    if (!sn) continue
    const sameName = pool.filter(p => surname(p.c.name) === sn)
    if (!sameName.length) continue
    // Prefer the one that also agrees on incumbency, then on party.
    const pick = sameName.find(p => !!p.c.incumbent === !!n.incumbent && partyBucket(p.c.party) === partyBucket(n.party))
      || sameName.find(p => !!p.c.incumbent === !!n.incumbent)
      || sameName.find(p => partyBucket(p.c.party) === partyBucket(n.party))
      || sameName[0]
    ranks.set(pick.i, n.order ?? 99)
    pool.splice(pool.indexOf(pick), 1)
  }
  return ranks
}

export function leaderOf (candidates) {
  let best = null
  for (const c of candidates) {
    if (!(c.votes > 0)) continue
    if (!best || c.votes > best.votes) best = c
  }
  return best ? best.id : null    // no leader until someone has a vote
}

export function twoPartyShare (candidates) {
  const d = candidates.filter(c => c.party === 'D').reduce((a, c) => a + c.votes, 0)
  const r = candidates.filter(c => c.party === 'R').reduce((a, c) => a + c.votes, 0)
  return d + r > 0 ? pct(d, d + r) : null
}

// A ballot measure's standing. "passing"/"failing" is a lead; PASSES/FAILS is
// only ever a call — the design brief is explicit that a leader is not a winner.
export function propStatus (race) {
  // A call outranks the vote test. Checking the total first made a called
  // measure read "none" whenever votes had not arrived yet.
  if (race.call) return race.call.winner === 'yes' ? 'passes' : 'fails'
  const yes = race.candidates.find(c => c.id === 'yes')
  const no = race.candidates.find(c => c.id === 'no')
  if (!yes || !no || yes.votes + no.votes === 0) return 'none'
  return pct(yes.votes, yes.votes + no.votes) > 50 ? 'passing' : 'failing'
}

// The four visual states the design brief defines.
export function statusOf (race) {
  if (race.call) return race.flipped ? 'called-flip' : 'called'
  if (race.pctIn > 0 || race.candidates.some(c => c.votes > 0)) return 'counting'
  return 'none'
}

// Recompute the derived view after any source writes. Pure: takes a race,
// mutates its derived fields only.
export function resolve (race) {
  const { reading, from } = chooseVotes(race)
  if (reading) {
    const total = reading.candidates.reduce((a, c) => a + num(c.votes), 0)
    const ranks = rankBySource(reading.candidates, race.votesBySource.nyt)
    race.candidates = reading.candidates.map((c, i) => ({
      id: c.id,
      name: c.name,
      party: c.party ?? partyBucket(c.party),
      surname: surname(c.name),
      votes: num(c.votes),
      pct: pct(num(c.votes), total),
      incumbent: !!c.incumbent,
      order: c.order,
      rank: ranks.get(i),
    })).sort(rankCandidates)
    race.pctIn = num(reading.pctIn)
    race.votesFrom = from
    race.updatedAt = reading.at || nowMs()
  }
  race.leader = leaderOf(race.candidates)
  return race
}
