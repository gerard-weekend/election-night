// House view: the swingometer. All 435 districts placed by the swing needed
// to flip them, a needle at the implied national swing, and the seat totals.
//
// The analytics are the same ones swingometer.html computes:
//   implied swing = mean of (2026 Dem two-party share - 2024 notional share)
//                   over every called seat where both are known
//   tipping point = the swing at which the 218th seat changes hands

import { CANVAS_W } from '../../shell/stage.js'
import { freshness } from '../../shell/ticker.js'
import { twoPartyShare } from '../../model/race.js'
import { nowMs, closeMs } from '../../util.js'

const MAJORITY = 218
const NS = 'http://www.w3.org/2000/svg'

// Poll close, ET hours. Used only for the auto-call of seats with no
// Republican on the ballot.
const CLOSE = {
  IN: 18, KY: 18, GA: 19, VA: 19, VT: 19, FL: 19, SC: 19, NH: 19.5, OH: 19.5,
  NC: 19.5, WV: 19.5, AL: 20, CT: 20, DE: 20, DC: 20, IL: 20, KS: 20, ME: 20,
  MD: 20, MA: 20, MS: 20, MO: 20, NJ: 20, NY: 20, OK: 20, PA: 20, RI: 20,
  TN: 20, AR: 20.5, AZ: 21, CO: 21, LA: 21, MI: 21, MN: 21, NE: 21, NM: 21,
  ND: 21, SD: 21, TX: 21, WI: 21, WY: 21, UT: 22, NV: 22, IA: 22, MT: 22,
  CA: 23, ID: 23, OR: 23, WA: 23, HI: 24, AK: 25,
}

let seats = []          // { id, state, label, holder, sh24, sNeeded, autoD }

export async function loadSeats () {
  if (seats.length) return seats
  const text = await (await fetch('data/house-2026.csv', { cache: 'no-store' })).text()
  const lines = text.trim().split(/\r?\n/)
  lines.shift()
  seats = lines.map(l => {
    const [state, district, label, winner, share, sNeeded] = l.split(',')
    const n = parseFloat(sNeeded)
    return {
      id: `HOUSE-${label.trim().toUpperCase()}`,
      state: state.trim(),
      // The CSV names states in full; poll-close times are keyed by postal
      // code, which the label already carries ("CA-04" -> "CA").
      postal: label.trim().split('-')[0].toUpperCase(),
      label: label.trim(),
      holder: winner.trim() === 'D' ? 'D' : 'R',
      sh24: parseFloat(share) * 100,
      sNeeded: n,
      autoD: n === -1,          // no Republican on the ballot
    }
  })
  return seats
}

export default {
  id: 'house',
  title: 'House',

  ready (store) { return store.racesBy('H').length > 0 },

  async mount (root, store) {
    this.store = store
    root.innerHTML = `
      <section class="v-house">
        <header class="v-head">
          <h1>U.S. House</h1>
          <span class="v-fresh" data-field="house.freshness"></span>
        </header>

        <div class="h-totals">
          <div class="h-side h-dem">
            <span class="h-num" data-field="house.dem.called">—</span>
            <span class="h-label">DEMOCRATS</span>
            <span class="h-sub" data-field="house.dem.gains"></span>
          </div>
          <div class="h-mid">
            <span class="h-swing" data-field="house.swing">—</span>
            <span class="h-label">IMPLIED NATIONAL SWING</span>
            <span class="h-sub" data-field="house.tipping"></span>
          </div>
          <div class="h-side h-rep">
            <span class="h-num" data-field="house.rep.called">—</span>
            <span class="h-label">REPUBLICANS</span>
            <span class="h-sub" data-field="house.rep.gains"></span>
          </div>
        </div>

        <svg class="h-dial" data-field="house.dial" viewBox="0 0 ${CANVAS_W} 560"></svg>
        <div class="h-meta"><span data-field="house.called"></span></div>
      </section>`

    this.el = {
      demCalled: root.querySelector('[data-field="house.dem.called"]'),
      repCalled: root.querySelector('[data-field="house.rep.called"]'),
      demGains: root.querySelector('[data-field="house.dem.gains"]'),
      repGains: root.querySelector('[data-field="house.rep.gains"]'),
      swing: root.querySelector('[data-field="house.swing"]'),
      tipping: root.querySelector('[data-field="house.tipping"]'),
      called: root.querySelector('[data-field="house.called"]'),
      dial: root.querySelector('[data-field="house.dial"]'),
      fresh: root.querySelector('[data-field="house.freshness"]'),
    }

    await loadSeats()
    // Build the dial before committing: commit() notifies subscribers, which
    // calls update() straight back, and that needs this.marks to exist.
    this.buildDial()
    // Publish each seat's holder into the store so the ticker can tag a House
    // gain the same way the Senate does.
    for (const s of seats) {
      const r = store.getRace(s.id)
      if (r && !r.holder) r.holder = s.holder
    }
    store.commit()
    this.update()
  },

  // Districts laid out left (safest Republican) to right (safest Democrat) by
  // the swing needed to flip them.
  buildDial () {
    const sorted = [...seats].sort((a, b) => a.sNeeded - b.sNeeded)
    const W = CANVAS_W - 160, H = 380, x0 = 80, y0 = 120
    const cols = 48, cw = W / cols, rh = 13
    this.marks = {}
    const svg = this.el.dial
    svg.innerHTML = ''

    const layer = document.createElementNS(NS, 'g')
    svg.appendChild(layer)

    sorted.forEach((s, i) => {
      const col = i % cols, row = Math.floor(i / cols)
      const r = document.createElementNS(NS, 'rect')
      r.setAttribute('x', (x0 + col * cw).toFixed(1))
      r.setAttribute('y', (y0 + row * rh).toFixed(1))
      r.setAttribute('width', (cw - 1.5).toFixed(1))
      r.setAttribute('height', rh - 2)
      r.setAttribute('rx', 2)
      r.setAttribute('class', 'seat')
      r.dataset.seat = s.id
      r.dataset.holder = s.holder
      layer.appendChild(r)
      this.marks[s.id] = r
    })

    // Control line: where the 218th seat sits.
    const line = document.createElementNS(NS, 'line')
    line.setAttribute('class', 'h-control')
    const ci = sorted.findIndex(s => s.sNeeded >= 0)
    const cx = x0 + (ci % cols) * cw
    line.setAttribute('x1', cx); line.setAttribute('x2', cx)
    line.setAttribute('y1', y0 - 16); line.setAttribute('y2', y0 + Math.ceil(435 / cols) * rh + 8)
    svg.appendChild(line)

    this.needle = document.createElementNS(NS, 'line')
    this.needle.setAttribute('class', 'h-needle')
    this.needle.setAttribute('y1', y0 - 30); this.needle.setAttribute('y2', y0 + Math.ceil(435 / cols) * rh + 14)
    svg.appendChild(this.needle)
    this.dialGeom = { x0, y0, cw, cols, rh, sorted }
  },

  // Seats with no Republican on the ballot are called for the Democrats once
  // their state's polls close. The date is pinned, so this cannot fire early.
  applyAutoCalls () {
    const now = nowMs()
    for (const s of seats) {
      if (!s.autoD) continue
      const close = closeMs(CLOSE[s.postal] ?? 20)
      if (now >= close) this.store.setAutoCall(s.id, { party: 'D', name: null, at: close })
    }
  },

  stats () {
    const store = this.store
    let dD = 0, dR = 0, gD = 0, gR = 0, sum = 0, n = 0
    const called = new Set()
    const undecided = []

    for (const s of seats) {
      const r = store.getRace(s.id)
      const w = r && r.call ? r.call.party : null
      if (w === 'D' || w === 'R') {
        called.add(s.id)
        if (w === 'D') dD++; else dR++
        if (w !== s.holder) { if (w === 'D') gD++; else gR++ }
        // Implied swing uses the two-party share against the 2024 notional.
        const share = r ? twoPartyShare(r.candidates) : null
        if (share != null && s.sh24 > 0 && s.sh24 < 100) { sum += share - s.sh24; n++ }
      } else {
        undecided.push(s.sNeeded)
      }
    }
    undecided.sort((a, b) => a - b)
    const need = MAJORITY - dD
    const tip = need <= 0 ? -Infinity : need > undecided.length ? Infinity : undecided[need - 1]
    return { dD, dR, gD, gR, implied: n ? sum / n : null, nSwing: n, called, tip }
  },

  update () {
    if (!this.el || !this.marks || !seats.length) return
    this.applyAutoCalls()
    const store = this.store
    const st = this.stats()

    this.el.demCalled.textContent = st.dD
    this.el.repCalled.textContent = st.dR
    this.el.demGains.textContent = st.gD ? `+${st.gD} gain${st.gD > 1 ? 's' : ''}` : ''
    this.el.repGains.textContent = st.gR ? `+${st.gR} gain${st.gR > 1 ? 's' : ''}` : ''
    this.el.swing.textContent = st.implied == null
      ? '—'
      : `${st.implied >= 0 ? 'D +' : 'R +'}${Math.abs(st.implied).toFixed(1)}`
    this.el.tipping.textContent = Number.isFinite(st.tip)
      ? `Tipping point: ${st.tip >= 0 ? 'D +' : 'R +'}${Math.abs(st.tip).toFixed(1)}`
      : ''
    this.el.called.textContent = `${st.called.size} of 435 called · swing from ${st.nSwing} seats`

    for (const s of seats) {
      const r = store.getRace(s.id)
      const mark = this.marks[s.id]
      if (!mark) continue
      const w = r && r.call ? r.call.party : null
      mark.dataset.status = w ? 'called' : (r && r.pctIn > 0 ? 'counting' : 'none')
      mark.dataset.party = w || ''
      mark.dataset.flipped = w && w !== s.holder ? '1' : ''
    }

    // Needle at the implied swing, mapped onto the same axis as the seats.
    if (st.implied != null && this.dialGeom) {
      const { x0, cw, cols, sorted } = this.dialGeom
      let i = sorted.findIndex(s => s.sNeeded >= st.implied)
      if (i < 0) i = sorted.length - 1
      const x = x0 + (i % cols) * cw
      this.needle.setAttribute('x1', x); this.needle.setAttribute('x2', x)
      this.needle.style.opacity = 1
    } else if (this.needle) {
      this.needle.style.opacity = 0
    }

    const f = freshness(store, 'civicHouse')
    this.el.fresh.textContent = f.text
    this.el.fresh.dataset.state = f.state
  },
}
