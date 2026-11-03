// The key-race row, shared by the Senate and Governors views. The design uses
// identical markup for both, so they share one filler and cannot drift apart.

import { field, templates, setText, setAttr, setVar, setFlag, show, pct1, lastName } from './dom.js'

export function fillKeyRace (row, r) {
  setAttr(row, 'data-race', r.state)

  const glyph = field(row, 'race.glyph')
  setAttr(glyph, 'data-status', r.status)
  setAttr(glyph, 'data-party', r.status === 'none' ? '' : (r.winner || r.leader))
  setVar(glyph, '--p', r.pctIn)
  setText(field(row, 'race.state'), r.state)

  const [leader, runner] = r.candidates
  const cells = templates(row, 'race.candidate')
  const pending = r.status === 'none'

  cells.forEach((cell, i) => {
    const c = i === 0 ? leader : runner
    setAttr(cell, 'data-party', c ? c.party : '')
    setText(field(cell, 'cand.name'), c ? lastName(c.name) : '')
    setText(field(cell, 'cand.party'), c && c.party !== 'N' ? c.party : '')
    setText(field(cell, 'cand.pct'), pending || !c ? '—' : pct1(c.pct))
  })

  // The Gain tag lives inside the leader's cell and is absent from most rows
  // in the design, so create it on demand.
  let gain = field(row, 'race.gain')
  if (!gain && cells[0]) {
    gain = document.createElement('span')
    gain.className = 'gain'
    gain.setAttribute('data-field', 'race.gain')
    gain.textContent = 'Gain'
    cells[0].appendChild(gain)
  }
  if (gain) show(gain, r.status === 'gain')

  const share = field(row, 'race.share')
  const a = leader && runner && leader.pct + runner.pct > 0
    ? Math.round((leader.pct / (leader.pct + runner.pct)) * 100) : 50
  setVar(share, '--a', a)
  setFlag(share, 'data-pending', pending)
  const bars = share ? share.querySelectorAll('i') : []
  if (bars[0]) setAttr(bars[0], 'data-party', leader ? leader.party : '')
  if (bars[1]) setAttr(bars[1], 'data-party', runner ? runner.party : '')

  setText(field(row, 'race.pctIn'), pending ? 'Polls open' : `${Math.round(r.pctIn)}%`)
}
