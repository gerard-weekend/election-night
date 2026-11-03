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

const errors = [], warnings = [], failedRequests = []
page.on('console', m => {
  if (m.type() === 'error') errors.push(m.text())
  if (m.type() === 'warning') warnings.push(m.text())
})
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message))
page.on('requestfailed', r => failedRequests.push(`${r.url()} — ${r.failure()?.errorText}`))

// Not 'networkidle': the page polls all evening, so it never goes idle.
await page.goto(URL, { waitUntil: 'load' })
await page.waitForTimeout(SECONDS * 1000)

const report = await page.evaluate(() => {
  const txt = sel => (document.querySelector(sel)?.textContent || '').trim()
  const active = document.querySelector('.view.is-active')
  return {
    views: [...document.querySelectorAll('.view')].map(v => v.dataset.view),
    activeView: active?.dataset.view || null,
    rotation: txt('#rotation'),
    tickerClock: txt('[data-field="shell.clock"]'),
    tickerSource: txt('[data-field="shell.source"]'),
    senate: {
      dem: txt('[data-field="senate.dem.total"]'),
      rep: txt('[data-field="senate.rep.total"]'),
      demDetail: txt('[data-field="senate.dem.detail"]'),
      undecided: txt('[data-field="senate.undecided"]'),
      tiles: document.querySelectorAll('.sen-map g[data-state]').length,
      keyRaces: document.querySelectorAll('.kr').length,
    },
    house: {
      dem: txt('[data-field="house.dem.called"]'),
      rep: txt('[data-field="house.rep.called"]'),
      swing: txt('[data-field="house.swing"]'),
      called: txt('[data-field="house.called"]'),
      seats: document.querySelectorAll('.seat').length,
    },
    california: {
      cards: document.querySelectorAll('.ca-card').length,
      waiting: document.querySelectorAll('.ca-card.is-waiting').length,
      labels: [...document.querySelectorAll('.ca-card .ca-label')].map(e => e.textContent),
    },
    storeType: typeof window.store,
    storeCounts: window.store ? {
      house: window.store.racesBy('H').length,
      senate: window.store.racesBy('S').length,
      ca: window.store.racesBy('CA').length + window.store.racesBy('PROP').length,
    } : null,
    health: window.store ? Object.fromEntries(Object.entries(window.store.allHealth())
      .map(([k, v]) => [k, v.ok ? 'OK' : 'FAIL: ' + v.error])) : null,
  }
})

// Views mount lazily, so visit each one explicitly rather than only capturing
// whichever happened to be on screen.
const perView = {}
for (const id of ['house', 'senate', 'california']) {
  await page.evaluate(v => window.rotator.pin(v), id)
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `/tmp/view-${id}.png` })
  perView[id] = await page.evaluate(() => {
    const v = document.querySelector('.view.is-active')
    const txt = s => (v?.querySelector(s)?.textContent || '').trim()
    return {
      mounted: !!v,
      seats: v?.querySelectorAll('.seat').length || 0,
      tiles: v?.querySelectorAll('.sen-map g[data-state]').length || 0,
      keyRaces: v?.querySelectorAll('.kr').length || 0,
      caCards: v?.querySelectorAll('.ca-card').length || 0,
      caWaiting: v?.querySelectorAll('.ca-card.is-waiting').length || 0,
      headline: [txt('[data-field="senate.dem.total"]'), txt('[data-field="senate.rep.total"]'),
        txt('[data-field="house.dem.called"]'), txt('[data-field="house.rep.called"]')].filter(Boolean),
      sub: txt('[data-field="senate.dem.detail"]') || txt('[data-field="house.called"]'),
      labels: [...(v?.querySelectorAll('.ca-card .ca-label') || [])].map(e => e.textContent),
      emptyFields: [...(v?.querySelectorAll('[data-field]') || [])]
        .filter(e => !e.textContent.trim() && !e.children.length).map(e => e.dataset.field),
    }
  })
}
console.log('\n=============== PER VIEW ==============')
console.log(JSON.stringify(perView, null, 2))

console.log('\n=============== CONSOLE ===============')
console.log(`  errors: ${errors.length}  warnings: ${warnings.length}  failed requests: ${failedRequests.length}`)
errors.slice(0, 15).forEach(e => console.log('  ERROR  ' + e.slice(0, 300)))
failedRequests.slice(0, 10).forEach(e => console.log('  REQFAIL ' + e.slice(0, 200)))

console.log('\n=============== RENDERED ==============')
console.log(JSON.stringify(report, null, 2))

await browser.close()
process.exit(errors.length ? 1 : 0)
