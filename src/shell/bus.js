// Link between the TV page and the control window.
//
// The TV page owns all the data — it is the only one that fetches. The control
// window is a thin remote: it receives state snapshots and sends commands back.
// That keeps the feeds at one set of requests and means the control window can
// be closed and reopened all evening without disturbing anything.

const CHANNEL = 'election-night-2026'

export const MSG = {
  STATE: 'state',          // TV -> control: health, rotation, call log
  COMMAND: 'command',      // control -> TV: pause / next / pin / manual call
  HELLO: 'hello',          // control -> TV: "I just opened, send a snapshot"
}

function createBus (role) {
  const chan = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL) : null
  const handlers = new Set()

  if (chan) {
    chan.onmessage = ev => {
      const msg = ev.data
      if (!msg || msg.role === role) return      // ignore our own echo
      for (const fn of handlers) { try { fn(msg) } catch (e) { console.error(e) } }
    }
  }

  return {
    send (type, payload) { if (chan) chan.postMessage({ role, type, payload, at: Date.now() }) },
    on (fn) { handlers.add(fn); return () => handlers.delete(fn) },
    available: !!chan,
  }
}

export const makeBus = createBus
