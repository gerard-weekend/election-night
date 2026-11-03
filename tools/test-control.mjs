// Open the TV page and the control window together and check the link between
// them: snapshots arriving, and commands actually taking effect on the TV.
//
//   node tools/test-control.mjs

import { chromium } from 'playwright'

const browser = await chromium.launch({ channel: 'chrome' })
// Same browser context, so the BroadcastChannel is shared as it will be on the night.
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } })

const tv = await ctx.newPage()
const control = await ctx.newPage()
const errs = []
for (const [name, p] of [['tv', tv], ['control', control]]) {
  p.on('pageerror', e => errs.push(`${name} PAGEERROR: ${e.message}`))
  p.on('console', m => { if (m.type() === 'error') errs.push(`${name}: ${m.text()}`) })
}

await tv.goto('http://localhost:8000/', { waitUntil: 'load' })
await control.goto('http://localhost:8000/control.html', { waitUntil: 'load' })
await control.waitForTimeout(6000)

let pass = 0, fail = 0
const ok = (n, c, d = '') => { c ? (pass++, console.log('  PASS  ' + n)) : (fail++, console.log(`  FAIL  ${n}   ${d}`)) }

// ---- the control window receives state ----
const link = (await control.textContent('#link')).trim()
ok('control reports connected', link.startsWith('Connected'), link)

// The NYT files are staggered 0/15/30s apart, so give them time to report
// before counting rather than sampling a half-filled panel.
await control.waitForFunction(() => document.querySelectorAll('#feeds .feed').length >= 5, { timeout: 60000 })
  .catch(() => {})
const feeds = await control.$$eval('#feeds .feed', els => els.map(e => e.textContent.trim()))
ok('feed health is listed', feeds.length >= 5, JSON.stringify(feeds))

const counts = await control.textContent('#counts')
ok('coverage counts arrive', /435/.test(counts) && /35/.test(counts), counts.replace(/\s+/g, ' ').trim())

const single = (await control.textContent('#single')).trim()
ok('single-sourced races are flagged', /Oakland/.test(single), single)

// ---- commands reach the TV ----
await control.click('#pause')
await tv.waitForTimeout(600)
ok('pause from control pauses the TV', await tv.evaluate(() => window.rotator.state.paused))

await control.click('#pause')
await tv.waitForTimeout(600)
ok('resume from control resumes the TV', !(await tv.evaluate(() => window.rotator.state.paused)))

await control.click('[data-pin="california"]')
await tv.waitForTimeout(1200)
ok('pin from control switches the TV view',
  (await tv.evaluate(() => window.rotator.state.pinned)) === 'california',
  await tv.evaluate(() => window.rotator.state.pinned))

await control.click('#unpin')
await tv.waitForTimeout(600)
ok('unpin clears the pin', !(await tv.evaluate(() => window.rotator.state.pinned)))

// ---- a manual call typed before the race has loaded still lands ----
// The call is kept as intent and re-resolved on every poll, so typing it
// early (as you would at a poll close) must not silently drop it.
const early = await tv.evaluate(() => window.store.getRace('CA-PROP-40').candidates.length)
await control.fill('#manual', 'CA-PROP-40 YES')
await control.press('#manual', 'Enter')
await tv.waitForTimeout(1200)
if (early === 0) {
  ok('a call typed before the race loaded is held, not lost',
    await tv.evaluate(() => !!window.store.manualCalls['CA-PROP-40']))
}
// Wait for civicAPI's California pass to reach this race, then re-check.
await tv.waitForFunction(() => window.store.getRace('CA-PROP-40').candidates.length > 0, { timeout: 30000 })
await tv.waitForTimeout(1500)
const call = await tv.evaluate(() => {
  const r = window.store.getRace('CA-PROP-40')
  return r && r.call ? { winner: r.call.winner, source: r.call.source } : null
})
ok('manual call applies on the TV', call && call.winner === 'yes' && call.source === 'manual', JSON.stringify(call))

// Rotate California on screen and confirm it reflects the call immediately —
// a view coming back after time off screen must not show stale content.
await control.click('[data-pin="california"]')
await tv.waitForTimeout(1200)
const onScreen = await tv.evaluate(() => document.querySelector('[data-key="CA-PROP-40"]')?.dataset.propStatus)
ok('a view rotating in shows the call at once (PASSES, not passing)', onScreen === 'passes', String(onScreen))
await control.click('#unpin')

const ticker = await tv.textContent('[data-field="shell.calls"]')
ok('the call reaches the ticker', /PROP 40/i.test(ticker), ticker.replace(/\s+/g, ' ').slice(0, 120))

// ---- withdrawing it ----
await control.fill('#manual', '-CA-PROP-40')
await control.press('#manual', 'Enter')
await tv.waitForTimeout(1200)
ok('withdrawing the manual call clears it',
  await tv.evaluate(() => !window.store.getRace('CA-PROP-40').call))

console.log(`\n  console errors: ${errs.length}`)
errs.slice(0, 5).forEach(e => console.log('   ' + e.slice(0, 200)))
console.log(`\n${pass} passed, ${fail} failed\n`)

await browser.close()
process.exit(fail || errs.length ? 1 : 0)
