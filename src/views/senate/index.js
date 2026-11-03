// Senate view: hemicycle, tile map and the key-races list.
//
// The 15 states not up this year are static in the design's markup, with their
// holdover colours already set, so this only ever touches the 35 that are.

import { senateData } from '../../render/adapt.js'
import { KEY_SENATE_RACES } from '../../../config/senate.js'
import { capture, repeat, field, templates, setText, setAttr, setVar } from '../../render/dom.js'
import { fillKeyRace } from '../../render/keyrace.js'

export default {
  id: 'senate',
  title: 'Senate',

  ready (store) { return store.racesBy('S').length > 0 },

  mount (root, store) {
    this.root = root
    this.store = store
    this.seats = templates(root, 'senate.seat')          // 100, positions fixed
    this.tiles = new Map(                                 // 50, grid fixed
      templates(root, 'senate.state').map(el => [el.dataset.stateCode, el]),
    )
    this.keyRaces = capture(root, 'senate.race')
    this.update()
  },

  /**
   * Seat order, left to right, from DATA-CONTRACT.md: D hold, D won (gains
   * nearest the centre), undecided, R won (gains nearest the centre), R hold.
   *
   * Independents are not in the contract because it assumes they caucus with
   * a party. Nebraska's does not have a known caucus, so rather than hand him
   * to either side he is placed immediately beside the undecided block in his
   * own colour — visibly not counted for either party.
   */
  seatOrder (d) {
    const out = []
    const push = (n, state, party) => { for (let i = 0; i < n; i++) out.push({ state, party }) }

    push(d.holdover.D, 'hold', 'D')
    push(d.won.D - d.flips.D, 'won', 'D')
    push(d.flips.D, 'gain', 'D')
    push(d.independents, 'won', 'I')
    push(Math.max(0, d.undecided), 'undecided', null)
    push(d.flips.R, 'gain', 'R')
    push(d.won.R - d.flips.R, 'won', 'R')
    push(d.holdover.R, 'hold', 'R')

    // The hemicycle is exactly 100 seats; never over- or under-fill it.
    while (out.length < 100) out.push({ state: 'undecided', party: null })
    return out.slice(0, 100)
  },

  update () {
    if (!this.root) return
    const d = senateData(this.store)
    const root = this.root

    // ---- totals ----
    setText(field(root, 'senate.dem.total'), d.total.D)
    setText(field(root, 'senate.gop.total'), d.total.R)
    setText(field(root, 'senate.dem.holdover'), d.holdover.D)
    setText(field(root, 'senate.gop.holdover'), d.holdover.R)
    setText(field(root, 'senate.dem.won'), d.won.D)
    setText(field(root, 'senate.gop.won'), d.won.R)
    setText(field(root, 'senate.undecided'), Math.max(0, d.undecided))
    // The markup already prints the "D +" prefix.
    setText(field(root, 'senate.flips.dem'), d.flips.D)
    setText(field(root, 'senate.flips.gop'), d.flips.R)

    // ---- hemicycle ----
    const order = this.seatOrder(d)
    this.seats.forEach((el, i) => {
      const s = order[i]
      setAttr(el, 'data-state', s.state)
      setAttr(el, 'data-party', s.party || '')
    })

    // ---- map ----
    for (const r of d.races) {
      const tile = this.tiles.get(r.state)
      if (!tile) continue
      setAttr(tile, 'data-status', r.status)
      setAttr(tile, 'data-party', r.status === 'none' ? '' : (r.winner || r.leader))
      setVar(tile, '--p', r.pctIn)
    }

    // ---- key races, in the order config/senate.js lists them, up to 15 ----
    const rank = new Map(KEY_SENATE_RACES.map((k, i) => [k.replace('SEN-', ''), i]))
    const keys = d.races.filter(r => r.key)
      .sort((a, b) => (rank.get(a.state) ?? 99) - (rank.get(b.state) ?? 99))
      .slice(0, 15)
    repeat(this.keyRaces, keys.length, (row, i) => fillKeyRace(row, keys[i]))
  },
}
