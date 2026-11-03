// Drives the rotation: which stage is visible, for how long, and the progress
// hairline and countdown in the ticker.
//
// All three stages stay in the DOM and cross-fade (SHELL.md), so a view never
// re-renders on switch.
//
// Deliberately NOT driven by requestAnimationFrame alone: browsers stop rAF
// when the window is covered or the display dims, which silently freezes the
// screen — the worst failure the House build hit. A 1 s setInterval is the
// authority; rAF only smooths the progress hairline.

import { VIEWS, MIN_DURATION, DRIFT_EVERY_MS, DRIFT_MAX_PX } from '../../config/views.js'
import { nowMs } from '../util.js'

export function createRotator (views, store) {
  const enabled = () => VIEWS.filter(v => v.enabled && views[v.id])
  let index = 0, startedAt = nowMs(), paused = false, pinned = null, current = null
  const listeners = new Set()
  const stages = new Map()

  for (const v of VIEWS) {
    const el = document.querySelector(`.stage[data-view="${v.id}"]`)
    if (el && views[v.id]) { stages.set(v.id, el); views[v.id].mount(el, store) }
  }

  const hasData = id => { const v = views[id]; return !v.ready || v.ready(store) }
  const duration = () => Math.max(MIN_DURATION, (enabled()[index] || {}).duration || 60e3)
  const remaining = () => Math.max(0, duration() - (nowMs() - startedAt))

  function show (id) {
    if (current === id) return
    for (const [key, el] of stages) el.classList.toggle('is-active', key === id)
    if (current && views[current].hide) views[current].hide()
    // Refresh before the view is seen: views only update while current, so one
    // coming back after minutes off screen would show what it last rendered.
    if (views[id].update) views[id].update(new Set())
    if (views[id].show) views[id].show()
    current = id
    startedAt = nowMs()
    emit()
  }

  function emit () {
    const list = enabled()
    const cur = list[index] || list[0]
    const next = pinned ? cur : list[(index + 1) % list.length]
    const d = duration(), left = remaining()
    const mmss = `${Math.floor(left / 60000)}:${String(Math.floor((left % 60000) / 1000)).padStart(2, '0')}`
    for (const fn of listeners) {
      fn({
        current: cur && cur.id, currentTitle: cur && cur.title,
        next: next && next.id, nextTitle: next && next.title,
        remaining: left, countdown: mmss,
        progress: d ? Math.min(100, ((d - left) / d) * 100) : 0,
        paused, pinned,
      })
    }
  }

  function tick () {
    const list = enabled()
    if (!list.length) return
    if (!current) { show(list[index].id); return }
    if (paused || pinned) { emit(); return }
    if (nowMs() - startedAt >= duration()) {
      // Skip past a view with no data yet, but never drop one that has data.
      let guard = list.length
      do { index = (index + 1) % list.length; guard-- }
      while (guard > 0 && !hasData(list[index].id))
      show(list[index].id)
    } else emit()
  }

  // Burn-in: nudge every stage by up to 4 px every 10 minutes. Imperceptible
  // to the room, and enough to spare the panel over six hours.
  function drift () {
    const dx = (Math.random() * 2 - 1) * DRIFT_MAX_PX
    const dy = (Math.random() * 2 - 1) * DRIFT_MAX_PX
    for (const el of document.querySelectorAll('.stage, .tk-fixed')) {
      el.style.setProperty('--drift-x', `${dx.toFixed(1)}px`)
      el.style.setProperty('--drift-y', `${dy.toFixed(1)}px`)
    }
  }

  function advance (step) {
    const list = enabled()
    if (!list.length) return
    index = (index + step + list.length) % list.length
    show(list[index].id)
  }

  const api = {
    start () {
      const list = enabled()
      if (list.length) show(list[index].id)
      setInterval(tick, 1000)
      // Smooth the hairline between ticks without depending on rAF for data.
      const frame = () => { emit(); requestAnimationFrame(frame) }
      requestAnimationFrame(frame)
      setInterval(drift, DRIFT_EVERY_MS)
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
    update (changedKeys) {
      // Off-screen views still take data (SHELL.md); only the visible one is
      // re-rendered, to keep the per-poll cost down.
      if (current && views[current] && views[current].update) views[current].update(changedKeys)
    },
  }
  return api
}
