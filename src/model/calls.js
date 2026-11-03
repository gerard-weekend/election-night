// Who gets to say a race is called.
//
//   1. manual            — you typed it in the operator window
//   2. AP via NYT        — while the NYT file has loaded in the last 4 minutes
//   3. civicAPI's call   — ONLY while NYT is down
//   4. auto-call         — House seats with no Republican, at their poll close
//
// Rule 2 is deliberate: if NYT is up but has not called a race, the race stays
// uncalled even when civicAPI has called it. AP has the track record; civicAPI's
// calls do not. See DATA-PLAN.md section 2.

import { nowMs, surname as toSurname } from '../util.js'

export const NYT_STALE_MS = 4 * 60e3

// Each office has its own NYT file, so each has its own health. Deciding a
// Senate race's precedence from the House file's health meant a working House
// feed could suppress a civicAPI Senate call that was the only one available.
export const NYT_FEED_FOR = { H: 'nytHouse', S: 'nytSenate', PROP: 'nytCA', CA: 'nytCA' }

export const nytHealthy = (health, office) => {
  const names = office ? [NYT_FEED_FOR[office] || 'nytHouse'] : Object.keys(NYT_FEED_FOR).map(k => NYT_FEED_FOR[k])
  return names.some(n => {
    const h = health[n]
    return !!(h && h.lastOk && nowMs() - h.lastOk < NYT_STALE_MS)
  })
}

// A source's call record is { party, name, at }, or for measures { winner: 'yes'|'no', at }.
// Map it onto one of the candidates we are actually showing. Party alone is not
// enough in California top-two contests, where both candidates share a party,
// nor in Nebraska (Republican vs. independent) — fall back to surname.
function matchCandidate (race, rec) {
  if (!rec) return null
  const cands = race.candidates
  if (!cands.length) return null

  if (rec.winner === 'yes' || rec.winner === 'no') {
    return cands.find(c => c.id === rec.winner) || null
  }

  const byParty = rec.party ? cands.filter(c => c.party === rec.party) : []
  if (byParty.length === 1) return byParty[0]

  const sn = toSurname(rec.name)
  if (sn) {
    const pool = byParty.length ? byParty : cands
    const hit = pool.find(c => c.surname === sn)
    if (hit) return hit
  }
  return byParty.length ? byParty[0] : null
}

/**
 * Decide the call for one race and write it to race.call.
 * Returns { changed, previous } so the store can raise a 'call' event —
 * including withdrawals, which must read as "CALL WITHDRAWN" and not vanish.
 */
export function resolveCall (race, health) {
  const previous = race.call
  const useNyt = nytHealthy(health, race.office)
  const src = race.callBySource

  let rec = null, source = null
  if (src.manual) { rec = src.manual; source = 'manual' }
  else if (useNyt && src.nyt) { rec = src.nyt; source = 'AP' }
  else if (!useNyt && src.civic) { rec = src.civic; source = 'civic' }
  else if (src.auto) { rec = src.auto; source = 'auto' }

  let next = null
  if (rec) {
    const cand = matchCandidate(race, rec)
    // A call we cannot tie to a candidate is not shown. Better a race that
    // reads uncalled than a winner's name we had to guess at.
    if (cand) {
      next = {
        winner: cand.id,
        name: cand.name,
        party: cand.party,
        source,
        // Keep the original call time across re-resolution so the ticker does
        // not reshuffle every poll.
        at: previous && previous.winner === cand.id ? previous.at : (rec.at || nowMs()),
      }
    }
  }

  race.call = next
  race.flipped = !!(next && race.holder && next.party && next.party !== race.holder)

  const changed =
    (!previous && !!next) ||
    (!!previous && !next) ||
    (previous && next && (previous.winner !== next.winner || previous.source !== next.source))

  return { changed, previous, withdrawn: !!previous && !next }
}
