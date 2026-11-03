// Shared fetch for both sources: retry with back-off, as DATA-PLAN section 2
// specifies.
//
// civicAPI was seen returning intermittent 503s during rehearsal on election
// morning, and it will be under far heavier load tonight. Without a retry a
// single blip costs a whole poll cycle — 30 to 60 seconds of a frozen number
// on the TV. Two quick retries turn most of those into nothing visible.

import { sleep } from '../util.js'

const RETRIES = 2
const BACKOFF_MS = [700, 2100]

// 4xx other than 429 means we asked for the wrong thing; retrying will not
// help and only adds load. Everything else is worth another go.
const worthRetrying = status => !status || status === 429 || status >= 500

export async function fetchJson (url, { label = 'feed' } = {}) {
  let lastErr = null
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    if (attempt) await sleep(BACKOFF_MS[attempt - 1])
    try {
      const r = await fetch(url, { cache: 'no-store' })
      if (!r.ok) {
        const e = new Error(`${label} answered ${r.status}.`)
        e.status = r.status
        if (!worthRetrying(r.status)) throw e
        lastErr = e
        continue
      }
      return await r.json()
    } catch (e) {
      // A TypeError here is a network-level failure, which is worth a retry.
      if (e.status && !worthRetrying(e.status)) throw e
      lastErr = e
    }
  }
  throw lastErr || new Error(`${label} unreachable.`)
}
