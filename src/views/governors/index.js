// Governors view: totals, the state cartogram, and the key-races list.
//
// Same building blocks as the Senate, minus the hemicycle: there is no control
// threshold here, and the design deliberately leaves majority-of-governorships
// framing out. The 14 states not up this year are static in the markup with
// their holdover colours, so this only touches the 36 that are.

import { governorsData } from '../../render/adapt.js'
import { fillKeyRace } from '../../render/keyrace.js'
import { KEY_GOVERNOR_RACES } from '../../../config/governors.js'
import { capture, repeat, field, templates, setText, setAttr, setVar } from '../../render/dom.js'

export default {
  id: 'governors',
  title: 'Governors',

  ready (store) { return store.racesBy('G').length > 0 },

  mount (root, store) {
    this.root = root
    this.store = store
    this.tiles = new Map(
      templates(root, 'gov.state').map(el => [el.dataset.stateCode, el]),
    )
    this.keyRaces = capture(root, 'gov.race')
    this.update()
  },

  update () {
    if (!this.root) return
    const d = governorsData(this.store)
    const root = this.root

    // ---- totals ----
    setText(field(root, 'gov.dem.total'), d.total.D)
    setText(field(root, 'gov.gop.total'), d.total.R)
    setText(field(root, 'gov.dem.holdover'), d.holdover.D)
    setText(field(root, 'gov.gop.holdover'), d.holdover.R)
    setText(field(root, 'gov.dem.won'), d.won.D)
    setText(field(root, 'gov.gop.won'), d.won.R)
    setText(field(root, 'gov.undecided'), Math.max(0, d.undecided))
    // The markup already prints the "D +" and "R +" prefixes.
    setText(field(root, 'gov.flips.dem'), d.flips.D)
    setText(field(root, 'gov.flips.gop'), d.flips.R)

    // ---- map ----
    for (const r of d.races) {
      const tile = this.tiles.get(r.state)
      if (!tile) continue
      setAttr(tile, 'data-status', r.status)
      setAttr(tile, 'data-party', r.status === 'none' ? '' : (r.winner || r.leader))
      setVar(tile, '--p', r.pctIn)
    }

    // ---- key races, in the order config/governors.js lists them ----
    const rank = new Map(KEY_GOVERNOR_RACES.map((k, i) => [k.replace('GOV-', ''), i]))
    const keys = d.races.filter(r => r.key)
      .sort((a, b) => (rank.get(a.state) ?? 99) - (rank.get(b.state) ?? 99))
      .slice(0, 15)
    repeat(this.keyRaces, keys.length, (row, i) => fillKeyRace(row, keys[i]))
  },
}
