// Drives the view rotation: which view is on screen, for how long, and the
// crossfade between them.
//
// Deliberately NOT driven by requestAnimationFrame alone. Browsers stop rAF
// when the window is covered or the display dims, which silently freezes the
// screen — the single worst failure the House build hit. A 1 s setInterval
// is the authority; rAF only smooths the countdown bar.

import { VIEWS, MIN_DURATION, TRANSITION_MS } from '../../config/views.js'
import { nowMs } from '../util.js'

export function createRotator (rootEl, views, store) {
  const enabled = () => VIEWS.filter(v => v.enabled && views[v.id])
  let index = 0
  let startedAt = nowMs()
  let paused = false
  let pinned = null
  let current = null
  const mounted = new Map()
  const listeners = new Set()

  // A view is only shown once it has data. Until then it says so in the design
  // language rather than showing a spinner.
  const hasData = id => {
    const v = views[id]
    return !v.ready || v.ready(store)
  }

  function panelFor (id) {
    let el = mounted.get(id)
    if (el) return el
    el = document.createElement('div')
    el.className = 'view'
    el.dataset.view = id
    rootEl.appendChild(el)
    views[id].mount(el, store)
    mounted.set(id, el)
    return el
  }

  function show (id) {
    if (current === id) return
    const next = panelFor(id)
    const prev = current ? mounted.get(current) : null
    if (prev) {
      prev.classList.remove('is-active')
      if (views[current].hide) views[current].hide()
    }
    next.classList.add('is-active')
    // Refresh from the store before the view is seen. Views only update while
    // they are the current one, so one coming back after a few minutes off
    // screen would otherwise show whatever it last rendered.
    if (views[id].update) views[id].update(new Set())
    if (views[id].show) views[id].show()
    current = id
    startedAt = nowMs()
    emit()
  }

  function emit () {
    const list = enabled()
    const cur = list[index] || list[0]
    const nextView = pinned ? cur : list[(index + 1) % list.length]
    for (const fn of listeners) {
      fn({
        current: cur && cur.id,
        currentTitle: cur && cur.title,
        next: nextView && nextView.id,
        nextTitle: nextView && nextView.title,
        remaining: remaining(),
        paused, pinned,
      })
    }
  }

  function duration () {
    const list = enabled()
    const v = list[index]
    if (!v) return MIN_DURATION
    return Math.max(MIN_DURATION, v.duration)
  }

  const remaining = () => Math.max(0, duration() - (nowMs() - startedAt))

  function advance (step = 1) {
    const list = enabled()
    if (!list.length) return
    index = (index + step + list.length) % list.length
    show(list[index].id)
  }

  // The 1 s heartbeat. Everything time-based hangs off this.
  function tick () {
    const list = enabled()
    if (!list.length) return
    if (!current) { show(list[index].id); return }
    if (paused || pinned) { emit(); return }
    if (nowMs() - startedAt >= duration()) {
      // Skip past a view with no data yet rather than showing an empty frame,
      // but never drop one that has data.
      let guard = list.length
      do { index = (index + 1) % list.length; guard-- }
      while (guard > 0 && !hasData(list[index].id))
      show(list[index].id)
    } else {
      emit()
    }
  }

  const api = {
    start () {
      const list = enabled()
      if (list.length) show(list[index].id)
      setInterval(tick, 1000)
      return api
    },
    next: () => advance(1),
    prev: () => advance(-1),
    pause () { paused = !paused; startedAt = nowMs(); emit(); return paused },
    setPaused (v) { paused = !!v; startedAt = nowMs(); emit() },
    pin (id) {
      const list = enabled()
      const i = list.findIndex(v => v.id === id)
      if (i < 0) return
      pinned = id; index = i; show(id)
    },
    unpin () { pinned = null; startedAt = nowMs(); emit() },
    setDuration (id, ms) {
      const v = VIEWS.find(x => x.id === id)
      if (v) v.duration = Math.max(MIN_DURATION, ms)
    },
    onChange (fn) { listeners.add(fn); return () => listeners.delete(fn) },
    get state () { return { current, paused, pinned, remaining: remaining() } },
    // Views update themselves only while mounted and visible, to keep the
    // per-poll cost down.
    update (changedKeys) {
      if (!current) return
      const v = views[current]
      if (v && v.update) v.update(changedKeys)
    },
    TRANSITION_MS,
  }
  return api
}
