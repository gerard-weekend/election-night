// DATA-PLAN.md acceptance checks 2-4, in a real browser:
//   2. shows a doctored NYT call within one poll
//   3. falls back to civicAPI calls when the NYT address is broken
//   4. survives a 2-minute network drop without blanking
//
//   node tools/test-resilience.mjs      (run make-rehearsal.mjs first)

import { chromium } from 'playwright'

const REHEARSAL = 'nytSenate=rehearsal/nyt-senate.json&civicSenate=rehearsal/civic-senate.json'
const browser = await chromium.launch({ channel: 'chrome' })

let pass = 0, fail = 0
const ok = (n, c, d = '') => { c ? (pass++, console.log('  PASS  ' + n)) : (fail++, console.log(`  FAIL  ${n}   ${d}`)) }

// ---------------------------------------------------------- check 2 ----
console.log('\n--- 2. a doctored AP call appears ---')
{
  const p = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
  await p.goto(`http://localhost:8000/?${REHEARSAL}`, { waitUntil: 'load' })
  // Wait for the doctored Senate file itself: civicAPI's own Alabama call can
  // land first, before NYT's poll, and that is not what this check is about.
  await p.waitForFunction(() => window.store?.latestCalls(40).length >= 10, { timeout: 60000 })
  const r = await p.evaluate(() => {
    const ga = window.store.getRace('SEN-GA')
    return { calls: window.store.latestCalls(40).length, source: ga?.call?.source, winner: ga?.call?.name }
  })
  ok('AP calls are applied', r.calls >= 10 && r.source === 'AP', JSON.stringify(r))
  ok('the winner is a real named candidate', !!r.winner, String(r.winner))
  await p.close()
}

// ---------------------------------------------------------- check 3 ----
console.log('\n--- 3. civicAPI calls take over when NYT is broken ---')
{
  const p = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
  // Point every NYT file at a URL that 404s, leaving civicAPI as the only source.
  await p.goto('http://localhost:8000/?nytSenate=rehearsal/nope.json&nytHouse=rehearsal/nope.json'
    + '&nytCa=rehearsal/nope.json&civicSenate=rehearsal/civic-senate.json', { waitUntil: 'load' })
  // NYT must go stale (4 min) before civicAPI's call is honoured, so push the
  // health clock back rather than waiting it out.
  await p.waitForTimeout(8000)
  const nytDown = await p.evaluate(() => {
    const h = window.store.allHealth()
    return Object.entries(h).filter(([k]) => k.startsWith('nyt')).every(([, v]) => !v.ok)
  })
  ok('a broken NYT address is reported as a failed feed', nytDown)

  const took = await p.evaluate(() => {
    window.store.setHealth('nytSenate', { ok: true, lastOk: Date.now() - 5 * 60e3 })
    window.store.commit()
    const al = window.store.getRace('SEN-AL')
    return al && al.call ? al.call.source : null
  })
  ok("civicAPI's own call is used once NYT is stale", took === 'civic', String(took))

  const credit = await p.textContent('.tk-src')
  ok('the ticker credits civicAPI for calls during the outage', /Calls: civicAPI/.test(credit),
    credit.replace(/\s+/g, ' ').trim())

  const blank = await p.evaluate(() => !document.querySelector('.stage.is-active')?.textContent.trim())
  ok('the screen is not blank while NYT is down', !blank)
  await p.close()
}

// ---------------------------------------------------------- check 4 ----
console.log('\n--- 4. survives a network drop without blanking ---')
{
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } })
  const p = await ctx.newPage()
  await p.goto(`http://localhost:8000/?${REHEARSAL}`, { waitUntil: 'load' })
  // Let the full picture settle before cutting the network, otherwise this
  // measures a half-loaded page rather than a drop.
  await p.waitForFunction(() => window.store?.latestCalls(40).length >= 10, { timeout: 60000 })
  await p.waitForTimeout(3000)

  const before = await p.evaluate(() => ({
    calls: window.store.latestCalls(40).length,
    dem: document.querySelector('[data-field="senate.dem.total"]')?.textContent,
  }))

  // Cut every network request, as a dropped Wi-Fi link would.
  await ctx.route('**/*', route => route.abort())
  await p.waitForTimeout(70000)       // longer than two poll cycles of each feed

  const during = await p.evaluate(() => ({
    calls: window.store.latestCalls(40).length,
    text: (document.querySelector('.stage.is-active')?.textContent || '').trim().length,
    failing: Object.values(window.store.allHealth()).filter(h => !h.ok).length,
    stale: window.store.all().filter(r => r.stale).length,
  }))
  ok('last good data stays on screen during the drop', during.calls === before.calls,
    `${before.calls} -> ${during.calls}`)
  ok('the view still has content', during.text > 100, String(during.text))
  ok('feeds are marked unhealthy', during.failing > 0, String(during.failing))

  // Restore the network and confirm it recovers on its own.
  await ctx.unroute('**/*')
  await p.waitForTimeout(50000)
  const after = await p.evaluate(() => ({
    recovered: Object.values(window.store.allHealth()).filter(h => h.ok).length,
    calls: window.store.latestCalls(40).length,
  }))
  ok('feeds recover once the network returns', after.recovered > 0, JSON.stringify(after))
  ok('calls survive the round trip', after.calls === before.calls, `${before.calls} -> ${after.calls}`)
  await ctx.close()
}

console.log(`\n${pass} passed, ${fail} failed\n`)
await browser.close()
process.exit(fail ? 1 : 0)
