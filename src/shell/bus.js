// Link between the TV page and the control page.
//
// This used to be a BroadcastChannel, which only reaches windows in the same
// browser profile — so the control page had to live in the same Chrome as the
// TV, and a phone could not drive it at all. It now relays through the server
// instead (see tools/serve.py), which removes both limits.
//
// The TV page still owns all the data: it is the only one that fetches feeds.
// It pushes a snapshot and polls for commands; the control page polls the
// snapshot and posts commands. The relay holds this in memory only.

export const MSG = {
  STATE: 'state',      // TV -> control: health, rotation, call log
  COMMAND: 'command',  // control -> TV: pause / next / pin / manual call
  HELLO: 'hello',      // kept for compatibility; the relay needs no handshake
}

const STATE_EVERY = 1000
const COMMAND_EVERY = 700

async function postJson (url, body) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  if (!r.ok) throw new Error(`${url} answered ${r.status}`)
  return r.json()
}

const getJson = async url => {
  const r = await fetch(url, { cache: 'no-store' })
  if (!r.ok) throw new Error(`${url} answered ${r.status}`)
  return r.json()
}

function createBus (role) {
  const handlers = new Set()
  const emit = msg => { for (const fn of handlers) { try { fn(msg) } catch (e) { console.error(e) } } }

  // Both sides poll on a plain interval rather than long-polling: a dropped
  // request simply means the next tick picks it up, with nothing to recover.
  if (role === 'tv') {
    let since = 0
    // Start from whatever the relay has already seen, so commands queued
    // before this page loaded are not replayed on a reload.
    getJson('/api/state')
      .then(d => { since = d.seq || 0 })
      .catch(() => {})
      .finally(() => {
        setInterval(async () => {
          try {
            const d = await getJson(`/api/commands?since=${since}`)
            for (const c of d.commands || []) {
              since = Math.max(since, c.seq)
              emit({ role: 'control', ...c.payload })
            }
          } catch (e) { /* the next tick retries */ }
        }, COMMAND_EVERY)
      })
  } else {
    let lastSeen = null
    setInterval(async () => {
      try {
        const d = await getJson('/api/state')
        if (d.state) {
          // Only raise a change; the control page redraws on every message.
          lastSeen = d.state
          emit({ role: 'tv', type: MSG.STATE, payload: lastSeen })
        }
      } catch (e) { /* the control page shows "not connected" on its own */ }
    }, STATE_EVERY)
  }

  return {
    send (type, payload) {
      if (type === MSG.HELLO) return          // no handshake needed
      if (role === 'tv' && type === MSG.STATE) {
        postJson('/api/state', payload).catch(() => {})
      } else if (role === 'control' && type === MSG.COMMAND) {
        postJson('/api/command', { type, payload }).catch(() => {})
      }
    },
    on (fn) { handlers.add(fn); return () => handlers.delete(fn) },
    available: true,
  }
}

export const makeBus = createBus
