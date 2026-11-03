// Boot the TV page: start the feeds, mount the three stages, start rotating.
//
// This page owns all the data. The control window is a remote that talks to it
// over a BroadcastChannel, so there is exactly one set of requests all evening.

import store from './store.js'
import * as civic from './sources/civic.js'
import * as nyt from './sources/nyt.js'
import { createRotator, isAvailable } from './shell/rotator.js'
import { createTicker } from './shell/ticker.js'
import { makeBus, MSG } from './shell/bus.js'
import { VIEWS } from '../config/views.js'
import { CALIFORNIA_RACES } from '../config/california.js'

import houseView from './views/house/index.js'
import senateView from './views/senate/index.js'
import governorsView from './views/governors/index.js'
import californiaView from './views/california/index.js'

const views = { house: houseView, senate: senateView, governors: governorsView, california: californiaView }

// Seed the configured California races before any feed answers, so the view
// has the right labels and the operator window knows at once which ones have
// only one source behind them.
for (const cfg of CALIFORNIA_RACES) {
  if (cfg.existing) continue        // the House feeds own this one
  store.observe(cfg.key, {
    office: cfg.kind === 'prop' ? 'PROP' : 'CA',
    label: cfg.label, kind: cfg.kind, state: 'CA',
  }, 'civic', {})
  const r = store.getRace(cfg.key)
  r.singleSourced = cfg.civicId == null
  r.title = cfg.title || null
  r.short = cfg.short || cfg.label
}
store.commit()

// The design pages ship with fictional sample results in every slot — "155
// Dem seats called", invented candidate names. If a view failed to render,
// those would sit on the TV looking exactly like real results. Blank every
// data slot before anything mounts, so the worst case is an empty field
// rather than a made-up number. Elements holding markup (the check glyphs)
// are left alone; only leaf text slots are cleared.
for (const el of document.querySelectorAll('[data-field]')) {
  if (!el.firstElementChild) el.textContent = ''
}

const ticker = createTicker(store)
const rotator = createRotator(views, store)
rotator.onChange(s => ticker.setRotation(s))
store.subscribe(changed => rotator.update(changed))

// Track the first leader of each race so "Lead changed" can be honest about
// what changed since counting began, rather than since page load.
store.subscribe(() => {
  for (const r of store.all()) {
    if (!r.leader) continue
    if (r.firstLeader == null) r.firstLeader = r.leader
    else if (r.firstLeader !== r.leader) r.leadChanged = true
  }
})

// Chrome allows this on localhost. It stops the display dimming mid-evening,
// and the lock is dropped whenever the tab is hidden, so re-request on return.
async function keepAwake () {
  if (!('wakeLock' in navigator)) return
  const request = async () => { try { await navigator.wakeLock.request('screen') } catch (e) {} }
  await request()
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') request()
  })
}
keepAwake()

civic.start()
nyt.start()
rotator.start()

// ---------------------------------------------------------------- control ----

const bus = makeBus('tv')

function snapshot () {
  return {
    health: store.allHealth(),
    rotation: rotator.state,
    views: VIEWS.map(v => ({
      id: v.id, title: v.title, duration: v.duration, enabled: v.enabled,
      // A view can be configured on but held out of the rotation until its
      // polls close; the control window says so rather than looking broken.
      available: isAvailable(v), fromET: v.fromET ?? null,
    })),
    testData: store.isTestData(),
    calls: store.latestCalls(15).map(r => ({
      key: r.key, label: r.label || r.key, name: r.call.name,
      party: r.call.party, source: r.call.source, flipped: r.flipped, at: r.call.at,
    })),
    manual: store.manualCalls,
    counts: {
      house: store.racesBy('H').length,
      senate: store.racesBy('S').length,
      governors: store.racesBy('G').length,
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
    // A toggle, so a stale snapshot on the control side cannot invert it.
    case 'pause': if (value === undefined) rotator.pause(); else rotator.setPaused(value); break
    case 'next': rotator.next(); break
    case 'prev': rotator.prev(); break
    case 'pin': rotator.pin(value); break
    case 'unpin': rotator.unpin(); break
    case 'duration': rotator.setDuration(value.id, value.ms); break
    case 'manual': store.setManualCall(value.key, value.call); store.commit(new Set([value.key])); break
    case 'refresh': civic.refresh(); nyt.refresh(); break
    case 'clear-cache': store.clearCache(); location.reload(); break
    case 'reload': location.reload(); break
  }
  pushState()
})

// ---- keyboard on the TV itself, per SHELL.md ----
addEventListener('keydown', e => {
  if (e.key === ' ') { e.preventDefault(); rotator.pause() }
  else if (e.key === 'ArrowRight') rotator.next()
  else if (e.key === 'ArrowLeft') rotator.prev()
  else if (e.key === '0') rotator.unpin()
  else if (['1', '2', '3', '4'].includes(e.key)) {
    const v = VIEWS[+e.key - 1]
    if (v) rotator.pin(v.id)
  } else if (e.key === 'r' || e.key === 'R') { civic.refresh(); nyt.refresh() }
  else if (e.key === 'f' || e.key === 'F') {
    if (document.fullscreenElement) document.exitFullscreen()
    else document.documentElement.requestFullscreen().catch(() => {})
  }
})

// Handy for poking at things from the browser console during the night.
Object.assign(window, { store, rotator, civic, nyt })
