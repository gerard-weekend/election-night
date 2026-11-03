// The bar along the bottom of every view: ET clock, the latest calls across
// all offices, and an honest statement of where the numbers came from.
//
// Markup carries data-field hooks so the designer's HTML can replace it
// without the data layer changing.

import { nytHealthy } from '../model/calls.js'
import { ago } from '../util.js'

const PARTY_LABEL = { D: 'DEM', R: 'REP', I: 'IND', O: 'OTH' }

export function createTicker (rootEl, store) {
  rootEl.innerHTML = `
    <div class="ticker">
      <div class="ticker-clock" data-field="shell.clock">--:--</div>
      <div class="ticker-calls" data-field="shell.calls"></div>
      <div class="ticker-source" data-field="shell.source"></div>
    </div>`

  const clockEl = rootEl.querySelector('[data-field="shell.clock"]')
  const callsEl = rootEl.querySelector('[data-field="shell.calls"]')
  const srcEl = rootEl.querySelector('[data-field="shell.source"]')

  function drawClock () {
    clockEl.textContent = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hourCycle: 'h23',
    }).format(new Date()) + ' ET'
  }

  function drawCalls () {
    const calls = store.latestCalls(12)
    if (!calls.length) {
      callsEl.innerHTML = '<span class="ticker-empty">Waiting for first results</span>'
      return
    }
    callsEl.innerHTML = calls.map(r => {
      const p = r.call.party
      const gain = r.flipped ? '<span class="tag-gain">GAIN</span>' : ''
      const label = r.label || r.key
      const who = r.kind === 'prop' ? r.call.winner.toUpperCase() : r.call.name
      return `<span class="ticker-item" data-template="call" data-party="${p || 'O'}">
        <b>${label}</b> ${who} ${p ? `<i>${PARTY_LABEL[p] || p}</i>` : ''} ${gain}
      </span>`
    }).join('')
  }

  // Say which source is actually in use, and change it when NYT drops out.
  function drawSource () {
    const h = store.allHealth()
    const calls = nytHealthy(h) ? 'AP via NYT' : 'civicAPI'
    const down = Object.entries(h).filter(([, v]) => !v.ok).map(([k]) => k)
    const civicOk = (h.civicHouse && h.civicHouse.ok) || (h.civicSenate && h.civicSenate.ok)
    const votes = civicOk ? 'civicAPI' : 'NYT'
    srcEl.innerHTML =
      `<span data-field="shell.source.calls">Calls: ${calls}</span> · ` +
      `<span data-field="shell.source.votes">Votes: ${votes}</span>` +
      (down.length ? ` · <span class="feed-down">${down.length} feed${down.length > 1 ? 's' : ''} down</span>` : '') +
      (store.isTestData() ? ' · <span class="tag-test">TEST DATA</span>' : '')
  }

  function draw () { drawClock(); drawCalls(); drawSource() }

  draw()
  store.subscribe(draw)
  setInterval(drawClock, 10e3)

  return { draw }
}

// Small freshness mark per view. Must read as context to the room and as a
// warning only to the operator — never as an error on the TV.
export function freshness (store, sourceName) {
  const h = store.getHealth(sourceName)
  if (!h) return { text: 'no data', state: 'stale' }
  if (!h.ok) return { text: `${sourceName} unreachable`, state: 'down' }
  const age = Date.now() - (h.lastOk || 0)
  return { text: `updated ${ago(h.lastOk)}`, state: age > 5 * 60e3 ? 'stale' : 'ok' }
}
