// Senate view: chamber balance, a tile cartogram of all 50 states, and the
// key-races panel.
//
// Structural markup only — every value sits behind a data-field hook and every
// repeated row behind data-template, so the designer's HTML can replace this
// wholesale without the data layer changing.

import { KEY_SENATE_RACES, TO_WIN } from '../../../config/senate.js'
import { holdovers } from '../../sources/civic.js'
import { partyControl } from '../../sources/nyt.js'
import { statusOf } from '../../model/race.js'
import { freshness } from '../../shell/ticker.js'

// Equal-size tiles read better on a TV than a geographic map. [col, row].
const GRID = {
  ME: [10, 0],
  VT: [9, 1], NH: [10, 1],
  WA: [0, 2], ID: [1, 2], MT: [2, 2], ND: [3, 2], MN: [4, 2], IL: [5, 2], WI: [6, 2], MI: [7, 2], NY: [8, 2], RI: [9, 2], MA: [10, 2],
  OR: [0, 3], NV: [1, 3], WY: [2, 3], SD: [3, 3], IA: [4, 3], IN: [5, 3], OH: [6, 3], PA: [7, 3], NJ: [8, 3], CT: [9, 3],
  CA: [0, 4], UT: [1, 4], CO: [2, 4], NE: [3, 4], MO: [4, 4], KY: [5, 4], WV: [6, 4], VA: [7, 4], MD: [8, 4], DE: [9, 4],
  AZ: [1, 5], NM: [2, 5], KS: [3, 5], AR: [4, 5], TN: [5, 5], NC: [6, 5], SC: [7, 5],
  OK: [3, 6], LA: [4, 6], MS: [5, 6], AL: [6, 6], GA: [7, 6],
  AK: [0, 7], HI: [1, 7], TX: [3, 7], FL: [7, 7],
}

const TILE = 76, GAP = 8

export default {
  id: 'senate',
  title: 'Senate',

  ready (store) { return store.racesBy('S').length > 0 },

  mount (root, store) {
    this.store = store
    root.innerHTML = `
      <section class="v-senate">
        <header class="v-head">
          <h1>U.S. Senate</h1>
          <span class="v-fresh" data-field="senate.freshness"></span>
        </header>

        <div class="sen-balance" data-field="senate.balance">
          <div class="bal-side bal-dem">
            <span class="bal-num" data-field="senate.dem.total">—</span>
            <span class="bal-label">DEMOCRATS</span>
            <span class="bal-sub" data-field="senate.dem.detail"></span>
          </div>
          <div class="bal-bar"><div class="bal-track" data-field="senate.bar"></div></div>
          <div class="bal-side bal-rep">
            <span class="bal-num" data-field="senate.rep.total">—</span>
            <span class="bal-label">REPUBLICANS</span>
            <span class="bal-sub" data-field="senate.rep.detail"></span>
          </div>
        </div>
        <div class="sen-undecided">
          <span data-field="senate.undecided"></span>
          <span data-field="senate.flips"></span>
          <span data-field="senate.independent"></span>
        </div>

        <div class="sen-body">
          <svg class="sen-map" data-field="senate.map" viewBox="0 0 ${11 * (TILE + GAP)} ${8 * (TILE + GAP)}"></svg>
          <div class="sen-key">
            <h2>Key races</h2>
            <div class="key-list" data-field="senate.keyraces"></div>
          </div>
        </div>
      </section>`

    this.el = {
      fresh: root.querySelector('[data-field="senate.freshness"]'),
      demTotal: root.querySelector('[data-field="senate.dem.total"]'),
      repTotal: root.querySelector('[data-field="senate.rep.total"]'),
      demDetail: root.querySelector('[data-field="senate.dem.detail"]'),
      repDetail: root.querySelector('[data-field="senate.rep.detail"]'),
      bar: root.querySelector('[data-field="senate.bar"]'),
      undecided: root.querySelector('[data-field="senate.undecided"]'),
      flips: root.querySelector('[data-field="senate.flips"]'),
      indep: root.querySelector('[data-field="senate.independent"]'),
      map: root.querySelector('[data-field="senate.map"]'),
      key: root.querySelector('[data-field="senate.keyraces"]'),
    }
    this.buildMap()
    this.update()
  },

  buildMap () {
    const NS = 'http://www.w3.org/2000/svg'
    this.tiles = {}
    for (const [st, [c, r]] of Object.entries(GRID)) {
      const g = document.createElementNS(NS, 'g')
      g.setAttribute('transform', `translate(${c * (TILE + GAP)},${r * (TILE + GAP)})`)
      g.dataset.state = st
      const rect = document.createElementNS(NS, 'rect')
      rect.setAttribute('width', TILE); rect.setAttribute('height', TILE); rect.setAttribute('rx', 6)
      rect.setAttribute('class', 'tile')
      const t = document.createElementNS(NS, 'text')
      t.setAttribute('x', TILE / 2); t.setAttribute('y', TILE / 2 + 2)
      t.setAttribute('class', 'tile-label'); t.textContent = st
      const pct = document.createElementNS(NS, 'text')
      pct.setAttribute('x', TILE / 2); pct.setAttribute('y', TILE - 12)
      pct.setAttribute('class', 'tile-pct')
      g.append(rect, t, pct)
      this.el.map.appendChild(g)
      this.tiles[st] = { g, rect, pct }
    }
  },

  // Seats won so far plus holdovers. An independent is counted on his own:
  // who he would caucus with is unknown, so control maths must not assume.
  tally () {
    const store = this.store
    const won = { D: 0, R: 0, I: 0, O: 0 }
    let called = 0, flips = { D: 0, R: 0 }
    for (const r of store.racesBy('S')) {
      if (!r.call) continue
      called++
      const p = r.call.party || 'O'
      won[p] = (won[p] || 0) + 1
      if (r.flipped && (p === 'D' || p === 'R')) flips[p]++
    }
    // Prefer NYT's own balance block when it is present; fall back to civicAPI.
    const pc = partyControl.senate && partyControl.senate.results && partyControl.senate.results[0]
    const nb = pc && pc.offices && pc.offices.S && pc.offices.S.party_balance
    const holdD = nb ? nb.DEM.no_election : holdovers.D
    const holdR = nb ? nb.GOP.no_election : holdovers.R
    return {
      won, called, flips,
      totalD: holdD + won.D,
      totalR: holdR + won.R,
      indep: won.I,
      undecided: store.racesBy('S').length - called,
      holdD, holdR,
    }
  },

  update () {
    if (!this.el) return
    const store = this.store
    const t = this.tally()

    this.el.demTotal.textContent = t.totalD
    this.el.repTotal.textContent = t.totalR
    this.el.demDetail.textContent = `${t.holdD} holdover + ${t.won.D} won`
    this.el.repDetail.textContent = `${t.holdR} holdover + ${t.won.R} won`
    this.el.undecided.textContent = `${t.undecided} undecided`
    this.el.flips.textContent = t.flips.D || t.flips.R ? `Flips: D +${t.flips.D} · R +${t.flips.R}` : ''
    this.el.indep.textContent = t.indep ? `${t.indep} independent (caucus unknown)` : ''

    // Control lines differ by party: 51 for Democrats, 50 for Republicans.
    this.el.bar.dataset.demNeed = Math.max(0, TO_WIN.D - t.totalD)
    this.el.bar.dataset.repNeed = Math.max(0, TO_WIN.R - t.totalR)
    this.el.bar.style.setProperty('--dem-seats', t.totalD)
    this.el.bar.style.setProperty('--rep-seats', t.totalR)

    // ---- map ----
    for (const [st, tile] of Object.entries(this.tiles)) {
      const race = store.getRace(`SEN-${st}`)
      if (!race) {
        // Not up this year: hint the holdover party, muted.
        tile.g.dataset.status = 'no-election'
        tile.g.dataset.party = ''
        tile.pct.textContent = ''
        continue
      }
      const status = statusOf(race)
      const leader = race.candidates.find(c => c.id === race.leader)
      tile.g.dataset.status = status
      tile.g.dataset.party = (race.call && race.call.party) || (leader && leader.party) || ''
      tile.g.dataset.flipped = race.flipped ? '1' : ''
      tile.pct.textContent = race.pctIn > 0 ? `${Math.round(race.pctIn)}%` : ''
    }

    // ---- key races ----
    this.el.key.innerHTML = KEY_SENATE_RACES.map(key => {
      const r = store.getRace(key)
      if (!r) return ''
      const [a, b] = r.candidates
      const lead = a && b ? Math.abs(a.pct - b.pct) : 0
      const row = c => c ? `
        <div class="kr-cand" data-party="${c.party || 'O'}" data-winner="${r.call && r.call.winner === c.id ? '1' : ''}">
          <span class="kr-name">${c.surname ? c.name.split(' ').pop() : c.name}</span>
          <span class="kr-party">${c.party && c.party !== 'O' ? c.party : ''}</span>
          <span class="kr-pct">${c.pct.toFixed(1)}%</span>
          <span class="kr-votes">${c.votes.toLocaleString()}</span>
        </div>` : ''
      return `
        <div class="kr" data-template="senate.race" data-key="${r.key}"
             data-status="${statusOf(r)}" data-flipped="${r.flipped ? '1' : ''}">
          <div class="kr-state">${r.state}</div>
          <div class="kr-cands">${row(a)}${row(b)}</div>
          <div class="kr-bar" style="--lead:${lead}"></div>
          <div class="kr-meta">
            <span class="kr-in">${r.pctIn.toFixed(0)}% in</span>
            <span class="kr-status">${
              r.call ? `${r.flipped ? 'GAIN · ' : ''}PROJECTED WINNER · ${r.call.source}` : (r.rating || '').replace('-', ' ')
            }</span>
          </div>
        </div>`
    }).join('')

    const f = freshness(store, 'civicSenate')
    this.el.fresh.textContent = f.text
    this.el.fresh.dataset.state = f.state
  },
}
