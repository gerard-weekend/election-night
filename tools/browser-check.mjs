// Load the real TV page in Chromium against the live feeds, let it run, and
// report every console error plus what actually rendered. This is the check
// the Node smoke test cannot do: module loading, DOM wiring, view mounting.
//
//   node tools/browser-check.mjs [seconds]

import { chromium } from 'playwright'

const SECONDS = Number(process.argv[2] || 35)
const URL = 'http://localhost:8000/'

// Use the installed Chrome rather than Playwright's bundled build: it is the
// browser this actually runs in on the night, and it avoids a download.
const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })

const errors = [], warnings = [], failedRequests = [], feedNoise = []

// civicAPI omits its CORS header on error responses, so an overloaded 503
// reaches the browser as a CORS error. The sources retry and fall back, and
// the console message cannot be suppressed, so it is counted separately
// rather than failing the check. Anything from our own origin still fails.
const isFeedNoise = text => /civicapi\.org|static01\.nyt\.com/.test(text)
  && /CORS|Failed to load resource|ERR_|net::/.test(text)

page.on('console', m => {
  if (m.type() === 'warning') { warnings.push(m.text()); return }
  if (m.type() !== 'error') return
  ;(isFeedNoise(m.text()) ? feedNoise : errors).push(m.text())
})
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message))
page.on('requestfailed', r => {
  const line = `${r.url()} — ${r.failure()?.errorText}`
  ;(isFeedNoise(r.url()) ? feedNoise : failedRequests).push(line)
})

// Not 'networkidle': the page polls all evening, so it never goes idle.
await page.goto(URL, { waitUntil: 'load' })
await page.waitForTimeout(SECONDS * 1000)

// Visit every view first: all three stay mounted, but only the active one
// re-renders, so a view never shown would still hold its mount-time state.
for (const id of ['house', 'senate', 'california']) {
  await page.evaluate(v => window.rotator.pin(v), id)
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `/tmp/view-${id}.png` })
}
await page.evaluate(() => window.rotator.unpin())

const report = await page.evaluate(() => {
  const txt = sel => (document.querySelector(sel)?.textContent || '').trim()
  const n = sel => document.querySelectorAll(sel).length
  return {
    stages: [...document.querySelectorAll('.stage')].map(s => s.dataset.view),
    active: document.querySelector('.stage.is-active')?.dataset.view || null,
    ticker: {
      clock: txt('[data-field="shell.clock"]'),
      calls: n('[data-template="shell.call"]'),
      source: txt('.tk-src'),
      view: txt('[data-field="shell.view"]'),
      next: txt('[data-field="shell.next"]'),
    },
    house: {
      plotted: n('[data-template="house.seat"]'),
      offDem: +txt('[data-field="house.offAxis.dem"]'),
      offGop: +txt('[data-field="house.offAxis.gop"]'),
      demCalled: txt('[data-field="house.dem.called"]'),
      demPredicted: txt('[data-field="house.dem.predicted"]'),
      gopPredicted: txt('[data-field="house.gop.predicted"]'),
      swing: txt('[data-field="house.swing"]'),
      axisTicks: n('[data-field="house.axis"] .tick'),
    },
    senate: {
      seats: n('[data-template="senate.seat"]'),
      tiles: n('[data-template="senate.state"]'),
      keyRaces: n('[data-template="senate.race"]'),
      dem: txt('[data-field="senate.dem.total"]'),
      gop: txt('[data-field="senate.gop.total"]'),
      undecided: txt('[data-field="senate.undecided"]'),
      flipsDem: txt('[data-field="senate.flips.dem"]'),
    },
    california: {
      races: n('[data-template="ca.race"]'),
      props: n('[data-template="ca.prop"]'),
      offices: [...document.querySelectorAll('[data-field="race.office"]')]
        .map(e => (e.firstChild?.nodeValue || e.textContent).trim()),
      propLabels: [...document.querySelectorAll('[data-field="prop.number"]')].map(e => e.textContent),
    },
    storeCounts: window.store ? {
      house: window.store.racesBy('H').length,
      senate: window.store.racesBy('S').length,
    } : null,
    health: window.store ? Object.fromEntries(Object.entries(window.store.allHealth())
      .map(([k, v]) => [k, v.ok ? 'OK' : 'FAIL: ' + v.error])) : null,
  }
})

// Seat accounting must be exact: every district is either plotted or counted
// as off-axis, and the predicted totals always sum to 435.
const h = report.house
const checks = [
  ['all 435 districts accounted for', h.plotted + h.offDem + h.offGop === 435,
    `${h.plotted} + ${h.offDem} + ${h.offGop}`],
  ['predicted totals sum to 435', (+h.demPredicted) + (+h.gopPredicted) === 435,
    `${h.demPredicted} + ${h.gopPredicted}`],
  ['hemicycle has exactly 100 seats', report.senate.seats === 100, String(report.senate.seats)],
  ['map has 50 state tiles', report.senate.tiles === 50, String(report.senate.tiles)],
  ['California has 4 races and 8 measures',
    report.california.races === 4 && report.california.props === 8,
    `${report.california.races}/${report.california.props}`],
]
console.log('\n=============== CHECKS ================')
let bad = 0
for (const [name, ok, detail] of checks) {
  if (!ok) bad++
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '   ' + detail}`)
}

console.log('\n=============== CONSOLE ===============')
console.log(`  errors: ${errors.length}  warnings: ${warnings.length}  failed requests: ${failedRequests.length}`)
console.log(`  upstream feed noise (retried, not a failure): ${feedNoise.length}`)
errors.slice(0, 15).forEach(e => console.log('  ERROR  ' + e.slice(0, 300)))
failedRequests.slice(0, 10).forEach(e => console.log('  REQFAIL ' + e.slice(0, 200)))

console.log('\n=============== RENDERED ==============')
console.log(JSON.stringify(report, null, 2))

await browser.close()
process.exit(errors.length || bad ? 1 : 0)
