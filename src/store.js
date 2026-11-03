// Holds every Race plus each feed's health. Sources write to it, views read
// from it. Views never fetch; sources never touch the DOM.

import { makeRace, resolve } from './model/race.js'
import { resolveCall } from './model/calls.js'
import { nowMs } from './util.js'

const SAVE_KEY = 'election-night-2026'
const SAVE_EVERY_MS = 5000
const STALE_AFTER_MS = 5 * 60e3

function createStore () {
  const races = new Map()
  const health = {}            // name -> { ok, lastOk, lastChange, error, test }
  const subscribers = new Set()
  const listeners = { call: new Set() }
  let manual = {}              // key -> call record, survives a reload
  let saveTimer = null

  // ---- persistence: a reload mid-evening comes back instantly ----
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null')
    if (saved && saved.manual) manual = saved.manual
    if (saved && saved.races) {
      for (const r of saved.races) {
        const race = Object.assign(makeRace(r.key, r), r)
        race.stale = true      // restored data is old until a poll confirms it
        races.set(r.key, race)
      }
    }
  } catch (e) { /* a corrupt cache must never stop the show */ }

  function scheduleSave () {
    if (saveTimer) return
    saveTimer = setTimeout(() => {
      saveTimer = null
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify({
          manual,
          races: [...races.values()],
          at: nowMs(),
        }))
      } catch (e) { /* quota or private mode: not fatal */ }
    }, SAVE_EVERY_MS)
  }

  function ensure (key, init) {
    let r = races.get(key)
    if (!r) { r = makeRace(key, init); races.set(key, r) }
    else if (init) Object.assign(r, { label: init.label ?? r.label, holder: init.holder ?? r.holder })
    return r
  }

  const api = {
    // ---- writes, from sources ----

    /** Record one source's reading of a race. Does not resolve; call commit(). */
    observe (key, init, source, { votes, call } = {}) {
      const r = ensure(key, init)
      if (votes) r.votesBySource[source] = { ...votes, at: votes.at || nowMs() }
      if (call !== undefined) r.callBySource[source] = call
      return r
    },

    setManualCall (key, rec) {
      if (rec) manual[key] = rec; else delete manual[key]
      const r = races.get(key)
      if (r) r.callBySource.manual = rec || null
      scheduleSave()
    },

    setAutoCall (key, rec) {
      const r = races.get(key)
      if (r) r.callBySource.auto = rec || null
    },

    setHealth (name, patch) {
      const h = health[name] || (health[name] = { ok: false, lastOk: 0, lastChange: 0, error: null, test: false })
      Object.assign(h, patch)
    },

    /**
     * Re-derive every race and notify. Called once at the end of each poll
     * rather than per-race, so a 435-seat refresh is one render, not 435.
     */
    commit (changedKeys = new Set()) {
      const callEvents = []
      const now = nowMs()
      for (const r of races.values()) {
        if (manual[r.key]) r.callBySource.manual = manual[r.key]
        resolve(r)
        const { changed, previous, withdrawn } = resolveCall(r, health)
        r.stale = r.updatedAt > 0 && now - r.updatedAt > STALE_AFTER_MS
        if (changed) {
          changedKeys.add(r.key)
          callEvents.push({ race: r, previous, withdrawn })
        }
      }
      for (const fn of subscribers) { try { fn(changedKeys) } catch (e) { console.error(e) } }
      for (const ev of callEvents) {
        for (const fn of listeners.call) { try { fn(ev) } catch (e) { console.error(e) } }
      }
      scheduleSave()
      return callEvents
    },

    // ---- reads, from views ----
    getRace: key => races.get(key) || null,
    racesBy: office => [...races.values()].filter(r => r.office === office),
    all: () => [...races.values()],
    getHealth: name => health[name] || null,
    allHealth: () => ({ ...health }),
    get manualCalls () { return { ...manual } },

    /** Calls across every office, newest first — what the ticker shows. */
    latestCalls (limit = 20) {
      return [...races.values()]
        .filter(r => r.call)
        .sort((a, b) => b.call.at - a.call.at)
        .slice(0, limit)
    },

    /** True while civicAPI is publishing rehearsal data, which must be labelled. */
    isTestData: () => Object.values(health).some(h => h.test),

    subscribe (fn) { subscribers.add(fn); return () => subscribers.delete(fn) },
    on (event, fn) {
      if (!listeners[event]) listeners[event] = new Set()
      listeners[event].add(fn)
      return () => listeners[event].delete(fn)
    },

    clearCache () {
      try { localStorage.removeItem(SAVE_KEY) } catch (e) {}
      races.clear(); manual = {}
    },
  }

  return api
}

export const store = createStore()
export default store
