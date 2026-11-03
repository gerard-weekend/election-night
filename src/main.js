// Boot the TV page: start the feeds, mount the shell, start the rotation.
//
// This page owns all the data. The control window is a remote that talks to it
// over a BroadcastChannel, so there is exactly one set of requests all evening.

import store from './store.js'
import * as civic from './sources/civic.js'
import * as nyt from './sources/nyt.js'
import { mountStage, keepAwake } from './shell/stage.js'
import { createRotator } from './shell/rotator.js'
import { createTicker } from './shell/ticker.js'
import { makeBus, MSG } from './shell/bus.js'
import { VIEWS } from '../config/views.js'
import { CALIFORNIA_RACES } from '../config/california.js'

import houseView from './views/house/index.js'
import senateView from './views/senate/index.js'
import californiaView from './views/california/index.js'

const views = { house: houseView, senate: senateView, california: californiaView }

const stageEl = document.getElementById('stage')
const viewsEl = document.getElementById('views')
const tickerEl = document.getElementById('ticker')
const rotEl = document.getElementById('rotation')

mountStage(stageEl)
keepAwake()

createTicker(tickerEl, store)
const rotator = createRotator(viewsEl, views, store)

// ---- rotation indicator: where we are and what is next ----
rotator.onChange(s => {
  const secs = Math.ceil(s.remaining / 1000)
  rotEl.innerHTML = `
    <span data-field="shell.rotation.current">${s.currentTitle || ''}</span>
    <span class="rot-next" data-field="shell.rotation.next">${
      s.pinned ? 'PINNED' : s.paused ? 'PAUSED' : `NEXT: ${(s.nextTitle || '').toUpperCase()}`
    }</span>
    <span class="rot-count" data-field="shell.rotation.remaining">${s.paused || s.pinned ? '' : secs + 's'}</span>`
})

store.subscribe(changed => rotator.update(changed))

// Seed the configured California races before any feed answers, so the view
// can show them as "waiting" with the right labels, and so the operator window
// knows immediately which ones have only one source behind them.
for (const cfg of CALIFORNIA_RACES) {
  if (cfg.existing) continue     // the House feeds own this one
  store.observe(cfg.key, {
    office: cfg.kind === 'prop' ? 'PROP' : 'CA',
    label: cfg.label, kind: cfg.kind, state: 'CA',
  }, 'civic', {})
  const r = store.getRace(cfg.key)
  r.singleSourced = cfg.civicId == null
  r.title = cfg.title || null
}
store.commit()

civic.start()
nyt.start()
rotator.start()

// ---------------------------------------------------------------- control ----

const bus = makeBus('tv')

// A compact snapshot — enough for the control window to show feed health, the
// rotation state and the call log without fetching anything itself.
function snapshot () {
  return {
    health: store.allHealth(),
    rotation: rotator.state,
    views: VIEWS.map(v => ({ id: v.id, title: v.title, duration: v.duration, enabled: v.enabled })),
    testData: store.isTestData(),
    calls: store.latestCalls(15).map(r => ({
      key: r.key, label: r.label || r.key, name: r.call.name,
      party: r.call.party, source: r.call.source, flipped: r.flipped, at: r.call.at,
    })),
    manual: store.manualCalls,
    counts: {
      house: store.racesBy('H').length,
      senate: store.racesBy('S').length,
      ca: CALIFORNIA_RACES.filter(c => store.getRace(c.key)).length,
    },
    singleSourced: store.all().filter(r => r.singleSourced).map(r => r.label || r.key),
  }
}

const pushState = () => bus.send(MSG.STATE, snapshot())
setInterval(pushState, 2000)
store.subscribe(pushState)

bus.on(msg => {
  if (msg.type === MSG.HELLO) { pushState(); return }
  if (msg.type !== MSG.COMMAND) return
  const { action, value } = msg.payload || {}
  switch (action) {
    case 'pause': rotator.setPaused(value); break
    case 'next': rotator.next(); break
    case 'prev': rotator.prev(); break
    case 'pin': rotator.pin(value); break
    case 'unpin': rotator.unpin(); break
    case 'duration': rotator.setDuration(value.id, value.ms); break
    case 'manual': store.setManualCall(value.key, value.call); store.commit(new Set([value.key])); break
    case 'clear-cache': store.clearCache(); location.reload(); break
    case 'reload': location.reload(); break
  }
  pushState()
})

// ---- keyboard fallback on the TV itself, if the control window is shut ----
addEventListener('keydown', e => {
  if (e.key === ' ') { e.preventDefault(); rotator.pause() }
  else if (e.key === 'ArrowRight') rotator.next()
  else if (e.key === 'ArrowLeft') rotator.prev()
  else if (e.key === '0') rotator.unpin()
  else if (['1', '2', '3'].includes(e.key)) {
    const v = VIEWS[+e.key - 1]
    if (v) rotator.pin(v.id)
  }
})

// Handy for poking at things from the browser console during the night.
Object.assign(window, { store, rotator, civic, nyt })
