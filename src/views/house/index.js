// House view: the swing strip. All 435 districts placed by the swing needed to
// flip them, a needle at the implied national swing, and called vs predicted
// seat totals.
//
// Geometry is exactly as DATA-CONTRACT.md specifies — the numbers below are
// the design, not preferences.

import { capture, repeat, field, setText, setAttr, setStyle } from '../../render/dom.js'
import { twoPartyShare } from '../../model/race.js'
import { nowMs, closeMs } from '../../util.js'

const MAJORITY = 218
const X0 = 168            // left edge of the axis
const SPAN = 1584         // axis width in px
const BASE_Y = 752        // bottom row of dots
const ROW_H = 33          // vertical step between stacked dots
const BIN = 0.5           // points of swing per column

// Axis half-range. Widens but never shrinks, so the picture cannot jump back
// and forth as the night moves.
const RANGES = [12, 15, 20]

// Poll close in ET hours, for the auto-call of seats with no Republican.
const CLOSE = {
  IN: 18, KY: 18, GA: 19, VA: 19, VT: 19, FL: 19, SC: 19, NH: 19.5, OH: 19.5,
  NC: 19.5, WV: 19.5, AL: 20, CT: 20, DE: 20, DC: 20, IL: 20, KS: 20, ME: 20,
  MD: 20, MA: 20, MS: 20, MO: 20, NJ: 20, NY: 20, OK: 20, PA: 20, RI: 20,
  TN: 20, AR: 20.5, AZ: 21, CO: 21, LA: 21, MI: 21, MN: 21, NE: 21, NM: 21,
  ND: 21, SD: 21, TX: 21, WI: 21, WY: 21, UT: 22, NV: 22, IA: 22, MT: 22,
  CA: 23, ID: 23, OR: 23, WA: 23, HI: 24, AK: 25,
}

let seats = []

export async function loadSeats () {
  if (seats.length) return seats
  const text = await (await fetch('data/house-2026.csv', { cache: 'no-store' })).text()
  const lines = text.trim().split(/\r?\n/)
  lines.shift()
  seats = lines.map(l => {
    const [state, district, label, winner, share, sNeeded] = l.split(',')
    const raw = parseFloat(sNeeded)
    return {
      id: `HOUSE-${label.trim().toUpperCase()}`,
      state: state.trim(),
      // The CSV names states in full; poll-close times are keyed by postal
      // code, which the label already carries ("CA-04" -> "CA").
      postal: label.trim().split('-')[0].toUpperCase(),
      label: label.trim(),
      holder: winner.trim() === 'D' ? 'D' : 'R',
      sh24: parseFloat(share) * 100,
      // The CSV stores the swing needed as a share, not points: 0.001 is a
      // tenth of a point. The contract wants points.
      swingToFlip: raw * 100,
      // -1 (i.e. -100 points) is the sentinel for "no Republican on the
      // ballot", not a real swing.
      autoD: raw === -1,
    }
  })
  return seats
}

export default {
  id: 'house',
  title: 'House',

  ready (store) { return store.racesBy('H').length > 0 },

  async mount (root, store) {
    this.root = root
    this.store = store
    this.M = RANGES[0]
    this.dots = capture(root, 'house.seat')
    this.axis = field(root, 'house.axis')

    await loadSeats()
    // Publish holders so the ticker can tag a House gain.
    for (const s of seats) {
      const r = store.getRace(s.id)
      if (r && !r.holder) r.holder = s.holder
    }
    store.commit()
    this.drawAxis()
    this.update()
  },

  x (swing) { return X0 + ((swing + this.M) / (2 * this.M)) * SPAN },
  binWidth () { return SPAN / ((2 * this.M) / BIN) },

  // Ticks every point, taller on even values; labels every two points.
  drawAxis () {
    if (!this.axis) return
    const M = this.M
    let html = ''
    for (let v = -M; v <= M; v++) {
      html += `<i class="tick" style="left:${this.x(v).toFixed(1)}px;height:${v % 2 === 0 ? 14 : 8}px"></i>`
    }
    for (let v = -M; v <= M; v += 2) {
      const big = Math.abs(v) % 6 === 0
      const colour = v === 0 ? 'var(--ink)' : v < 0 ? 'var(--gop-ink)' : 'var(--dem-ink)'
      const text = v === 0 ? 'EVEN' : String(Math.abs(v))
      html += `<span class="num" style="left:${this.x(v).toFixed(1)}px;font-size:${big ? 30 : 24}px;color:${colour}">${text}</span>`
    }
    this.axis.innerHTML = html
  },

  // Seats with no Republican are called for the Democrats at their state's
  // poll close. The date is pinned in closeMs, so this cannot fire early.
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
    let dCalled = 0, rCalled = 0, sum = 0, n = 0
    const items = []

    for (const s of seats) {
      const r = store.getRace(s.id)
      const w = r && r.call ? r.call.party : null
      const called = w === 'D' || w === 'R'
      if (called) {
        if (w === 'D') dCalled++; else rCalled++
        const share = r ? twoPartyShare(r.candidates) : null
        if (share != null && s.sh24 > 0 && s.sh24 < 100) { sum += share - s.sh24; n++ }
      }
      items.push({
        seat: s,
        state: called ? (w === s.holder ? 'called' : 'gain') : 'uncalled',
        party: called ? w : s.holder,
        called,
        winner: w,
      })
    }
    return { items, dCalled, rCalled, implied: n ? sum / n : 0, nSwing: n }
  },

  update () {
    if (!this.root || !seats.length) return
    this.applyAutoCalls()
    const st = this.stats()
    const implied = st.implied

    // Widen the axis if the swing approaches its edge. Never shrink.
    for (const m of RANGES) {
      if (Math.abs(implied) > this.M - 2 && m > this.M) { this.M = m; this.drawAxis(); break }
    }
    const M = this.M
    const bw = this.binWidth()
    const dotSize = Math.min(28, bw - 5)

    // Called, plus uncalled projected at the implied swing.
    let dPred = st.dCalled, rPred = st.rCalled
    for (const it of st.items) {
      if (it.called) continue
      if (it.seat.swingToFlip < implied) dPred++; else rPred++
    }

    setText(field(this.root, 'house.dem.called'), st.dCalled)
    setText(field(this.root, 'house.gop.called'), st.rCalled)
    // The markup already prints the word "predicted" after these.
    setText(field(this.root, 'house.dem.predicted'), dPred)
    setText(field(this.root, 'house.gop.predicted'), rPred)

    // Off-axis seats are counted, not drawn.
    const onAxis = st.items.filter(it => it.seat.swingToFlip >= -M && it.seat.swingToFlip <= M)
    const offDem = st.items.filter(it => it.seat.swingToFlip < -M).length
    const offGop = st.items.filter(it => it.seat.swingToFlip > M).length
    // The markup already prints the leading "+".
    setText(field(this.root, 'house.offAxis.dem'), offDem)
    setText(field(this.root, 'house.offAxis.gop'), offGop)

    // Bin, then stack: called at the bottom, then gains, then uncalled.
    const columns = new Map()
    for (const it of onAxis) {
      const bin = Math.floor((it.seat.swingToFlip + M) / BIN)
      if (!columns.has(bin)) columns.set(bin, [])
      columns.get(bin).push(it)
    }
    const RANK = { called: 0, gain: 1, uncalled: 2 }
    const placed = []
    for (const [bin, col] of columns) {
      col.sort((a, b) => RANK[a.state] - RANK[b.state])
      const x = X0 + (bin + 0.5) * bw
      col.forEach((it, row) => placed.push({ ...it, x, y: BASE_Y - row * ROW_H }))
    }

    repeat(this.dots, placed.length, (el, i) => {
      const p = placed[i]
      setAttr(el, 'data-district', p.seat.label)
      setAttr(el, 'data-flip-at', p.seat.swingToFlip.toFixed(1))
      setAttr(el, 'data-state', p.state)
      setAttr(el, 'data-party', p.party)
      setStyle(el, 'left', `${p.x.toFixed(1)}px`)
      setStyle(el, 'top', `${p.y}px`)
      if (dotSize < 28) {
        setStyle(el, 'width', `${dotSize}px`)
        setStyle(el, 'height', `${dotSize}px`)
        setStyle(el, 'margin', `${-dotSize / 2}px 0 0 ${-dotSize / 2}px`)
      }
    })

    // Needle, flag and the tinted zone between EVEN and the implied swing.
    const nx = this.x(implied)
    const zero = this.x(0)
    setStyle(field(this.root, 'house.needle'), 'left', `${nx.toFixed(1)}px`)
    setStyle(field(this.root, 'house.flag'), 'left', `${nx.toFixed(1)}px`)
    setText(field(this.root, 'house.swing'),
      Math.abs(implied) < 0.05 ? 'EVEN'
        : `${implied > 0 ? 'D' : 'R'}+${Math.abs(implied).toFixed(1)}%`)

    const zone = field(this.root, 'house.zone')
    setStyle(zone, 'left', `${Math.min(zero, nx).toFixed(1)}px`)
    setStyle(zone, 'width', `${Math.abs(nx - zero).toFixed(1)}px`)
    setStyle(zone, 'background', implied >= 0 ? 'rgba(61,123,255,.13)' : 'rgba(255,77,66,.13)')
  },
}
