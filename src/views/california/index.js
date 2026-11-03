// California view: fills the designer's markup, which has fixed slots for this
// exact mix — four race blocks (Governor large, then AG, Oakland Mayor, CA-11)
// and eight measure rows (six statewide, two local).
//
// The race blocks are NOT cloned: each has its own size in the design, so they
// are filled in place by position. Measure rows are filled by index too, since
// the count is fixed at eight.

import { californiaData } from '../../render/adapt.js'
import { field, templates, setText, setAttr, setVar, show, pct1, pct0 } from '../../render/dom.js'

export default {
  id: 'california',
  title: 'California',

  ready (store) { return californiaData(store).races.some(r => r.candidates.length) },

  mount (root, store) {
    this.root = root
    this.store = store
    this.raceBlocks = templates(root, 'ca.race')
    this.propRows = templates(root, 'ca.prop')
    this.update()
  },

  fillRace (block, r) {
    // The office name shares its element with a small grey note, so only the
    // leading text node is replaced.
    const off = field(block, 'race.office')
    if (off) {
      const sub = off.querySelector('.sub')
      if (off.firstChild && off.firstChild.nodeType === 3) off.firstChild.nodeValue = r.office
      else if (!sub) setText(off, r.office)
      if (sub) { setText(sub, r.sub || ''); show(sub, !!r.sub) }
    }

    const glyph = field(block, 'race.glyph')
    setAttr(glyph, 'data-status', r.status)
    setAttr(glyph, 'data-party', r.glyphParty)
    setVar(glyph, '--p', r.pctIn)

    setText(field(block, 'race.status'),
      r.status === 'called' || r.status === 'gain' ? 'Projected · AP' : `${pct0(r.pctIn)} in`)

    // "Lead changed" only appears once it has actually happened.
    const lead = field(block, 'race.leadChanged')
    if (lead) show(lead, r.leadChanged)

    templates(block, 'race.candidate').forEach((row, i) => {
      const c = r.candidates[i]
      show(row, !!c)
      if (!c) return
      setAttr(row, 'data-party', c.party)
      setText(field(row, 'cand.name'), c.name)
      // Nonpartisan races show no party letter at all.
      setText(field(row, 'cand.party'), c.party === 'N' ? '' : c.party)
      setText(field(row, 'cand.pct'), r.counted ? pct1(c.pct) : '—')
      const bar = field(row, 'cand.bar')
      setVar(bar, '--pct', c.pct)
      // 'same' when the runner-up shares the leader's party — the top-two
      // case — so the two bars stay distinguishable without colour.
      setAttr(bar, 'data-style',
        i === 0 ? 'lead' : c.party === r.candidates[0].party ? 'same' : 'trail')
    })
  },

  fillProp (row, m) {
    setAttr(row, 'data-result', m.result || '')
    setText(field(row, 'prop.number'), m.label)
    setText(field(row, 'prop.title'), m.title)
    setText(field(row, 'prop.yes'), m.counted ? pct1(m.yesPct) : '—')
    setText(field(row, 'prop.no'), m.counted ? pct1(m.noPct) : '—')

    const bar = field(row, 'prop.bar')
    setVar(bar, '--y', m.yesPct)
    setVar(bar, '--t', m.threshold)
    setAttr(bar, 'data-threshold', m.threshold > 50 ? 'supermajority' : null)

    // Passes / Fails come only from a call, never from the current Yes share.
    const status = field(row, 'prop.status')
    if (!status) return
    const html = m.result === 'pass' ? '<span class="lbl tag-pass">✓ Passes</span>'
      : m.result === 'fail' ? '<span class="lbl tag-fail">✕ Fails</span>'
      : `<span class="gl" data-status="counting" data-party="N" style="--size:22px;--p:${m.pctIn}"></span>`
        + `<span class="fig" style="font-size:24px;color:var(--ink-2)">${pct0(m.pctIn)} in</span>`
    if (status.innerHTML !== html) status.innerHTML = html
  },

  update () {
    if (!this.root) return
    const data = californiaData(this.store)
    this.raceBlocks.forEach((block, i) => {
      const r = data.races[i]
      show(block, !!r)
      if (r) this.fillRace(block, r)
    })
    this.propRows.forEach((row, i) => {
      const m = data.measures[i]
      show(row, !!m)
      if (m) this.fillProp(row, m)
    })
  },
}
