// Smoke test: run the real source modules against the real feeds in Node and
// report what the store ends up holding. Catches parser and join errors
// without a browser.
//
//   node tools/smoke.mjs [seconds]

const mem = new Map()
globalThis.localStorage = {
  getItem: k => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: k => mem.delete(k),
}

const SECONDS = Number(process.argv[2] || 12)

const { default: store } = await import('../src/store.js')
const civic = await import('../src/sources/civic.js')
const nyt = await import('../src/sources/nyt.js')
const { CALIFORNIA_RACES } = await import('../config/california.js')

const callLog = []
store.on('call', ev => callLog.push(ev))

civic.start()
nyt.start()

await new Promise(r => setTimeout(r, SECONDS * 1000))

const pad = (s, n) => String(s).padEnd(n)
const line = n => console.log('-'.repeat(n))

console.log('\n================ FEED HEALTH ================')
for (const [name, h] of Object.entries(store.allHealth())) {
  console.log(`  ${pad(name, 12)} ${h.ok ? 'OK  ' : 'FAIL'}  ${h.test ? 'TEST-DATA ' : ''}${h.error || ''}`)
}

const house = store.racesBy('H')
const senate = store.racesBy('S')
const props = store.racesBy('PROP')
const ca = store.racesBy('CA')

console.log('\n================ RACE COUNTS ================')
console.log(`  House   ${house.length}   (expect 435)`)
console.log(`  Senate  ${senate.length}   (expect 35)`)
// Count configured races present, not office tags: CA-11 carries office 'H'
// because the House feeds already own it.
const caPresent = CALIFORNIA_RACES.filter(c => store.getRace(c.key))
console.log(`  CA      ${caPresent.length}   (expect ${CALIFORNIA_RACES.length})`)

console.log('\n============ TWO-SOURCE JOIN CHECK ==========')
for (const [label, list] of [['House', house], ['Senate', senate],
  ['California', CALIFORNIA_RACES.map(c => store.getRace(c.key)).filter(Boolean)]]) {
  const both = list.filter(r => r.votesBySource.civic && r.votesBySource.nyt).length
  const civicOnly = list.filter(r => r.votesBySource.civic && !r.votesBySource.nyt).length
  const nytOnly = list.filter(r => !r.votesBySource.civic && r.votesBySource.nyt).length
  console.log(`  ${pad(label, 11)} both=${pad(both, 4)} civic-only=${pad(civicOnly, 4)} nyt-only=${nytOnly}`)
}

console.log('\n============ CALIFORNIA DETAIL ==============')
line(78)
console.log(`  ${pad('KEY', 15)} ${pad('LABEL', 22)} ${pad('CANDS', 6)} ${pad('%IN', 6)} ${pad('FROM', 6)} CALL`)
line(78)
for (const cfg of CALIFORNIA_RACES) {
  const r = store.getRace(cfg.key)
  if (!r) { console.log(`  ${pad(cfg.key, 15)} ${pad(cfg.label, 22)} -- MISSING --`); continue }
  const names = r.candidates.slice(0, 2).map(c => c.name.split(' ').pop()).join('/')
  console.log(`  ${pad(cfg.key, 15)} ${pad(cfg.label, 22)} ${pad(r.candidates.length, 6)} ${pad(r.pctIn.toFixed(1), 6)} ${pad(r.votesFrom || '-', 6)} ${r.call ? r.call.source + ':' + r.call.name : '-'}  ${names}`)
}

console.log('\n============ SENATE SAMPLE ==================')
for (const r of senate.slice(0, 6)) {
  const top = r.candidates.slice(0, 2).map(c => `${c.name.split(' ').pop()}(${c.party || '?'}) ${c.votes}`).join('  ')
  console.log(`  ${pad(r.key, 9)} ${pad(r.label || '', 14)} rating=${pad(r.rating || '-', 12)} from=${pad(r.votesFrom || '-', 6)} ${top}`)
}
console.log(`\n  holdovers from civicAPI: D=${civic.holdovers.D} R=${civic.holdovers.R}`)
const pc = nyt.partyControl.senate
if (pc) {
  const b = pc.results[0].offices.S
  console.log(`  holdovers from NYT:      D=${b.party_balance.DEM.no_election} R=${b.party_balance.GOP.no_election}  to_win=${JSON.stringify(b.to_win)}`)
}

console.log('\n============ HOUSE SANITY ===================')
const bad = house.filter(r => r.candidates.length === 0)
console.log(`  races with zero candidates: ${bad.length}`)
console.log(`  sample: ${house.slice(0, 3).map(r => r.key).join(', ')}`)

console.log(`\n  call events seen: ${callLog.length}`)
console.log('')
process.exit(0)
