// The ticker and the per-view freshness indicator.
//
// Both live in the designer's markup; this only fills them.

import { nytHealthy } from '../model/calls.js'
import { callLine } from '../render/adapt.js'
import { capture, repeat, field, fields, setText, setAttr, setVar, setFlag } from '../render/dom.js'
import { STALE_AFTER_MS, NO_CHANGE_AFTER_MS } from '../../config/views.js'
import { nowMs } from '../util.js'

export function createTicker (store) {
  const root = document
  const calls = capture(root, 'shell.call')
  const clockEl = field(root, 'shell.clock')
  const srcEl = root.querySelector('.tk-src')

  function drawClock () {
    setText(clockEl, new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit',
    }).format(new Date()) + ' ET')
  }

  function drawCalls () {
    // Newest first, across all offices. Overflow is clipped by the design.
    const list = store.latestCalls(12).map(callLine)
    repeat(calls, list.length, (el, i) => {
      const c = list[i]
      setAttr(el, 'data-party', c.party)
      setText(field(el, 'call.race'), c.race)
      setText(field(el, 'call.result'), c.result)
      let tag = el.querySelector('.gain')
      if (c.gain && !tag) {
        tag = document.createElement('span')
        tag.className = 'gain'
        tag.textContent = 'Gain'
        el.appendChild(tag)
      } else if (!c.gain && tag) tag.remove()
    })
  }

  // Always say which source is actually in use, and change it when NYT drops.
  function drawSource () {
    if (!srcEl) return
    const h = store.allHealth()
    const civicOk = (h.civicHouse && h.civicHouse.ok) || (h.civicSenate && h.civicSenate.ok)
    setText(srcEl,
      `Calls: ${nytHealthy(h) ? 'AP via NYT' : 'civicAPI'} · Votes: ${civicOk ? 'civicAPI' : 'NYT'}`
      + (store.isTestData() ? ' · TEST DATA' : ''))
  }

  /**
   * Freshness, per SHELL.md. Stale must never read as an error to the room —
   * no red, no motion. It is for the operator, and it names the stalled source
   * when that is known.
   */
  function drawFreshness () {
    const h = store.allHealth()
    const entries = Object.entries(h)
    const lastOk = Math.max(0, ...entries.map(([, v]) => v.lastOk || 0))
    const lastChange = Math.max(0, ...entries.map(([, v]) => v.lastChange || 0))
    const now = nowMs()
    const noFetch = !lastOk || now - lastOk > STALE_AFTER_MS
    const noChange = lastChange && now - lastChange > NO_CHANGE_AFTER_MS
    const stale = noFetch || noChange

    const down = entries.filter(([, v]) => !v.ok).map(([k]) => k)
    const source = down.length === 1 ? down[0] : down.length ? `${down.length} feeds` : 'civicAPI'

    const secs = lastOk ? Math.round((now - lastOk) / 1000) : null
    const text = stale
      ? (noFetch
        ? `No update ${secs == null ? 'yet' : fmt(secs)} · ${source}`
        : `Last change ${fmt(Math.round((now - lastChange) / 1000))} · ${source}`)
      : `Updated ${fmt(secs)} ago`

    for (const el of fields(root, 'shell.updated')) setFlag(el, 'data-stale', stale)
    for (const el of fields(root, 'shell.updatedText')) setText(el, text)
  }

  const fmt = s => (s < 90 ? `${s} s` : s < 5400 ? `${Math.round(s / 60)} min` : `${Math.round(s / 3600)} h`)

  function draw () { drawClock(); drawCalls(); drawSource(); drawFreshness() }

  draw()
  store.subscribe(draw)
  setInterval(() => { drawClock(); drawFreshness() }, 1000)

  return {
    draw,
    // Rotation labels and the progress hairline.
    setRotation (s) {
      setText(field(root, 'shell.view'), s.currentTitle || '')
      setText(field(root, 'shell.next'), s.paused ? 'Paused' : s.pinned ? 'Pinned' : (s.nextTitle || ''))
      setText(field(root, 'shell.nextIn'), s.paused || s.pinned ? '' : s.countdown)
      setVar(field(root, 'shell.progress'), '--progress', s.progress.toFixed(1))
    },
  }
}
