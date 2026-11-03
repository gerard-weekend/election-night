// Call-precedence tests. Nothing is called on real feeds until polls close,
// so these drive the store directly with crafted readings — the one path that
// must not be wrong on the night.
//
//   node tools/test-calls.mjs

const mem = new Map()
globalThis.localStorage = {
  getItem: k => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: k => mem.delete(k),
}

const { default: store } = await import('../src/store.js')
const { NYT_STALE_MS } = await import('../src/model/calls.js')

let pass = 0, fail = 0
const ok = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name}`) }
  else { fail++; console.log(`  FAIL  ${name}   ${detail}`) }
}

const now = Date.now()
// NYT health is per office, so set every NYT feed together.
const NYT_FEEDS = ['nytHouse', 'nytSenate', 'nytCA']
const healthy = () => NYT_FEEDS.forEach(n => store.setHealth(n, { ok: true, lastOk: Date.now(), error: null }))
const stale = () => NYT_FEEDS.forEach(n => store.setHealth(n, { ok: true, lastOk: Date.now() - NYT_STALE_MS - 1000, error: null }))

// Two-candidate partisan race used by most cases.
function seed (key, { holder = 'R' } = {}) {
  store.observe(key, { office: 'S', state: 'XX', label: key, holder }, 'civic', {
    votes: {
      pctIn: 55,
      candidates: [
        { id: 'c-dem', name: 'Jane Smith', party: 'D', votes: 5000 },
        { id: 'c-rep', name: 'John Jones', party: 'R', votes: 4000 },
      ],
    },
  })
  const r = store.getRace(key)
  r.holder = holder
  return r
}

console.log('\n--- precedence ---')

// 1. AP via NYT calls it.
seed('SEN-T1')
healthy()
store.observe('SEN-T1', null, 'nyt', { call: { party: 'D', name: 'Jane Smith', at: now } })
store.commit()
let r = store.getRace('SEN-T1')
ok('NYT call is applied', r.call && r.call.source === 'AP' && r.call.winner === 'c-dem',
  JSON.stringify(r.call))

// 2. NYT healthy and silent, civic has called it -> stays uncalled.
seed('SEN-T2')
healthy()
store.observe('SEN-T2', null, 'civic', { call: { party: 'R', name: 'John Jones', at: now } })
store.commit()
r = store.getRace('SEN-T2')
ok('civic call ignored while NYT healthy', r.call === null, JSON.stringify(r.call))

// 3. NYT goes stale -> civic's call takes over.
stale()
store.commit()
r = store.getRace('SEN-T2')
ok('civic call used once NYT stale', r.call && r.call.source === 'civic' && r.call.winner === 'c-rep',
  JSON.stringify(r.call))

// 4. NYT recovers and disagrees -> AP wins.
seed('SEN-T4')
store.observe('SEN-T4', null, 'civic', { call: { party: 'R', name: 'John Jones', at: now } })
store.observe('SEN-T4', null, 'nyt', { call: { party: 'D', name: 'Jane Smith', at: now } })
healthy()
store.commit()
r = store.getRace('SEN-T4')
ok('AP overrides a disagreeing civic call', r.call.source === 'AP' && r.call.winner === 'c-dem',
  JSON.stringify(r.call))

// 5. Manual beats everything.
store.setManualCall('SEN-T4', { party: 'R', name: 'John Jones', at: now })
store.commit()
r = store.getRace('SEN-T4')
ok('manual overrides AP', r.call.source === 'manual' && r.call.winner === 'c-rep', JSON.stringify(r.call))
store.setManualCall('SEN-T4', null)

console.log('\n--- withdrawal ---')

seed('SEN-T5')
healthy()
store.observe('SEN-T5', null, 'nyt', { call: { party: 'D', name: 'Jane Smith', at: now } })
store.commit()
let events = []
store.on('call', ev => events.push(ev))
store.observe('SEN-T5', null, 'nyt', { call: null })      // AP withdraws
store.commit()
r = store.getRace('SEN-T5')
ok('withdrawn call clears race.call', r.call === null, JSON.stringify(r.call))
ok('withdrawal raises an event flagged as withdrawn',
  events.some(e => e.race.key === 'SEN-T5' && e.withdrawn), JSON.stringify(events.map(e => e.race.key)))

console.log('\n--- flips ---')

seed('SEN-T6', { holder: 'R' })
healthy()
store.observe('SEN-T6', null, 'nyt', { call: { party: 'D', name: 'Jane Smith', at: now } })
store.commit()
r = store.getRace('SEN-T6')
ok('D win over R holder is a flip', r.flipped === true)

seed('SEN-T7', { holder: 'D' })
store.observe('SEN-T7', null, 'nyt', { call: { party: 'D', name: 'Jane Smith', at: now } })
store.commit()
r = store.getRace('SEN-T7')
ok('D win over D holder is not a flip', r.flipped === false)

console.log('\n--- candidate matching ---')

// California top-two: two Democrats. Party alone cannot disambiguate.
store.observe('CA-TOPTWO', { office: 'CA', label: 'Top-two' }, 'civic', {
  votes: {
    pctIn: 40,
    candidates: [
      { id: 'a', name: 'Maria Gonzalez', party: 'D', votes: 900 },
      { id: 'b', name: 'Alan Whitfield', party: 'D', votes: 800 },
    ],
  },
})
healthy()
store.observe('CA-TOPTWO', null, 'nyt', { call: { party: 'D', name: 'Alan Whitfield', at: now } })
store.commit()
r = store.getRace('CA-TOPTWO')
ok('same-party contest matched by surname', r.call && r.call.winner === 'b', JSON.stringify(r.call))

// Nebraska: Republican vs. independent.
store.observe('SEN-NE-T', { office: 'S', state: 'NE', label: 'Nebraska', holder: 'R' }, 'civic', {
  votes: {
    pctIn: 70,
    candidates: [
      { id: 'ric', name: 'Pete Ricketts', party: 'R', votes: 5000 },
      { id: 'osb', name: 'Dan Osborn', party: 'I', votes: 5200 },
    ],
  },
})
store.observe('SEN-NE-T', null, 'nyt', { call: { party: 'I', name: 'Dan Osborn', at: now } })
store.commit()
r = store.getRace('SEN-NE-T')
ok('independent winner matched', r.call && r.call.winner === 'osb' && r.call.party === 'I', JSON.stringify(r.call))
ok('independent win over R holder counts as a flip', r.flipped === true)

// Ballot measure.
store.observe('CA-PROP-T', { office: 'PROP', label: 'Prop T', kind: 'prop' }, 'civic', {
  votes: {
    pctIn: 61,
    candidates: [
      { id: 'yes', name: 'Yes', party: null, votes: 7000 },
      { id: 'no', name: 'No', party: null, votes: 6000 },
    ],
  },
})
store.observe('CA-PROP-T', null, 'nyt', { call: { winner: 'yes', at: now } })
store.commit()
r = store.getRace('CA-PROP-T')
ok('measure Yes/No call matched', r.call && r.call.winner === 'yes', JSON.stringify(r.call))

console.log('\n--- safety ---')

// A call we cannot tie to a candidate must not invent a winner.
store.observe('SEN-T8', { office: 'S', label: 'T8' }, 'civic', {
  votes: { pctIn: 50, candidates: [{ id: 'x', name: 'Ann Lee', party: 'D', votes: 10 }] },
})
healthy()
store.observe('SEN-T8', null, 'nyt', { call: { party: 'R', name: 'Nobody Here', at: now } })
store.commit()
r = store.getRace('SEN-T8')
ok('unmatchable call does not produce a winner', r.call === null, JSON.stringify(r.call))

// A leader is never a winner.
seed('SEN-T9')
healthy()
store.commit()
r = store.getRace('SEN-T9')
ok('leader with no call stays uncalled', r.leader === 'c-dem' && r.call === null)

// Bad votes from civic fall back to NYT.
store.observe('SEN-T10', { office: 'S', label: 'T10' }, 'civic', {
  votes: {
    pctIn: 80,
    candidates: [
      { id: 'd', name: 'Dee Dem', party: 'D', votes: 0 },      // major party at zero while counting
      { id: 'r', name: 'Ron Rep', party: 'R', votes: 9000 },
    ],
  },
})
store.observe('SEN-T10', null, 'nyt', {
  votes: {
    pctIn: 80,
    candidates: [
      { id: 'd', name: 'Dee Dem', party: 'D', votes: 8500 },
      { id: 'r', name: 'Ron Rep', party: 'R', votes: 9000 },
    ],
  },
})
store.commit()
r = store.getRace('SEN-T10')
ok('zero-major-party civic reading falls back to NYT votes',
  r.votesFrom === 'nyt' && r.candidates.find(c => c.id === 'd').votes === 8500,
  `${r.votesFrom} ${JSON.stringify(r.candidates)}`)

console.log(`\n${pass} passed, ${fail} failed\n`)
process.exit(fail ? 1 : 0)
